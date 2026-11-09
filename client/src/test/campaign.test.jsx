import { screen } from "@testing-library/react";
import { vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import Campaign from "../pages/Campaign.jsx";
import { mockApi, renderAt } from "./helpers.jsx";

const page = (
  <Routes>
    <Route path="/campaigns/:slug" element={<Campaign />} />
  </Routes>
);

afterEach(() => vi.unstubAllGlobals());

describe("campaign page", () => {
  it("shows progress and a donate button that carries the campaign into the donation flow", async () => {
    mockApi({
      "GET /api/campaigns/widow-support": () => ({
        body: { campaign: { slug: "widow-support", title: { hi: "विधवा सहायता कोष", en: "Widow support fund" }, goal: 500000, raised: 125000, donations: 7 } },
      }),
    });
    renderAt(page, "/campaigns/widow-support");
    await screen.findByRole("heading", { name: "विधवा सहायता कोष" });
    expect(screen.getByText("₹1,25,000")).toBeTruthy();
    expect(screen.getByText("25%")).toBeTruthy();
    expect(screen.getByRole("link", { name: "इस काम के लिए दान करें" }).getAttribute("href")).toBe("/donate?campaign=widow-support");
  });

  it("says so when the campaign does not exist", async () => {
    mockApi({ "GET /api/campaigns/nope": () => ({ status: 404, body: { error: "not_found", message: "x" } }) });
    renderAt(page, "/campaigns/nope");
    await screen.findByText("यह अभियान नहीं मिला");
  });
});
