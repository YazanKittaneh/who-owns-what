import { expect, test } from "@playwright/test";

const PIN = "17062010120000";

test("address tab routes resolve for pin, legacy, and locale aliases", async ({ page }) => {
  await page.goto(`/pin/${PIN}`);
  const tabs = page.getByRole("navigation", { name: /address view tabs/i });
  await expect(tabs).toBeVisible();

  await tabs.getByRole("link", { name: "Portfolio", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/pin/${PIN}/portfolio$`));
  await expect(page.getByRole("heading", { name: /portfolio/i })).toBeVisible();

  await tabs.getByRole("link", { name: "Summary", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/pin/${PIN}/summary$`));
  await expect(page.getByRole("heading", { name: /^summary$/i })).toBeVisible();

  await tabs.getByRole("link", { name: "Timeline", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/pin/${PIN}/timeline$`));
  await expect(page.getByRole("heading", { name: /^timeline$/i })).toBeVisible();

  await page.goto(`/legacy/pin/${PIN}/timeline/violations`);
  await expect(page).toHaveURL(new RegExp(`/pin/${PIN}/timeline/violations$`));
  await expect(page.getByText(/current indicator:\s*violations/i)).toBeVisible();

  await page.goto(`/en/legacy/pin/${PIN}/summary`);
  await expect(page).toHaveURL(new RegExp(`/en/pin/${PIN}/summary$`));
  await expect(page.getByRole("heading", { name: /^summary$/i })).toBeVisible();
});
