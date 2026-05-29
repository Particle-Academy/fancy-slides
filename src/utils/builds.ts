/**
 * Build (entrance-animation) sequencing — the shared model used by both
 * `SlideViewer` and `PresenterView` so step-through behaves identically.
 *
 * A slide's *builds* are the elements that carry an `animation`. They are
 * stable-sorted by `(order ?? 0)` then original element array index, then
 * grouped into *click steps*:
 *
 *   - The first build, and every build whose trigger is `"on-click"`, starts
 *     a NEW step.
 *   - `"with-prev"` plays simultaneously with the current step's lead.
 *   - `"after-prev"` plays after a delay equal to the current step's lead
 *     duration (chained onto its `delay`).
 *
 * `buildStep` semantics (used by the viewer/presenter):
 *   - `0`  → nothing built yet; only non-animated elements are visible.
 *   - `n`  → the first `n` steps have fired; their elements are visible.
 *   - `totalSteps` → every build is shown (the fully-built slide).
 */

import type { ElementAnimation, Slide, SlideElement } from "../types";

/** One element participating in a build, paired with its (defaulted) animation. */
export interface Build {
    element: SlideElement;
    animation: ElementAnimation;
    /** Original index of the element in the slide's `elements` array (tie-breaker). */
    index: number;
    /**
     * For a "by paragraph" text build, which paragraph index (0-based) this
     * build reveals. Undefined for whole-element builds. The renderer uses this
     * to show "the first K paragraphs of this element".
     */
    paraIndex?: number;
}

/**
 * Split a text element's `content` into paragraphs for a "by paragraph" build.
 * Splits on `"\n"` and drops a single trailing empty line (so content ending in
 * a newline doesn't manifest a phantom blank build). Empty interior lines are
 * preserved — they still consume a click, matching PowerPoint's behaviour.
 */
export function splitParagraphs(content: string): string[] {
    const lines = content.split("\n");
    if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
    return lines;
}

/**
 * Whether an element expands into per-paragraph builds: a text element whose
 * animation has `byParagraph` and that splits into 2+ paragraphs. With 0/1
 * paragraphs it behaves like a normal single build.
 */
export function isByParagraph(element: SlideElement, animation: ElementAnimation): boolean {
    if (!animation.byParagraph || element.type !== "text") return false;
    return splitParagraphs(element.content).length > 1;
}

/** A click step — the set of builds revealed by a single forward advance. */
export interface BuildStep {
    /** Builds that reveal on this step (lead first, then with-prev / after-prev). */
    builds: Build[];
}

const DEFAULT_BUILD_DURATION = 500;

/**
 * Collect a slide's builds in resolved order: every element with an
 * `animation`, stable-sorted by `(order ?? 0)` then array index.
 */
export function collectBuilds(slide: Slide | undefined): Build[] {
    if (!slide) return [];
    const builds: Build[] = [];
    slide.elements.forEach((element, index) => {
        if (element.animation) {
            builds.push({ element, animation: element.animation, index });
        }
    });
    // Stable sort: Array.prototype.sort is stable in modern engines, but we
    // tie-break on the captured array index explicitly to be safe.
    const ordered = builds.sort((a, b) => {
        const ao = a.animation.order ?? 0;
        const bo = b.animation.order ?? 0;
        if (ao !== bo) return ao - bo;
        return a.index - b.index;
    });

    // Expand "by paragraph" text builds into one build per paragraph. The first
    // paragraph keeps the element's own trigger (so it can be with-prev /
    // after-prev relative to a prior element); every subsequent paragraph is
    // "on-click" — one line per click. They stay contiguous, so the rest of an
    // element's paragraphs fire before the next element's builds.
    const expanded: Build[] = [];
    for (const build of ordered) {
        if (isByParagraph(build.element, build.animation)) {
            const paras = splitParagraphs((build.element as { content: string }).content);
            paras.forEach((_, paraIndex) => {
                const animation: ElementAnimation =
                    paraIndex === 0 ? build.animation : { ...build.animation, trigger: "on-click" };
                expanded.push({ element: build.element, animation, index: build.index, paraIndex });
            });
        } else {
            expanded.push(build);
        }
    }
    return expanded;
}

/**
 * Group a slide's builds into click steps. The first build always opens a
 * step; thereafter an `"on-click"` trigger opens a new step while
 * `"with-prev"` / `"after-prev"` attach to the current one.
 */
