import type { EmbedElement } from "../../types";

export default function EmbedHost({ element }: { element: EmbedElement }) {
    return (
        <iframe
            src={element.src}
            title={element.title ?? "Embedded content"}
            sandbox={element.sandbox ?? "allow-scripts"}
            style={{ width: "100%", height: "100%", border: 0, display: "block" }}
        />
    );
}
