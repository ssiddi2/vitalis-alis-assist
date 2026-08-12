import { render } from "@testing-library/react";
import { Bar, BarChart, XAxis } from "recharts";
import { describe, expect, it } from "vitest";

/** Guards the recharts major upgrade: charts must still mount under React 18. */
describe("recharts runtime", () => {
  it("renders a chart surface", () => {
    const { container } = render(
      <BarChart width={200} height={100} data={[{ name: "a", v: 1 }, { name: "b", v: 2 }]}>
        <XAxis dataKey="name" />
        <Bar dataKey="v" />
      </BarChart>,
    );
    expect(container.querySelector("svg.recharts-surface")).toBeTruthy();
  });
});
