import { test, expect } from "@playwright/test";
import routes from "./routes.json";

type Route = { path: string; role: "public" | "admin" | "chef" | "operator" };

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

const stateFor = (role: string): string | undefined =>
  role === "public" ? undefined : `tests/.auth/${role}.json`;

for (const route of routes as Route[]) {
  for (const vp of VIEWPORTS) {
    test(`${route.path} @ ${vp.width}px (${vp.name})`, async ({ browser }) => {
      const ctx = await browser.newContext({
        storageState: stateFor(route.role),
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await ctx.newPage();
      try {
        await page.goto(route.path, { waitUntil: "networkidle" });

        // Authenticated routes must actually render (not bounce to /login).
        if (route.role !== "public") {
          expect(page.url(), `${route.path} redirected to login`).not.toContain("/login");
        }

        // No horizontal overflow: the document must not scroll sideways.
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `horizontal overflow of ${overflow}px at ${vp.width}px`).toBeLessThanOrEqual(0);

        // Primary nav (app chrome) is present on authenticated pages.
        if (route.role !== "public") {
          await expect(page.locator("header").first(), "primary nav not visible").toBeVisible();
        }

        // A main call-to-action is visible in the viewport.
        await expect(
          page.locator('button:visible, a[href]:visible, [role="button"]:visible').first(),
          "no visible CTA",
        ).toBeVisible();
      } finally {
        await ctx.close();
      }
    });
  }
}
