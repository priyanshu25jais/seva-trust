const mongoose = require("mongoose");

// Mock monthly giving: a record of the donor's wish plus the next charge date.
// Real recurring billing is out of scope; renewals are produced by processDueSubscriptions.
const subscriptionSchema = new mongoose.Schema(
  {
    donor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign" },
    sourceDonation: { type: mongoose.Schema.Types.ObjectId, ref: "Donation", unique: true, sparse: true },
    donorName: { type: String, trim: true },
    donorEmail: { type: String, lowercase: true, trim: true },
    donorPan: { type: String, trim: true },
    amount: { type: Number, required: true, min: 1 },
    nextChargeDate: { type: Date, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subscription", subscriptionSchema);
