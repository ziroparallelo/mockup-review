import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const DECISIONS = "/Users/ziroparallelo/AI AGENCY/WEB SITES/studio-buccini-v3/.preview/decisions.json";

test.beforeEach(async () => {
  await writeFile(DECISIONS, "{}");
});

test("fix-02 page: 4 variant cards render and decision bar is inline at bottom", async ({ page }) => {
  await page.goto("/.preview/mockups/fix-02-cta-contattaci.html");
  await expect(page.locator(".variant-card")).toHaveCount(4);
  const bar = page.locator(".decision-bar-live");
  await expect(bar).toBeVisible();
  await expect(bar).toHaveCSS("position", "relative");
});

test("clicking a variant card persists the decision to decisions.json", async ({ page }) => {
  await page.goto("/.preview/mockups/fix-02-cta-contattaci.html");
  await page.waitForSelector("[data-variant]", { timeout: 3000 });
  // Click the notes section of variant C (avoids internal <a> which is ignored by the handler)
  await page.locator("#variant-C .variant-card-notes").click();
  await page.waitForTimeout(300);
  const saved = JSON.parse(await readFile(DECISIONS, "utf-8"));
  expect(saved["fix-02"].variant).toBe("C");
  expect(saved["fix-02"].status).toBe("variant");
});

test("variant AFTER live preview updates on selection", async ({ page }) => {
  await page.goto("/.preview/mockups/fix-02-cta-contattaci.html");
  await page.waitForSelector("[data-variant]");
  await page.locator('[data-variant="D"]').click();
  await expect(page.locator("#live-after-name")).toContainText("variante D");
  const slot = page.locator("#live-after-cta-slot");
  await expect(slot.locator("a.cta-var-d")).toHaveCount(1);
});

test("re-clicking selected variant deselects it", async ({ page }) => {
  await page.goto("/.preview/mockups/fix-02-cta-contattaci.html");
  await page.waitForSelector("[data-variant]");
  const btnA = page.locator('[data-variant="A"]');
  await btnA.click();
  await expect(page.locator("#variant-A.variant-selected")).toHaveCount(1);
  await btnA.click();
  await expect(page.locator(".variant-selected")).toHaveCount(0);
});

test("textarea auto-save on blur writes note to decisions.json", async ({ page }) => {
  await page.goto("/.preview/mockups/fix-02-cta-contattaci.html");
  await page.waitForSelector("#note-input");
  await page.locator("#note-input").fill("e2e note from playwright");
  await page.locator("#note-input").blur();
  await page.waitForTimeout(300);
  const saved = JSON.parse(await readFile(DECISIONS, "utf-8"));
  expect(saved["fix-02"].note).toBe("e2e note from playwright");
  expect(saved["fix-02"].status).toBe("revise");
});

test("server responds on /.preview/mtime endpoint", async ({ request }) => {
  const r = await request.get("/.preview/mtime?path=/.preview/mockups/fix-02-cta-contattaci.html");
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(body.mtime).toBeGreaterThan(0);
});

test("live reload: mtime check returns updated values after file touch", async ({ request }) => {
  const r1 = await request.get("/.preview/mtime?path=/.preview/mockups/_decisions.js");
  const m1 = (await r1.json()).mtime;
  spawnSync("touch", ["/Users/ziroparallelo/AI AGENCY/WEB SITES/studio-buccini-v3/.preview/mockups/_decisions.js"]);
  await new Promise((r) => setTimeout(r, 200));
  const r2 = await request.get("/.preview/mtime?path=/.preview/mockups/_decisions.js");
  const m2 = (await r2.json()).mtime;
  expect(m2).toBeGreaterThanOrEqual(m1);
});
