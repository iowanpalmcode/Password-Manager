// ========== Global State ==========
let currentUser = null
let currentBank = null
let authToken = null
let passwordEditingId = null
// Undo backups
let lastDeletedPassword = null
let lastClearedPasswords = null
let snackbarTimer = null
// Roles cache for quick edit
let rolesCache = {}

const API_BASE = "http://localhost:5500/api"

// ========== Initialization ==========
document.addEventListener("DOMContentLoaded", async () => {
    // Check if user is already logged in
    const savedToken = localStorage.getItem("authToken")
    if (savedToken) {
        authToken = savedToken
        await loadCurrentUser()
    }

    // Set up event listeners
    setupEventListeners()
})

function setupEventListeners() {
    // Auth Form
    document.getElementById("loginForm").addEventListener("submit", handleLogin)
    document.getElementById("registerForm").addEventListener("submit", handleRegister)
    document.getElementById("toggleAuthLink").addEventListener("click", toggleAuthForm)

    // Password Form
    document.getElementById("passwordForm").addEventListener("submit", handlePasswordSubmit)

    // Help button
    document.getElementById("help").addEventListener("mouseover", () => {
        document.getElementById("helpDesc").classList.add("active")
    })
    document.getElementById("help").addEventListener("mouseout", () => {
        document.getElementById("helpDesc").classList.remove("active")
    })

    // User avatar dropdown
    document.getElementById("userAvatar").addEventListener("click", (e) => {
        document.getElementById("dropdownMenu").classList.toggle("active")
    })

    // Close dropdown when clicking elsewhere
    document.addEventListener("click", (e) => {
        const dropdown = document.getElementById("dropdownMenu")
        const avatar = document.getElementById("userAvatar")
        if (!dropdown.contains(e.target) && !avatar.contains(e.target)) {
            dropdown.classList.remove("active")
        }
    })

    // Search and filter
    document.getElementById("searchInput").addEventListener("input", filterPasswords)
    document.getElementById("categoryFilter").addEventListener("change", filterPasswords)

    // Create bank modal form
    const createBankForm = document.getElementById("createBankForm")
    if (createBankForm) createBankForm.addEventListener("submit", handleCreateBank)
    // Roles form
    const addRoleForm = document.getElementById("addRoleForm")
    if (addRoleForm) addRoleForm.addEventListener("submit", handleAddRole)

    // Password show toggle
    const pwdToggle = document.getElementById("passwordShowToggle")
    if (pwdToggle) pwdToggle.addEventListener("change", (e) => {
        const input = document.getElementById("passwordPassword")
        input.type = e.target.checked ? "text" : "password"
    })
    // Password strength live indicator
    const pwdInput = document.getElementById('passwordPassword')
    if (pwdInput) pwdInput.addEventListener('input', (e) => {
        const val = e.target.value || ''
        const el = document.getElementById('passwordStrength')
        if (!el) return
        updatePasswordStrengthUI(val)
    })
}

// ========== Authentication ==========
function toggleAuthForm() {
    const loginForm = document.getElementById("loginForm")
    const registerForm = document.getElementById("registerForm")
    const authTitle = document.getElementById("authTitle")
    const authSubtitle = document.getElementById("authSubtitle")
    const toggleText = document.getElementById("toggleText")
    const toggleLink = document.getElementById("toggleAuthLink")

    if (loginForm.style.display === "none") {
        // Switch to login
        loginForm.style.display = "block"
        registerForm.style.display = "none"
        authTitle.textContent = "Login"
        authSubtitle.textContent = "Manage your passwords securely"
        toggleText.textContent = "Don't have an account?"
        toggleLink.textContent = "Register"
    } else {
        // Switch to register
        loginForm.style.display = "none"
        registerForm.style.display = "block"
        authTitle.textContent = "Create Account"
        authSubtitle.textContent = "Join the password manager"
        toggleText.textContent = "Already have an account?"
        toggleLink.textContent = "Login"
    }

    document.getElementById("authError").textContent = ""
    document.getElementById("authError").style.display = "none"
}

async function handleLogin(e) {
    e.preventDefault()
    const email = document.getElementById("loginEmail").value
    const password = document.getElementById("loginPassword").value
    const errorEl = document.getElementById("authError")

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        })

        const data = await response.json()

        if (!response.ok) {
            errorEl.textContent = data.message || "Login failed"
            errorEl.style.display = "block"
            return
        }

        authToken = data.token
        localStorage.setItem("authToken", authToken)
        await loadCurrentUser()
    } catch (error) {
        errorEl.textContent = "Error logging in. Please try again."
        errorEl.style.display = "block"
    }
}

