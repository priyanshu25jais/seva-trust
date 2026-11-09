const { startDb, stopDb, clearDb, makeCampaign, makeDonation } = require("./helpers/db");
const { Receipt, Counter, Donation, Subscription } = require("../src/models");
const { confirmDonation } = require("../src/services/receiptService");

beforeAll(startDb);
afterAll(stopDb);
afterEach(clearDb);

describe("receipt numbering", () => {
  it("issues 100 unique, consecutive receipt numbers for 100 parallel confirmations", async () => {
    const campaign = await makeCampaign();
    const donations = await Promise.all(Array.from({ length: 100 }, () => makeDonation(campaign)));

    const results = await Promise.all(donations.map((d) => confirmDonation(d.idempotencyKey)));

    const numbers = results.map((r) => r.receipt.receiptNo);
    expect(new Set(numbers).size).toBe(100);

    const seqs = results.map((r) => r.receipt.seq).sort((a, b) => a - b);
    expect(seqs[0]).toBe(1);
    expect(seqs[99]).toBe(100);
    // consecutive: no gaps
    seqs.forEach((seq, i) => expect(seq).toBe(i + 1));

    expect(await Receipt.countDocuments()).toBe(100);
    expect(await Donation.countDocuments({ status: "paid" })).toBe(100);
  });

  it("stays correct with the in-process queue switched off (simulates several server instances)", async () => {
    const campaign = await makeCampaign();
    const donations = await Promise.all(Array.from({ length: 30 }, () => makeDonation(campaign)));

    // Without the queue every confirmation races at the database: MongoDB's write-conflict
    // detection and the transaction retry must still give unique, consecutive numbers.
    const results = await Promise.all(
      donations.map((d) => confirmDonation(d.idempotencyKey, { localQueue: false }))
    );

    const seqs = results.map((r) => r.receipt.seq).sort((a, b) => a - b);
    seqs.forEach((seq, i) => expect(seq).toBe(i + 1));
    expect(await Receipt.countDocuments()).toBe(30);
  });

  it("formats the receipt number as 80G/<financial year>/<6 digits>", async () => {
    const campaign = await makeCampaign();
    const donation = await makeDonation(campaign);
    const { receipt } = await confirmDonation(donation.idempotencyKey, {
      now: new Date("2026-11-05T10:00:00+05:30"),
    });
    expect(receipt.receiptNo).toBe("80G/2026-27/000001");
  });

  it("confirming the same donation 10 times in parallel creates exactly one receipt", async () => {
    const campaign = await makeCampaign();
    const donation = await makeDonation(campaign);

    const results = await Promise.all(
      Array.from({ length: 10 }, () => confirmDonation(donation.idempotencyKey))
    );

    expect(await Receipt.countDocuments()).toBe(1);
    expect(new Set(results.map((r) => r.receipt.receiptNo)).size).toBe(1);
    // Only one of the ten calls created it; the others returned the existing receipt.
    expect(results.filter((r) => r.created).length).toBe(1);

    const counter = await Counter.findOne({ key: /^receipt:/ });
    expect(counter.seq).toBe(1);
  });

  it("is idempotent when retried after the receipt exists", async () => {
    const campaign = await makeCampaign();
    const donation = await makeDonation(campaign);
    const first = await confirmDonation(donation.idempotencyKey);
    const second = await confirmDonation(donation.idempotencyKey);
    expect(second.created).toBe(false);
    expect(second.receipt.receiptNo).toBe(first.receipt.receiptNo);
  });

  it("puts 00:30 IST on 1 April into the new financial year (and 23:59 IST on 31 March in the old one)", async () => {
    const campaign = await makeCampaign();
    const lastMoment = await makeDonation(campaign);
    const firstMoment = await makeDonation(campaign);

    const old = await confirmDonation(lastMoment.idempotencyKey, {
      now: new Date("2027-03-31T23:59:00+05:30"),
    });
    const fresh = await confirmDonation(firstMoment.idempotencyKey, {
      // 00:30 IST on 1 April is 19:00 UTC on 31 March: a UTC calculation would get this wrong.
      now: new Date("2027-03-31T19:00:00Z"),
    });

    expect(old.receipt.financialYear).toBe("2026-27");
    expect(old.receipt.receiptNo).toBe("80G/2026-27/000001");
    expect(fresh.receipt.financialYear).toBe("2027-28");
    expect(fresh.receipt.receiptNo).toBe("80G/2027-28/000001");
  });

  it("leaves no gap when a failure happens after the counter was incremented", async () => {
    const campaign = await makeCampaign();
    const failing = await makeDonation(campaign);
    const next = await makeDonation(campaign);

    await expect(
      confirmDonation(failing.idempotencyKey, {
        hooks: {
          afterCounterIncrement: async () => {
            throw new Error("simulated crash after the counter moved");
          },
        },
      })
    ).rejects.toThrow("simulated crash");

    // Everything rolled back together.
    expect(await Receipt.countDocuments()).toBe(0);
    expect((await Donation.findById(failing._id)).status).toBe("pending");
    const counter = await Counter.findOne({ key: /^receipt:/ });
    expect(counter.seq).toBe(0);

    // The next successful receipt takes number 1: nothing was skipped.
    const { receipt } = await confirmDonation(next.idempotencyKey);
    expect(receipt.seq).toBe(1);
  });

  it("snapshots donor details so later changes never alter an issued receipt", async () => {
    const campaign = await makeCampaign();
    const donation = await makeDonation(campaign, { donorName: "Original Name", amount: 1200 });
    const { receipt } = await confirmDonation(donation.idempotencyKey);

    await Donation.updateOne({ _id: donation._id }, { $set: { donorName: "Changed Name", amount: 1 } });

    const stored = await Receipt.findById(receipt._id);
    expect(stored.snapshot.donorName).toBe("Original Name");
    expect(stored.snapshot.amount).toBe(1200);
  });

  it("creates a mock monthly subscription in the same transaction for monthly donations", async () => {
    const campaign = await makeCampaign();
    const donation = await makeDonation(campaign, { type: "monthly" });
    await confirmDonation(donation.idempotencyKey, { now: new Date("2026-11-05T10:00:00Z") });
    await confirmDonation(donation.idempotencyKey);

    const subs = await Subscription.find();
    expect(subs).toHaveLength(1);
    expect(subs[0].nextChargeDate.toISOString()).toBe("2026-12-05T10:00:00.000Z");
  });

  it("rejects an unknown idempotency key", async () => {
    await expect(confirmDonation("00000000-0000-4000-8000-000000000000")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("refuses to confirm a failed donation", async () => {
    const campaign = await makeCampaign();
    const donation = await makeDonation(campaign, { status: "failed" });
    await expect(confirmDonation(donation.idempotencyKey)).rejects.toMatchObject({ status: 409 });
  });
});
