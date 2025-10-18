import mongoose, { Document, Schema } from "mongoose";

export interface ITransaction extends Document {
    userId: mongoose.Types.ObjectId;
    type: "deposit" | "withdraw_request" | "withdraw_payout" | "trade_fee";
    amount: number;
    status: "pending" | "completed" | "failed" | "canceled";
    createdAt: Date;
    updatedAt: Date;
    meta?: Record<string, any>;
}

const transactionSchema = new Schema<ITransaction>({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["deposit", "withdraw_request", "withdraw_payout", "trade_fee"], required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["pending", "completed", "failed", "canceled"], required: true, default: "pending" },
    meta: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Indexes for performance
transactionSchema.index({ userId: 1, createdAt: -1 }); // For user transaction history
transactionSchema.index({ type: 1, status: 1 }); // For admin queries
transactionSchema.index({ status: 1, createdAt: -1 }); // For pending transactions
transactionSchema.index({ 'meta.tradeId': 1 }, { sparse: true }); // For trade-related transactions

export const Transaction = mongoose.model<ITransaction>("Transaction", transactionSchema);

