import type { ImageElement } from "../../../types";

export interface ImageElementRendererProps {
    element: ImageElement;
}

export function ImageElementRenderer({ element }: ImageElementRendererProps) {
    return (
        <img
            src={element.src}
            alt={element.alt ?? ""}
            style={{
                width: "100%",
                height: "100%",
                objectFit: element.fit ?? "contain",
                display: "block",
            }}
            draggable={false}
        />
    );
}
