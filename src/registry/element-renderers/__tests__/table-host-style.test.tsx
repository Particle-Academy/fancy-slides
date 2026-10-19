// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import TableHost from "../table-host";
import { SlideContext } from "../../../components/Slide/slide-context";
import type { TableElement, Theme } from "../../../types";

/**
 * A table renders the way dark-slide writes it.
 *
 * TableHost drew every table in react-fancy's default look inside a scrolling box:
 * no header band, no stripe, no cell colour, fixed-size text. A deck agent's KPI
 * scorecard (red "Below target" cells, a cyan header) showed as a plain grid with
 * the last row clipped, while the same deck in PowerPoint was coloured. The
 * styling model is dark-slide's `TableResolver`: cell > row > column > band
 * (header | stripe | body) > table > theme > default.
 */
const dark: Theme = { name: "dark", colors: { background: "#0B1220", text: "#F9FAFB", accent: "#38BDF8" } };

const el = (extra: Partial<TableElement> = {}): TableElement => ({
    id: "kpi", type: "table", x: 0, y: 0, w: 1, h: 0.5,
    columns: [{ key: "k", label: "KPI" }, { key: "s", label: "Status" }],
    rows: [
        { k: "On-time delivery", s: { text: "Below target", fill: "#DC2626", color: "#FFFFFF", bold: true } },
        { k: "Damage rate", s: "On target" },
    ],
    ...extra,
}) as TableElement;

function renderIn(element: TableElement, theme: Theme = dark, slideWidthPx = 960) {
    return render(
        <SlideContext.Provider value={{ theme, isDark: true, slideWidthPx }}>
            <TableHost element={element} />
        </SlideContext.Provider>,
    );
}

const cell = (container: HTMLElement, text: string): HTMLElement =>
    [...container.querySelectorAll<HTMLElement>("th, td")].find((c) => c.textContent === text)!;

describe("TableHost styling", () => {
    it("draws a header band in the theme accent, white and bold, by default", () => {
        const { container } = renderIn(el());
        const th = cell(container, "KPI");
        expect(th.style.backgroundColor).toBe("rgb(56, 189, 248)");
        expect(th.style.color).toBe("rgb(255, 255, 255)");
        expect(th.style.fontWeight).toBe("700");
    });

    it("draws a styled cell with its own fill, colour and weight, and its text, not JSON", () => {
        const { container } = renderIn(el());
        const td = cell(container, "Below target");
        expect(td).toBeDefined();
        expect(td.style.backgroundColor).toBe("rgb(220, 38, 38)");
        expect(td.style.color).toBe("rgb(255, 255, 255)");
        expect(td.style.fontWeight).toBe("700");
        expect(container.textContent).not.toContain("{");
    });

    it("takes body text from the theme, and stripes every second body row", () => {
        const { container } = renderIn(el());
        expect(cell(container, "On-time delivery").style.color).toBe("rgb(249, 250, 251)");
        expect(cell(container, "Damage rate").style.backgroundColor).not.toBe("transparent");
        // An unfilled cell is stated transparent, so the library's own zebra never shows through.
        expect(cell(container, "On-time delivery").style.backgroundColor).toBe("transparent");

        const flat = renderIn(el({ style: { stripe: false } } as Partial<TableElement>));
        expect(cell(flat.container, "Damage rate").style.backgroundColor).toBe("transparent");
    });

    it("honours style.header, and scales sizes with the slide like text does", () => {
        const { container } = renderIn(el({ style: { header: { fill: "#1F3A5F" }, fontSize: 36 } } as Partial<TableElement>), dark, 960);
        expect(cell(container, "KPI").style.backgroundColor).toBe("rgb(31, 58, 95)");
        // 36 design px on a 1920 canvas drawn 960 wide.
        expect(cell(container, "Damage rate").style.fontSize).toBe("18px");
    });

    it("fits its frame instead of scrolling, so no row is clipped behind a scrollbar", () => {
        const { container } = renderIn(el());
        expect((container.firstElementChild as HTMLElement).style.overflow).not.toBe("auto");
    });
});
