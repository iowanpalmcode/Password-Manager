let rot = 0
const form = document.querySelector(".formToAddPassword")
const help = document.querySelector(".help")
const helpDescription = document.querySelector(".helpDesc")

document.querySelector(".addPassword").addEventListener('click', () => {
    
})



// Help hover functionality 
help.addEventListener('mouseover', () => {
    helpDescription.style.display = "block"
})
help.addEventListener('mouseout', () => {
    helpDescription.style.display = "none"
})

//addPasswordForm toggle functionality
function formToggle() {
    if(rot === 0){
        form.style.display = "flex"
        rot = 1
    } else{
        form.style.display = "none"
        rot = 0
    }
}

function addPassword(title, username, password) {
    const boxes = document.querySelector(".boxes")
    const newBox = document.createElement("div")
    newBox.classList.add("box")
    const newTitle = document.createElement("h2")
    newTitle.textContent = title
    newTitle.classList.add("boxTitle")
    newBox.appendChild(newTitle)
    const newUsername = document.createElement("p")
    newUsername.textContent = "Username: " + username
    newUsername.classList.add("boxp")
    newBox.appendChild(newUsername)
    const newPassword = document.createElement("p")
    newPassword.textContent = "Password: " + password
    newPassword.classList.add("boxp")
    newBox.appendChild(newPassword)
    const boxMenu = document.createElement("img")
    boxMenu.classList.add("boxMenu")
    boxMenu.src = "./src/menu-vertical-svgrepo-com (1).svg"
    newBox.appendChild(boxMenu)
    boxes.appendChild(newBox)
    document.querySelector(".noPasswordsError").style.display = "none"

}

//addPasswordForm functionality
function addPasswordSubmit() {
    const title = document.querySelector(".titlef")
    const username = document.querySelector(".usernamef")
    const password = document.querySelector(".passwordf")
    if (title.value != "" && username.value != "" && password.value != "") {
        addPassword(title.value, username.value, password.value)
        formToggle()
        document.querySelector(".errorAddingPassword").style.display = "none"
        title.value = ""
        username.value = ""
        password.value = ""
        } else {
        document.querySelector(".errorAddingPassword").style.display = "block"
    }
}


