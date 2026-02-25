import { expect, test } from "@playwright/test";

const KNOWN_SAMPLE_PIN = "17062010120000";

test("locale and legacy route aliases resolve", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { name: /who owns what/i })).toBeVisible();

  await page.goto("/es/search?q=Division");
  await expect(page).toHaveURL(/\/es\/search\?q=Division/);
  await expect(page.getByRole("heading", { name: /search results/i })).toBeVisible();

  await page.goto(`/pin/${KNOWN_SAMPLE_PIN}`);
  await expect(page).toHaveURL(new RegExp(`/pin/${KNOWN_SAMPLE_PIN}`));
  await expect(page.getByText(/owner:/i)).toBeVisible();

  await page.goto(`/legacy/pin/${KNOWN_SAMPLE_PIN}`);
  await expect(page).toHaveURL(new RegExp(`/pin/${KNOWN_SAMPLE_PIN}`));

  await page.goto(`/en/legacy/pin/${KNOWN_SAMPLE_PIN}`);
  await expect(page).toHaveURL(new RegExp(`/en/pin/${KNOWN_SAMPLE_PIN}`));
});
