import { test, expect } from "@playwright/test";

test.describe("Oracle mobile graph", () => {
  test.skip(!process.env.VECTOR_E2E_FIXTURE, "Requires authenticated Oracle fixture");

  test("filters and opens a node path without horizontal overflow", async ({ page }) => {
    await page.goto(`${process.env.VECTOR_E2E_BASE_URL ?? "http://127.0.0.1:4173"}/?screen=oracle-balanced`);
    await expect(page.getByRole("button", { name: "Фільтри" })).toBeVisible();
    await page.getByRole("button", { name: "Списком" }).click();
    await expect(page.getByRole("list", { name: "Список вузлів Oracle" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
  });
});
