import { readFileSync } from "node:fs";
import path from "node:path";

const RUNTIME_FILE = path.resolve(import.meta.dirname, "../.runtime.json");

function loadRuntime() {
  return JSON.parse(readFileSync(RUNTIME_FILE, "utf8"));
}

// Turbopack dev compiles each route on its first hit; the server can
// briefly refuse/time out new connections while compiling a route this
// suite hasn't hit yet (see tests/setup/global-setup.js's fetchWithRetry
// for the fuller explanation). Retrying only on connection-level
// failures — never on a real HTTP response — rides that out without
// masking genuine assertion failures.
async function fetchWithRetry(url, options, { retries = 5, delayMs = 1500 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

/**
 * Thin fetch wrapper for the Phase 12 integration suite — every test
 * hits the real running test server over HTTP (see the Phase 12 plan
 * for why this can't be a direct route-handler call).
 */
export async function apiRequest(method, requestPath, { token, clientType, body, headers: extraHeaders } = {}) {
  const { baseUrl } = loadRuntime();
  const headers = { "Content-Type": "application/json", ...extraHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (clientType) headers["X-Client-Type"] = clientType;

  const res = await fetchWithRetry(`${baseUrl}${requestPath}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    // some responses (e.g. 405s) may have no body
  }

  return { status: res.status, headers: res.headers, body: json };
}

export function baseUrl() {
  return loadRuntime().baseUrl;
}