async function handleRegister(e) {
    e.preventDefault()
    const username = document.getElementById("registerUsername").value
    const email = document.getElementById("registerEmail").value
    const password = document.getElementById("registerPassword").value
    const passwordConfirm = document.getElementById("registerPasswordConfirm").value
    const errorEl = document.getElementById("authError")

    if (password !== passwordConfirm) {
        errorEl.textContent = "Passwords do not match"
        errorEl.style.display = "block"
        return
    }

    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password, passwordConfirm })
        })

        const data = await response.json()

        if (!response.ok) {
            errorEl.textContent = data.message || "Registration failed"
            errorEl.style.display = "block"
            return
        }

        authToken = data.token
        localStorage.setItem("authToken", authToken)
        await loadCurrentUser()
    } catch (error) {
        errorEl.textContent = "Error registering. Please try again."
        errorEl.style.display = "block"
    }
}

async function loadCurrentUser() {
    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            headers: { "Authorization": `Bearer ${authToken}` }
        })

        if (!response.ok) {
            logout()
            return
        }

        const data = await response.json()
        currentUser = data.user

        // Update UI
        hideAuthScreen()
        showWelcomeScreen()
        updateUserMenu()
    } catch (error) {
        console.error("Error loading user:", error)
        logout()
    }
}

function logout() {
    currentUser = null
    authToken = null
    currentBank = null
    localStorage.removeItem("authToken")
    showAuthScreen()
}

function hideAuthScreen() {
    document.getElementById("authContainer").style.display = "none"
}

function showAuthScreen() {
    document.getElementById("authContainer").style.display = "flex"
    document.getElementById("welcomeContainer").style.display = "none"
    document.getElementById("mainContainer").classList.remove("active")
    document.getElementById("bankContainer").classList.remove("active")
    document.getElementById("settingsContainer").classList.remove("active")
    document.getElementById("header").classList.remove("active")
}

function showWelcomeScreen() {
    document.getElementById("authContainer").style.display = "none"
    document.getElementById("welcomeContainer").style.display = "flex"
}

function updateUserMenu() {
    if (currentUser) {
        const initial = currentUser.username.charAt(0).toUpperCase()
        document.getElementById("userAvatar").textContent = initial
    }
}

// ========== Navigation ==========
async function goToBanks() {
    document.getElementById("welcomeContainer").style.display = "none"
    document.getElementById("header").classList.add("active")
    document.getElementById("mainContainer").classList.add("active")
    document.getElementById("bankContainer").classList.remove("active")
    document.getElementById("settingsContainer").classList.remove("active")
    document.getElementById("dropdownMenu").classList.remove("active")

    await loadBanks()
    // Hide add-password and bank controls
    const addBtn = document.getElementById("addPasswordBtn")
    if (addBtn) addBtn.style.display = "none"
    const clearBtn = document.getElementById("clearPasswordsBtn")
    if (clearBtn) clearBtn.style.display = "none"
    const delBtn = document.getElementById("deleteBankBtn")
    if (delBtn) delBtn.style.display = "none"
}

async function goToSettings() {
    document.getElementById("welcomeContainer").style.display = "none"
    document.getElementById("header").classList.add("active")
    document.getElementById("mainContainer").classList.remove("active")
    document.getElementById("bankContainer").classList.remove("active")
    document.getElementById("settingsContainer").classList.add("active")
    document.getElementById("dropdownMenu").classList.remove("active")

    updateSettingsScreen()
}

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll(".tab-content").forEach(tab => tab.style.display = "none")

    // Remove active class from all tabs
    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"))

    // Show selected tab
    document.getElementById(tabName + "Tab").style.display = "block"

    // Add active class to clicked tab
    event.target.classList.add("active")

    if (tabName === "members") {
        loadBankMembers()
    } else if (tabName === "settings") {
        loadRolesAndPermissions()
    }
}

