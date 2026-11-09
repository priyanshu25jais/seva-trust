import { vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../lib/auth.jsx";

// A tiny fake API. routes: { "POST /api/finder/match": (body) => ({ status, body }) }
export function mockApi(routes) {
  const calls = [];
  const fn = vi.fn(async (url, options = {}) => {
    const method = (options.method || "GET").toUpperCase();
    const path = String(url).split("?")[0];
    const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ method, path, body });
    const handler = routes[`${method} ${path}`];
    if (!handler) return { ok: false, status: 404, json: async () => ({ error: "not_found", message: "no route" }) };
    const res = await handler(body);
    const status = res.status || 200;
    return { ok: status < 400, status, json: async () => res.body };
  });
  vi.stubGlobal("fetch", fn);
  return { calls, fn };
}

export function renderAt(ui, path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );
}
