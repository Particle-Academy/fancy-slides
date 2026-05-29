import type { CSSProperties } from "react";
import type { ImageElement } from "../../../types";

export interface ImageElementRendererProps {
    element: ImageElement;
}

/**
 * Renders an image element. When `element.crop` is set (a window in
 * image-relative 0..1 coords `{x,y,w,h}`), the image is shown cropped to that
 * window: an `overflow:hidden` box clips an inner `<img>` that's been scaled up
 * by `1/w` × `1/h` and offset so the crop window exactly fills the box. Without
 * a crop it's the plain `object-fit` image. The same renderer feeds both the
 * editor canvas and the viewer, so a crop is visible everywhere.
 */
export function ImageElementRenderer({ element }: ImageElementRendererProps) {
    const crop = element.crop;
    const fit = element.fit ?? "contain";

    if (crop && crop.w > 0 && crop.h > 0) {
        // The inner image is scaled so the crop window (fraction w×h of the
        // image) fills 100% of the box; then translated so the window's
        // top-left aligns with the box's top-left.
        const inner: CSSProperties = {
            position: "absolute",
            left: 0,
            top: 0,
            width: `${(1 / crop.w) * 100}%`,
            height: `${(1 / crop.h) * 100}%`,
            transform: `translate(${(-crop.x / crop.w) * 100}%, ${(-crop.y / crop.h) * 100}%)`,
            transformOrigin: "top left",
            objectFit: fit,
            display: "block",
        };
        return (
            <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
                <img src={element.src} alt={element.alt ?? ""} style={inner} draggable={false} />
            </div>
        );
    }

    return (
        <img
            src={element.src}
            alt={element.alt ?? ""}
            style={{
                width: "100%",
                height: "100%",
                objectFit: fit,
                display: "block",
            }}
            draggable={false}
        />
    );
}
