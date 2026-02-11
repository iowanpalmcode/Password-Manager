import express from "express"
import jwt from "jsonwebtoken"
import User from "../models/User.js"
import Bank from "../models/Bank.js"
import Role from "../models/Role.js"

const router = express.Router()

// Middleware to verify JWT token
export const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1]
    if (!token) {
        return res.status(401).json({ message: "No token provided" })
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key")
        req.userId = decoded.userId
        next()
    } catch (error) {
        return res.status(401).json({ message: "Invalid token" })
    }
}

// Register endpoint
router.post("/register", async (req, res) => {
    try {
        const { username, email, password, passwordConfirm } = req.body

        if (!username || !email || !password || !passwordConfirm) {
            return res.status(400).json({ message: "Please provide all required fields" })
        }

        if (password !== passwordConfirm) {
            return res.status(400).json({ message: "Passwords do not match" })
        }

        const userExists = await User.findOne({ $or: [{ email }, { username }] })
        if (userExists) {
            return res.status(400).json({ message: "User already exists" })
        }

        const user = await User.create({
            username,
            email,
            password
        })

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || "your-secret-key", { expiresIn: "7d" })

        return res.status(201).json({
            message: "User created successfully",
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: error.message })
    }
})

// Login endpoint
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            return res.status(400).json({ message: "Please provide email and password" })
        }

        const user = await User.findOne({ email }).select("+password").populate("bankMemberships.bankId")

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: "Invalid email or password" })
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || "your-secret-key", { expiresIn: "7d" })

        return res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                banks: user.bankMemberships
            }
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: error.message })
    }
})

// Get current user
router.get("/me", verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).populate("bankMemberships.bankId bankMemberships.roleId")

        return res.status(200).json({
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                banks: user.bankMemberships
            }
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: error.message })
    }
})

// Update current user's profile (username/email/theme)
router.put("/me", verifyToken, async (req, res) => {
    try {
        const { username, email } = req.body
        const user = await User.findById(req.userId)
        if (!user) return res.status(404).json({ message: 'User not found' })

        if (username && username !== user.username) {
            const exists = await User.findOne({ username })
            if (exists) return res.status(400).json({ message: 'Username already taken' })
            user.username = username
        }

        if (email && email !== user.email) {
            const exists = await User.findOne({ email })
            if (exists) return res.status(400).json({ message: 'Email already in use' })
            user.email = email
        }

        await user.save()
        return res.status(200).json({ message: 'Profile updated', user: { id: user._id, username: user.username, email: user.email } })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: error.message })
    }
})

// Change password
router.put('/me/password', verifyToken, async (req, res) => {
    try {
        const { currentPassword, newPassword, newPasswordConfirm } = req.body
        if (!currentPassword || !newPassword || !newPasswordConfirm) return res.status(400).json({ message: 'Please provide all password fields' })
        if (newPassword !== newPasswordConfirm) return res.status(400).json({ message: 'New passwords do not match' })

        const user = await User.findById(req.userId).select('+password')
        if (!user) return res.status(404).json({ message: 'User not found' })

        if (!(await user.comparePassword(currentPassword))) {
            return res.status(401).json({ message: 'Current password is incorrect' })
        }

        user.password = newPassword
        await user.save()

        return res.status(200).json({ message: 'Password changed successfully' })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: error.message })
    }
})

export default router
