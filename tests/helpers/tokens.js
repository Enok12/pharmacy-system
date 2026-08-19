import { readFileSync } from "node:fs";
import path from "node:path";

const RUNTIME_FILE = path.resolve(import.meta.dirname, "../.runtime.json");

/** Auth tokens obtained once in globalSetup — see the Phase 12 plan. */
export function tokenFor(role) {
  const { tokens } = JSON.parse(readFileSync(RUNTIME_FILE, "utf8"));
  const key = role.toLowerCase();
  if (!tokens[key]) throw new Error(`No token available for role: ${role}`);
  return tokens[key];
}
