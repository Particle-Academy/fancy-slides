import type { ShapeElement, Theme } from "../../../types";
import { resolveTheme } from "../../../theme/theme-utils";

export interface ShapeElementRendererProps {
    element: ShapeElement;
    theme?: Theme;
    slideWidthPx: number;
    /** Rendered slide height. Defaults to the width over `theme.aspectRatio` (16:9). */
    slideHeightPx?: number;
}

/**
 * SVG-rendered shape primitive. Sized to fill its element box; the box
 * decides world position via the parent Slide's positioning wrapper.
 */
export function ShapeElementRenderer({ element, theme, slideWidthPx, slideHeightPx }: ShapeElementRendererProps) {
    const t = resolveTheme(theme);
    const designWidth = t.slideWidth ?? 1920;
    const scale = slideWidthPx / designWidth;
    const heightPx = slideHeightPx ?? slideWidthPx / (t.aspectRatio ?? 16 / 9);

    const fill = element.fill ?? "rgba(139, 92, 246, 0.15)";
    const stroke = element.stroke ?? t.colors?.accent ?? "#8b5cf6";
    const strokeWidth = (element.strokeWidth ?? 2) * scale;
    const dasharray = element.dashed ? `${6 * scale} ${4 * scale}` : undefined;

    // The SVG is a 0..100 viewBox stretched to the box, so stroke width has to
    // be kept in screen pixels (vectorEffect below) and a corner radius has to
    // be converted per axis, or it stops being a pixel length.
    const corner = cornerRadius(element, scale, element.w * slideWidthPx, element.h * heightPx);

    return (
        <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ width: "100%", height: "100%", display: "block", overflow: "visible" }}
        >
            {renderShape(element, { fill, stroke, strokeWidth, dasharray, corner })}
        </svg>
    );
}

/**
 * A `rounded-rect`'s corner as viewBox units on each axis.
 *
 * `radius` is documented, and used by the pptx writer, as design pixels. It was
 * drawn as `rx = ry = radius` in the stretched 0..100 viewBox, which made it a
 * PERCENTAGE of the box on each axis: 8 on a wide box was a long flat ellipse of
 * a corner, and the same deck rounded differently in fancy-slides and in
 * PowerPoint. Now it is `radius` design pixels on both axes, capped at half the
 * shorter side, which is where PowerPoint's roundRect stops too.
 */
export function cornerRadius(element: ShapeElement, scale: number, boxWidthPx: number, boxHeightPx: number): { rx: number; ry: number } {
    if (boxWidthPx <= 0 || boxHeightPx <= 0) return { rx: 0, ry: 0 };
    const px = Math.min(Math.max(0, (element.radius ?? 8) * scale), boxWidthPx / 2, boxHeightPx / 2);
    return { rx: (px / boxWidthPx) * 100, ry: (px / boxHeightPx) * 100 };
}

interface ShapeStyle {
    fill: string;
    stroke: string;
    strokeWidth: number;
    dasharray?: string;
    corner: { rx: number; ry: number };
}

function renderShape(el: ShapeElement, s: ShapeStyle) {
    // vectorEffect="non-scaling-stroke" keeps the visible stroke at the
    // pixel width we asked for, regardless of how the parent SVG's
    // `preserveAspectRatio="none"` stretches the viewBox. Without this,
    // narrow arrow / line boxes shrink the stroke into invisibility because
    // the y-axis is squashed.
    const common = {
        fill: s.fill,
        stroke: s.stroke,
        strokeWidth: s.strokeWidth,
        strokeDasharray: s.dasharray,
        vectorEffect: "non-scaling-stroke" as const,
    };
    switch (el.shape) {
        case "rect":
            return <rect x="0" y="0" width="100" height="100" {...common} />;
        case "rounded-rect":
            return <rect x="0" y="0" width="100" height="100" rx={s.corner.rx} ry={s.corner.ry} {...common} />;
        case "ellipse":
            return <ellipse cx="50" cy="50" rx="50" ry="50" {...common} />;
        case "triangle":
            return <polygon points="50,0 100,100 0,100" {...common} />;
        case "line":
            return <line x1="0" y1="50" x2="100" y2="50" {...common} fill="none" />;
        case "arrow":
            // Render the arrow as a polyline shaft + an inline triangular
            // head built from the same SVG geometry. Avoids SVG markers,
            // which scale with stroke-width and turn into specks at tile
            // sizes.
            return (
                <g>
                    <line x1="0" y1="50" x2="85" y2="50" {...common} fill="none" />
                    <polygon points="100,50 80,30 80,70" fill={s.stroke} stroke="none" />
                </g>
            );
        default:
            return null;
    }
}
