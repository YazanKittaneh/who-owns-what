import { createAddressPageRoutes, isAddressPageRoute } from "routes";

describe("isAddressPageRoute()", () => {
  it("correctly identifies a regular address page", () => {
    expect(isAddressPageRoute("/es/pin/12345678901234")).toBe(true);
  });

  it("correctly identifies a legacy address page", () => {
    expect(isAddressPageRoute("/es/legacy/pin/12345678901234")).toBe(true);
  });

  it("correctly identifies a regular page as not an address page", () => {
    expect(isAddressPageRoute("/en/legacy/how-to-use")).toBe(false);
  });

  it("handles cases where 'address' happens to be in the url somewhere", () => {
    expect(isAddressPageRoute("/en/find-my-address")).toBe(false);
  });
});

describe("createAddressPageRoutes()", () => {
  const OLD_ENV = process.env;

  // https://stackoverflow.com/questions/48033841/test-process-env-with-jest
  beforeEach(() => {
    jest.resetModules(); // Most important - it clears the cache
    process.env = { ...OLD_ENV }; // Make a copy
  });

  afterAll(() => {
    process.env = OLD_ENV; // Restore old environment
  });

  it("prefixes with string when given one", () => {
    expect(createAddressPageRoutes("/boop").overview).toBe("/boop");
    expect(createAddressPageRoutes("/boop").portfolio).toBe("/boop/portfolio");
  });

  it("prefixes with address page params when given one", () => {
    expect(
      createAddressPageRoutes({
        pin: "12345678901234",
      }).overview
    ).toBe("/pin/12345678901234");
  });

  it("prefixes with address page params and locale when given one", () => {
    expect(
      createAddressPageRoutes({
        pin: "12345678901234",
        locale: "es",
      }).portfolio
    ).toBe("/es/pin/12345678901234/portfolio");
  });

  it("correctly sets the right path when route is specified as a legacy route", () => {
    process.env.REACT_APP_ENABLE_NEW_WOWZA_PORTFOLIO_MAPPING = "1";
    expect(
      createAddressPageRoutes(
        {
          pin: "12345678901234",
          locale: "es",
        },
        true
      ).overview
    ).toBe("/es/legacy/pin/12345678901234");
  });

  it("defaults to the standard path when env variable is not defined", () => {
    process.env.REACT_APP_ENABLE_NEW_WOWZA_PORTFOLIO_MAPPING = undefined;
    expect(
      createAddressPageRoutes(
        {
          pin: "12345678901234",
          locale: "es",
        },
        true
      ).overview
    ).toBe("/es/pin/12345678901234");
  });
});
