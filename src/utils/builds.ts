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
    return builds.sort((a, b) => {
        const ao = a.animation.order ?? 0;
        const bo = b.animation.order ?? 0;
        if (ao !== bo) return ao - bo;
        return a.index - b.index;
    });
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
    const stepOfElement = new Map<string, number>(); // 1-based step at which an element reveals
    steps.forEach((step, i) => {
        for (const b of step.builds) stepOfElement.set(b.element.id, i + 1);
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
