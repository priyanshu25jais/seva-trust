const mongoose = require("mongoose");

const donationSchema = new mongoose.Schema(
  {
    donor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true },
    amount: { type: Number, required: true, min: 1 },
    type: { type: String, required: true, enum: ["one-time", "monthly"] },
    status: { type: String, required: true, enum: ["pending", "paid", "failed"] },
    idempotencyKey: { type: String, required: true, unique: true, trim: true },
    donorName: { type: String, required: true, trim: true },
    donorEmail: { type: String, required: true, lowercase: true, trim: true },
    donorPan: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Donation", donationSchema);
