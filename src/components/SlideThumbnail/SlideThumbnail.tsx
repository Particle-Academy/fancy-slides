import type { CSSProperties, ReactNode } from "react";
import type { Slide as SlideData, SlideElement, Theme } from "../../types";
import { Slide } from "../Slide";
import { resolveTheme } from "../../theme/theme-utils";
import { cn } from "../../utils/cn";

export interface SlideThumbnailProps {
    slide: SlideData;
    theme?: Theme;
    /** Width of the thumbnail in px. Height comes from the theme's aspect ratio. */
    width?: number;
    /** When true, the thumbnail is rendered with a focused outline. */
    active?: boolean;
    onClick?: () => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    renderElement?: (element: SlideElement, slideWidthPx: number) => ReactNode | undefined;
    className?: string;
    style?: CSSProperties;
}

/**
 * Compact slide preview. Used by the slide rail in the editor, by the
 * presenter view, and anywhere else a deck wants to show its slides as
 * thumbnails. Re-uses the shared <Slide> so the layout matches the viewer
 * exactly — no second rendering path.
 *
 * The slide is rendered at its full DESIGN width and the whole thing is
 * CSS-`scale()`d down to the thumbnail size (the same approach fancy-artboard
 * uses for its piece previews). Scaling the rendered output — rather than
 * rendering the slide *at* the thumbnail width — is what makes heavy embedded
 * surfaces (ECharts charts, the fancy-code editor) shrink proportionally:
 * those render at fixed internal font sizes that ignore `slideWidthPx`, so a
 * directly-undersized render leaves them oversized in the thumb. A uniform
 * transform shrinks everything identically, so the thumb is a faithful
 * miniature of the live slide.
 */
export function SlideThumbnail({
    slide,
    theme,
    width = 200,
    active = false,
    onClick,
    onContextMenu,
    renderElement,
    className,
    style,
}: SlideThumbnailProps) {
    const resolved = resolveTheme(theme);
    const ratio = resolved.aspectRatio ?? 16 / 9;
    const designWidth = resolved.slideWidth ?? 1280;
    const scale = width / designWidth;
    const height = width / ratio;

    return (
        <div
            className={cn("fs-thumbnail", className)}
            style={{
                cursor: onClick ? "pointer" : "default",
                borderRadius: 6,
                border: active ? "2px solid #8b5cf6" : "1px solid rgba(0,0,0,0.08)",
                overflow: "hidden",
                boxShadow: active ? "0 0 0 3px rgba(139, 92, 246, 0.2)" : "0 1px 2px rgba(0,0,0,0.05)",
                background: "#ffffff",
                width,
                height,
                ...style,
            }}
            onClick={onClick}
            onContextMenu={onContextMenu}
            data-fancy-slides-thumbnail={slide.id}
        >
            <div
                style={{
                    width: designWidth,
                    height: designWidth / ratio,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    // The thumb owns interaction — charts/code/iframes inside the
                    // scaled slide shouldn't capture clicks.
                    pointerEvents: "none",
                }}
            >
                <Slide slide={slide} theme={theme} width={designWidth} renderElement={renderElement} />
            </div>
        </div>
    );
}
