import { useId, type CSSProperties } from "react";
import { ContentRenderer } from "@particle-academy/react-fancy";
import type { TextElement, Theme } from "../../../types";
import { resolveTheme } from "../../../theme/theme-utils";

export interface TextElementRendererProps {
    element: TextElement;
    theme?: Theme;
    /** Rendered slide width in px (for font-size scaling). */
    slideWidthPx: number;
    /**
     * Edit mode — when true, the element is potentially editable.
     * The textarea actually becomes pointer-interactive only when both
     * `editing` and `selected` are true, so the first click on an
     * unselected text element selects it (handled by the parent Slide)
     * rather than landing on the textarea.
     */
    editing?: boolean;
    /** Element is selected — gates whether the textarea grabs pointer events. */
    selected?: boolean;
    /** Called when the user edits the content (only fires when the textarea is focusable). */
    onContentChange?: (content: string) => void;
}

/**
 * Renderer for `text` elements. Three formats:
 *
 *   - `"markdown"` (default) — parsed via react-fancy's ContentRenderer.
 *     Bullets, bold/italic, code spans, links, headings.
 *   - `"html"` — parsed sanitized HTML via ContentRenderer's html path.
 *   - `"plain"` — raw text rendered into a single block; preserves newlines
 *     via `white-space: pre-wrap`.
 *
 * In editing mode + when the element is selected, the renderer swaps to a
 * textarea showing the raw source. Edits flow back via `onContentChange`.
 */
export function TextElementRenderer({
    element,
    theme,
    slideWidthPx,
    editing = false,
    selected = false,
    onContentChange,
}: TextElementRendererProps) {
    const t = resolveTheme(theme);
    const style = element.style ?? {};
    const designWidth = t.slideWidth ?? 1920;
    const scale = slideWidthPx / designWidth;
    const format = element.format ?? "markdown";
    const scopeId = useId();

    const css: CSSProperties = {
        fontFamily: style.fontFamily ?? t.fonts?.body,
        fontSize: `${(style.fontSize ?? 28) * scale}px`,
        fontWeight: weight(style.weight) ?? 400,
        fontStyle: style.italic ? "italic" : "normal",
        textDecoration: style.underline ? "underline" : "none",
        color: style.color ?? t.colors?.text,
        textAlign: style.align ?? "left",
        lineHeight: style.lineHeight ?? 1.4,
        display: "flex",
        flexDirection: "column",
        justifyContent:
            style.verticalAlign === "middle" ? "center" : style.verticalAlign === "bottom" ? "flex-end" : "flex-start",
        width: "100%",
        height: "100%",
        padding: 0,
        margin: 0,
        outline: "none",
        background: "transparent",
        whiteSpace: format === "plain" ? "pre-wrap" : "normal",
        wordBreak: "break-word",
        overflow: "hidden",
    };

    // Edit mode is gated by selection: an unselected element in the editor
    // still shows the parsed markdown so the user sees the real layout.
    // Clicking selects → textarea appears with the raw source, ready to edit.
    if (editing && selected) {
        return (
            <textarea
                value={element.content}
                onChange={(e) => onContentChange?.(e.target.value)}
                style={{
                    ...css,
                    whiteSpace: "pre-wrap",
                    resize: "none",
                    border: "none",
                    pointerEvents: "auto",
                    cursor: "text",
                }}
            />
        );
    }

    if (format === "plain") {
        return <div style={css}>{element.content}</div>;
    }

    // Scope the ContentRenderer's prose styles so element-level typography
    // (fontSize, weight, align) wins over the global prose CSS. We render a
    // tiny inline style block that targets only this instance via the
    // generated useId scope.
    //
    // CRITICAL: ContentRenderer wraps its content in `text-sm` plus per-tag
    // Tailwind utilities (`[&_h1]:text-2xl`, etc). Those have higher
    // specificity than the inline `fontSize` we set on the wrapper, so
    // without forced overrides the slide text ignores `style.fontSize` AND
    // ignores the slide's resolution scaling — that's why thumbnails were
    // rendering text at ~14px instead of (fontSize × scale)px.
    //
    // We double the attribute-selector to outrank Tailwind's
    // `[&_h2]:text-xl`-style utilities, and re-express heading sizes in
    // `em` so they remain proportional as the slide scales.
    const proseScope = `[data-fs-text-scope="${scopeId}"]`;
    const doubleScope = `${proseScope}${proseScope}`;
    return (
        <div data-fs-text-scope={scopeId} style={css}>
            <style>{`
                ${proseScope} > div { width: 100%; height: 100%; font-size: inherit; }
                ${doubleScope} :is(p, ul, ol, li, blockquote, h1, h2, h3, h4, h5, h6, pre, code, strong, em, a) {
                    font-size: inherit;
                }
                ${doubleScope} h1 { font-size: 1.6em; font-weight: 700; }
                ${doubleScope} h2 { font-size: 1.35em; font-weight: 700; }
                ${doubleScope} h3 { font-size: 1.15em; font-weight: 600; }
                ${proseScope} :where(p, ul, ol, h1, h2, h3, h4, h5, h6, pre, blockquote) {
                    margin: 0;
                    padding: 0;
                }
                ${proseScope} :where(p, li) + :where(p, li, ul, ol) { margin-top: 0.4em; }
                ${proseScope} :where(ul, ol) { padding-left: 1.4em; }
                ${proseScope} :where(strong) { font-weight: ${Math.max(700, weight(style.weight) ?? 400 + 200)}; }
                ${proseScope} :where(a) { color: inherit; text-decoration: underline; }
                ${proseScope} :where(code) { font-family: ${t.fonts?.mono ?? "monospace"}; }
            `}</style>
            <ContentRenderer value={element.content} format={format === "html" ? "html" : "markdown"} />
        </div>
    );
}

function weight(w: "normal" | "medium" | "semibold" | "bold" | number | undefined): number | undefined {
    if (typeof w === "number") return w;
    if (w === "normal") return 400;
    if (w === "medium") return 500;
    if (w === "semibold") return 600;
    if (w === "bold") return 700;
    return undefined;
}
