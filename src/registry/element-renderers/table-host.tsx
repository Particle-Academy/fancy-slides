import { Table } from "@particle-academy/react-fancy";
import type { TableElement } from "../../types";

/**
 * `columns` and `rows` are REQUIRED on `TableElement`, and are still read
 * defensively here.
 *
 * The type only binds TypeScript consumers at compile time. This element also
 * arrives as plain JSON — from a database, an API, a saved deck, and above all
 * from an **agent**, which this package explicitly invites to author slides
 * through the MCP bridge. An agent emitting `{ type: "table" }` with no
 * `columns` is a predictable outcome, not an exotic one.
 *
 * Unguarded, `element.columns.map(...)` threw *during render*, so the failure was
 * not contained by the element: it unmounted whatever the consumer wrapped
 * `SlideViewer` in, and the error ("Cannot read properties of undefined (reading
 * 'map')") named none of this code. A malformed element must degrade to blank,
 * never take down the deck.
 *
 * Reported as #12.
 */
export default function TableHost({ element }: { element: TableElement }) {
    // `?? []` rather than loosening the type: the contract still REQUIRES both,
    // and making them optional would push this same guard onto every consumer.
    const columns = Array.isArray(element.columns) ? element.columns : [];
    const rows = Array.isArray(element.rows) ? element.rows : [];

    // With no columns there is nothing to draw. An empty <Table> renders a stray
    // border, which reads as a styling bug rather than as absent data.
    if (columns.length === 0) return null;

    return (
        <div style={{ width: "100%", height: "100%", overflow: "auto" }}>
            <Table className="w-full">
                <Table.Head>
                    <Table.Row>
                        {columns.map((c) => (
                            <Table.Cell key={c.key} header>
                                {c.label}
                            </Table.Cell>
                        ))}
                    </Table.Row>
                </Table.Head>
                <Table.Body>
                    {rows.map((row, i) => (
                        <Table.Row key={i}>
                            {columns.map((c) => (
                                // A row can itself be null in hand-written JSON.
                                <Table.Cell key={c.key}>{formatCell(row?.[c.key])}</Table.Cell>
                            ))}
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table>
        </div>
    );
}

function formatCell(v: unknown): string {
    if (v == null) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
}
