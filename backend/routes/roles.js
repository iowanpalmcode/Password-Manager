import express from "express"
import Role from "../models/Role.js"
import Bank from "../models/Bank.js"
import User from "../models/User.js"
import { verifyToken } from "./auth.js"

const router = express.Router()

// Update role permissions
router.put("/:bankId/:roleId", verifyToken, async (req, res) => {
    try {
        const bank = await Bank.findById(req.params.bankId)

        if (!bank || bank.ownerId.toString() !== req.userId.toString()) {
            return res.status(403).json({ message: "Only bank owner can modify roles" })
        }

        const { permissions } = req.body

        const role = await Role.findByIdAndUpdate(
            req.params.roleId,
            { permissions },
            { new: true }
        )

        if (!role) {
            return res.status(404).json({ message: "Role not found" })
        }

        return res.status(200).json({
            message: "Role updated successfully",
            role
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: error.message })
    }
})

// Get all roles for a bank
router.get("/:bankId", verifyToken, async (req, res) => {
    try {
        const bank = await Bank.findById(req.params.bankId).populate("roles")

        if (!bank) {
            return res.status(404).json({ message: "Bank not found" })
        }

        // Check if user is member
        const isMember = bank.members.some(m => m.userId.toString() === req.userId.toString())
        if (!isMember) {
            return res.status(403).json({ message: "Access denied" })
        }

        return res.status(200).json({
            roles: bank.roles
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: error.message })
    }
})

// Assign role to user
router.post("/:bankId/assign", verifyToken, async (req, res) => {
    try {
        const { userId, roleId } = req.body
        const bank = await Bank.findById(req.params.bankId)

        if (!bank || bank.ownerId.toString() !== req.userId.toString()) {
            return res.status(403).json({ message: "Only bank owner can assign roles" })
        }

        const member = bank.members.find(m => m.userId.toString() === userId)
        if (!member) {
            return res.status(404).json({ message: "User is not a member of this bank" })
        }

        member.roleId = roleId
        await bank.save()

        // Update user's bank membership
        const user = await User.findById(userId)
        const userMembership = user.bankMemberships.find(m => m.bankId.toString() === req.params.bankId)
        if (userMembership) {
            userMembership.roleId = roleId
            await user.save()
        }

        return res.status(200).json({
            message: "Role assigned successfully"
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: error.message })
    }
})

// Create a new role preset
router.post("/:bankId", verifyToken, async (req, res) => {
    try {
        const { name, permissions } = req.body
        const bank = await Bank.findById(req.params.bankId)

        if (!bank || bank.ownerId.toString() !== req.userId.toString()) {
            return res.status(403).json({ message: "Only bank owner can create roles" })
        }

        const newRole = await Role.create({
            name,
            bankId: req.params.bankId,
            permissions
        })

        bank.roles.push(newRole._id)
        await bank.save()

        return res.status(201).json({
            message: "Role created successfully",
            role: newRole
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: error.message })
    }
})

// Delete a role
router.delete("/:bankId/:roleId", verifyToken, async (req, res) => {
    try {
        const bank = await Bank.findById(req.params.bankId)
        if (!bank || bank.ownerId.toString() !== req.userId.toString()) {
            return res.status(403).json({ message: "Only bank owner can delete roles" })
        }

        // Prevent deleting last role
        if (!bank.roles || bank.roles.length <= 1) {
            return res.status(400).json({ message: "Cannot delete the only role in a bank" })
        }

        // Remove role from Bank and delete Role doc
        const roleId = req.params.roleId
        bank.roles = bank.roles.filter(r => r.toString() !== roleId)
        await bank.save()

        // Reassign any members who had this role to the first remaining role
        const fallbackRoleId = bank.roles[0]
        bank.members.forEach(m => {
            if (m.roleId && m.roleId.toString() === roleId) {
                m.roleId = fallbackRoleId
            }
        })
        await bank.save()

        // Update user memberships
        await User.updateMany({ 'bankMemberships.bankId': req.params.bankId, 'bankMemberships.roleId': roleId }, { $set: { 'bankMemberships.$.roleId': fallbackRoleId } })

        await Role.findByIdAndDelete(roleId)

        return res.status(200).json({ message: 'Role deleted' })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: error.message })
    }
})

export default router
