/**
 * Default element registry. Wires up the element types fancy-slides doesn't
 * render natively (chart / code / table / embed) by composing the other
 * fancy packages as optional peer deps.
 *
 * Hosts opt into this by importing from the `/registry` subpath:
 *
 *     import { defaultElementRegistry } from "@particle-academy/fancy-slides/registry";
 *     <DeckEditor renderElement={defaultElementRegistry} … />
 *
 * Keeping it behind a subpath means consumers who only render decks with
 * built-in element types (text / image / shape) never pull fancy-echarts,
 * fancy-code, or react-fancy Table into their bundle.
 */

import { lazy, Suspense } from "react";
import type { ChartElement, CodeElement, SlideElement, EmbedElement, TableElement } from "../types";

const ChartHost = lazy(() => import("./element-renderers/chart-host"));
const CodeHost = lazy(() => import("./element-renderers/code-host"));
const TableHost = lazy(() => import("./element-renderers/table-host"));
const EmbedHost = lazy(() => import("./element-renderers/embed-host"));

const Loading = ({ label }: { label: string }) => (
    <div
        style={{
            display: "grid",
            placeItems: "center",
            width: "100%",
            height: "100%",
            color: "rgba(0,0,0,0.4)",
            fontSize: 12,
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
    >
        {label}…
    </div>
);

/**
 * Renderer signature compatible with `Slide`'s `renderElement` prop. Returns
 * `undefined` for element types fancy-slides handles itself, so the call
 * site falls back to the built-in renderer.
 */
export function defaultElementRegistry(element: SlideElement, slideWidthPx: number) {
    switch (element.type) {
        case "chart":
            return (
                <Suspense fallback={<Loading label="Loading chart" />}>
                    <ChartHost element={element as ChartElement} slideWidthPx={slideWidthPx} />
                </Suspense>
            );
        case "code":
            return (
                <Suspense fallback={<Loading label="Loading code" />}>
                    <CodeHost element={element as CodeElement} />
                </Suspense>
            );
        case "table":
            return (
                <Suspense fallback={<Loading label="Loading table" />}>
                    <TableHost element={element as TableElement} />
                </Suspense>
            );
        case "embed":
            return (
                <Suspense fallback={<Loading label="Loading embed" />}>
                    <EmbedHost element={element as EmbedElement} />
                </Suspense>
            );
        default:
            return undefined;
    }
}
