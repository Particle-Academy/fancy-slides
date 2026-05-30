# Changelog

## 0.11.0 — 2026-05-30

### Changed
- **`@particle-academy/fancy-code` and `@particle-academy/fancy-echarts` are now
  required peer dependencies** (previously optional). The code and chart
  elements need them to render, so consumers should install them alongside
  fancy-slides. The registry's guarded dynamic imports remain as a safety net —
  a consumer still missing a peer degrades to a small placeholder instead of a
  build break — but they're no longer advertised as optional.

> Toolbar/inspector dropdowns that appeared "stuck" (menu mounted but parked
> off-screen) were a `react-fancy` popover-positioning race — the measurement
> ran on `requestAnimationFrame`, which fires after the menu's late mount (or
> never, in a backgrounded tab). Fixed in `@particle-academy/react-fancy@3.4.3`
> by measuring on a passive effect instead. **Update react-fancy to 3.4.3+
> alongside this release** (3.4.2 has a regression — skip it).

## 0.10.0 — 2026-05-29

### Added — stream a full presentation in / out
- **`deck_set` op** — a new `DeckOp` (+ `DeckStateApi.setDeck`) that replaces the
  entire deck atomically, so a host or agent can stream a full presentation IN
  in one step instead of reconstructing it from N granular ops. The prior deck
  is what an undo entry snapshots.
- **Serialization helpers** — `serializeDeck(deck, pretty?)`, `parseDeck(json)`,
  `validateDeck(deck)` (forgiving structural check → `{ ok, errors }`), and
  `migrateDeck(deck)` (forward-migration shim keyed on `Deck.version` /
  `SCHEMA_VERSION`). `parseDeck` migrates + validates and throws a descriptive
  error on malformed input. Streaming OUT stays `value` / `onChange` (or
  `serializeDeck`); streaming IN is `parseDeck` → `value`, or the `deck_set` op.

The companion `deck_set` MCP tool ships in `agent-integrations` so agents have
the same full-state import the human editor has.

## 0.9.0 — 2026-05-29

### Added — represent + edit a fuller deck (pptx round-trip)
The editor already renders + edits everything `dark-slide`'s `PptxReader`
extracts (text / image / shape / table + geometry, z-order, rotation,
background, notes). This release rounds out the schema for richer decks:
- **Whole-element hyperlinks** — new optional `ElementBase.href`. The viewer
  makes the element a click target (opens a new tab); the inspector's Layout tab
  has a "Link (href)" field. For inline links *inside* text, use markdown
  `[label](url)`. Mirrored in `dark-slide`'s schema (0.5.1).
- **Z-order convenience** — "Front" / "Back" buttons in the Layout tab that set
  `z` above / below all siblings (no more hand-typing a z-index for overlapping
  elements from an imported deck). The renderer already sorts by `z` + applies
  `rotation`.
- **Schema version** — new optional `Deck.version` + exported `SCHEMA_VERSION`
  constant (foundation for the serialize / parse / migrate helpers landing next),
  kept in lockstep with `dark-slide`.

## 0.8.0 — 2026-05-29

### Added — editor parity with the dark-slide pptx writer
The ElementInspector now exposes every authoring knob the sibling `dark-slide`
writer can emit, so a human (or agent) can compose anything the export supports:
- **Slide layout picker** — all 8 presets (blank / title / title-content /
  two-column / section-divider / image-text / text-image / quote) in slide
  settings, wired to `slide_set_layout`.
- **Backgrounds beyond solid color** — a type switch for solid color / CSS
  gradient / image (+ cover/contain/fill `imageFit`), matching the writer's
  `<p:bg>` gradient + blipFill support.
- **Shape: dashed stroke** toggle.
- **Code: line numbers** toggle (editor/viewer preview; default on).
- **Text: vertical align, line height, italic & underline** toggles — rounding
  out `TextStyle` so box typography matches what the writer emits.

Already complete and unchanged: the Build (animation) tab covers every
`AnimationEffect` (fade / fly-in / zoom / wipe), trigger, direction, duration,
delay, order, and by-paragraph; theme switching lives in the toolbar.

## 0.7.0 — 2026-05-29

