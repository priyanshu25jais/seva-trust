// One small fetch wrapper. Adds the login token, turns error responses into ApiError.
const TOKEN_KEY = "seva_token";

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* private mode: the session just won't persist */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

function headers(extra = {}) {
  const h = { ...extra };
  const token = tokenStore.get();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function parse(res) {
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    throw new ApiError(res.status, body?.error || "error", body?.message || "Request failed", body?.details);
  }
  return body;
}

export async function request(method, url, data, options = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: headers(data !== undefined ? { "Content-Type": "application/json" } : {}),
      body: data !== undefined ? JSON.stringify(data) : undefined,
      signal: options.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError(0, "network", "Network error");
  }
  return parse(res);
}

export const api = {
  get: (url, options) => request("GET", url, undefined, options),
  post: (url, data, options) => request("POST", url, data ?? {}, options),
  put: (url, data) => request("PUT", url, data),
  patch: (url, data) => request("PATCH", url, data),
  delete: (url) => request("DELETE", url),
};

// Download a file that needs the login header (PDF, CSV) and save it.
export async function downloadFile(url, filename) {
  let res;
  try {
    res = await fetch(url, { headers: headers() });
  } catch {
    throw new ApiError(0, "network", "Network error");
  }
  if (!res.ok) await parse(res);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10000);
}
