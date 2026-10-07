import type { TableColumn, TableRow } from "../types";

/**
 * One table row's cells, keyed by column key.
 *
 * A row is canonically an object keyed by each column's `key`. A row given as an
 * ARRAY is POSITIONAL: its values are read in column order.
 *
 * The positional form used to resolve every cell to `undefined`, so the table drew
 * at the correct size with every cell blank — no exception, nothing logged,
 * because the geometry comes from `columns` and `rows.length` rather than from any
 * cell. It is also the shape an author guesses whenever the published schema shows
 * a column list and no row shape, which is what `dark-slide` published until
 * 0.10.4. Reported as #14, after reaching a customer as "the table rows were
 * empty".
 *
 * Surplus values have nowhere to go and are dropped; columns past the last value
 * read as empty, exactly as a missing key does. The matching rule lives in
 * `dark-slide`'s `TableResolver::cellMap` in all three writer engines, and is
 * pinned cross-language by `fancy-conformance` rows 0029–0033.
 *
 * It lives here rather than in the renderer because the EDITOR needs the identical
 * rule — two readings of one row is how a deck renders one way and edits another.
 */
export function tableCells(row: TableRow, columns: TableColumn[]): Record<string, unknown> {
    // A row can itself be null in hand-written JSON.
    if (!row) return {};
    if (!Array.isArray(row)) return row;

    const cells: Record<string, unknown> = {};
    row.forEach((value, i) => {
        const column = columns[i];
        if (column) cells[column.key] = value;
    });

    return cells;
}

/**
 * Every row in the canonical keyed form.
 *
 * Use it before EDITING: an editor that patches a positional row by key would
 * write a cell the renderer then reads from a different place. Converting on the
 * way in means a deck authored positionally is saved back keyed, which is the form
 * that survives a column reorder.
 */
export function tableRowsAsRecords(rows: TableRow[], columns: TableColumn[]): Record<string, unknown>[] {
    return (Array.isArray(rows) ? rows : []).map((row) => tableCells(row, columns));
}

/**
 * The rows no rule can rescue: OBJECT rows that match no column key.
 *
 * A positional row is read by order and a partially-filled row is ordinary, so
 * what remains is a row keyed by something no column reads — in practice a
 * mis-cased or renamed key. Nothing says which column `{"Plan": …}` meant, and it
 * fails the same silent way: full-size grid, every cell empty.
 */
export function unreadableTableRows(rows: TableRow[], columns: TableColumn[]): TableRow[] {
    const keys = columns.map((c) => c.key);

    return (Array.isArray(rows) ? rows : []).filter((row) => {
        if (!row || Array.isArray(row)) return false;
        const rowKeys = Object.keys(row);
        return rowKeys.length > 0 && !rowKeys.some((k) => keys.includes(k));
    });
}
