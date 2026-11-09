import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import Donate from "../pages/Donate.jsx";
import { mockApi, renderAt } from "./helpers.jsx";

const campaigns = {
  campaigns: [
    { slug: "widow-support", title: { hi: "विधवा सहायता कोष", en: "Widow support fund" }, goal: 500000, raised: 1000, donations: 2 },
  ],
};
const receipt = { id: "r1", receiptNo: "80G/2026-27/000001", amount: 1000 };

function page() {
  return (
    <Routes>
      <Route path="/donate" element={<Donate />} />
      <Route path="/donate/done/:key" element={<p>done page</p>} />
    </Routes>
  );
}

async function toPayment(user) {
  await screen.findByText("विधवा सहायता कोष");
  await user.click(screen.getByLabelText("₹1,000"));
  await user.click(screen.getByRole("button", { name: /आगे/ }));
  await user.type(screen.getByLabelText("पूरा नाम"), "Anita Sharma");
  await user.type(screen.getByLabelText("ईमेल"), "anita@example.test");
  await user.type(screen.getByLabelText(/पैन/), "abcde1234f");
  await user.click(screen.getByRole("button", { name: /आगे/ }));
  await user.type(screen.getByLabelText("कार्ड नंबर"), "4111111111111111");
  await user.type(screen.getByLabelText(/समाप्ति/), "1230");
  await user.type(screen.getByLabelText("सीवीवी"), "123");
}

afterEach(() => vi.unstubAllGlobals());

describe("donation flow", () => {
  it("takes three steps and validates each one before moving on", async () => {
    mockApi({ "GET /api/campaigns": () => ({ body: campaigns }) });
    const user = userEvent.setup();
    renderAt(page(), "/donate");
    await screen.findByText("विधवा सहायता कोष");
    expect(screen.getByText("चरण 1 / 3")).toBeTruthy();

    // custom amount out of range is refused
    await user.type(screen.getByLabelText(/अपनी राशि/), "5");
    await user.click(screen.getByRole("button", { name: /आगे/ }));
    expect(screen.getByText(/₹10 से ₹2,00,000 के बीच/)).toBeTruthy();

    await user.clear(screen.getByLabelText(/अपनी राशि/));
    await user.click(screen.getByLabelText("₹500"));
    await user.click(screen.getByRole("button", { name: /आगे/ }));
    expect(screen.getByText("चरण 2 / 3")).toBeTruthy();

    // empty details show inline errors
    await user.click(screen.getByRole("button", { name: /आगे/ }));
    expect(screen.getByText("अपना पूरा नाम लिखें")).toBeTruthy();
    expect(screen.getByText("सही ईमेल लिखें")).toBeTruthy();
    expect(screen.getByText(/पैन ऐसा होना चाहिए/)).toBeTruthy();

    await user.type(screen.getByLabelText("पूरा नाम"), "Anita Sharma");
    await user.type(screen.getByLabelText("ईमेल"), "anita@example.test");
    await user.type(screen.getByLabelText(/पैन/), "abcde12345"); // wrong format
    await user.click(screen.getByRole("button", { name: /आगे/ }));
    expect(screen.getByText(/पैन ऐसा होना चाहिए/)).toBeTruthy();
  });

  it("uppercases the PAN, creates the donation, pays, then opens the receipt page", async () => {
    const api = mockApi({
      "GET /api/campaigns": () => ({ body: campaigns }),
      "POST /api/donations": () => ({ status: 201, body: { donation: { id: "d1" } } }),
      "POST /api/payments/mock/pay": () => ({ status: 201, body: { receipt } }),
    });
    const user = userEvent.setup();
    renderAt(page(), "/donate");
    await toPayment(user);
    await user.click(screen.getByRole("button", { name: /₹1,000 दान करें/ }));
    await screen.findByText("done page");

    const created = api.calls.find((c) => c.path === "/api/donations").body;
    expect(created).toMatchObject({ amount: 1000, type: "one-time", campaignSlug: "widow-support", pan: "ABCDE1234F" });
    expect(created.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    const paid = api.calls.find((c) => c.path === "/api/payments/mock/pay").body;
    expect(paid.idempotencyKey).toBe(created.idempotencyKey); // same key on both calls
  });

  it("shows the FCRA notice when a foreign card is blocked, and a retry reuses the same donation key", async () => {
    let attempt = 0;
    const api = mockApi({
      "GET /api/campaigns": () => ({ body: campaigns }),
      "POST /api/donations": () => ({ status: 200, body: { donation: { id: "d1" } } }),
      "POST /api/payments/mock/pay": () => {
        attempt += 1;
        return attempt === 1
          ? { status: 422, body: { error: "foreign_card_blocked", message: "blocked" } }
          : { status: 201, body: { receipt } };
      },
    });
    const user = userEvent.setup();
    renderAt(page(), "/donate");
    await toPayment(user);
    await user.click(screen.getByRole("button", { name: /₹1,000 दान करें/ }));

    const alert = await screen.findByText("विदेशी कार्ड स्वीकार नहीं");
    expect(alert).toBeTruthy();
    expect(screen.getByText(/एफसीआरए/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /₹1,000 दान करें/ }));
    await screen.findByText("done page");
    const keys = api.calls.filter((c) => c.path === "/api/payments/mock/pay").map((c) => c.body.idempotencyKey);
    expect(new Set(keys).size).toBe(1);
  });

  it("explains a declined card", async () => {
    mockApi({
      "GET /api/campaigns": () => ({ body: campaigns }),
      "POST /api/donations": () => ({ status: 201, body: { donation: { id: "d1" } } }),
      "POST /api/payments/mock/pay": () => ({ status: 402, body: { error: "card_declined", message: "declined" } }),
    });
    const user = userEvent.setup();
    renderAt(page(), "/donate");
    await toPayment(user);
    await user.click(screen.getByRole("button", { name: /₹1,000 दान करें/ }));
    await waitFor(() => expect(screen.getByText(/कार्ड अस्वीकार हुआ/)).toBeTruthy());
  });

  it("shows an empty state when there is no campaign", async () => {
    mockApi({ "GET /api/campaigns": () => ({ body: { campaigns: [] } }) });
    renderAt(page(), "/donate");
    await screen.findByText(/अभी कोई दान अभियान उपलब्ध नहीं है/);
  });

  it("shows an error state with a retry button when the server is down", async () => {
    mockApi({ "GET /api/campaigns": () => ({ status: 500, body: { error: "error", message: "x" } }) });
    renderAt(page(), "/donate");
    await screen.findByRole("button", { name: "दोबारा कोशिश करें" });
  });
});
