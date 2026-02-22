import { expect, test } from "@playwright/test";

test("portfolio page shows summary and filter", async ({ page }) => {
  await page.goto("/portfolio/pf-division-group");

  await expect(page.getByRole("heading", { name: /portfolio:/i })).toBeVisible();
  await expect(page.getByText(/total properties:/i)).toBeVisible();

  await page.getByLabel(/filter by address, owner, or pin/i).fill("1238");
  await expect(page.getByText(/showing 1 of/i)).toBeVisible();
});
