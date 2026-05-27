import { EChart, registerAll, registerBuiltinThemes } from "@particle-academy/fancy-echarts";
import type { ChartElement } from "../../types";
import { useIsDarkSlide } from "../../components/Slide/slide-context";

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
    // If the slide background reads as dark and the chart doesn't already
    // pin a theme explicitly, fall back to echarts' built-in "dark" theme
    // so the chart legend/axis/tooltip text stay legible.
    const isDarkSlide = useIsDarkSlide();
    const theme = element.chartTheme ?? (isDarkSlide ? "dark" : undefined);
    return (
        <div style={{ width: "100%", height: "100%" }}>
            <EChart option={element.option as Parameters<typeof EChart>[0]["option"]} theme={theme} />
        </div>
    );
}
