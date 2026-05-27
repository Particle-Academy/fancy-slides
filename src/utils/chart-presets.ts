/**
 * Starter ECharts option objects for each `ChartKind`. Used by
 * `DeckEditor.insertChart(kind)` so each toolbar dropdown choice spawns
 * a renderable chart with sensible defaults — bar/line/area on a
 * Q1-Q4 category axis, pie with three slices, scatter with a small
 * random cluster.
 *
 * Once the agent or user edits the chart's `option`, the original
 * `kind` is irrelevant — `option.series[0].type` is the source of
 * truth from then on.
 */

export type ChartKind = "bar" | "line" | "pie" | "area" | "scatter";

type Option = Record<string, unknown>;

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const REVENUE = [24000, 38000, 31000, 47000];

export function chartStarterOption(kind: ChartKind): Option {
    switch (kind) {
        case "bar":
            return {
                grid: { top: 24, left: 56, right: 16, bottom: 32 },
                tooltip: { trigger: "axis" },
                xAxis: { type: "category", data: [...QUARTERS] },
                yAxis: { type: "value" },
                series: [{ type: "bar", name: "Revenue", data: [...REVENUE] }],
            };

        case "line":
            return {
                grid: { top: 24, left: 56, right: 16, bottom: 32 },
                tooltip: { trigger: "axis" },
                xAxis: { type: "category", data: [...QUARTERS] },
                yAxis: { type: "value" },
                series: [{ type: "line", name: "Revenue", smooth: true, data: [...REVENUE] }],
            };

        case "area":
            return {
                grid: { top: 24, left: 56, right: 16, bottom: 32 },
                tooltip: { trigger: "axis" },
                xAxis: { type: "category", data: [...QUARTERS] },
                yAxis: { type: "value" },
                series: [
                    {
                        type: "line",
                        name: "Revenue",
                        smooth: true,
                        areaStyle: {},
                        data: [...REVENUE],
                    },
                ],
            };

        case "pie":
            return {
                tooltip: { trigger: "item" },
                legend: { bottom: 0 },
                series: [
                    {
                        type: "pie",
                        radius: ["40%", "70%"],
                        name: "Segment",
                        data: [
                            { value: 1048, name: "Direct" },
                            { value: 735, name: "Search" },
                            { value: 580, name: "Email" },
                        ],
                    },
                ],
            };

        case "scatter":
            return {
                grid: { top: 24, left: 48, right: 16, bottom: 32 },
                tooltip: { trigger: "item" },
                xAxis: { type: "value" },
                yAxis: { type: "value" },
                series: [
                    {
                        type: "scatter",
                        name: "Points",
                        symbolSize: 12,
                        data: [
                            [10.0, 8.04],
                            [8.0, 6.95],
                            [13.0, 7.58],
                            [9.0, 8.81],
                            [11.0, 8.33],
                            [14.0, 9.96],
                            [6.0, 7.24],
                            [4.0, 4.26],
                            [12.0, 10.84],
                            [7.0, 4.82],
                            [5.0, 5.68],
                        ],
                    },
                ],
            };
    }
}
