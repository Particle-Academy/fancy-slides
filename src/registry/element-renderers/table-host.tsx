import { Table } from "@particle-academy/react-fancy";
import type { TableElement } from "../../types";

export default function TableHost({ element }: { element: TableElement }) {
    return (
        <div style={{ width: "100%", height: "100%", overflow: "auto" }}>
            <Table className="w-full">
                <Table.Head>
                    <Table.Row>
                        {element.columns.map((c) => (
                            <Table.Cell key={c.key} header>
                                {c.label}
                            </Table.Cell>
                        ))}
                    </Table.Row>
                </Table.Head>
                <Table.Body>
                    {element.rows.map((row, i) => (
                        <Table.Row key={i}>
                            {element.columns.map((c) => (
                                <Table.Cell key={c.key}>{formatCell(row[c.key])}</Table.Cell>
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