// ========== Banks Management ==========
async function loadBanks() {
    try {
        const response = await fetch(`${API_BASE}/banks`, {
            headers: { "Authorization": `Bearer ${authToken}` }
        })

        const data = await response.json()
        const grid = document.getElementById("banksGrid")
        grid.innerHTML = ""

        if (data.banks && data.banks.length > 0) {
            data.banks.forEach(bank => {
                const card = document.createElement("div")
                card.className = "bank-card"
                card.onclick = () => openBank(bank._id, bank)
                card.innerHTML = `
                    <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                        <div style="display:flex; gap:12px; align-items:center;">
                            <div class="bank-icon">${bank.icon || "🏦"}</div>
                            <div>
                                <h3>${bank.name}</h3>
                                <p style="margin:0;">${bank.description || "No description"}</p>
                            </div>
                        </div>
                        <div style="display:flex; gap:8px; align-items:center;">
                            <div class="bank-members">${bank.members.length} member(s)</div>
                            <button class="small-btn" onclick="event.stopPropagation(); deleteBankPrompt('${bank._id}')">Delete</button>
                        </div>
                    </div>
                `
                grid.appendChild(card)
            })
        } else {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 50px; color: rgb(150,150,150);">No banks yet. Create one to get started!</p>'
        }
    } catch (error) {
        console.error("Error loading banks:", error)
    }
}

async function openBank(bankId, bankData) {
    // Fetch full bank data from server to get members/roles
    try {
        const resp = await fetch(`${API_BASE}/banks/${bankId}`, { headers: { "Authorization": `Bearer ${authToken}` } })
        if (!resp.ok) return alert("Unable to open bank")
        const payload = await resp.json()
        currentBank = payload.bank
    } catch (err) {
        console.error(err)
        return
    }
    document.getElementById("mainContainer").classList.remove("active")
    document.getElementById("bankContainer").classList.add("active")
    document.getElementById("settingsContainer").classList.remove("active")

    document.getElementById("bankName").textContent = currentBank.name
    document.getElementById("bankIcon").textContent = currentBank.icon || "🏦"

    // Show Add Password button only when in a bank
    const addBtn = document.getElementById("addPasswordBtn")
    if (addBtn) addBtn.style.display = "block"

    // Show clear/delete buttons for owner
    const isOwner = currentBank.ownerId && currentBank.ownerId.toString() === currentUser._id
    document.getElementById("clearPasswordsBtn").style.display = isOwner ? "inline-block" : "none"
    document.getElementById("deleteBankBtn").style.display = isOwner ? "inline-block" : "none"

    // Reset tabs
    document.querySelectorAll(".tab-content").forEach(tab => tab.style.display = "none")
    document.getElementById("passwordsTab").style.display = "block"
    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"))
    document.querySelector(".tab").classList.add("active")

    await loadPasswords()
}

async function loadPasswords() {
    if (!currentBank) return

    try {
        const response = await fetch(`${API_BASE}/passwords/${currentBank._id}`, {
            headers: { "Authorization": `Bearer ${authToken}` }
        })

        if (!response.ok) {
            document.getElementById("noPasswordsError").style.display = "block"
            document.getElementById("passwordsBoxes").innerHTML = ""
            return
        }

        const data = await response.json()
        const container = document.getElementById("passwordsBoxes")
        container.innerHTML = ""

        if (data.passwords && data.passwords.length > 0) {
            document.getElementById("noPasswordsError").style.display = "none"
            data.passwords.forEach(pwd => {
                const box = createPasswordBox(pwd)
                container.appendChild(box)
            })
        } else {
            document.getElementById("noPasswordsError").style.display = "block"
        }
    } catch (error) {
        console.error("Error loading passwords:", error)
    }
}

function createPasswordBox(password) {
    const box = document.createElement("div")
    box.className = "box"
    box.setAttribute('data-password-id', password._id)
    box.setAttribute('data-username', password.username)
    box.setAttribute('data-password', password.password)
    box.setAttribute('data-title', password.title)
    box.setAttribute('data-category', password.category || 'General')
    box.setAttribute('data-notes', password.notes || '')

    box.innerHTML = `
        <div class="box-header">
            <h2 class="boxTitle">${password.title}</h2>
            <img class="boxMenu" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Ccircle cx='12' cy='5' r='1'/%3E%3Ccircle cx='12' cy='12' r='1'/%3E%3Ccircle cx='12' cy='19' r='1'/%3E%3C/svg%3E" onclick="toggleBoxMenu(event)">
            <div class="box-menu-dropdown">
                <div class="box-menu-item" onclick="editPassword('${password._id}')">Edit</div>
                <div class="box-menu-item delete" onclick="deletePassword('${password._id}')">Delete</div>
            </div>
        </div>
        <p class="boxp"><span class="boxp-label">Username:</span> ${password.username}</p>
        <p class="boxp"><span class="boxp-label">Password:</span> <span class="masked">••••••••</span> <button class="small-btn" onclick="revealPassword('${password._id}', this)">Reveal</button></p>
        <div class="box-category">${password.category || "General"}</div>
        ${password.notes ? `<div class="box-notes">📝 ${password.notes}</div>` : ""}
    `
    return box
}