### Changed
- **Inline text editing now uses react-fancy's `Editor`** (a WYSIWYG rich-text
  surface) instead of a raw-source `<textarea>`. Selecting a text element on the
  canvas opens the Editor with a presentation-tuned toolbar — **bold / italic /
  heading / paragraph / bullet list** — so authors format text visually and see
  the result as they type. The toolbar is intentionally limited to commands that
  round-trip through markdown; box-level typography (alignment, color, font size,
  line height) stays in the ElementInspector as `TextStyle` properties.
- Edited text commits as `format: "markdown"`. The Editor's markdown output is
  normalized to the **line-based paragraph model** the slide content + the
  sibling `dark-slide` pptx writer commit to (`normalizeSlideMarkdown` collapses
  the editor's blank-line paragraph separators to a single `\n`), so
  "by paragraph" build reveals and per-paragraph pptx animations stay correct —
  bullets are already one-per-line and unaffected. New exports:
  `PRESENTATION_EDITOR_ACTIONS`, `normalizeSlideMarkdown`.
- The inline Editor is scoped CSS-styled to drop its card chrome and match the
  element's scaled typography, so editing looks like the live slide.

## 0.6.1 — 2026-05-29

### Fixed
- **Slide thumbnails now scale every element type uniformly.** `SlideThumbnail`
  rendered the slide *at* the thumbnail width, which scaled font sizes and SVG
  strokes (text / shape / image) but left embedded surfaces that render at fixed
  internal font sizes — ECharts charts and the fancy-code editor — oversized and
  overflowing inside the thumb. The thumbnail now renders the slide at its full
  design width and applies a single CSS `transform: scale()` to the whole
  output (the approach fancy-artboard uses for its piece previews), so the
  chart / code / table / shape thumbs are faithful miniatures of the live slide.
  The slide rail and presenter view (both built on `SlideThumbnail`) inherit the
  fix. Embedded surfaces inside a thumb are also `pointer-events: none` so the
  thumb's own click handler still owns interaction.

## 0.6.0 — 2026-05-29

### Changed
- **Full editor out of the box.** `DeckEditor` and `SlideViewer` now render all
  element types (chart / code / table / embed) by default via a built-in default
  registry — `renderElement` defaults to `defaultElementRegistry`, so consumers
  no longer have to wire it manually. A consumer-passed `renderElement` still
  wins entirely, keeping full customizability.
- **Optional-peer hosts use guarded dynamic imports.** The chart and code hosts
  no longer statically import `@particle-academy/fancy-echarts` /
  `@particle-academy/fancy-code`. They load the peer via a dynamic
  `import()` and read its members off the resolved module at runtime, guarding
  the missing-peer case. A consumer that hasn't installed fancy-echarts/fancy-code
  still builds — the element shows a small dashed placeholder (with the
  `npm i …` hint) instead of breaking the build with a Rollup MISSING_EXPORT.
  The base bundle never statically requires the optional peers; they stay in
  dynamically-loaded chunks.

## 0.5.1 — 2026-05-29

### Fixed
- Inserting a chart / code / table / embed element with no `renderElement`
  wired no longer renders blank (which made the toolbar's Insert buttons look
  broken). The Slide renderer shows a labeled placeholder for those optional
  types when no renderer is provided — every insert is visible. Hosts that want
  the real render still pass `renderElement` from
  `@particle-academy/fancy-slides/registry`.

## 0.5.0 — 2026-05-29

"By paragraph" text builds — a single TEXT element can now reveal its
lines/bullets one per click (PowerPoint/Google Slides "By paragraph"), built on
top of the per-element animation feature from 0.4.0.

- **Schema**: new `byParagraph?: boolean` on `ElementAnimation` (only meaningful
  for text elements). Shape stays aligned with the sibling `dark-slide` PHP
  package.
- **Build model** (`src/utils/builds.ts`): when a text element's animation has
  `byParagraph: true`, `collectBuilds` expands it into ONE build per paragraph
  — the element's `content` split on `"\n"` (a single trailing empty line is
  dropped; 0/1 paragraphs falls back to a normal single build). The first
  paragraph keeps the element's own `trigger` (so it can be with-prev /
  after-prev relative to a prior element); every subsequent paragraph is
  forced to `on-click` (one line per click) and stays contiguous, so all of an
  element's paragraphs fire before the next element's builds. Each expanded
  build carries a `paraIndex` and the owning element. New exports:
  `splitParagraphs`, `isByParagraph`, `paragraphReveals`, and the `ParaReveal`
  type. `totalBuildSteps` / `visibleElementIds` account for the per-paragraph
  sub-steps automatically (an element is visible from its first paragraph's
  step).
