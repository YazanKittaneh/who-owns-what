const { groupIndicatorsData } = require("./IndicatorsViz");

describe("groupIndicatorsData", () => {
  it("keeps monthly data unchanged", () => {
    const labels = ["2024-01", "2024-02"];
    const values = [5, 7];
    expect(groupIndicatorsData(labels, values, "month")).toEqual({ labels, values });
  });

  it("groups quarterly values by calendar quarter", () => {
    const labels = ["2021-11", "2021-12", "2022-01", "2022-02"];
    const values = [1, 2, 3, 4];
    expect(groupIndicatorsData(labels, values, "quarter")).toEqual({
      labels: ["2021-Q4", "2022-Q1"],
      values: [3, 7],
    });
  });

  it("groups yearly values by year", () => {
    const labels = ["2021-11", "2021-12", "2022-01"];
    const values = [1, 2, 3];
    expect(groupIndicatorsData(labels, values, "year")).toEqual({
      labels: ["2021", "2022"],
      values: [3, 3],
    });
  });
});