function revealPassword(passwordId, btn) {
    const box = document.querySelector(`[data-password-id="${passwordId}"]`)
    if (!box) return
    const masked = box.querySelector('.masked')
    if (!masked) return
    const pwd = box.getAttribute('data-password')
    if (masked.textContent.includes('•')) {
        masked.textContent = pwd
        btn.textContent = 'Hide'
    } else {
        masked.textContent = '••••••••'
        btn.textContent = 'Reveal'
    }
}

function toggleBoxMenu(event) {
    event.stopPropagation()
    const menu = event.target.nextElementSibling
    if (menu) {
        menu.classList.toggle("active")
    }

    // Close other menus
    document.querySelectorAll(".box-menu-dropdown").forEach(m => {
        if (m !== menu) {
            m.classList.remove("active")
        }
    })
}

// ========== Password Management ==========
function formToggle() {
    const form = document.getElementById("formToAddPassword")
    form.classList.toggle("active")
    if (!form.classList.contains("active")) {
        resetPasswordForm()
    }
}

async function handlePasswordSubmit(e) {
    e.preventDefault()

    const title = document.getElementById("passwordTitle").value
    const username = document.getElementById("passwordUsername").value
    const password = document.getElementById("passwordPassword").value
    const category = document.getElementById("passwordCategory").value
    const notes = document.getElementById("passwordNotes").value
    const errorEl = document.getElementById("errorAddingPassword")

    if (!title || !username || !password) {
        errorEl.textContent = "Please fill in all required fields"
        errorEl.classList.add("show")
        return
    }

    try {
        if (passwordEditingId) {
            // Update existing password
            const response = await fetch(`${API_BASE}/passwords/${currentBank._id}/${passwordEditingId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${authToken}`
                },
                body: JSON.stringify({ title, username, password, category, notes })
            })

            const data = await response.json()
            if (!response.ok) {
                errorEl.textContent = data.message || "Error updating password"
                errorEl.classList.add("show")
                return
            }
        } else {
            // Add new password
            const response = await fetch(`${API_BASE}/passwords/${currentBank._id}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${authToken}`
                },
                body: JSON.stringify({ title, username, password, category, notes })
            })

            const data = await response.json()
            if (!response.ok) {
                errorEl.textContent = data.message || "Error adding password"
                errorEl.classList.add("show")
                return
            }
        }

        formToggle()
        resetPasswordForm()
        await loadPasswords()
    } catch (error) {
        errorEl.textContent = "Error saving password"
        errorEl.classList.add("show")
    }
}

function resetPasswordForm() {
    document.getElementById("passwordForm").reset()
    document.getElementById("formTitle").textContent = "Add Password"
    document.getElementById("errorAddingPassword").classList.remove("show")
    document.getElementById("errorAddingPassword").textContent = ""
    passwordEditingId = null
    // reset strength UI
    updatePasswordStrengthUI('')
}

async function editPassword(passwordId) {
    // Populate form with existing password details stored on the box
    const box = document.querySelector(`[data-password-id="${passwordId}"]`)
    if (!box) return
    const title = box.getAttribute('data-title')
    const username = box.getAttribute('data-username')
    const password = box.getAttribute('data-password')
    const category = box.getAttribute('data-category')
    const notes = box.getAttribute('data-notes')

    document.getElementById("passwordTitle").value = title
    document.getElementById("passwordUsername").value = username
    document.getElementById("passwordPassword").value = password
    document.getElementById("passwordCategory").value = category
    document.getElementById("passwordNotes").value = notes

    // Ensure password field is masked by default
    const pwdToggle = document.getElementById('passwordShowToggle')
    if (pwdToggle) { pwdToggle.checked = false; document.getElementById('passwordPassword').type = 'password' }

    formToggle()
    passwordEditingId = passwordId
    document.getElementById("formTitle").textContent = "Edit Password"
    // update strength UI for the populated password
    updatePasswordStrengthUI(password)
}

