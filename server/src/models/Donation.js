const mongoose = require("mongoose");

const donationSchema = new mongoose.Schema(
  {
    // Optional: a visitor can donate without an account (guest donation).
    donor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true },
    amount: { type: Number, required: true, min: 1 },
    type: { type: String, required: true, enum: ["one-time", "monthly"] },
    status: { type: String, required: true, enum: ["pending", "paid", "failed"], default: "pending" },
    idempotencyKey: { type: String, required: true, unique: true, trim: true },
    donorName: { type: String, required: true, trim: true },
    donorEmail: { type: String, required: true, lowercase: true, trim: true },
    donorPan: { type: String, trim: true },
    paidAt: { type: Date },
    // Set when this donation is a monthly renewal created from a Subscription.
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription" },
  },
  { timestamps: true }
);

donationSchema.index({ donor: 1, createdAt: -1 });
donationSchema.index({ campaign: 1, status: 1 });

module.exports = mongoose.model("Donation", donationSchema);
