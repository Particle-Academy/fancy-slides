import { fontStack } from "../../utils/font-stack";
import type { CSSProperties } from "react";
import { Table } from "@particle-academy/react-fancy";
import type { TableColumn, TableElement, TableRow } from "../../types";
import { tableCells, unreadableTableRows } from "../../utils/table-rows";
import { resolveCell, type CellLook } from "../../utils/table-style";
import { useSlideContext } from "../../components/Slide/slide-context";

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
    const context = useSlideContext();
    const theme = context?.theme;
    const columns: TableColumn[] = Array.isArray(element.columns) ? element.columns : [];
    const rows: TableRow[] = Array.isArray(element.rows) ? element.rows : [];

    // With no columns there is nothing to draw. An empty <Table> renders a stray
    // border, which reads as a styling bug rather than as absent data.
    if (columns.length === 0) return null;

    warnAboutUnreadableRows(element, columns, rows);

    const style = (element as { style?: Record<string, unknown> }).style;
    const hasHeader = style?.header !== false;
    // Sizes are design px on the deck canvas, scaled to the rendered slide the
    // way text is. Outside a Slide there is nothing to scale against.
    const scale = context ? context.slideWidthPx / (context.theme.slideWidth ?? 1920) : 1;
    const widths = columnWidths(columns);

    return (
        // Fits its frame; never a scroll box. A scroll box clipped the last row
        // behind a scrollbar on a slide, which has no way to scroll.
        <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
            <Table className="w-full">
                {hasHeader && (
                    <Table.Head>
                        <Table.Row>
                            {columns.map((c, i) => (
                                // `label ?? key`, as dark-slide's writer resolves it.
                                <Table.Cell key={c.key} header style={cellCss(resolveCell(element, theme, c, null, { header: true }), scale, widths[i], theme?.fonts?.body)}>
                                    {c.label ?? c.key}
                                </Table.Cell>
                            ))}
                        </Table.Row>
                    </Table.Head>
                )}
                <Table.Body>
                    {rows.map((row, r) => {
                        const cells = tableCells(row, columns);
                        return (
                            <Table.Row key={r}>
                                {columns.map((c, i) => {
                                    const look = resolveCell(element, theme, c, cells[c.key], { header: false, bodyIndex: r, row: Array.isArray(row) ? undefined : row });
                                    return (
                                        <Table.Cell key={c.key} style={cellCss(look, scale, hasHeader ? undefined : widths[i], theme?.fonts?.body)}>
                                            {look.text}
                                        </Table.Cell>
                                    );
                                })}
                            </Table.Row>
                        );
                    })}
                </Table.Body>
            </Table>
        </div>
    );
}

/** Column widths as percentages: fractions (all <= 1) or weights, as dark-slide reads them. */
function columnWidths(columns: TableColumn[]): (string | undefined)[] {
    const raw = columns.map((c) => (typeof (c as { width?: unknown }).width === "number" ? ((c as { width?: number }).width as number) : null));
    if (raw.every((w) => w === null)) return columns.map(() => undefined);
    const fractions = raw.every((w) => w === null || w <= 1);
    const declared = raw.filter((w): w is number => w !== null);
    const filled = fractions
        ? (() => {
              const rest = Math.max(0, 1 - declared.reduce((a, b) => a + b, 0));
              const open = raw.filter((w) => w === null).length;
              return raw.map((w) => w ?? (open > 0 ? rest / open : 0));
          })()
        : raw.map((w) => w ?? 1);
    const total = filled.reduce((a, b) => a + b, 0) || 1;
    return filled.map((w) => `${((w / total) * 100).toFixed(3)}%`);
}

function cellCss(look: CellLook, scale: number, width?: string, bodyFont?: string): CSSProperties {
    const border = look.border === null ? "none" : `${Math.max(1, look.borderWidth * scale)}px solid ${look.border}`;
    return {
        backgroundColor: look.fill ?? "transparent",
        color: look.color,
        fontWeight: look.bold ? 700 : 400,
        fontStyle: look.italic ? "italic" : "normal",
        textDecoration: look.underline ? "underline" : undefined,
        textAlign: look.align,
        verticalAlign: look.anchor,
        fontSize: `${look.fontSize * scale}px`,
        lineHeight: 1.25,
        fontFamily: fontStack(look.fontFamily ?? bodyFont),
        // PowerPoint's default cell insets: 7.2pt / 3.6pt = 19.2 / 9.6 design px.
        padding: `${9.6 * scale}px ${19.2 * scale}px`,
        border,
        width,
    };
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
