import mongoose, { Document, Schema } from "mongoose";

export interface ITrade extends Document {
    userId: mongoose.Types.ObjectId;
    asset: string;
    side: "call" | "put";
    status: "pending" | "win" | "loss";
    stakeAmount: number;
    entryPrice: number;
    entryTime: Date;
    expiryTime: Date;
    settlementPrice?: number;
    settledAt?: Date;
    payout?: number;
}

const TradeSchema: Schema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    asset: { type: String, required: true },
    side: { type: String, enum: ['call', 'put'], required: true },
    status: { type: String, enum: ['pending', 'win', 'loss'], default: 'pending' },
    stakeAmount: { type: Number, required: true, min: 0 },
    entryPrice: { type: Number, required: true, min: 0 },
    entryTime: { type: Date, required: true },
    expiryTime: { type: Date, required: true },
    settlementPrice: { type: Number, min: 0 },
    settledAt: { type: Date },
    payout: { type: Number, default: 0 }
}, { timestamps: true });

// Indexes for performance
TradeSchema.index({ userId: 1, status: 1 }); // For user's active trades
TradeSchema.index({ status: 1, expiryTime: 1 }); // For settlement cron job
TradeSchema.index({ userId: 1, createdAt: -1 }); // For trade history
TradeSchema.index({ asset: 1, createdAt: -1 }); // For asset statistics
TradeSchema.index({ expiryTime: 1, status: 1 }); // For expired pending trades

export const Trade = mongoose.model<ITrade>('Trade', TradeSchema);