// k6 version of the same burst test (https://k6.io). Run with:
//   k6 run -e BASE_URL=http://localhost:4000 -e WEBHOOK_SECRET=<secret> scripts/loadtest.k6.js
// It ramps to 50 new donations per second, confirms each one, and re-sends some confirmations
// (gateway retries). Afterwards run `npm run verify:receipts` to check for duplicates and gaps.
import http from "k6/http";
import { check } from "k6";
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

const BASE = __ENV.BASE_URL || "http://localhost:4000";
const SECRET = __ENV.WEBHOOK_SECRET || "dev-webhook-secret";

export const options = {
  scenarios: {
    campaign_day: {
      executor: "ramping-arrival-rate",
      startRate: 5,
      timeUnit: "1s",
      preAllocatedVUs: 100,
      maxVUs: 300,
      stages: [
        { target: 50, duration: "30s" },
        { target: 50, duration: "1m30s" },
        { target: 0, duration: "10s" },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],
  },
};

const json = { headers: { "Content-Type": "application/json" } };

export default function () {
  const key = uuidv4();
  const created = http.post(
    `${BASE}/api/donations`,
    JSON.stringify({
      amount: 500,
      type: "one-time",
      campaignSlug: "widow-support",
      donorName: "Load Test",
      donorEmail: "load@example.test",
      pan: "ABCDE1234F",
      idempotencyKey: key,
    }),
    json
  );
  check(created, { "donation created": (r) => r.status === 201 });

  const confirmParams = { headers: { "Content-Type": "application/json", "x-webhook-secret": SECRET } };
  const body = JSON.stringify({ idempotencyKey: key });
  const first = http.post(`${BASE}/api/payments/mock/confirm`, body, confirmParams);
  check(first, { "receipt issued": (r) => r.status === 201 || r.status === 200 });

  if (Math.random() < 0.2) {
    const retry = http.post(`${BASE}/api/payments/mock/confirm`, body, confirmParams);
    check(retry, {
      "retry returns the same receipt": (r) =>
        r.status === 200 && r.json("receipt.receiptNo") === first.json("receipt.receiptNo"),
    });
  }
}
