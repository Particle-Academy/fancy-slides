import type { CSSProperties, ReactNode } from "react";
import type { Slide as SlideData, SlideElement, Theme } from "../../types";
import { Slide } from "../Slide";
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
                ...style,
            }}
            onClick={onClick}
            onContextMenu={onContextMenu}
            data-fancy-slides-thumbnail={slide.id}
        >
            <Slide slide={slide} theme={theme} width={width} renderElement={renderElement} />
        </div>
    );
}
