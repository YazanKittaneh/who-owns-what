import { expect, test } from "@playwright/test";

test("address search API returns both legacy and normalized keys", async ({ request }) => {
  const response = await request.get("/api/address/search?q=Division");
  expect(response.ok()).toBeTruthy();

  const json = await response.json();
  expect(Array.isArray(json.result)).toBeTruthy();
  expect(json.result.length).toBeGreaterThan(0);

  const first = json.result[0];
  expect(first).toHaveProperty("pin");
  expect(first).toHaveProperty("address");
  expect(first).toHaveProperty("ownerName");
  expect(first).toHaveProperty("prop_address");
  expect(first).toHaveProperty("owner_name");
});

test("address detail API returns both legacy and normalized keys", async ({ request }) => {
  const response = await request.get("/api/address/17062010120000");
  expect(response.ok()).toBeTruthy();

  const json = await response.json();
  expect(json).toHaveProperty("geosearch");
  expect(Array.isArray(json.addrs)).toBeTruthy();
  expect(json.addrs.length).toBeGreaterThan(0);

  const first = json.addrs[0];
  expect(first).toHaveProperty("pin");
  expect(first).toHaveProperty("address");
  expect(first).toHaveProperty("ownerName");
  expect(first).toHaveProperty("violationsOpen");
  expect(first).toHaveProperty("permitsTotal");
  expect(first).toHaveProperty("prop_address");
  expect(first).toHaveProperty("owner_name");
  expect(first).toHaveProperty("violations_open");
  expect(first).toHaveProperty("permits_total");
});

test("portfolio API returns summary and both key shapes", async ({ request }) => {
  const response = await request.get("/api/portfolio/pf-division-group");
  expect(response.ok()).toBeTruthy();

  const json = await response.json();
  expect(json).toHaveProperty("portfolioId", "pf-division-group");
  expect(json).toHaveProperty("summary");
  expect(Array.isArray(json.properties)).toBeTruthy();
  expect(json.properties.length).toBeGreaterThan(0);

  const first = json.properties[0];
  expect(first).toHaveProperty("pin");
  expect(first).toHaveProperty("address");
  expect(first).toHaveProperty("ownerName");
  expect(first).toHaveProperty("violationsOpen");
  expect(first).toHaveProperty("permitsTotal");
  expect(first).toHaveProperty("prop_address");
  expect(first).toHaveProperty("owner_name");
  expect(first).toHaveProperty("violations_open");
  expect(first).toHaveProperty("permits_total");
});
