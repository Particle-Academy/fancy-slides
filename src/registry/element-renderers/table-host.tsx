import { Table } from "@particle-academy/react-fancy";
import type { TableColumn, TableElement, TableRow } from "../../types";
import { tableCells, unreadableTableRows } from "../../utils/table-rows";

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
    const columns: TableColumn[] = Array.isArray(element.columns) ? element.columns : [];
    const rows: TableRow[] = Array.isArray(element.rows) ? element.rows : [];

    // With no columns there is nothing to draw. An empty <Table> renders a stray
    // border, which reads as a styling bug rather than as absent data.
    if (columns.length === 0) return null;

    warnAboutUnreadableRows(element, columns, rows);

    return (
        <div style={{ width: "100%", height: "100%", overflow: "auto" }}>
            <Table className="w-full">
                <Table.Head>
                    <Table.Row>
                        {columns.map((c) => (
                            <Table.Cell key={c.key} header>
                                {/* `label ?? key`, as dark-slide's writer resolves it and
                                    as its published schema now states. A blank header
                                    would make that description false for the renderer
                                    half of the same deck model. */}
                                {c.label ?? c.key}
                            </Table.Cell>
                        ))}
                    </Table.Row>
                </Table.Head>
                <Table.Body>
                    {rows.map((row, i) => {
                        const cells = tableCells(row, columns);
                        return (
                            <Table.Row key={i}>
                                {columns.map((c) => (
                                    <Table.Cell key={c.key}>{formatCell(cells[c.key])}</Table.Cell>
                                ))}
                            </Table.Row>
                        );
                    })}
                </Table.Body>
            </Table>
        </div>
    );
}

const warned = new WeakSet<object>();

/**
 * The one unreadable shape left: an OBJECT row that matches no column key.
 *
 * A positional row is now read by order and a partially-filled row is ordinary,
 * so what remains is a row keyed by something no column reads — in practice a
 * mis-cased or renamed key. No rule can rescue it (`{"Plan": …}` is a perfectly
 * good object; nothing says which column it meant), and it fails the same silent
 * way: full-size grid, every cell empty. So the renderer says so.
 *
 * Dev-only, and once per element rather than once per render — React renders the
 * same element repeatedly, twice per commit under StrictMode, and a warning that
 * repeats is a warning people filter out. `dark-slide`'s `Agent.validate()`
 * reports the same row on the writer side, where an agent can act on it.
 */
function warnAboutUnreadableRows(element: TableElement, columns: TableColumn[], rows: TableRow[]): void {
    // Read off globalThis rather than `process.env` directly: this package ships to
    // browsers, where `process` may simply not exist and a bare reference throws.
    // Where NODE_ENV is absent we warn, because a silent blank grid is the defect.
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    if (env?.NODE_ENV === "production") return;
    if (warned.has(element)) return;

    const keys = columns.map((c) => c.key);
    const unreadable = unreadableTableRows(rows, columns);

    if (unreadable.length === 0) return;
    warned.add(element);

    console.warn(
        `[fancy-slides] table "${element.id}": ${unreadable.length} of ${rows.length} rows match no column, ` +
            `so their cells render empty at full table size. Key each cell by a column key ` +
            `(${keys.join(", ")}), or give the row as a positional array in column order. ` +
            `Got: ${JSON.stringify(unreadable[0])}`,
    );
}

function formatCell(v: unknown): string {
    if (v == null) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
}
