import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Deck, TextElement } from "../../../types";
import { defaultTheme } from "../../../theme/default-theme";
import { DeckEditor, DeckEditorRail, useDeckEditor } from "../index";

afterEach(cleanup);

function makeDeck(): Deck {
    return {
        id: "deck1",
        title: "Test Deck",
        theme: defaultTheme,
        slides: [
            {
                id: "s1",
                layout: "blank",
                elements: [
                    {
                        id: "el1",
                        type: "text",
                        x: 0.1,
                        y: 0.1,
                        w: 0.5,
                        h: 0.2,
                        content: "Hello",
                        format: "plain",
                        style: {},
                    } as TextElement,
                ],
                notes: "",
            },
            { id: "s2", layout: "blank", elements: [] },
        ],
    };
}

/** Controlled host so ops that call onChange persist across renders. */
function Host(props: Omit<React.ComponentProps<typeof DeckEditor>, "value" | "onChange"> & { initial?: Deck }) {
    const { initial, ...rest } = props;
    const [deck, setDeck] = useState<Deck>(initial ?? makeDeck());
    return <DeckEditor value={deck} onChange={setDeck} {...rest} />;
}

/** An app panel sharing the editor controller via context. */
function SelectProbe({ id }: { id: string }) {
    const { setSelectedElementId, selectedElement } = useDeckEditor();
    return (
        <button data-testid="probe" onClick={() => setSelectedElementId(id)}>
            sel:{selectedElement?.id ?? "none"}
        </button>
    );
}

describe("DeckEditor — composable parts", () => {
    it("shares selection across Provider + Canvas + Inspector (one controller)", () => {
        render(
            <DeckEditor.Provider value={makeDeck()} onChange={() => {}}>
                <SelectProbe id="el1" />
                <DeckEditor.Canvas />
                <DeckEditor.Inspector />
            </DeckEditor.Provider>,
        );

        // Nothing selected yet — the external panel sees no element.
        expect(screen.getByTestId("probe").textContent).toBe("sel:none");

        // Select through the shared controller from one slot…
        fireEvent.click(screen.getByTestId("probe"));

        // …and a *different* slot (the Inspector) reflects it — proving shared state.
        expect(screen.getByTestId("probe").textContent).toBe("sel:el1");
        expect(screen.getAllByText("text").length).toBeGreaterThan(0);
    });

    it("renders the full default chrome and dispatches the right op on insert", () => {
        const onOp = vi.fn();
        render(<Host onOp={onOp} />);

        const editor = document.querySelector("[data-fancy-slides-editor='deck1']");
        expect(editor).not.toBeNull();
        expect(document.querySelector(".fs-toolbar")).not.toBeNull();
        expect(document.querySelector(".fs-inspector")).not.toBeNull();
        expect(document.querySelector(".fs-notes")).not.toBeNull();

        fireEvent.click(screen.getByLabelText("Insert text"));
        expect(onOp).toHaveBeenCalledWith(
            expect.objectContaining({ op: "element.add", element: expect.objectContaining({ type: "text" }) }),
        );
    });

    it("throws a clear error when a slot is used outside the provider", () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(() => render(<DeckEditorRail />)).toThrow(/DeckEditor\.Provider/);
        spy.mockRestore();
    });

    it("honors hide flags and a custom renderToolbar", () => {
        const { rerender } = render(<Host hideToolbar hideRail hideInspector hideNotes />);
        expect(document.querySelector(".fs-toolbar")).toBeNull();
        expect(document.querySelector(".fs-inspector")).toBeNull();
        expect(document.querySelector(".fs-notes")).toBeNull();

        rerender(<Host renderToolbar={() => <div data-testid="custom-bar">bespoke</div>} />);
        expect(screen.getByTestId("custom-bar")).not.toBeNull();
        expect(document.querySelector(".fs-toolbar")).toBeNull();
    });
});
