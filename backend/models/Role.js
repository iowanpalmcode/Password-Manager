import mongoose from "mongoose"

const roleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    bankId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Bank",
        required: true
    },
    permissions: {
        canViewPasswords: { type: Boolean, default: false },
        canAddPasswords: { type: Boolean, default: false },
        canEditPasswords: { type: Boolean, default: false },
        canDeletePasswords: { type: Boolean, default: false },
        canManageUsers: { type: Boolean, default: false },
        canManageRoles: { type: Boolean, default: false },
        canManageSettings: { type: Boolean, default: false },
        canChangePermissions: { type: Boolean, default: false },
        // Allow scoping view to specific categories. If canViewAll is true, viewCategories is ignored.
        canViewAll: { type: Boolean, default: false },
        viewCategories: { type: [String], default: [] }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})

export default mongoose.model("Role", roleSchema)
