import { EChart, registerAll, registerBuiltinThemes } from "@particle-academy/fancy-echarts";
import type { ChartElement } from "../../types";

// fancy-echarts ships its chart types as opt-in tree-shake-friendly modules,
// so the consumer normally calls `registerAll()` somewhere global. The
// registry subpath here is the natural spot to wire it: this module only
// loads when a deck actually contains a chart element (defaultElementRegistry
// is React.lazy), so the registration cost is paid by chart-using hosts
// only — non-chart consumers never even import this file.
//
// `registerAll()` is idempotent on echarts' side, so re-imports across
// chunks are safe.
registerAll();
registerBuiltinThemes();

export default function ChartHost({ element }: { element: ChartElement; slideWidthPx: number }) {
    return (
        <div style={{ width: "100%", height: "100%" }}>
            <EChart option={element.option as Parameters<typeof EChart>[0]["option"]} theme={element.chartTheme} />
        </div>
    );
}
