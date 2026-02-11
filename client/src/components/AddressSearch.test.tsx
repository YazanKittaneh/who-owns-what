import { searchAddressToString } from "./AddressSearch";

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
