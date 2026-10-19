// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { fontStack } from "../../../utils/font-stack";
import { TextElementRenderer } from "../../../components/elements/TextElement";
import type { ChartElement, TextElement as TextElementType } from "../../../types";

/**
 * A slide draws the way the same deck prints.
 *
 * Found by putting a deck agent's file beside LibreOffice's render of it:
 *  - every chart was 400px tall whatever its frame (fancy-echarts' default
 *    height won, because ChartHost passed no size), so it ran out of the
 *    frame and its axis was cut;
 *  - a theme face the browser does not have fell back to the browser's serif,
 *    so a Poppins / Inter deck drew its titles in Times;
 *  - text clipped at its box and stood at 1.4 line height, where PowerPoint
 *    lets text run on and sets single spacing at about 1.2 -- the last line of
 *    a takeaway vanished here and printed there.
 */

const received: { style?: Record<string, unknown>; option?: unknown }[] = [];
vi.mock("@particle-academy/fancy-echarts", () => ({
    EChart: (props: { style?: Record<string, unknown>; option?: unknown }) => {
        received.push(props);
        return <div data-testid="echart" />;
    },
    registerAll: () => {},
    registerBuiltinThemes: () => {},
}));

describe("viewer fidelity", () => {
    it("draws a chart to its frame, not fancy-echarts' 400px default", async () => {
        const { default: ChartHost } = await import("../chart-host");
        const element = {
            id: "c", type: "chart", x: 0, y: 0, w: 0.5, h: 0.5,
            option: { xAxis: { data: ["A"] }, series: [{ type: "bar", data: [1] }] },
        } as ChartElement;
        render(<ChartHost element={element} slideWidthPx={960} />);
        await waitFor(() => expect(received.length).toBeGreaterThan(0));
        expect(received[received.length - 1]!.style).toMatchObject({ width: "100%", height: "100%" });
    });

    it("lays a chart out as a slide chart: tight grid, labels contained, slide showing through", async () => {
        const { default: ChartHost } = await import("../chart-host");
        const element = {
            id: "c", type: "chart", x: 0, y: 0, w: 0.5, h: 0.3,
            option: { xAxis: { data: ["A"] }, series: [{ type: "bar", data: [1] }] },
        } as ChartElement;
        render(<ChartHost element={element} slideWidthPx={960} />);
        await waitFor(() => expect(received.length).toBeGreaterThan(0));
        const option = (received[received.length - 1] as { option?: Record<string, unknown> }).option!;
        // ECharts' own default grid keeps ~60px top and bottom: a 160px frame
        // was left a 40px plot with its axis labels piled on each other.
        expect(option.grid).toMatchObject({ containLabel: true });
        expect((option.grid as { top: number }).top).toBeLessThan(40);
        expect(option.backgroundColor).toBe("transparent");

        // The author's own layout wins.
        render(<ChartHost element={{ ...element, option: { ...element.option, grid: { top: 80 }, backgroundColor: "#111" } }} slideWidthPx={960} />);
        await waitFor(() => expect(((received[received.length - 1] as { option?: { grid?: { top?: number } } }).option!.grid!.top)).toBe(80));
    });

    it("shows every category and puts bar values above the bar, as the deck prints them", async () => {
        const { slideChartOption } = await import("../chart-host");
        const o = slideChartOption({
            xAxis: { type: "category", data: ["Leeds", "Bristol", "Glasgow", "Norwich"] },
            series: [{ type: "bar", label: { show: true }, data: [96.1, 95.4, 93.8, 90.7] }, { type: "line", label: { show: true }, data: [1, 2, 3, 4] }],
        }) as { xAxis: { axisLabel: { interval: number } }; series: { label: { position?: string } }[] };
        expect(o.xAxis.axisLabel.interval).toBe(0);
        expect(o.series[0]!.label.position).toBe("top");
        expect(o.series[1]!.label.position).toBe("top");

        const own = slideChartOption({
            xAxis: { type: "category", axisLabel: { interval: 1 }, data: ["A"] },
            series: [{ type: "bar", label: { show: true, position: "inside" }, data: [1] }],
        }) as { xAxis: { axisLabel: { interval: number } }; series: { label: { position?: string } }[] };
        expect(own.xAxis.axisLabel.interval).toBe(1);
        expect(own.series[0]!.label.position).toBe("inside");
    });

    it("gives every theme face a generic fallback, quoting names with spaces", () => {
        expect(fontStack("Poppins")).toBe("Poppins, ui-sans-serif, system-ui, sans-serif");
        expect(fontStack("Playfair Display")).toBe('"Playfair Display", ui-sans-serif, system-ui, sans-serif');
        expect(fontStack("Fira Code", "mono")).toBe('"Fira Code", ui-monospace, SFMono-Regular, Menlo, monospace');
        expect(fontStack(undefined)).toBe("ui-sans-serif, system-ui, sans-serif");
        // A stack the author wrote is left as written.
        expect(fontStack("Georgia, serif")).toBe("Georgia, serif");
    });

    it("sets text at PowerPoint's single spacing and lets it run past its box, as the file does", () => {
        const element = { id: "t", type: "text", x: 0, y: 0, w: 0.3, h: 0.05, content: "Norwich fell to 90.7%" } as TextElementType;
        const { container } = render(<TextElementRenderer element={element} theme={{ name: "t" }} slideWidthPx={960} />);
        const node = container.querySelector<HTMLElement>("[style*='font-size']")!;
        expect(node.style.lineHeight).toBe("1.2");
        expect(node.style.overflow).toBe("visible");
        expect(node.style.fontFamily).toContain("sans-serif");
    });
});
