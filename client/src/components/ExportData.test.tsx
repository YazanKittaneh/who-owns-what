import React from "react";
import ReactDOM from "react-dom";
import ExportDataButton from "./ExportData";

describe("ExportDataButton", () => {
  it("renders without crashing", () => {
    const div = document.createElement("div");
    ReactDOM.render(<ExportDataButton data={[]} />, div);
    ReactDOM.unmountComponentAtNode(div);
  });
});
