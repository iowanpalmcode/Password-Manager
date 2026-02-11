import express from "express"
import Bank from "../models/Bank.js"
import User from "../models/User.js"
import Role from "../models/Role.js"
import Password from "../models/Password.js"
import { verifyToken } from "./auth.js"

const router = express.Router()

// Create a new bank
router.post("/", verifyToken, async (req, res) => {
    try {
        const { name, description, icon } = req.body

        if (!name) {
            return res.status(400).json({ message: "Bank name is required" })
        }

        // Create bank first
        const bank = await Bank.create({
            name,
            description: description || "",
            icon: icon || "🏦",
            ownerId: req.userId,
            members: [],
            roles: []
        })

        // Create default roles for the bank (now that bank exists)
        const topLevel = await Role.create({
            name: "Top Level",
            bankId: bank._id,
            permissions: {
                canViewPasswords: true,
                canAddPasswords: true,
                canEditPasswords: true,
                canDeletePasswords: true,
                canManageUsers: true,
                canManageRoles: true,
                canManageSettings: true,
                canChangePermissions: true,
                canViewAll: true,
                viewCategories: []
            }
        })

        // Update bank with role and member
        bank.members.push({ userId: req.userId, roleId: topLevel._id })
        bank.roles.push(topLevel._id)
        await bank.save()

        // Add bank to user's memberships
        await User.findByIdAndUpdate(
            req.userId,
            { $push: { bankMemberships: { bankId: bank._id, roleId: topLevel._id } } }
        )

        return res.status(201).json({
            message: "Bank created successfully",
            bank
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: error.message })
    }
})

// Delete all passwords for a bank
router.delete("/:bankId/passwords", verifyToken, async (req, res) => {
    try {
        const bank = await Bank.findById(req.params.bankId).populate("members.roleId")
        if (!bank) return res.status(404).json({ message: "Bank not found" })

        // Check permission: owner or role with canDeletePasswords
        const member = bank.members.find(m => m.userId.toString() === req.userId.toString())
        if (!member) return res.status(403).json({ message: "You are not a member of this bank" })

        const isOwner = bank.ownerId.toString() === req.userId.toString()
        const role = member.roleId
        if (!isOwner && !role.permissions.canDeletePasswords) {
            return res.status(403).json({ message: "You do not have permission to clear passwords" })
        }

        await Password.deleteMany({ bankId: bank._id })
        return res.status(200).json({ message: "All passwords cleared for this bank" })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: error.message })
    }
})

// Soft-delete a bank (owner only)
router.delete("/:bankId", verifyToken, async (req, res) => {
    try {
        const bank = await Bank.findById(req.params.bankId)
        if (!bank) return res.status(404).json({ message: "Bank not found" })

        if (bank.ownerId.toString() !== req.userId.toString()) {
            return res.status(403).json({ message: "Only bank owner can delete the bank" })
        }

        // Soft-delete: mark as deleted and set timestamp
        bank.deleted = true
        bank.deletedAt = Date.now()
        await bank.save()

        return res.status(200).json({ message: "Bank soft-deleted (can be restored)" })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: error.message })
    }
})

// Restore a soft-deleted bank (owner only)
router.post("/:bankId/restore", verifyToken, async (req, res) => {
    try {
        const bank = await Bank.findById(req.params.bankId)
        if (!bank) return res.status(404).json({ message: "Bank not found" })

        if (bank.ownerId.toString() !== req.userId.toString()) {
            return res.status(403).json({ message: "Only bank owner can restore the bank" })
        }

        bank.deleted = false
        bank.deletedAt = null
        await bank.save()

        return res.status(200).json({ message: "Bank restored successfully", bank })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: error.message })
    }
})

// Get all banks for current user
router.get("/", verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).populate("bankMemberships.bankId")

        // Exclude soft-deleted banks from list
        const banks = user.bankMemberships
            .map(membership => membership.bankId)
            .filter(b => b && !b.deleted)

        return res.status(200).json({
            banks
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: error.message })
    }
})

// Get specific bank with members and roles
router.get("/:bankId", verifyToken, async (req, res) => {
    try {
        const bank = await Bank.findById(req.params.bankId)
            .populate("members.userId", "username email")
            .populate("members.roleId")
            .populate("roles")

        if (!bank || bank.deleted) {
            return res.status(404).json({ message: "Bank not found" })
        }

        // Check if user is a member
        const isMember = bank.members.some(member => member.userId._id.toString() === req.userId.toString())
        if (!isMember) {
            return res.status(403).json({ message: "Access denied" })
        }

        return res.status(200).json({
            bank
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: error.message })
    }
})

// Add user to bank (invite)
router.post("/:bankId/invite", verifyToken, async (req, res) => {
    try {
        const { email, roleId } = req.body
        const bank = await Bank.findById(req.params.bankId)

        if (!bank) {
            return res.status(404).json({ message: "Bank not found" })
        }

        // Check if requester is owner or manager
        const requesterRole = bank.members.find(m => m.userId.toString() === req.userId.toString())
        if (!requesterRole || requesterRole.userId.toString() !== bank.ownerId.toString()) {
            return res.status(403).json({ message: "Only bank owner can invite users" })
        }

        const userToAdd = await User.findOne({ email })
        if (!userToAdd) {
            return res.status(404).json({ message: "User not found" })
        }

        // Check if user is already a member
        const alreadyMember = bank.members.some(m => m.userId.toString() === userToAdd._id.toString())
        if (alreadyMember) {
            return res.status(400).json({ message: "User is already a member" })
        }

        // Add user to bank
        bank.members.push({ userId: userToAdd._id, roleId })
        await bank.save()

        // Add bank to user's memberships
        await User.findByIdAndUpdate(
            userToAdd._id,
            { $push: { bankMemberships: { bankId: bank._id, roleId } } }
        )

        return res.status(200).json({
            message: "User invited successfully",
            bank
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: error.message })
    }
})

// Update bank settings
router.put("/:bankId", verifyToken, async (req, res) => {
    try {
        const bank = await Bank.findById(req.params.bankId)

        if (!bank) {
            return res.status(404).json({ message: "Bank not found" })
        }

        // Check if user is owner
        if (bank.ownerId.toString() !== req.userId.toString()) {
            return res.status(403).json({ message: "Only bank owner can update settings" })
        }

        const { name, description, icon } = req.body

        if (name) bank.name = name
        if (description) bank.description = description
        if (icon) bank.icon = icon

        await bank.save()

        return res.status(200).json({
            message: "Bank updated successfully",
            bank
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: error.message })
    }
})

export default router
