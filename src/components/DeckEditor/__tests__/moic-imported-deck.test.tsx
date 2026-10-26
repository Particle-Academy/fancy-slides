// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { StrictMode, useState } from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import type { Deck } from "../../../types";
import { DeckEditor } from "../index";
import { SlideViewer } from "../../SlideViewer";

/*
 * Reported by MOIC. The deck below is a pptx written by dark-slide 0.21.0
 * `toBytes` and read back with `DarkSlide::read` -- exactly what MOIC's server
 * hands to both the viewer and the editor.
 *
 * Bug 1: the editor drew "—" where the viewer drew "Q3 review". (a) and (b)
 *        guard that the editor and viewer draw the same text from the same
 *        renderer. They PASSED on the code as reported: the renderers never
 *        diverged. The dash is the real text drawn tiny -- fontSize 28 is design
 *        px on a 1920 canvas, so a 152px rail thumb sets it at ~2px and a
 *        ~370px canvas at ~5px. Measured in Chromium, not in jsdom.
 * Bug 2: a controlled editor called onChange on mount, before any edit, so the
 *        host could not tell "opened" from "edited".
 */

afterEach(cleanup);

const MOIC_JSON =
    '{"id":"imported-342d85a3","title":"Q3 review","theme":{"name":"imported","colors":{"background":"#FFFFFF","text":"#0F172A","accent":"#8B5CF6","muted":"#44546A","surface":"#E7E6E6"},"fonts":{"heading":"Calibri","body":"Calibri"}},"slides":[{"id":"imported-slide-1","layout":"blank","elements":[{"id":"e1","x":0.1,"y":0.3,"w":0.8,"h":0.2,"type":"text","content":"Q3 review","format":"plain","style":{"fontSize":28,"color":"#0F172A"}}]},{"id":"imported-slide-2","layout":"blank","elements":[{"id":"e2","x":0.1,"y":0.3,"w":0.8,"h":0.2,"type":"text","content":"Pipeline is up","format":"plain","style":{"fontSize":28,"color":"#0F172A"}}]}]}';

/** A fresh parse each time, so no test can leak a mutation into another. */
function moicDeck(): Deck {
    return JSON.parse(MOIC_JSON) as Deck;
}

function railOf(container: HTMLElement): HTMLElement {
    const rail = container.querySelector("[data-react-fancy-slide-rail]") as HTMLElement | null;
    if (!rail) throw new Error("slide rail not found");
    return rail;
}

/** The editable canvas: the one rendered slide in the editor that is not a rail thumbnail. */
function canvasOf(container: HTMLElement): HTMLElement {
    const rail = railOf(container);
    const slides = Array.from(container.querySelectorAll<HTMLElement>("[data-fancy-slides-slide]"));
    const canvas = slides.find((s) => !rail.contains(s));
    if (!canvas) throw new Error("editor canvas not found");
    return canvas;
}

/** The visible text of every element on the rendered slide, keyed by element id. */
function elementTexts(root: HTMLElement): Record<string, string> {
    const out: Record<string, string> = {};
    root.querySelectorAll<HTMLElement>("[data-fancy-slides-element]").forEach((el) => {
        const id = el.getAttribute("data-fancy-slides-element")!;
        // A rendered slide can appear more than once (thumbnails); first wins.
        if (id in out) return;
        // Scoped <style> blocks carry per-instance ids; they are not drawn text.
        const copy = el.cloneNode(true) as HTMLElement;
        copy.querySelectorAll("style").forEach((s) => s.remove());
        out[id] = (copy.textContent ?? "").replace(/\s+/g, " ").trim();
    });
    return out;
}

function Host({ initial, onChange }: { initial: Deck; onChange?: (d: Deck) => void }) {
    const [deck, setDeck] = useState<Deck>(initial);
    return (
        <DeckEditor
            value={deck}
            onChange={(d) => {
                onChange?.(d);
                setDeck(d);
            }}
            hideNotes
        />
    );
}

