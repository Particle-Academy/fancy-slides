import { EChart } from "@particle-academy/fancy-echarts";
import type { ChartElement } from "../../types";

export default function ChartHost({ element }: { element: ChartElement; slideWidthPx: number }) {
    return (
        <div style={{ width: "100%", height: "100%" }}>
            <EChart option={element.option as Parameters<typeof EChart>[0]["option"]} theme={element.chartTheme} />
        </div>
    );
}
