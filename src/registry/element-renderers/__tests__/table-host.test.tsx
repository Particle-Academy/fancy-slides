// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import TableHost from "../table-host";
import type { TableElement } from "../../../types";

/**
 * A malformed `table` element must not take down the deck.
 *
 * `columns` and `rows` are required on `TableElement`, so TypeScript consumers
 * cannot omit them — but the type is only a compile-time contract, and this
 * element also arrives as plain JSON: from storage, from an API, and above all
 * from an **agent** authoring slides over the MCP bridge. `{ type: "table" }`
 * with no `columns` is a predictable agent output.
 *
 * Unguarded, `element.columns.map(...)` threw during render with "Cannot read
 * properties of undefined (reading 'map')" — a throw that is not contained by
 * the element. It unmounted whatever the consumer wrapped `SlideViewer` in, and
 * named none of the responsible code.
 *
 * Reported as #12. Each case below is written as `expect(...).not.toThrow()`
 * because the defect WAS the throw; asserting output shape instead would have
 * passed on the broken version for the well-formed case and told us nothing.
 */
const base = { id: "t1", type: "table" as const, x: 0, y: 0, w: 400, h: 200 };

/** Deliberately cast: the point is input that violates the type at runtime. */
const malformed = (extra: Record<string, unknown>) =>
    ({ ...base, ...extra }) as unknown as TableElement;

describe("TableHost with malformed input", () => {
    it("does not throw when columns is missing entirely", () => {
        expect(() => render(<TableHost element={malformed({ rows: [] })} />)).not.toThrow();
    });

    it("does not throw when rows is missing entirely", () => {
        expect(() =>
            render(<TableHost element={malformed({ columns: [{ key: "a", label: "A" }] })} />),
        ).not.toThrow();
    });

    it("does not throw on a bare { type: table } — the likeliest agent output", () => {
        expect(() => render(<TableHost element={malformed({})} />)).not.toThrow();
    });

    it("does not throw when columns/rows are the wrong type", () => {
        // JSON from a loose source can carry anything; `null` and objects both
        // lack `.map`, and a string HAS no `.map` either.
        expect(() => render(<TableHost element={malformed({ columns: null, rows: null })} />)).not.toThrow();
        expect(() =>
            render(<TableHost element={malformed({ columns: "a,b", rows: { x: 1 } })} />),
        ).not.toThrow();
    });

    it("does not throw when a row is null", () => {
        expect(() =>
            render(
                <TableHost
                    element={malformed({ columns: [{ key: "a", label: "A" }], rows: [null, { a: 1 }] })}
                />,
            ),
        ).not.toThrow();
    });

    it("renders nothing when there are no columns, rather than an empty table frame", () => {
        // "Doesn't crash" is not enough: a bordered empty <Table> reads as a
        // styling bug instead of as absent data.
        const { container } = render(<TableHost element={malformed({})} />);

        expect(container.innerHTML).toBe("");
    });

    it("still renders a well-formed table", () => {
        // The counter-case. A guard that made everything render nothing would
        // satisfy every assertion above.
        const { container } = render(
            <TableHost
                element={{
                    ...base,
                    columns: [
                        { key: "region", label: "Region" },
                        { key: "q1", label: "Q1" },
                    ],
                    rows: [{ region: "North", q1: 4260 }],
                }}
            />,
        );

        expect(container.querySelectorAll("tr")).toHaveLength(2); // header + one row
        expect(container.textContent).toContain("Region");
        expect(container.textContent).toContain("North");
        expect(container.textContent).toContain("4260");
    });
});
