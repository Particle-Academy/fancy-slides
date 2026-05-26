import type { Theme } from "../types";
import { defaultTheme } from "./default-theme";

/**
 * Merge a partial theme with the defaults so consumers can override just the
 * pieces they care about (colors, fonts, aspect ratio) and inherit the rest.
 */
export function defineTheme(overrides: Partial<Theme> & { name: string }): Theme {
    return {
        ...defaultTheme,
        ...overrides,
        colors: { ...defaultTheme.colors, ...overrides.colors },
        fonts: { ...defaultTheme.fonts, ...overrides.fonts },
        defaultTransition: overrides.defaultTransition ?? defaultTheme.defaultTransition,
    };
}

/** Resolve the effective theme for a deck — applies the default for any missing fields. */
export function resolveTheme(theme: Theme | undefined): Theme {
    if (!theme) return defaultTheme;
    return defineTheme(theme);
}
