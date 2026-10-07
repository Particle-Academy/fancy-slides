// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import TableHost from "../table-host";
import type { TableElement } from "../../../types";

/**
 * What shape a row takes, and what happens to the shape an author guesses.
 *
 * A cell was read as `row?.[c.key]`, so the contract was rows as OBJECTS keyed by
 * each column's `key` — and nothing published said so. `dark-slide`'s schema, the
 * one a document-writer vocabulary is generated from, exported `columns: {type:
 * "array"}, rows: {type: "array"}` and no item shape, so the natural guess from a
 * bare column list is a POSITIONAL row: `[["Starter", "$49"]]`.
 *
 * That guess failed in the worst available way. Every `row?.[c.key]` is
 * `undefined`, every cell renders empty, and the table STILL DRAWS AT THE RIGHT
 * SIZE, because its geometry comes from `columns` and `rows.length`. A
 * correctly-shaped grid, every cell blank, no exception and nothing in the
 * console. It reached a customer as "the table rows were empty" and read as a
 * renderer bug rather than a malformed deck — and it is intermittent, because an
 * agent author lands on the keyed form some of the time.
 *
 * Reported as #14. Not #12, which was a CRASH on absent `columns`/`rows`: here
 * both are present and well-formed.
 */
const base = { id: "t1", type: "table" as const, x: 0, y: 0, w: 400, h: 200 };
const columns = [
    { key: "plan", label: "Plan" },
    { key: "price", label: "Monthly price" },
];

/** Deliberately cast where the point is JSON that violates the type. */
const el = (extra: Record<string, unknown>) => ({ ...base, columns, ...extra }) as unknown as TableElement;

describe("TableHost row shapes", () => {
    it("renders a keyed row — the canonical form", () => {
        const { container } = render(<TableHost element={el({ rows: [{ plan: "Starter", price: "$49" }] })} />);

        expect(container.textContent).toContain("Starter");
        expect(container.textContent).toContain("$49");
    });

    it("fills a positional row by column order instead of rendering a blank grid", () => {
        const { container } = render(<TableHost element={el({ rows: [["Starter", "$49"]] })} />);

        expect(container.querySelectorAll("tr")).toHaveLength(2); // header + one row
        expect(container.textContent).toContain("Starter");
        expect(container.textContent).toContain("$49");
    });

    it("renders a positional row and the keyed row it means identically", () => {
        const positional = render(<TableHost element={el({ rows: [["Starter", "$49"]] })} />);
        const keyed = render(<TableHost element={el({ rows: [{ plan: "Starter", price: "$49" }] })} />);

        expect(positional.container.innerHTML).toBe(keyed.container.innerHTML);
    });

    it("leaves the remaining columns empty for a short positional row", () => {
        const { container } = render(<TableHost element={el({ rows: [["Starter"]] })} />);

        const cells = container.querySelectorAll("tbody td, tbody th");
        expect(cells).toHaveLength(2);
        expect(cells[0]!.textContent).toBe("Starter");
        expect(cells[1]!.textContent).toBe("");
    });

    it("drops positional values that have no column to land in", () => {
        const { container } = render(<TableHost element={el({ rows: [["Starter", "$49", "ignored"]] })} />);

        expect(container.querySelectorAll("tbody td, tbody th")).toHaveLength(2);
        expect(container.textContent).not.toContain("ignored");
    });

    it("falls back to the column key for a header with no label, as the writer does", () => {
        // `dark-slide` resolves `label ?? key`, and its published schema now says
        // so. A blank header here would make that description false for the
        // renderer half of the same deck model.
        const { container } = render(
            <TableHost element={el({ columns: [{ key: "plan" }], rows: [{ plan: "Starter" }] })} />,
        );

        expect(container.querySelector("thead")!.textContent).toBe("plan");
    });
});

describe("the row no shape can rescue", () => {
    let warn: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    });
    afterEach(() => {
        warn.mockRestore();
    });

    it("warns when a row matches no column at all", () => {
        // `Plan` is not `plan`. An object row cannot be read positionally, so this
        // is the blank grid the fallback cannot save — and the only remaining
        // defence is saying so.
        render(<TableHost element={el({ rows: [{ Plan: "Starter" }] })} />);

        expect(warn).toHaveBeenCalledTimes(1);
        const message = String(warn.mock.calls[0]![0]);
        expect(message).toContain("plan");
        expect(message).toContain("t1");
    });

    it("warns once per element, not once per render", () => {
        const element = el({ rows: [{ Plan: "Starter" }] });

        render(<TableHost element={element} />);
        render(<TableHost element={element} />);

        expect(warn).toHaveBeenCalledTimes(1);
    });

    it("says nothing about a keyed, positional, partial or empty row", () => {
        render(
            <TableHost
                element={el({
                    rows: [{ plan: "Starter", price: "$49" }, ["Pro", "$99"], { plan: "Team" }, {}],
                })}
            />,
        );

        expect(warn).not.toHaveBeenCalled();
    });
});