- **Renderer**: `<Slide>` resolves a `ParaReveal` per by-paragraph text element
  and hands it to `TextElementRenderer`, which splits `content` on `"\n"`,
  renders each paragraph as its own block (markdown/html through the existing
  ContentRenderer path, so a `- …` bullet line renders as its own item), shows
  only the first K revealed paragraphs, and plays the element's effect on the
  paragraph that just fired. The element box stays mounted from its first
  paragraph onward (no whole-box entrance for by-paragraph elements). In
  `editing` mode the full text always renders (no hiding).
- **SlideViewer / PresenterView**: unchanged code — step math flows through the
  expanded build list, so advancing reveals the next paragraph, and after the
  last paragraph plus all other builds, advancing moves to the next slide.
- **Editor**: the ElementInspector "Build" tab shows an "Animate by paragraph
  (one line per click)" switch for TEXT elements once an effect is chosen
  (hidden for non-text elements), wired to `animation.byParagraph`.

## 0.4.0 — 2026-05-29

Per-element entrance animations (build steps) — elements can now reveal one
click step at a time, the way PowerPoint/Keynote builds work.

- **Schema**: new `ElementAnimation` (`effect`: fade / fly-in / zoom / wipe,
  `trigger`: on-click / with-prev / after-prev, `direction`, `duration`,
  `delay`, `order`) added as `animation?` on `ElementBase`. Shape is shared
  byte-for-byte with the sibling `dark-slide` PHP package. New
  `AnimationEffect` / `AnimationTrigger` types exported.
- **Op + reducer**: new `element_set_animation` `DeckOp` and
  `setAnimation(slideId, elementId, animation?)` on `DeckStateApi`; passing
  `undefined` clears the animation (drops the element from the build sequence).
- **Build model** (`src/utils/builds.ts`): a slide's builds are its animated
  elements stable-sorted by `(order ?? 0)` then array index, grouped into click
  steps — the first build and every `on-click` build opens a new step, while
  `with-prev` plays alongside the step's lead and `after-prev` follows it (delay
  = lead duration). Exports `collectBuilds`, `buildSteps`, `totalBuildSteps`,
  `visibleElementIds`, `buildsForStep`, `stepDelays`.
- **Slide renderer**: new optional `buildStep` prop. Not-yet-built animated
  elements are not rendered; elements revealing on the firing step play a
  pure-CSS entrance keyframe (fade / fly-in translate / zoom scale 0.8→1 /
  wipe clip-path inset) honoring `duration` / `delay` and
  `prefers-reduced-motion: reduce`. `editing` mode always shows every element.
- **SlideViewer**: tracks `buildStep` per slide (reset to 0 on forward slide
  change). → / Space / click advances to the next build step, then to the next
  slide once all builds have fired. ← steps back a whole slide, shown fully
  built (reversing individual builds is out of scope for v1). Home / End / 1-9
  jump fully built. Kiosk auto-advance walks builds then slides.
- **PresenterView**: mirrors the viewer's build step-through on the current
  slide; the "Up next" preview shows the next slide fully built. Prev/Next
  buttons drive retreat/advance.
- **useSlideKeyboard**: new optional `onAdvance` / `onRetreat` callbacks that,
  when provided, own forward/backward nav (so → / Space run builds-then-slide);
  Esc / Home / End / B / F / 1-9 unchanged.
- **Editor**: ElementInspector gains a "Build" tab (Effect / Trigger /
  Direction / Duration / Delay / Order; Effect "none" clears the animation) via
  a new `onSetAnimation` prop. Slide settings (no element selected) gains a
  compact "Build order" list with up/down buttons that reassign sequential
  orders, via `onSetElementAnimation`. Both threaded through `DeckEditor`.

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
