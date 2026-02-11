import express from "express"
import Password from "../models/Password.js"
import Bank from "../models/Bank.js"
import { verifyToken } from "./auth.js"

const router = express.Router()

// Middleware to check password permissions
const checkPermission = async (req, res, next, permission) => {
    try {
        const bank = await Bank.findById(req.params.bankId).populate("members.roleId")
        const member = bank.members.find(m => m.userId.toString() === req.userId.toString())

        if (!member) {
            return res.status(403).json({ message: "You are not a member of this bank" })
        }

        const role = member.roleId
        if (!role.permissions[permission]) {
            return res.status(403).json({ message: "You do not have permission for this action" })
        }

        next()
    } catch (error) {
        return res.status(500).json({ message: error.message })
    }
}

// Add password to bank
router.post("/:bankId", verifyToken, async (req, res, next) => {
    await checkPermission(req, res, next, "canAddPasswords")
}, async (req, res) => {
    try {
        const { title, username, password, category, notes } = req.body

        if (!title || !username || !password) {
            return res.status(400).json({ message: "Title, username, and password are required" })
        }

        const newPassword = await Password.create({
            title,
            username,
            password,
            category: category || "General",
            bankId: req.params.bankId,
            createdBy: req.userId,
            notes: notes || ""
        })

        return res.status(201).json({
            message: "Password added successfully",
            password: newPassword
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: error.message })
    }
})

// Get all passwords for a bank
router.get("/:bankId", verifyToken, async (req, res, next) => {
    await checkPermission(req, res, next, "canViewPasswords")
}, async (req, res) => {
    try {
        // Determine role scoping for this user
        const bank = await Bank.findById(req.params.bankId).populate('members.roleId')
        const member = bank.members.find(m => m.userId.toString() === req.userId.toString())
        const role = member.roleId

        let query = { bankId: req.params.bankId }
        if (role && role.permissions) {
            if (!role.permissions.canViewAll && Array.isArray(role.permissions.viewCategories) && role.permissions.viewCategories.length > 0) {
                query.category = { $in: role.permissions.viewCategories }
            }
        }

        const passwords = await Password.find(query).populate("createdBy", "username")

        return res.status(200).json({ passwords })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: error.message })
    }
})

// Get passwords by category
router.get("/:bankId/category/:category", verifyToken, async (req, res, next) => {
    await checkPermission(req, res, next, "canViewPasswords")
}, async (req, res) => {
    try {
        const passwords = await Password.find({
            bankId: req.params.bankId,
            category: req.params.category
        }).populate("createdBy", "username")

        return res.status(200).json({
            passwords
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: error.message })
    }
})

// Update password
router.put("/:bankId/:passwordId", verifyToken, async (req, res, next) => {
    await checkPermission(req, res, next, "canEditPasswords")
}, async (req, res) => {
    try {
        const { title, username, password, category, notes } = req.body

        const updatedPassword = await Password.findByIdAndUpdate(
            req.params.passwordId,
            {
                title,
                username,
                password,
                category,
                notes,
                updatedAt: Date.now()
            },
            { new: true }
        ).populate("createdBy", "username")

        if (!updatedPassword) {
            return res.status(404).json({ message: "Password not found" })
        }

        return res.status(200).json({
            message: "Password updated successfully",
            password: updatedPassword
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: error.message })
    }
})

// Delete password
router.delete("/:bankId/:passwordId", verifyToken, async (req, res, next) => {
    await checkPermission(req, res, next, "canDeletePasswords")
}, async (req, res) => {
    try {
        const password = await Password.findByIdAndDelete(req.params.passwordId)

        if (!password) {
            return res.status(404).json({ message: "Password not found" })
        }

        return res.status(200).json({
            message: "Password deleted successfully"
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: error.message })
    }
})

export default router
