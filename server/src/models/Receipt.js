const mongoose = require("mongoose");

const snapshotSchema = new mongoose.Schema(
  {
    donorName: { type: String, required: true, trim: true },
    donorPan: { type: String, trim: true },
    amount: { type: Number, required: true, min: 1 },
    date: { type: Date, required: true },
    campaignTitle: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const receiptSchema = new mongoose.Schema(
  {
    receiptNo: { type: String, required: true, trim: true },
    financialYear: { type: String, required: true, trim: true },
    donation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Donation",
      required: true,
      unique: true,
    },
    snapshot: { type: snapshotSchema, required: true },
    pdf: { type: Buffer },
  },
  { timestamps: true }
);

receiptSchema.index({ receiptNo: 1 }, { unique: true });

module.exports = mongoose.model("Receipt", receiptSchema);
