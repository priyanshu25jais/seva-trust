// Dependency-free load test (Node 18+). Simulates a campaign-day burst against a running server:
//   1. create a donation (guest)           POST /api/donations
//   2. confirm it through the gateway       POST /api/payments/mock/confirm (shared secret)
//   3. some confirmations are sent again    (gateway retries: must never create a second receipt)
//   4. some receipts are downloaded         GET  /api/receipts/:id/pdf?key=...
// Then run `npm run verify:receipts` to check the database for duplicates and gaps.
//
// Usage: node scripts/loadtest.js [--url http://localhost:4000] [--total 5000]
//        [--concurrency 50] [--retry-rate 0.2] [--pdf-rate 0.1] [--secret <MOCK_WEBHOOK_SECRET>]
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, all) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), all[i + 1]]);
    return acc;
  }, [])
);
const URL_BASE = (args.url || "http://localhost:4000").replace(/\/$/, "");
const TOTAL = Number(args.total || 5000);
const CONCURRENCY = Number(args.concurrency || 50);
const RETRY_RATE = Number(args["retry-rate"] || 0.2);
const PDF_RATE = Number(args["pdf-rate"] || 0.1);
const SECRET = args.secret || process.env.MOCK_WEBHOOK_SECRET || "dev-webhook-secret";
const CAMPAIGN = args.campaign || "widow-support";

const latencies = { createDonation: [], confirm: [], confirmRetry: [], pdf: [] };
const errors = [];
const receiptNumbers = new Map(); // key -> receiptNo, to prove retries return the same receipt
let retryMismatches = 0;

async function timed(name, fn) {
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    latencies[name].push(performance.now() - t0);
  }
}

function pct(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

async function one(i) {
  const key = crypto.randomUUID();
  const created = await timed("createDonation", () =>
    fetch(`${URL_BASE}/api/donations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: 100 + (i % 50) * 100,
        type: "one-time",
        campaignSlug: CAMPAIGN,
        donorName: `Load Test ${i}`,
        donorEmail: `load${i}@example.test`,
        pan: "ABCDE1234F",
        idempotencyKey: key,
      }),
    })
  );
  if (created.status !== 201) throw new Error(`create ${created.status}`);
  await created.arrayBuffer();

  const confirm = () =>
    fetch(`${URL_BASE}/api/payments/mock/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webhook-secret": SECRET },
      body: JSON.stringify({ idempotencyKey: key }),
    });

  const first = await timed("confirm", confirm);
  if (![200, 201].includes(first.status)) throw new Error(`confirm ${first.status}`);
  const { receipt } = await first.json();
  receiptNumbers.set(key, receipt.receiptNo);

  if (Math.random() < RETRY_RATE) {
    // The gateway retries: several parallel duplicates of the same confirmation.
    const dupes = await Promise.all(
      [1, 2, 3].map(() => timed("confirmRetry", confirm).then((r) => r.json().then((b) => ({ s: r.status, b }))))
    );
    for (const d of dupes) {
      if (![200, 201].includes(d.s) || d.b.receipt.receiptNo !== receipt.receiptNo) retryMismatches += 1;
    }
  }

  if (Math.random() < PDF_RATE) {
    const pdf = await timed("pdf", () => fetch(`${URL_BASE}/api/receipts/${receipt.id}/pdf?key=${key}`));
    if (pdf.status !== 200) throw new Error(`pdf ${pdf.status}`);
    const buf = Buffer.from(await pdf.arrayBuffer());
    if (buf.slice(0, 4).toString() !== "%PDF") throw new Error("not a PDF");
  }
}

async function main() {
  console.log(`Load test: ${TOTAL} donations, concurrency ${CONCURRENCY}, retry rate ${RETRY_RATE}, pdf rate ${PDF_RATE}`);
  console.log(`Target: ${URL_BASE}\n`);
  let next = 0;
  let done = 0;
  const started = performance.now();

  const progress = setInterval(() => {
    const s = (performance.now() - started) / 1000;
    process.stdout.write(`\r  ${done}/${TOTAL} done, ${errors.length} errors, ${(done / s).toFixed(1)} donations/s   `);
  }, 1000);

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= TOTAL) return;
      try {
        await one(i);
      } catch (err) {
        errors.push(err.message);
      }
      done += 1;
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  clearInterval(progress);

  const seconds = (performance.now() - started) / 1000;
  const summary = {
    when: new Date().toISOString(),
    target: URL_BASE,
    totalDonations: TOTAL,
    concurrency: CONCURRENCY,
    durationSeconds: Number(seconds.toFixed(1)),
    donationsPerSecond: Number((TOTAL / seconds).toFixed(1)),
    receiptsIssued: receiptNumbers.size,
    uniqueReceiptNumbers: new Set(receiptNumbers.values()).size,
    errors: errors.length,
    errorSamples: [...new Set(errors)].slice(0, 5),
    retryMismatches,
    latencyMs: {},
  };
  for (const [name, values] of Object.entries(latencies)) {
    const sorted = values.slice().sort((a, b) => a - b);
    summary.latencyMs[name] = {
      count: sorted.length,
      p50: Number(pct(sorted, 50).toFixed(1)),
      p95: Number(pct(sorted, 95).toFixed(1)),
      p99: Number(pct(sorted, 99).toFixed(1)),
      max: Number((sorted[sorted.length - 1] || 0).toFixed(1)),
    };
  }

  console.log("\n\n" + JSON.stringify(summary, null, 2));
  const outDir = path.join(__dirname, "out");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "loadtest-result.json"), JSON.stringify(summary, null, 2));
  console.log("\nSaved scripts/out/loadtest-result.json. Now run: npm run verify:receipts");
  process.exit(errors.length || retryMismatches || summary.uniqueReceiptNumbers !== summary.receiptsIssued ? 1 : 0);
}

main();
