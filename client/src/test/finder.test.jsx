import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import Finder from "../pages/Finder.jsx";
import { mockApi, renderAt } from "./helpers.jsx";

const match = {
  disclaimer: "possible_match_only",
  checked: 10,
  notMatched: 9,
  matches: [
    {
      scheme: {
        code: "SCH-014",
        need: "Pension",
        title: { hi: "राज्य विधवा पेंशन", en: "State widow pension" },
        benefit: { hi: "600 रुपये प्रति माह", en: "600 rupees a month" },
      },
      rules: [
        { key: "gender", label: { hi: "महिला आवेदक", en: "Woman applicant" }, status: "passed" },
        { key: "requires:antenatal_registration", label: { hi: "गर्भावस्था पंजीकरण", en: "Antenatal registration" }, status: "unknown" },
      ],
      passedCount: 1,
      unknownCount: 1,
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("eligibility finder page", () => {
  it("asks six questions one at a time, sends the answers, and shows possible matches with the rules used", async () => {
    const api = mockApi({ "POST /api/finder/match": () => ({ body: match }) });
    const user = userEvent.setup();
    renderAt(<Finder />, "/finder");

    await user.click(screen.getByRole("button", { name: /सवाल शुरू करें/ }));
    expect(screen.getByText("सवाल 1 / 6")).toBeTruthy();
    await user.click(screen.getByLabelText("हाँ, मैं महिला हूँ"));
    await user.type(screen.getByRole("textbox", { name: /उम्र/ }), "50");
    await user.click(screen.getByRole("button", { name: "आगे" }));
    await user.click(screen.getByLabelText("विधवा"));
    await user.click(screen.getByLabelText("हाँ")); // BPL card
    await user.click(screen.getByLabelText("नहीं")); // pregnancy
    await user.click(screen.getByLabelText("नहीं")); // self-help group

    await waitFor(() => expect(screen.getByText("राज्य विधवा पेंशन")).toBeTruthy());
    expect(screen.getByText(/पक्की पात्रता आवेदन के समय/)).toBeTruthy(); // not a promise
    expect(screen.getByText("इन नियमों से मिलान हुआ")).toBeTruthy(); // rules used
    expect(screen.getByText(/आवेदन के समय जाँचा जाएगा/)).toBeTruthy(); // unknown rule
    expect(screen.getByRole("button", { name: "कॉल-बैक माँगें" })).toBeTruthy(); // call-back offer

    const sent = api.calls.find((c) => c.path === "/api/finder/match").body;
    expect(sent.answers).toEqual({
      gender: "female",
      age: 50,
      maritalStatus: "widow",
      hasBplCard: true,
      pregnancy: "no",
      shgMember: false,
    });
  });

  it("rejects an impossible age and lets the woman skip the question", async () => {
    mockApi({ "POST /api/finder/match": () => ({ body: { ...match, matches: [] } }) });
    const user = userEvent.setup();
    renderAt(<Finder />, "/finder");
    await user.click(screen.getByRole("button", { name: /सवाल शुरू करें/ }));
    await user.click(screen.getByLabelText("हाँ, मैं महिला हूँ"));
    await user.type(screen.getByRole("textbox", { name: /उम्र/ }), "999");
    await user.click(screen.getByRole("button", { name: "आगे" }));
    expect(screen.getByRole("alert").textContent).toMatch(/0 से 120/);
    await user.clear(screen.getByRole("textbox", { name: /उम्र/ }));
    await user.click(screen.getByRole("button", { name: "छोड़ें" }));
    expect(screen.getByText("सवाल 3 / 6")).toBeTruthy();
  });

  it("shows the helpline option when nothing matches", async () => {
    mockApi({ "POST /api/finder/match": () => ({ body: { ...match, matches: [] } }) });
    const user = userEvent.setup();
    renderAt(<Finder />, "/finder");
    await user.click(screen.getByRole("button", { name: /सवाल शुरू करें/ }));
    await user.click(screen.getByLabelText("नहीं")); // not a woman
    await user.click(screen.getByRole("button", { name: "छोड़ें" })); // age: skipped
    await user.click(screen.getByLabelText("अविवाहित"));
    await user.click(screen.getByLabelText("पता नहीं")); // BPL card
    await user.click(screen.getByLabelText("नहीं")); // pregnancy
    await user.click(screen.getByLabelText("पता नहीं")); // self-help group
    await waitFor(() => expect(screen.getByText("आपके जवाबों से कोई योजना नहीं मिली")).toBeTruthy());
    expect(screen.getByText(/हेल्पलाइन आपकी मदद कर सकती है/)).toBeTruthy();
  });

  it("an AI-read sentence is only a draft: the woman must confirm before schemes are shown", async () => {
    const api = mockApi({
      "POST /api/finder/parse": () => ({
        body: { answers: { gender: "female", age: 50, maritalStatus: "widow", hasBplCard: true, pregnancy: null, shgMember: null } },
      }),
      "POST /api/finder/match": () => ({ body: match }),
    });
    const user = userEvent.setup();
    renderAt(<Finder />, "/finder");
    await user.type(screen.getByLabelText("अपनी बात यहाँ लिखें"), "मैं विधवा हूँ 50 साल की");
    await user.click(screen.getByRole("button", { name: "मेरी बात समझें" }));

    await waitFor(() => expect(screen.getByText("क्या ये जवाब सही हैं?")).toBeTruthy());
    expect(api.calls.some((c) => c.path === "/api/finder/match")).toBe(false); // nothing matched yet
    await user.click(screen.getByRole("button", { name: "सही है, योजनाएँ दिखाएँ" }));
    await waitFor(() => expect(api.calls.some((c) => c.path === "/api/finder/match")).toBe(true));
  });

  it("explains politely when the typed-question helper is unavailable", async () => {
    mockApi({ "POST /api/finder/parse": () => ({ status: 503, body: { error: "ai_unavailable", message: "x" } }) });
    const user = userEvent.setup();
    renderAt(<Finder />, "/finder");
    await user.type(screen.getByLabelText("अपनी बात यहाँ लिखें"), "मैं विधवा हूँ");
    await user.click(screen.getByRole("button", { name: "मेरी बात समझें" }));
    await waitFor(() => expect(screen.getByText(/अभी यह सुविधा उपलब्ध नहीं है/)).toBeTruthy());
  });
});
