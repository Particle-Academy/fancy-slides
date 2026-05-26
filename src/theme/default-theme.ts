import type { Theme } from "../types";

/**
 * The default Fancy UI deck theme. Conservative neutral palette, modern
 * geometric typography, 16:9 ratio. Custom themes can extend this — see
 * `defineTheme()` in `./theme-utils`.
 */
export const defaultTheme: Theme = {
    name: "default",
    aspectRatio: 16 / 9,
    slideWidth: 1920,
    colors: {
        background: "#ffffff",
        text: "#0f172a",
        muted: "#64748b",
        accent: "#8b5cf6",
        surface: "#f8fafc",
    },
    fonts: {
        heading: '"Instrument Sans", ui-sans-serif, system-ui, sans-serif',
        body: '"Instrument Sans", ui-sans-serif, system-ui, sans-serif',
        mono: 'ui-monospace, "JetBrains Mono", "Fira Code", monospace',
    },
    defaultTransition: { kind: "fade", duration: 200 },
};

/** Dark inverse of the default theme. */
export const darkTheme: Theme = {
    ...defaultTheme,
    name: "dark",
    colors: {
        background: "#0b1220",
        text: "#f8fafc",
        muted: "#94a3b8",
        accent: "#a855f7",
        surface: "#1e293b",
    },
};

/** A loud, brand-forward theme — handy for marketing decks. */
export const vividTheme: Theme = {
    ...defaultTheme,
    name: "vivid",
    colors: {
        background: "#0f172a",
        text: "#f8fafc",
        muted: "#cbd5e1",
        accent: "#22d3ee",
        surface: "#1e293b",
    },
};

export const builtinThemes: Record<string, Theme> = {
    default: defaultTheme,
    dark: darkTheme,
    vivid: vividTheme,
};
