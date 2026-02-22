import { expect, test } from "@playwright/test";

test("auth pages render forms", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  await expect(page.getByLabel(/email/i)).toBeVisible();

  await page.goto("/register");
  await expect(page.getByRole("heading", { name: /create account/i })).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
});