export function buildSteps(slide: Slide | undefined): BuildStep[] {
    const builds = collectBuilds(slide);
    const steps: BuildStep[] = [];
    for (const build of builds) {
        const trigger = build.animation.trigger ?? "on-click";
        if (steps.length === 0 || trigger === "on-click") {
            steps.push({ builds: [build] });
        } else {
            steps[steps.length - 1]!.builds.push(build);
        }
    }
    return steps;
}

/** Total number of click steps for a slide (0 when the slide has no builds). */
export function totalBuildSteps(slide: Slide | undefined): number {
    return buildSteps(slide).length;
}

/**
 * Given a slide and a `buildStep` (0..totalSteps), return the set of element
 * ids that should be VISIBLE. Elements with no animation are always visible;
 * animated elements become visible once their owning step has fired.
 */
export function visibleElementIds(slide: Slide | undefined, buildStep: number): Set<string> {
    const visible = new Set<string>();
    if (!slide) return visible;
    const steps = buildSteps(slide);
    const stepOfElement = new Map<string, number>(); // 1-based step at which an element FIRST reveals
    steps.forEach((step, i) => {
        for (const b of step.builds) {
            // For by-paragraph builds many builds share one element id; the
            // element is visible once its earliest (first paragraph) step fires.
            if (!stepOfElement.has(b.element.id)) stepOfElement.set(b.element.id, i + 1);
        }
    });
    for (const element of slide.elements) {
        const revealStep = stepOfElement.get(element.id);
        if (revealStep === undefined) {
            visible.add(element.id); // no animation → always visible
        } else if (buildStep >= revealStep) {
            visible.add(element.id); // step has fired
        }
    }
    return visible;
}

/**
 * Per-element paragraph reveal state for a "by paragraph" text build at a given
 * `buildStep`. Keyed by element id:
 *   - `revealed` — how many paragraphs (0..count) should be shown so far.
 *   - `firingParaIndex` — the paragraph index revealing on the step that just
 *     fired (so the renderer plays its entrance effect), or `undefined` when no
 *     paragraph of this element fires on `buildStep`.
 * Only elements that actually expand by-paragraph appear in the map.
 */
export interface ParaReveal {
    revealed: number;
    firingParaIndex?: number;
}

export function paragraphReveals(slide: Slide | undefined, buildStep: number): Map<string, ParaReveal> {
    const out = new Map<string, ParaReveal>();
    if (!slide) return out;
    const steps = buildSteps(slide);
    steps.forEach((step, i) => {
        const stepNum = i + 1; // 1-based
        for (const b of step.builds) {
            if (b.paraIndex === undefined) continue;
            const fired = buildStep >= stepNum;
            const prev = out.get(b.element.id) ?? { revealed: 0 };
            if (fired) {
                prev.revealed = Math.max(prev.revealed, b.paraIndex + 1);
                if (stepNum === buildStep) prev.firingParaIndex = b.paraIndex;
            }
            out.set(b.element.id, prev);
        }
    });
    return out;
}

/**
 * The builds that fire when advancing INTO `buildStep` (1-based). Returns the
 * lead build first; the viewer uses `with-prev` / `after-prev` to compute each
 * element's effective `delay`. Empty when `buildStep` is out of range.
 */
export function buildsForStep(slide: Slide | undefined, buildStep: number): Build[] {
    const steps = buildSteps(slide);
    const step = steps[buildStep - 1];
    return step ? step.builds : [];
}

/**
 * Compute the effective entrance delay (ms) for each build within a step,
 * honouring `with-prev` (0 extra) and `after-prev` (lead duration). The lead
 * build keeps its own `delay`; followers add to it. Keyed by element id.
 */
export function stepDelays(builds: Build[]): Map<string, number> {
    const delays = new Map<string, number>();
    const lead = builds[0];
    if (!lead) return delays;
    const leadDelay = lead.animation.delay ?? 0;
    const leadDuration = lead.animation.duration ?? DEFAULT_BUILD_DURATION;
    delays.set(lead.element.id, leadDelay);
    for (let i = 1; i < builds.length; i++) {
        const b = builds[i]!;
        const own = b.animation.delay ?? 0;
        const trigger = b.animation.trigger ?? "on-click";
        // with-prev → simultaneous with lead; after-prev → starts after lead finishes.
        const base = trigger === "after-prev" ? leadDelay + leadDuration : leadDelay;
        delays.set(b.element.id, base + own);
    }
    return delays;
}
