import { expect, test } from "@playwright/test";

test("home search navigates to results and property page", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel(/search by address, owner, or pin/i).fill("Division");
  await page.getByRole("button", { name: /search/i }).click();

  await expect(page).toHaveURL(/\/search\?q=Division/);
  await expect(page.getByRole("heading", { name: /search results/i })).toBeVisible();

  await page.getByRole("link", { name: /open property details/i }).first().click();
  await expect(page).toHaveURL(/\/address\//);
  await expect(page.getByText(/owner:/i)).toBeVisible();
});
