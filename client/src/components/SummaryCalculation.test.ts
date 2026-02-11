import { calculateAggDataFromAddressList } from "./SummaryCalculation";

const SAMPLE_ADDRESS_RECORDS = [
  {
    pin: "123",
    units_res: 2,
    permits_total: 1,
    violations_open: 3,
    violations_total: 4,
    requests_311_total: 5,
  },
  {
    pin: "456",
    units_res: 3,
    permits_total: 2,
    violations_open: 1,
    violations_total: 2,
    requests_311_total: 0,
  },
] as any;

describe("calculateAggDataFromAddressList()", () => {
  it("calculates aggregate metrics", () => {
    const agg = calculateAggDataFromAddressList(SAMPLE_ADDRESS_RECORDS);
    expect(agg.parcels).toBe(2);
    expect(agg.units_res).toBe(5);
    expect(agg.permits_total).toBe(3);
    expect(agg.violations_open).toBe(4);
    expect(agg.violations_total).toBe(6);
    expect(agg.requests_311_total).toBe(5);
  });
});