// Update the password strength label and visual bar
function updatePasswordStrengthUI(pw) {
    const score = calculatePasswordStrength(pw || '')
    const el = document.getElementById('passwordStrength')
    const bar = document.getElementById('passwordStrengthBar')
    if (!el) return
    el.textContent = score.label
    el.className = ''
    if (score.level === 1) el.classList.add('strength-weak')
    else if (score.level === 2) el.classList.add('strength-medium')
    else if (score.level === 3) el.classList.add('strength-strong')

    if (bar) {
        let pct = 0
        let color = '#ddd'
        if (score.level === 0) { pct = 0; color = '#ddd' }
        else if (score.level === 1) { pct = 30; color = '#d9534f' }
        else if (score.level === 2) { pct = 65; color = '#f0ad4e' }
        else if (score.level === 3) { pct = 100; color = '#5cb85c' }
        bar.style.width = pct + '%'
        bar.style.background = color
    }
}

async function deletePassword(passwordId) {
    if (!confirm("Are you sure you want to delete this password?")) return

    try {
        // backup from DOM if possible
        const box = document.querySelector(`[data-password-id="${passwordId}"]`)
        const backup = box ? {
            title: box.getAttribute('data-title'),
            username: box.getAttribute('data-username'),
            password: box.getAttribute('data-password'),
            category: box.getAttribute('data-category'),
            notes: box.getAttribute('data-notes')
        } : null

        lastDeletedPassword = { id: passwordId, bankId: currentBank._id, data: backup }

        const response = await fetch(`${API_BASE}/passwords/${currentBank._id}/${passwordId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${authToken}` }
        })

        if (response.ok) {
            await loadPasswords()
            showSnackbar('Password deleted', async () => {
                if (!lastDeletedPassword) return
                try {
                    await fetch(`${API_BASE}/passwords/${lastDeletedPassword.bankId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                        body: JSON.stringify(lastDeletedPassword.data)
                    })
                    await loadPasswords()
                    lastDeletedPassword = null
                } catch (err) { console.error('Restore failed', err) }
            })
        }
    } catch (error) {
        console.error("Error deleting password:", error)
    }
}

function filterPasswords() {
    const searchTerm = document.getElementById("searchInput").value.toLowerCase()
    const category = document.getElementById("categoryFilter").value
    const boxes = document.querySelectorAll(".box")

    boxes.forEach(box => {
        const title = box.querySelector(".boxTitle").textContent.toLowerCase()
        const boxCategory = box.querySelector(".box-category").textContent

        const matchesSearch = title.includes(searchTerm)
        const matchesCategory = category === "" || boxCategory.includes(category)

        box.style.display = matchesSearch && matchesCategory ? "flex" : "none"
    })
}

// Snackbar utilities
function showSnackbar(message, undoCb, timeout = 8000) {
    const snackbar = document.getElementById('snackbar')
    const msg = document.getElementById('snackbarMessage')
    const undo = document.getElementById('snackbarUndo')
    if (!snackbar || !msg || !undo) return

    msg.textContent = message
    snackbar.style.display = 'flex'

    if (snackbarTimer) clearTimeout(snackbarTimer)

    const close = () => { snackbar.style.display = 'none'; if (snackbarTimer) { clearTimeout(snackbarTimer); snackbarTimer = null } }

    undo.onclick = async () => {
        try {
            await undoCb()
        } finally {
            lastDeletedPassword = null
            lastClearedPasswords = null
            close()
        }
    }

    snackbarTimer = setTimeout(() => {
        snackbar.style.display = 'none'
        lastDeletedPassword = null
        lastClearedPasswords = null
        snackbarTimer = null
    }, timeout)
}

// Password strength calculation (simple heuristic)
function calculatePasswordStrength(pw) {
    let score = 0
    if (!pw) return { level: 0, label: '' }
    if (pw.length >= 8) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++

    if (score <= 1) return { level: 1, label: 'Weak' }
    if (score === 2) return { level: 2, label: 'Medium' }
    return { level: 3, label: 'Strong' }
}

// ========== Settings Screen ==========
function updateSettingsScreen() {
    if (!currentUser) return
    document.getElementById("settingsUsername").textContent = currentUser.username
    document.getElementById("settingsEmail").textContent = currentUser.email
    document.getElementById("settingsMemberSince").textContent = new Date().toLocaleDateString()

    // Fetch banks from API so Settings reflects the same banks shown on main screen
    const banksList = document.getElementById("userBanksList")
    banksList.innerHTML = "Loading..."
    try {
        const resp = await fetch(`${API_BASE}/banks`, { headers: { 'Authorization': `Bearer ${authToken}` } })
        if (!resp.ok) {
            banksList.innerHTML = '<div style="color:rgb(150,150,150)">No banks available</div>'
            return
        }
        const data = await resp.json()
        banksList.innerHTML = ''
        if (data.banks && data.banks.length > 0) {
            data.banks.forEach(bank => {
                const bankDiv = document.createElement('div')
                bankDiv.style.padding = '8px 0'
                bankDiv.innerHTML = `• ${bank.name}`
                banksList.appendChild(bankDiv)
            })
        } else {
            banksList.innerHTML = '<div style="color:rgb(150,150,150)">No banks yet</div>'
        }
    } catch (err) {
        console.error('Error loading banks for settings', err)
        banksList.innerHTML = '<div style="color:rgb(150,150,150)">Unable to load banks</div>'
    }
}

// ========== Bank Members Management ==========
async function loadBankMembers() {
    if (!currentBank) return

    try {
        const response = await fetch(`${API_BASE}/banks/${currentBank._id}`, {
            headers: { "Authorization": `Bearer ${authToken}` }
        })

        const data = await response.json()
        const tbody = document.getElementById("membersTableBody")
        tbody.innerHTML = ""

        data.bank.members.forEach(member => {
            const row = document.createElement("tr")
            row.innerHTML = `
                <td>${member.userId.username}</td>
                <td>${member.userId.email}</td>
                <td>${member.roleId.name}</td>
                <td><button class="role-action-btn">Change Role</button></td>
            `
            tbody.appendChild(row)
        })

        // Populate member role dropdown
        const memberRoleSelect = document.getElementById("memberRole")
        memberRoleSelect.innerHTML = '<option value="">Select a role...</option>'
        data.bank.roles.forEach(role => {
            const option = document.createElement("option")
            option.value = role._id
            option.textContent = role.name
            memberRoleSelect.appendChild(option)
        })
    } catch (error) {
        console.error("Error loading members:", error)
    }
}

function showAddMemberForm() {
    document.getElementById("addMemberModal").classList.add("active")
}

function hideAddMemberForm() {
    document.getElementById("addMemberModal").classList.remove("active")
    document.getElementById("addMemberForm").reset()
}

async function handleAddMember(event) {
    event.preventDefault()
    
    const email = document.getElementById("memberEmail").value
    const roleId = document.getElementById("memberRole").value

    if (!email || !roleId) {
        alert("Please fill in all fields")
        return
    }

    try {
        const response = await fetch(`${API_BASE}/banks/${currentBank._id}/invite`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({ email, roleId })
        })

        const data = await response.json()
        
        if (response.ok) {
            alert("Member invited successfully!")
            hideAddMemberForm()
            await loadBankMembers()
        } else {
            alert(data.message || "Failed to add member")
        }
    } catch (error) {
        console.error("Error adding member:", error)
        alert("Error adding member: " + error.message)
    }
}

// ========== Roles & Permissions Management ===========
async function loadRolesAndPermissions() {
    if (!currentBank) return

    try {
        const response = await fetch(`${API_BASE}/roles/${currentBank._id}`, {
            headers: { "Authorization": `Bearer ${authToken}` }
        })

        const data = await response.json()
        const tbody = document.getElementById("rolesTableBody")
        tbody.innerHTML = ""

        data.roles.forEach(role => {
            rolesCache[role._id] = role
            const row = document.createElement("tr")
            row.innerHTML = `
                <td>${role.name}</td>
                <td><input type="checkbox" class="permission-checkbox" ${role.permissions.canViewPasswords ? "checked" : ""} disabled></td>
                <td><input type="checkbox" class="permission-checkbox" ${role.permissions.canAddPasswords ? "checked" : ""} disabled></td>
                <td><input type="checkbox" class="permission-checkbox" ${role.permissions.canEditPasswords ? "checked" : ""} disabled></td>
                <td><input type="checkbox" class="permission-checkbox" ${role.permissions.canDeletePasswords ? "checked" : ""} disabled></td>
                <td><input type="checkbox" class="permission-checkbox" ${role.permissions.canManageUsers ? "checked" : ""} disabled></td>
                <td><input type="checkbox" class="permission-checkbox" ${role.permissions.canManageSettings ? "checked" : ""} disabled></td>
                <td style="white-space:nowrap;">
                    <button class="small-btn" onclick="editRole('${role._id}')">Edit</button>
                    <button class="small-btn danger" onclick="deleteRole('${role._id}')">Delete</button>
                </td>
            `
            tbody.appendChild(row)
        })
    } catch (error) {
        console.error("Error loading roles:", error)
    }
}

function showAddRoleForm() {
    document.getElementById('addRoleModal').classList.add('active')
    document.getElementById('roleModalTitle').textContent = 'Add Role'
    document.getElementById('roleIdInput').value = ''
    document.getElementById('roleNameInput').value = ''
    document.getElementById('permView').checked = true
    document.getElementById('permAdd').checked = true
    document.getElementById('permEdit').checked = true
    document.getElementById('permDelete').checked = true
    document.getElementById('permManageUsers').checked = false
    document.getElementById('permManageSettings').checked = false
    resetRoleCategorySelections()
}

// populate view-all and categories defaults
function resetRoleCategorySelections() {
    const catEls = Array.from(document.querySelectorAll('.permCategory'))
    catEls.forEach(c => c.checked = false)
    const viewAll = document.getElementById('permViewAll')
    if (viewAll) viewAll.checked = false
}

function hideAddRoleForm() {
    const modal = document.getElementById('addRoleModal')
    if (modal) modal.classList.remove('active')
    const form = document.getElementById('addRoleForm')
    if (form) form.reset()
}

async function handleAddRole(e) {
    e.preventDefault()
    if (!currentBank) return alert('Open a bank first')
    const roleId = document.getElementById('roleIdInput').value
    const name = document.getElementById('roleNameInput').value
    const canViewAll = !!document.getElementById('permViewAll').checked
    // gather selected categories
    const catEls = Array.from(document.querySelectorAll('.permCategory'))
    const selectedCats = catEls.filter(c => c.checked).map(c => c.value)

    const permissions = {
        canViewPasswords: !!document.getElementById('permView').checked,
        canViewAll,
        viewCategories: selectedCats,
        canAddPasswords: !!document.getElementById('permAdd').checked,
        canEditPasswords: !!document.getElementById('permEdit').checked,
        canDeletePasswords: !!document.getElementById('permDelete').checked,
        canManageUsers: !!document.getElementById('permManageUsers').checked,
        canManageSettings: !!document.getElementById('permManageSettings').checked,
    }

    try {
        let url = `${API_BASE}/roles/${currentBank._id}`
        let method = 'POST'
        if (roleId) { url = `${url}/${roleId}`; method = 'PUT' }

        const resp = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ name, permissions })
        })
        const payload = await resp.json()
        if (!resp.ok) return alert(payload.message || 'Failed to save role')
        hideAddRoleForm()
        await loadRolesAndPermissions()
        await loadBankMembers()
    } catch (err) {
        console.error('Error saving role', err)
        alert('Error saving role')
    }
}

function editRole(roleId) {
    const role = rolesCache[roleId]
    if (!role) return alert('Role not found')
    document.getElementById('roleModalTitle').textContent = 'Edit Role'
    document.getElementById('roleIdInput').value = role._id
    document.getElementById('roleNameInput').value = role.name
    document.getElementById('permView').checked = !!role.permissions.canViewPasswords
    document.getElementById('permViewAll').checked = !!(role.permissions.canViewAll)
    // populate category checkboxes
    resetRoleCategorySelections()
    if (Array.isArray(role.permissions.viewCategories)) {
        role.permissions.viewCategories.forEach(cat => {
            const el = document.querySelector(`.permCategory[value="${cat}"]`)
            if (el) el.checked = true
        })
    }
    document.getElementById('permAdd').checked = !!role.permissions.canAddPasswords
    document.getElementById('permEdit').checked = !!role.permissions.canEditPasswords
    document.getElementById('permDelete').checked = !!role.permissions.canDeletePasswords
    document.getElementById('permManageUsers').checked = !!role.permissions.canManageUsers
    document.getElementById('permManageSettings').checked = !!role.permissions.canManageSettings
    document.getElementById('addRoleModal').classList.add('active')
}

async function deleteRole(roleId) {
    if (!confirm('Delete this role? This will affect all members assigned to it.')) return
    try {
        const resp = await fetch(`${API_BASE}/roles/${currentBank._id}/${roleId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${authToken}` } })
        const payload = await resp.json()
        if (!resp.ok) return alert(payload.message || 'Failed to delete role')
        delete rolesCache[roleId]
        await loadRolesAndPermissions()
        await loadBankMembers()
    } catch (err) { console.error('Error deleting role', err); alert('Error deleting role') }
}

// ========== Bank Creation ==========
function showCreateBankForm() {
    const modal = document.getElementById("createBankModal")
    if (modal) modal.classList.add("active")
}

function hideCreateBankForm() {
    const modal = document.getElementById("createBankModal")
    if (modal) modal.classList.remove("active")
    const form = document.getElementById("createBankForm")
    if (form) form.reset()
}

async function handleCreateBank(e) {
    e.preventDefault()
    const name = document.getElementById("bankNameInput").value
    const description = document.getElementById("bankDescription").value
    const icon = document.getElementById("bankIconInput").value

    if (!name) return alert("Please enter a bank name")

    await createBank(name, description || "", icon || "🏦")
    hideCreateBankForm()
}

async function createBank(name, description, icon) {
    try {
        console.log("Creating bank with token:", authToken?.substring(0, 20) + "...")
        const response = await fetch(`${API_BASE}/banks`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({ name, description, icon })
        })

        const data = await response.json()
        console.log("Bank creation response:", data)

        if (response.ok) {
            await loadBanks()
        } else {
            console.error("Bank creation failed:", data.message)
            alert(data.message || "Failed to create bank")
        }
    } catch (error) {
        console.error("Error creating bank:", error)
    }
}

// Delete bank with confirmation (used from list)
function deleteBankPrompt(bankId) {
    if (!confirm("Delete this bank? This will remove it for all members.")) return
    deleteBank(bankId)
}

async function deleteBank(bankId) {
    try {
        const resp = await fetch(`${API_BASE}/banks/${bankId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${authToken}` } })
        const data = await resp.json()
        if (!resp.ok) return alert(data.message || 'Failed to delete bank')
        // Refresh bank list
        await loadBanks()
        // If current bank was deleted, navigate back
        if (currentBank && currentBank._id === bankId) goToBanks()

        // Show undo snackbar which calls restore endpoint
        showSnackbar('Bank deleted', async () => {
            try {
                const r = await fetch(`${API_BASE}/banks/${bankId}/restore`, { method: 'POST', headers: { 'Authorization': `Bearer ${authToken}` } })
                const payload = await r.json()
                if (!r.ok) return alert(payload.message || 'Failed to restore bank')
                await loadBanks()
            } catch (err) { console.error('Restore failed', err) }
        }, 10000)
    } catch (err) {
        console.error(err)
        alert('Error deleting bank')
    }
}

async function deleteCurrentBank() {
    if (!currentBank) return
    if (!confirm('Delete this bank and all its data?')) return
    await deleteBank(currentBank._id)
}

async function clearBankPasswords() {
    if (!currentBank) return
    if (!confirm('Clear ALL passwords in this bank? This cannot be undone.')) return
    try {
        // backup existing passwords
        const getResp = await fetch(`${API_BASE}/passwords/${currentBank._id}`, { headers: { 'Authorization': `Bearer ${authToken}` } })
        const getData = await getResp.json()
        lastClearedPasswords = getData.passwords || []

        const resp = await fetch(`${API_BASE}/banks/${currentBank._id}/passwords`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${authToken}` } })
        const data = await resp.json()
        if (!resp.ok) return alert(data.message || 'Failed to clear passwords')
        await loadPasswords()
        showSnackbar(`Cleared ${lastClearedPasswords.length} passwords`, async () => {
            if (!lastClearedPasswords) return
            try {
                for (const p of lastClearedPasswords) {
                    await fetch(`${API_BASE}/passwords/${currentBank._id}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                        body: JSON.stringify({ title: p.title, username: p.username, password: p.password, category: p.category, notes: p.notes })
                    })
                }
                await loadPasswords()
                lastClearedPasswords = null
            } catch (err) { console.error('Restore failed', err) }
        })
    } catch (err) {
        console.error(err)
        alert('Error clearing passwords')
    }
}


