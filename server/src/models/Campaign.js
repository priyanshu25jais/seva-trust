const mongoose = require("mongoose");
const { bilingual } = require("./bilingual");

const campaignSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    title: { type: bilingual, required: true },
    goal: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Campaign", campaignSchema);
