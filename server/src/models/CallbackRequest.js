const mongoose = require("mongoose");

// A woman asks the helpline to call her back about a scheme. Stored only with consent (DPDP).
const callbackSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true },
    schemeCode: { type: String, trim: true, uppercase: true },
    note: { type: String, trim: true, maxlength: 300 },
    consent: { type: Boolean, required: true },
    status: { type: String, enum: ["new", "called"], default: "new" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CallbackRequest", callbackSchema);
