const mongoose = require("mongoose");
const { bilingual } = require("./bilingual");

const helpCentreSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const auditSchema = new mongoose.Schema(
  {
    by: { type: String, required: true, trim: true },
    at: { type: Date, required: true, default: Date.now },
    action: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const schemeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    title: { type: bilingual, required: true },
    need: {
      type: String,
      required: true,
      enum: ["Pension", "Livelihood", "Health"],
    },
    districts: { type: [String], default: [] },
    eligibility: { type: mongoose.Schema.Types.Mixed, default: {} },
    benefit: { type: bilingual, required: true },
    whoCanApply: { type: bilingual, required: true },
    documents: { type: [bilingual], default: [] },
    howToApply: { type: bilingual, required: true },
    helpCentre: { type: helpCentreSchema, required: true },
    sourceUrl: { type: String, required: true, trim: true },
    lastChecked: { type: Date, required: true },
    summaryHi: { type: String, default: "" },
    summaryStatus: {
      type: String,
      enum: ["none", "draft", "approved"],
      default: "none",
    },
    summaryFlags: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["draft", "review", "published"],
      default: "draft",
    },
    audit: { type: [auditSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Scheme", schemeSchema);
