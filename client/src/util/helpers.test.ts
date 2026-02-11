import helpers, { searchAddrsAreEqual } from "./helpers";
import { SearchAddress } from "components/AddressSearch";

describe("searchAddrsAreEqual()", () => {
  const searchAddr1: SearchAddress = {
    pin: "12345678901234",
    housenumber: "",
    streetname: "",
    city: "",
    state: "",
    zip: "",
  };
  const searchAddr2: SearchAddress = {
    pin: "00000000000000",
    housenumber: "",
    streetname: "",
    city: "",
    state: "",
    zip: "",
  };

  it("should compare by pin", () => {
    expect(searchAddrsAreEqual(searchAddr1, searchAddr1)).toBe(true);
    expect(searchAddrsAreEqual(searchAddr2, searchAddr2)).toBe(true);
    expect(searchAddrsAreEqual(searchAddr1, searchAddr2)).toBe(false);
  });
});

describe("isValidPin()", () => {
  it("validates 14-digit pins", () => {
    expect(helpers.isValidPin("12345678901234")).toBe(true);
    expect(helpers.isValidPin("1234")).toBe(false);
  });
});

describe("addrsAreEqual()", () => {
  it("compares by pin", () => {
    expect(helpers.addrsAreEqual({ pin: "1" }, { pin: "1" })).toBe(true);
    expect(helpers.addrsAreEqual({ pin: "1" }, { pin: "2" })).toBe(false);
  });
});
