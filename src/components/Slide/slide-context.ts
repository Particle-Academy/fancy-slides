import { createContext, useContext } from "react";
import type { Theme } from "../../types";

/**
 * What the surrounding <Slide> knows about itself. Exposed to children
 * (including `renderElement` callbacks and registry hosts like chart-host)
 * via React context so they can react to the deck's theme without the
 * renderElement signature having to carry it around.
 */
export interface SlideContextValue {
    /** Fully-resolved theme (merged with defaults). */
    theme: Theme;
    /**
     * Heuristic: true when the resolved background is dark enough that
     * native-rendered widgets (charts, code blocks) should use a dark variant.
     * Computed once from `theme.colors.background` luminance.
     */
    isDark: boolean;
    /** Slide width in CSS pixels at the current render size. */
    slideWidthPx: number;
}

export const SlideContext = createContext<SlideContextValue | null>(null);

/**
 * Read the surrounding <Slide>'s context. Returns null when called outside
 * a Slide — chart-host / code-host can use that signal to fall back to
 * a sensible default (light theme, no resize anchor).
 */
export function useSlideContext(): SlideContextValue | null {
    return useContext(SlideContext);
}

/**
 * Convenience: returns the resolved theme, or undefined when the caller
 * isn't inside a Slide.
 */
export function useSlideTheme(): Theme | undefined {
    return useContext(SlideContext)?.theme;
}

/**
 * Convenience: returns true when the surrounding slide's background reads
 * as "dark enough" — useful for charts/code blocks that ship a dark variant.
 */
export function useIsDarkSlide(): boolean {
    return useContext(SlideContext)?.isDark ?? false;
}

/** Compute `isDark` from a hex/rgb colour. Used by Slide when building the context. */
export function isDarkColor(color: string): boolean {
    // Normalise #rgb / #rrggbb / rgb()/rgba() to a triple.
    const m = color.match(/^#([0-9a-f]{3,8})$/i);
    if (m) {
        let hex = m[1];
        if (hex.length === 3) {
            hex = hex.split("").map((c) => c + c).join("");
        }
        if (hex.length >= 6) {
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            return relativeLuminance(r, g, b) < 0.5;
        }
    }
    const rgb = color.match(/rgba?\(([^)]+)\)/i);
    if (rgb) {
        const [r, g, b] = rgb[1].split(",").map((s) => parseInt(s.trim(), 10));
        if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
            return relativeLuminance(r, g, b) < 0.5;
        }
    }
    return false;
}

function relativeLuminance(r: number, g: number, b: number): number {
    // Standard sRGB → relative luminance.
    const toLinear = (c: number) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}
