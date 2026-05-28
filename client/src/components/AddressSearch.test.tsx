import { normalizeAddressSearchQuery, searchAddressToString } from "./AddressSearch";

describe("searchAddressToString", () => {
  it("formats address text", () => {
    expect(
      searchAddressToString({
        pin: "12345678901234",
        housenumber: "123",
        streetname: "MAIN ST",
        city: "Chicago",
        state: "IL",
        zip: "60601",
      })
    ).toBe("123 MAIN ST, Chicago, IL");
  });
});

describe("normalizeAddressSearchQuery", () => {
  it("normalizes spacing and case for cache keys", () => {
    expect(normalizeAddressSearchQuery("  833   W Newport AVE  ")).toBe("833 w newport ave");
  });
});
