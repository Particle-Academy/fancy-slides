// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import ChartHost from "../chart-host";
import type { ChartElement } from "../../../types";

/**
 * A chart element whose `option` declares nothing to plot.
 *
 * `option` is handed to ECharts verbatim, and ECharts draws an EMPTY CANVAS for
 * an option it cannot make a chart from — no exception, nothing in the console,
 * and the canvas is the full size of the element. Same silent shape as a table
 * row that matches no column (#14): the surface renders, the data does not, and
 * nothing anywhere says which.
 *
 * `dark-slide`'s published schema now describes the option surface, so an author
 * reading it can get this right; this is the other half, for an author who did
 * not. Dev-only and once per element, because React re-renders the same element
 * and a repeating warning is one people filter out.
 */
const base = { id: "c1", type: "chart" as const, x: 0, y: 0, w: 400, h: 200 };

const el = (extra: Record<string, unknown>) => ({ ...base, ...extra }) as unknown as ChartElement;

describe("ChartHost with an unplottable option", () => {
    let warn: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    });
    afterEach(() => {
        warn.mockRestore();
    });

    it("warns when the option declares no series", () => {
        render(<ChartHost element={el({ option: { title: { text: "Revenue" }, xAxis: { data: ["Q1"] } } })} slideWidthPx={960} />);

        expect(warn).toHaveBeenCalledTimes(1);
        const message = String(warn.mock.calls[0]![0]);
        expect(message).toContain("series");
        expect(message).toContain("c1");
    });

    it("warns when option is missing entirely", () => {
        render(<ChartHost element={el({})} slideWidthPx={960} />);

        expect(warn).toHaveBeenCalledTimes(1);
    });

    it("warns once per element, not once per render", () => {
        const element = el({ option: { xAxis: { data: ["Q1"] } } });

        render(<ChartHost element={element} slideWidthPx={960} />);
        render(<ChartHost element={element} slideWidthPx={960} />);

        expect(warn).toHaveBeenCalledTimes(1);
    });

    it("says nothing about an option with series, or one driven by a dataset", () => {
        render(<ChartHost element={el({ option: { series: [{ type: "bar", data: [1, 2] }] } })} slideWidthPx={960} />);
        render(<ChartHost element={el({ option: { dataset: { source: [[1, 2]] }, series: [{ type: "bar" }] } })} slideWidthPx={960} />);
        // A `dataset` with no explicit series is a legitimate ECharts shape:
        // the chart type comes from the dataset wiring. Warning on it would be
        // a false positive, and a warning people learn to ignore is worse than
        // none at all.
        render(<ChartHost element={el({ option: { dataset: { source: [[1, 2]] } } })} slideWidthPx={960} />);

        expect(warn).not.toHaveBeenCalled();
    });

    it("does not throw when option is not an object at all", () => {
        // A deck written by the PHP engine serialises an empty option as `[]`.
        expect(() => render(<ChartHost element={el({ option: [] })} slideWidthPx={960} />)).not.toThrow();
        expect(() => render(<ChartHost element={el({ option: "nonsense" })} slideWidthPx={960} />)).not.toThrow();
    });
});
