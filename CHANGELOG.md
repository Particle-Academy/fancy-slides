# Changelog

## 0.2.0 — 2026-05-29

Slide transitions — the `SlideTransition` schema is now rendered, settable,
and editable end to end.

- **Viewer animation**: `SlideViewer` plays the incoming slide's
  `transition` (falling back to `theme.defaultTransition`, else none) on
  every index change. Supports `none` (instant), `fade` (opacity), `slide`
  (translate in from a direction — defaults to the nav direction), and
  `zoom` (scale 0.92→1 + fade). Implemented with pure-CSS keyframes on an
  index-keyed wrapper around `<Slide>` (remount replays the enter
  animation); default 400 ms, ease-out. Respects
  `prefers-reduced-motion: reduce` — animation is fully disabled.
- **`slide_set_transition` op**: new `DeckOp` member plus a
  `setTransition(id, transition?)` helper on `DeckStateApi`, funneled
  through the same pure reducer agents and the editor share.
- **Editor control**: when a slide is selected but no element is, the
  inspector now shows slide settings with a Transition control (kind /
  direction / duration) and a background color picker, wired to
  `ops.setTransition` / `ops.setBackground`.

## v0.1.3 — 2026-05-26

Bug fixes for the slide renderer + editor pipeline.

- **TextElement**: scope-doubled CSS overrides so `ContentRenderer`'s
  `text-sm` + `[&_h1]:text-2xl` Tailwind utilities no longer beat the
  computed inline font size. Slide text now scales proportionally
  whether you render a slide at 1280 px wide on the canvas or at 152 px
  in the rail thumbnail.
- **ShapeElement**: `vectorEffect="non-scaling-stroke"` on every
  primitive so anisotropic SVG box sizing doesn't squash strokes to
  sub-pixel widths. Replaced the SVG `<marker>`-based arrow head with an
  inline polygon (markers shrink with stroke-width and turned into specks
  in narrow boxes).
- **SlideRail**: dropped the `<Sidebar>` wrapper (react-fancy hardcodes
  `w-60` on its root, forcing a horizontal scrollbar when the host's
  rail container was narrower than 240 px). Plain `<aside w-full
  min-w-0>` now inherits whatever width the host provides.

## v0.1.2 — earlier

Initial publish pre-cycle. See git history.
