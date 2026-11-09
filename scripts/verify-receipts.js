// Reads the database and proves the receipt numbers are clean:
//   - no duplicate receipt numbers
//   - no missing number in each financial year's sequence (1..N)
//   - no donation marked paid without a receipt, and no receipt for an unpaid donation
// Usage: npm run verify:receipts   (from /server; reads MONGODB_URI from server/.env)
const path = require("path");
require("../server/node_modules/dotenv").config({ path: path.resolve(__dirname, "../server/.env") });
const mongoose = require("../server/node_modules/mongoose");
const { Receipt, Donation, Counter } = require("../server/src/models");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/seva-trust");

  const receipts = await Receipt.find({}, { receiptNo: 1, financialYear: 1, seq: 1, donation: 1 }).lean();
  const result = { totalReceipts: receipts.length, financialYears: {}, problems: [] };

  const seenNumbers = new Set();
  const seenDonations = new Set();
  const byYear = new Map();
  for (const r of receipts) {
    if (seenNumbers.has(r.receiptNo)) result.problems.push(`duplicate receipt number ${r.receiptNo}`);
    seenNumbers.add(r.receiptNo);
    if (seenDonations.has(String(r.donation))) result.problems.push(`two receipts for donation ${r.donation}`);
    seenDonations.add(String(r.donation));
    if (!byYear.has(r.financialYear)) byYear.set(r.financialYear, []);
    byYear.get(r.financialYear).push(r.seq);
  }

  for (const [fy, seqs] of byYear) {
    seqs.sort((a, b) => a - b);
    const missing = [];
    for (let i = 1; i <= seqs[seqs.length - 1]; i += 1) {
      if (!seqs.includes(i) && missing.length < 20) missing.push(i);
    }
    const counter = await Counter.findOne({ key: `receipt:${fy}` }).lean();
    result.financialYears[fy] = {
      receipts: seqs.length,
      firstSeq: seqs[0],
      lastSeq: seqs[seqs.length - 1],
      counter: counter ? counter.seq : null,
      missingNumbers: missing,
    };
    if (missing.length) result.problems.push(`${fy}: missing numbers ${missing.join(", ")}`);
    if (counter && counter.seq !== seqs[seqs.length - 1]) {
      result.problems.push(`${fy}: counter ${counter.seq} does not match last receipt ${seqs[seqs.length - 1]}`);
    }
  }

  const paid = await Donation.find({ status: "paid" }, { _id: 1 }).lean();
  const paidWithoutReceipt = paid.filter((d) => !seenDonations.has(String(d._id))).length;
  const receiptForUnpaid = await Donation.countDocuments({
    _id: { $in: [...seenDonations].map((id) => new mongoose.Types.ObjectId(id)) },
    status: { $ne: "paid" },
  });
  result.paidDonations = paid.length;
  result.paidWithoutReceipt = paidWithoutReceipt;
  result.receiptsForUnpaidDonations = receiptForUnpaid;
  if (paidWithoutReceipt) result.problems.push(`${paidWithoutReceipt} paid donations have no receipt`);
  if (receiptForUnpaid) result.problems.push(`${receiptForUnpaid} receipts belong to unpaid donations`);

  console.log(JSON.stringify(result, null, 2));
  console.log(result.problems.length === 0 ? "\nRESULT: OK (0 duplicates, 0 missing numbers)" : "\nRESULT: PROBLEMS FOUND");
  await mongoose.disconnect();
  process.exit(result.problems.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
