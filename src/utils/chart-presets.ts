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

// ─── UI-driven chart model ───────────────────────────────────────────────────
//
// The inspector edits charts through a small, JSON-friendly model rather than
// raw ECharts option JSON. `chartModelFromOption` round-trips an existing
// option into this model (returning `null` when the option is too custom to
// represent), and `chartOptionFromModel` rebuilds a clean ECharts option from
// it. This keeps the friendly editor and the advanced JSON escape hatch in
// sync — both ultimately write `ChartElement.option`.

/** Default series palette — reused for new series + slices. */
export const CHART_PALETTE = [
    "#8b5cf6",
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#ec4899",
    "#14b8a6",
    "#6366f1",
];

/** A named series of per-category numeric values (bar / line / area / scatter). */
export interface ChartSeriesModel {
    name: string;
    color?: string;
    /** One value per category, aligned to `ChartModel.categories`. */
    values: number[];
}

/** A single pie slice. */
export interface ChartSliceModel {
    name: string;
    value: number;
}

/** The friendly chart model the inspector edits. */
export interface ChartModel {
    kind: ChartKind;
    /** x-axis category labels — used by bar/line/area/scatter. */
    categories: string[];
    /** Series — used by bar/line/area/scatter. */
    series: ChartSeriesModel[];
    /** Slices — used by pie. */
    slices: ChartSliceModel[];
}

/** Pick a palette color by index, wrapping around. */
export function chartColorAt(index: number): string {
    return CHART_PALETTE[index % CHART_PALETTE.length]!;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toNumber(v: unknown): number {
    const n = typeof v === "number" ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : 0;
}

/**
 * Parse an ECharts option into the friendly `ChartModel`. Returns `null` when
 * the option doesn't match one of the supported shapes (so the inspector can
 * fall back to the raw-JSON editor instead of silently mangling a custom
 * option).
 *
 * Supported shapes:
 *   - pie: a single `series` entry with `type: "pie"` and array `data` of
 *     `{ name, value }`.
 *   - bar/line/area/scatter: a categorical `xAxis.data` plus one or more
 *     `series` of the matching type with numeric (or `[i, v]`) `data`.
 */
export function chartModelFromOption(option: Record<string, unknown>): ChartModel | null {
    if (!isPlainObject(option)) return null;
    const seriesRaw = option.series;
    if (!Array.isArray(seriesRaw) || seriesRaw.length === 0) return null;
    if (!seriesRaw.every(isPlainObject)) return null;

    const types = (seriesRaw as Record<string, unknown>[]).map((s) => String(s.type ?? ""));

    // Pie — single series only.
    if (types[0] === "pie") {
        if (seriesRaw.length !== 1) return null;
        const data = (seriesRaw[0] as Record<string, unknown>).data;
        if (!Array.isArray(data)) return null;
        const slices: ChartSliceModel[] = [];
        for (const d of data) {
            if (!isPlainObject(d)) return null;
            slices.push({ name: String(d.name ?? ""), value: toNumber(d.value) });
        }
        return { kind: "pie", categories: [], series: [], slices };
    }

    // Cartesian — every series must share one of these types.
    const cartesian = new Set(["bar", "line", "scatter"]);
    if (!types.every((t) => cartesian.has(t))) return null;
    if (new Set(types).size !== 1) return null; // mixed types → too custom

    const baseType = types[0]!;
    const isArea = baseType === "line" && (seriesRaw as Record<string, unknown>[]).every((s) => isPlainObject(s.areaStyle) || s.areaStyle != null);
    const kind: ChartKind = baseType === "line" ? (isArea ? "area" : "line") : (baseType as ChartKind);

    const xAxis = option.xAxis;
    const axisData = isPlainObject(xAxis) ? xAxis.data : undefined;
    const categories: string[] = Array.isArray(axisData) ? axisData.map((c) => String(c)) : [];
    // Scatter often has no category axis; derive length from the first series.
    const firstData = (seriesRaw[0] as Record<string, unknown>).data;
    const valueCount = Array.isArray(firstData) ? firstData.length : 0;
    const cats = categories.length > 0 ? categories : Array.from({ length: valueCount }, (_, i) => String(i + 1));

    const series: ChartSeriesModel[] = [];
    for (const s of seriesRaw as Record<string, unknown>[]) {
        const data = s.data;
        if (!Array.isArray(data)) return null;
        const values: number[] = data.map((d) => {
            if (Array.isArray(d)) return toNumber(d[1]); // [x, y] pair → take y
            if (isPlainObject(d)) return toNumber((d as Record<string, unknown>).value);
            return toNumber(d);
        });
        series.push({ name: String(s.name ?? "Series"), color: typeof s.itemStyle === "object" && s.itemStyle && isPlainObject(s.itemStyle) ? (typeof s.itemStyle.color === "string" ? s.itemStyle.color : undefined) : (typeof s.color === "string" ? s.color : undefined), values });
    }

    return { kind, categories: cats, series, slices: [] };
}

/** Rebuild a clean ECharts option from the friendly `ChartModel`. */
export function chartOptionFromModel(model: ChartModel): Record<string, unknown> {
    if (model.kind === "pie") {
        return {
            tooltip: { trigger: "item" },
            legend: { bottom: 0 },
            color: model.slices.map((_, i) => chartColorAt(i)),
            series: [
                {
                    type: "pie",
                    radius: ["40%", "70%"],
                    name: "Segment",
                    data: model.slices.map((s) => ({ name: s.name, value: s.value })),
                },
            ],
        };
    }

    const isScatter = model.kind === "scatter";
    const isArea = model.kind === "area";
    const seriesType = model.kind === "bar" ? "bar" : model.kind === "scatter" ? "scatter" : "line";

    const series = model.series.map((s, i) => {
        const color = s.color ?? chartColorAt(i);
        const base: Record<string, unknown> = {
            type: seriesType,
            name: s.name,
            itemStyle: { color },
        };
        if (isScatter) {
            base.symbolSize = 12;
            base.data = s.values.map((v, idx) => [idx, v]);
        } else {
            base.data = s.values;
        }
        if (seriesType === "line") base.smooth = true;
        if (isArea) base.areaStyle = { color };
        return base;
    });

    return {
        grid: { top: 24, left: 56, right: 16, bottom: isScatter ? 32 : 40 },
        tooltip: { trigger: isScatter ? "item" : "axis" },
        legend: model.series.length > 1 ? { bottom: 0 } : undefined,
        xAxis: isScatter ? { type: "value" } : { type: "category", data: [...model.categories] },
        yAxis: { type: "value" },
        series,
    };
}
