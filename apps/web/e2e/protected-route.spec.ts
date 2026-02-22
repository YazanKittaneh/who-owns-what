import { expect, test } from "@playwright/test";

test("unauthenticated access to /account redirects to /login", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
});
