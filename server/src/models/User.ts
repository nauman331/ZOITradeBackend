import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
    name: string;
    email: string;
    password?: string;
    role: "Admin" | "User";
    otp: string | null;
    otpExpiresAt: Date | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    picture?: string;
    googleId: string | null;
    phone?: string | null;
    balance: number;
    equity?: number;
    kycStatus?: "none" | "pending" | "verified" | "rejected";
    kycDocuments?: Object | null;
    withdrawalAddress?: string | null;
}

const userSchema = new Schema<IUser>({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, default: null, minlength: 6 },
    role: { type: String, enum: ["Admin", "User"], required: true, default: "User" },
    otp: { type: String, default: null },
    otpExpiresAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    picture: { type: String, default: null },
    googleId: { type: String, default: null },
    phone: { type: String, default: null, unique: true },
    balance: { type: Number, default: 0 },
    equity: { type: Number, default: 0 },
    withdrawalAddress: { type: String, default: null },
    kycDocuments: { type: Object, default: null },
    kycStatus: { type: String, enum: ["none", "pending", "approved", "rejected"], default: "none" },
}, { timestamps: true });

// Indexes for performance
userSchema.index({ email: 1 }, { unique: true }); // For login
userSchema.index({ googleId: 1 }, { sparse: true }); // For OAuth
userSchema.index({ isActive: 1, role: 1 }); // For admin queries
userSchema.index({ createdAt: -1 }); // For user analytics

export const User = mongoose.model<IUser>("User", userSchema);