describe("DeckEditor on a dark-slide imported deck (MOIC)", () => {
    it("(a) draws the text on the canvas and in the rail, never a dash", () => {
        const { container } = render(<DeckEditor value={moicDeck()} onChange={() => {}} hideNotes />);
        const canvas = canvasOf(container);
        const rail = railOf(container);

        expect(canvas.textContent).toContain("Q3 review");
        expect(rail.textContent).toContain("Q3 review");
        expect(rail.textContent).toContain("Pipeline is up");
        expect(canvas.textContent).not.toContain("—");
        expect(rail.textContent).not.toContain("—");
    });

    it("(b) the editor canvas and SlideViewer draw the same text for every element", () => {
        const deck = moicDeck();
        // Every element type that carries text a person reads off the slide.
        deck.slides.push({
            id: "parity",
            layout: "blank",
            elements: [
                { id: "t-plain", type: "text", x: 0.1, y: 0.1, w: 0.8, h: 0.1, content: "Plain line", format: "plain" },
                { id: "t-md", type: "text", x: 0.1, y: 0.2, w: 0.8, h: 0.1, content: "**Bold** words" },
                { id: "t-html", type: "text", x: 0.1, y: 0.3, w: 0.8, h: 0.1, content: "<p>Html words</p>", format: "html" },
                { id: "shape-1", type: "shape", shape: "rect", x: 0.1, y: 0.4, w: 0.2, h: 0.1 },
                {
                    id: "table-1",
                    type: "table",
                    x: 0.1,
                    y: 0.5,
                    w: 0.8,
                    h: 0.2,
                    columns: [{ key: "a", label: "Col A" }],
                    rows: [{ a: "Cell one" }],
                },
                { id: "img-1", type: "image", x: 0.5, y: 0.8, w: 0.1, h: 0.1, src: "data:image/png;base64,AAAA", alt: "pic" },
            ],
        } as unknown as Deck["slides"][number]);

        for (const slide of deck.slides) {
            const editor = render(
                <DeckEditor value={deck} onChange={() => {}} hideNotes selectedSlideId={slide.id} />,
            );
            const fromEditor = elementTexts(canvasOf(editor.container));
            editor.unmount();

            const index = deck.slides.findIndex((s) => s.id === slide.id);
            const viewer = render(<SlideViewer deck={deck} defaultIndex={index} />);
            const stage = viewer.container.querySelector("[data-fancy-slides-viewer]") as HTMLElement;
            const fromViewer = elementTexts(stage);
            viewer.unmount();

            expect(Object.keys(fromEditor).sort()).toEqual(slide.elements.map((e) => e.id).sort());
            expect(fromEditor).toEqual(fromViewer);
        }
    });

    it("(c) mounting a controlled editor under StrictMode calls onChange 0 times", async () => {
        const onChange = vi.fn();
        await act(async () => {
            render(
                <StrictMode>
                    <Host initial={moicDeck()} onChange={onChange} />
                </StrictMode>,
            );
        });
        expect(onChange).toHaveBeenCalledTimes(0);
    });

    it("(d) a real edit still calls onChange exactly once, with the edited deck", async () => {
        const onChange = vi.fn();
        let container!: HTMLElement;
        await act(async () => {
            ({ container } = render(
                <StrictMode>
                    <Host initial={moicDeck()} onChange={onChange} />
                </StrictMode>,
            ));
        });
        onChange.mockClear(); // isolate the edit even if (c) regresses

        const title = container.querySelector("input[aria-label='Deck title']") as HTMLInputElement | null;
        expect(title).not.toBeNull();
        await act(async () => {
            fireEvent.change(title!, { target: { value: "Q3 review (final)" } });
        });

        expect(onChange).toHaveBeenCalledTimes(1);
        const next = onChange.mock.calls[0]![0] as Deck;
        expect(next.title).toBe("Q3 review (final)");
        // Nothing else about the deck moved.
        expect({ ...next, title: "Q3 review" }).toEqual(moicDeck());
    });

    it("(e) the load-time migration is reported through onNormalize, once, and not as an edit", async () => {
        const onChange = vi.fn();
        const onNormalize = vi.fn();
        await act(async () => {
            render(
                <StrictMode>
                    <DeckEditor value={moicDeck()} onChange={onChange} onNormalize={onNormalize} hideNotes />
                </StrictMode>,
            );
        });
        expect(onChange).toHaveBeenCalledTimes(0);
        expect(onNormalize).toHaveBeenCalledTimes(1);
        expect(onNormalize.mock.calls[0]![0]).toEqual({ ...moicDeck(), version: 1 });
    });
});
