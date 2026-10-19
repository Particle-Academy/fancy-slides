import type { TableColumn, TableElement, Theme } from "../types";

/**
 * A table cell's look, resolved the way dark-slide's `TableResolver` resolves it,
 * so a deck draws here as it prints:
 *
 *     cell > row > column > band (header | stripe | body) > table > theme > default
 *
 * An ABSENT key falls through to the next layer; `false` stops the chain and
 * means off (no fill, no borders). Lengths are design pixels on the deck canvas
 * (`theme.slideWidth`, 1920 by default) and are scaled by the caller.
 *
 * Kept to what a viewer draws: fill, text colour, weight, slant, underline,
 * alignment, vertical anchor, size, face and borders.
 */
export interface CellLook {
    text: string;
    fill: string | null;
    color: string;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    align: "left" | "center" | "right" | "justify";
    anchor: "top" | "middle" | "bottom";
    fontSize: number;
    fontFamily: string | null;
    /** A border colour, or null for none. One rule for all four sides. */
    border: string | null;
    /** The border width, design px (0.75pt default = 2px on the 1920 canvas). */
    borderWidth: number;
}

const STYLE_KEYS = ["fill", "color", "bold", "italic", "underline", "align", "anchor", "fontSize", "fontFamily", "borders"] as const;

export const DEFAULT_FONT_SIZE = 28;
const DEFAULT_BODY_COLOR = "#0F172A";
const DEFAULT_HEADER_COLOR = "#FFFFFF";
const DEFAULT_ACCENT = "#8B5CF6";
const DEFAULT_STRIPE_FILL = "#F8FAFC";
const DEFAULT_BORDER_COLOR = "#D9DEE4";
/** 0.75pt on a 720pt slide, in design px on the 1920 canvas. */
const DEFAULT_BORDER_PX = 2;

type Layer = Record<string, unknown>;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function styleKeys(source: unknown): Layer {
    const out: Layer = {};
    if (!isObject(source)) return out;
    for (const k of STYLE_KEYS) {
        if (k in source && source[k] !== null && source[k] !== undefined) out[k] = source[k];
    }
    return out;
}

function themeColor(theme: Theme | undefined, key: "text" | "accent" | "surface" | "background", fallback: string): string {
    const v = theme?.colors?.[key];
    return typeof v === "string" && v !== "" ? v : fallback;
}

function hex6(color: string): string | null {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
    if (!m) return null;
    const h = m[1]!;
    return (h.length === 3 ? h.split("").map((c) => c + c).join("") : h).toUpperCase();
}

/** The stripe band dark-slide draws: theme surface; on a dark theme, background 8% toward text; else light. */
function stripeDefault(theme: Theme | undefined): string {
    const surface = theme?.colors?.surface;
    if (typeof surface === "string" && surface !== "") return surface;
    const bg = hex6(themeColor(theme, "background", "#FFFFFF")) ?? "FFFFFF";
    const lum = (299 * parseInt(bg.slice(0, 2), 16) + 587 * parseInt(bg.slice(2, 4), 16) + 114 * parseInt(bg.slice(4, 6), 16)) / 255000;
    if (lum >= 0.5) return DEFAULT_STRIPE_FILL;
    const text = hex6(themeColor(theme, "text", "#F9FAFB")) ?? "F9FAFB";
    let out = "#";
    for (const i of [0, 2, 4]) {
        const x = parseInt(bg.slice(i, i + 2), 16);
        const y = parseInt(text.slice(i, i + 2), 16);
        out += (x + Math.trunc(((y - x) * 8) / 100)).toString(16).toUpperCase().padStart(2, "0");
    }
    return out;
}

/** A cell value: a string/number, or an object carrying `text` and its own style keys. */
export function cellSpec(value: unknown): Layer & { text: string } {
    if (isObject(value) && ("text" in value || STYLE_KEYS.some((k) => k in value))) {
        return { ...styleKeys(value), text: value.text == null ? "" : String(value.text) };
    }
    if (value == null) return { text: "" };
    if (typeof value === "object") return { text: JSON.stringify(value) };
    return { text: String(value) };
}

/**
 * Resolve one cell. `bodyIndex` counts body rows from 0 (the header is not one);
 * striping applies to odd body rows, as dark-slide stripes them.
 */
export function resolveCell(
    element: TableElement,
    theme: Theme | undefined,
    column: TableColumn,
    value: unknown,
    position: { header: true } | { header: false; bodyIndex: number; row?: unknown },
): CellLook {
    const style: Layer = isObject((element as { style?: unknown }).style) ? ((element as { style?: unknown }).style as Layer) : {};

    const defaults: Layer = { color: themeColor(theme, "text", DEFAULT_BODY_COLOR), align: "left", anchor: "middle", fontSize: DEFAULT_FONT_SIZE };
    let band: Layer = {};
    if (position.header) {
        band = { fill: themeColor(theme, "accent", DEFAULT_ACCENT), color: DEFAULT_HEADER_COLOR, bold: true, ...(isObject(style.header) ? styleKeys(style.header) : {}) };
    } else {
        band = isObject(style.body) ? styleKeys(style.body) : {};
        if (style.stripe !== false && position.bodyIndex % 2 === 1) {
            band = { ...band, fill: stripeDefault(theme), ...(isObject(style.stripe) ? styleKeys(style.stripe) : {}) };
        }
    }
    const spec = position.header ? { text: column.label ?? column.key } : cellSpec(value);
    const rowLayer = position.header ? {} : styleKeys(position.row);
    const layers: Layer[] = [defaults, styleKeys(style), band, styleKeys(column), rowLayer, spec];

    const r: Layer = {};
    let border: string | null = DEFAULT_BORDER_COLOR;
    let borderWidth = DEFAULT_BORDER_PX;
    for (const layer of layers) {
        for (const [k, v] of Object.entries(layer)) {
            if (k === "borders") {
                if (v === false || v === "none") {
                    border = null;
                } else if (isObject(v)) {
                    const all = isObject(v.all) ? v.all : v;
                    if (typeof all.color === "string") border = all.color;
                    if (typeof all.width === "number") borderWidth = all.width;
                }
                continue;
            }
            if (k !== "text") r[k] = v;
        }
    }

    const fill = r.fill;
    const align = r.align === "center" || r.align === "centre" ? "center" : r.align === "right" ? "right" : r.align === "justify" ? "justify" : "left";
    const anchor = r.anchor === "top" ? "top" : r.anchor === "bottom" ? "bottom" : "middle";
    return {
        text: spec.text,
        fill: fill === false || fill === "none" || fill == null ? null : String(fill),
        color: String(r.color),
        bold: r.bold === true,
        italic: r.italic === true,
        underline: r.underline === true,
        align,
        anchor,
        fontSize: typeof r.fontSize === "number" ? r.fontSize : Number(r.fontSize) || DEFAULT_FONT_SIZE,
        fontFamily: typeof r.fontFamily === "string" ? r.fontFamily : null,
        border,
        borderWidth,
    };
}
