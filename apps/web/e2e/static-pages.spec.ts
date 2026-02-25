import { expect, test } from "@playwright/test";

test("static pages resolve on modern, locale, and legacy routes", async ({ page }) => {
  await page.goto("/about");
  await expect(page.locator("h1").first()).toHaveText(/about this project/i);

  await page.goto("/es/about");
  await expect(page.locator("h1").first()).toHaveText(/sobre este proyecto/i);

  await page.goto("/legacy/about");
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.locator("h1").first()).toHaveText(/about this project/i);

  await page.goto("/en/privacy-policy");
  await expect(page.locator("h1").first()).toHaveText(/privacy policy/i);
});
