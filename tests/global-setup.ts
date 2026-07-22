import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Load .env.local (the node process running global setup doesn't get Next's env).
function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* ignore */
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BASE = process.env.BASE_URL || "http://localhost:3100";

const PASSWORD = "Passw0rd!e2e";
const USERS = [
  { role: "admin", email: "e2e-admin@example.com", name: "E2E Admin", dbRole: "admin" },
  { role: "chef", email: "e2e-chef@example.com", name: "E2E Chef", dbRole: "chef_de_ligne" },
  { role: "operator", email: "e2e-operator@example.com", name: "E2E Operator", dbRole: "operator" },
];

export default async function globalSetup() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (checked .env.local).");
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Ensure a clean, known test user per role.
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of USERS) {
    const existing = list?.users.find((x) => x.email === u.email);
    if (existing) await admin.auth.admin.deleteUser(existing.id).catch(() => {});
    const { data: created, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.name, role: u.dbRole, status: "active" },
    });
    if (error) throw new Error(`createUser ${u.email}: ${error.message}`);
    if (created?.user) {
      // Enforce role/status regardless of what the DB trigger seeded.
      await admin
        .from("profiles")
        .update({ role: u.dbRole, status: "active", full_name: u.name })
        .eq("id", created.user.id);
    }
  }

  // Log each user in through the real form → save its cookie storage state.
  fs.mkdirSync("tests/.auth", { recursive: true });
  const browser = await chromium.launch();
  for (const u of USERS) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.fill('input[name="email"]', u.email);
    await page.fill('input[name="password"]', PASSWORD);
    await Promise.all([
      page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 45_000 }),
      page.locator('button[type="submit"]').click(),
    ]);
    await ctx.storageState({ path: `tests/.auth/${u.role}.json` });
    await ctx.close();
  }
  await browser.close();
}
