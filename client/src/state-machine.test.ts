import { wowMachine } from "./state-machine";

describe("wowMachine", () => {
  it("initializes in noData", () => {
    const state = wowMachine.initialState;
    expect(state.matches("noData")).toBe(true);
  });
});
