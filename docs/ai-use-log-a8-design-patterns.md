# AI Use Log — Assignment A8 (Design Patterns and GRASP Refactoring)

**Tool:** Claude Code (model: Opus 5.5, `claude-opus-5-5`)
**Dates:** 2026-10-15 to 2026-10-16
**Repository:** github.com/mendozaa0130/excalidraw (fork)

This log records, in the order it happened, what Claude Code did versus what I (the
student) did, for transparency.

## Part 1: Three GoF patterns already in the code

I pasted the Part 1 prompt into the session. Claude:

- Listed every class in `packages/` and `excalidraw-app/`, then read `ActionManager`,
  the `Action` interface, `Store`, `History`, `Emitter`, the library persistence code
  and the trail classes. It rejected the `AnimatedTrail` → `LassoTrail` / `EraserTrail`
  hierarchy as a Template Method candidate because the subclasses only override and
  call `super`, without a template step.
- Wrote a first version covering **Command** (`Action` / `ActionManager`),
  **Observer** (`Emitter` / `Store` / `History`) and **Adapter**
  (`LibraryPersistenceAdapter` / `LibraryIndexedDBAdapter`). It drew a Mermaid class
  diagram for each and rendered them to PNG.
- Fixed Mermaid syntax that would not render (parentheses inside attribute types and
  relationship labels), and corrected a few claims after checking them against the code:
  - It had attributed the "only subscribe if `onIncrement` is passed" optimization to
    `Store`; it is in `App`.
  - It had said the library's write queue protects against two tabs; it is in-memory,
    so it only serializes writes within one tab.
  - It replaced a guessed list of places that trigger the delete action with the four
    places it confirmed (`Delete` key, context menu, command palette, properties panel).

I then told Claude that my professor's notes only list Singleton, Observer, Strategy
and Factory. Claude pointed out that Command and Adapter are also among the 23 GoF
patterns. It checked that Strategy (`TextMetricsProvider`) and Factory (`newElement.ts`)
really exist in the code, and asked me which set to use. **I chose Observer, Factory and
Strategy.** Claude then:

- Replaced the Command and Adapter sections and diagrams with Factory and Strategy.
  It deleted their files, which had never been committed.
- Stated in the write-up that the Factory is a *Simple Factory* made of functions, not
  GoF *Factory Method*. It also noted that two of the three patterns are built from
  modules rather than classes, and how the diagrams show that.
- Corrected its own overstatements after checking them: the number of style defaults in
  `_newElementBase`, which tool uses `convertToExcalidrawElements` (the text-to-diagram
  dialog), and claims about Node and test environments for the text-metrics strategy.

## Part 2: A missing pattern

I pasted the Part 2 prompt. Claude:

- Read the GRASP section of my A3 page. Because A3 already used the pointer-up handler
  as its High Cohesion violation, it looked for a different example.
- Counted the `switch (element.type)` statements: 11 switches with 129 `case` labels.
  Using `git log -S`, it found that the sticky-note commit (`afa3a653`, #12064) changed
  84 files and added 13 `case "stickynote"` labels in 9 files.
- Found three supporting problems in the code:
  - default branches that silently return a value or throw at runtime;
  - inconsistent "rectangle-like" groupings, where `diamond` is grouped three
    different ways;
  - what looks like a typo in `getCanvasPadding` (`endArrowhead || endArrowhead`). It
    labeled this a *likely* typo, not a confirmed bug.
- Proposed Strategy per element type and drew the proposed design. It first combined
  canvas and SVG rendering into one interface. After checking where each switch lives,
  it split them by package so the design would not add an upward import.
- Wrote the GRASP connection: Polymorphism and Protected Variations are violated now,
  and the pattern restores them.

## Part 3: Implementation

I pasted the Part 3 prompt. Claude:

- Chose to implement the geometry part of the Part 2 proposal: `distanceToElement` and
  `intersectElementWithLineSegment`, with signatures unchanged so no call sites change.
  It said this is only part of the proposal, and the write-up lists the rest as next
  steps.
- Added `packages/element/src/elementGeometry.ts`. The strategy methods call the shape
  functions inside arrow functions because `distance.ts` / `collision.ts` and the new
  module import each other. A direct reference would throw at module load.
- Tested that the registry is complete by deleting the `stickynote` entry and running
  `tsc`. The error showed that its first type, `Extract<ExcalidrawElement, { type: K }>`,
  had turned `line` into `never`. Claude changed it to `ExcalidrawElement & { type: K }`
  and re-ran the check.
- Verified the change with `tsc`, the full `vitest` suite (run *without* `--update`, so
  a behavior change would fail a snapshot), ESLint and Prettier, and a production
  `vite build`. `yarn` was not installed, so it ran the same tools directly from
  `node_modules/.bin`.
- Corrected two claims in the write-up before committing:
  - It had written 25 call sites in 10 files; a recount found 20 in 8.
  - It had written that a missing `case` in the old switches compiled. A small `tsc`
    test showed TypeScript already reported it (TS2366), so the write-up now says the
    change keeps that safety rather than adding it.
- Committed the code as `A8: Apply Strategy to element geometry (distanceToElement,
  intersectElementWithLineSegment)` and the write-up as a separate commit.

## Wiki

I asked Claude to make the wiki. Claude:

- Cloned my fork's wiki and followed my earlier pages' conventions: live Mermaid with no
  static images, a "Source:" link to `docs/` under each diagram, and wiki-style page
  links. It added an A8 entry to Home.
- Pushed the A8 commits to my fork's `master`, so the wiki's source and commit links
  would work, and published the `Design-Patterns` page. It checked that the page and
  links returned HTTP 200, but did not view the rendered page in a browser.

## Part 4: GRASP refactoring

I pasted the Part 4 prompt. Claude:

- Chose `Store`, which received the whole `App` class but only used
  `app.scene.getElementsMapIncludingDeleted()` and `app.state`. This is the
  Low Coupling problem my A3 page identified.
- Changed `Store` to take two getter functions instead of `App`, following
  `ActionManager`'s constructor style. It reran the same checks as Part 3 and confirmed
  that `packages/element` now imports `App` zero times (one before).
- Committed this alone as `A8-GRASP: Refactor Store to apply Low Coupling`, separate from
  Part 3 and from the docs commit. It updated the Observer diagram from Part 1, which
  still showed `-app: App`.
- Narrowed one of its own claims: the change removes `Store`'s runtime calls into `App`,
  but not the other type-only imports counted in A3's violation ②.

## GRASP vs. GoF paragraph

Claude drafted a paragraph on how GRASP and GoF patterns relate. **I wrote my own
version** and asked Claude to publish it instead. Before publishing, Claude checked the
sticky-note commit's author and found it was written by an upstream Excalidraw
maintainer, not me. It changed "When I added sticky notes" to "When sticky notes were
added upstream" and told me. It also suggested tightening the sentence about adding a
type "without touching existing code". I chose to leave that as written. The rest of the
paragraph is my wording.

## Repo mechanics

- Diagrams were rendered with `@mermaid-js/mermaid-cli`, installed in a scratch
  directory with a scratch npm cache because of the same `~/.npm` cache error as in A2b
  and A3. One validation run wrote stray `check-*.svg` files into `docs/`; Claude
  deleted them before committing.
- Claude made all commits, pushed to my fork, and published the wiki at my direction.
  It wrote this log from its record of the session.
