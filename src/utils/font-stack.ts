/**
 * A CSS font-family for a theme face, with a generic fallback.
 *
 * A deck names brand faces ("Poppins", "Inter") that the viewing browser often
 * does not have. Without a fallback the browser picks its default, which is a
 * SERIF, so a sans-serif deck drew its titles in Times; PowerPoint and
 * LibreOffice substitute a sans. Names with spaces are quoted; a value that is
 * already a stack (it has a comma) is left as the author wrote it.
 */
const GENERIC = {
    sans: "ui-sans-serif, system-ui, sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

export function fontStack(face: string | null | undefined, kind: keyof typeof GENERIC = "sans"): string {
    const name = typeof face === "string" ? face.trim() : "";
    if (name === "") return GENERIC[kind];
    if (name.includes(",")) return name;
    const quoted = /\s/.test(name) && !/^["'].*["']$/.test(name) ? `"${name}"` : name;
    return `${quoted}, ${GENERIC[kind]}`;
}
