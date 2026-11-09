const mongoose = require("mongoose");

// Snapshot of what was true when the receipt was issued. The certificate PDF is
// rendered from this snapshot only, so later edits to a donor never change it.
const snapshotSchema = new mongoose.Schema(
  {
    donorName: { type: String, required: true, trim: true },
    donorPan: { type: String, trim: true },
    amount: { type: Number, required: true, min: 1 },
    date: { type: Date, required: true },
    campaignTitle: { type: String, required: true, trim: true },
    campaignTitleHi: { type: String, trim: true },
  },
  { _id: false }
);

const receiptSchema = new mongoose.Schema(
  {
    receiptNo: { type: String, required: true, trim: true },
    financialYear: { type: String, required: true, trim: true },
    seq: { type: Number, required: true, min: 1 },
    donation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Donation",
      required: true,
      unique: true,
    },
    snapshot: { type: snapshotSchema, required: true },
  },
  { timestamps: true }
);

// Second safety net behind the atomic counter: a duplicate number can never be stored.
receiptSchema.index({ receiptNo: 1 }, { unique: true });
receiptSchema.index({ financialYear: 1, seq: 1 }, { unique: true });

module.exports = mongoose.model("Receipt", receiptSchema);
