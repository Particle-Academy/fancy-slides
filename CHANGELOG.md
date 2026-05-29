# Changelog

## 0.3.0 — 2026-05-29

Fully UI-driven element editing — no more hand-editing raw JSON for tables and
charts, and images gain upload + crop.

- **Table editor**: `TableStyleControls` is now a real grid. Columns render as
  editable label inputs with per-column remove + an "Add column" button that
  mints a stable unique key (`col2`, `col3`, …); editing a label never touches
  the key. Rows are an editable cell-per-column grid with add/remove. Adding a
  column seeds an empty value on every row; removing one deletes that key from
  every row. A collapsed "Edit as JSON" `<details>` keeps the raw escape hatch.
- **Chart editor**: `ChartStyleControls` replaces the raw ECharts JSON textarea
  with a friendly editor — a chart-type `<Select>` (bar / line / area / pie /
  scatter), a Categories editor + multi-series editor (name, color, one value
  per category) for cartesian charts, and a slice list for pie. Switching type
  preserves data where possible and rebuilds a clean option via new
  `chartModelFromOption` / `chartOptionFromModel` helpers in `chart-presets`.
  Options too custom to parse show a notice and fall back to the JSON editor,
  which is still available under an "Advanced" `<details>`.
- **Image editor**: `ImageStyleControls` adds an "Upload image" button (hidden
  `<input type=file>` → FileReader data-URI → `element.src`), keeping the URL
  field, plus a crop control — four `<Slider>`s for `crop` `{x,y,w,h}` (0..1)
  and a "Clear crop" button.
- **Image crop rendering**: `ImageElementRenderer` now honors `crop`, clipping
  an inner scaled/translated `<img>` so the crop window fills the box in both
  the editor and the viewer.
- **Insert / icon audit**: verified every toolbar Insert handler produces a
  valid, auto-selected element and every react-fancy icon slug (`type`,
  `image`, `square`, `bar-chart`, `code`, `table`, `chevron-down`, `play`,
  `upload`, `plus`, `x`) resolves; `iconTrailing` confirmed as a supported
  `Action` prop. No fixes required.

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
