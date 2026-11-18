# Part 2: Building the Partial Eraser

Design: [`docs/DESIGN.md`](../DESIGN.md), written and frozen before any code. This page records how the build went: the test-first steps, what changed in existing code and why, where the design turned out to be wrong, and the full test-suite run.

## What was built

| Layer (A3) | File | New / changed | Role |
| --- | --- | --- | --- |
| Domain | `packages/element/src/freedrawSplit.ts` | **new** | `splitFreedrawByPath()`: pure geometry. It takes a stroke and an eraser path and returns the surviving pieces. |
| Domain | `packages/element/src/shape.ts` | changed (+11) | `getFreedrawStrokeRadius()`: the ink half-width of a stroke |
| Domain | `packages/element/src/index.ts` | changed (+1) | export |
| Editor | `packages/excalidraw/eraser/partialErase.ts` | **new** | `applyPartialErase()`: turns the pieces into elements. It deletes the original, creates the fragments with `newFreeDrawElement`, and assigns z-order indices. |
| Editor | `packages/excalidraw/actions/actionToggleEraserMode.ts` | **new** | `toggleEraserMode()` plus the `eraserMode` Action |
| Editor | `packages/excalidraw/eraser/index.ts` | changed (+16) | `EraserTrail` keeps the gesture's full path. In partial mode it does not mark whole elements. |
| Editor | `packages/excalidraw/components/App.tsx` | changed (+30) | One branch on pointer-up, plus `partiallyEraseElements()` |
| Editor | `packages/excalidraw/components/Tools.tsx` | changed (+34) | Clicking the active eraser toggles the mode. The label shows the mode. |
| Editor | `types.ts`, `appState.ts`, `data/restore.ts`, `actions/types.ts`, `actions/index.ts`, `locales/en.json` | changed | The public `AppState.eraserMode`, its default, its storage policy, restore validation, and labels |
| - | `packages/excalidraw/CHANGELOG.md` | changed | Entry for the public API change |
| Application (`excalidraw-app/`) | - | **unchanged** | As predicted in DESIGN §3 |
| Renderers, collaboration, file format | - | **unchanged** | As predicted in DESIGN §4, point 4 |

Changes to existing source files total about 110 lines across 11 files, plus tests. All new logic is in three new files.

## Test-first, piece by piece

Each step was Red, then Green, with the output captured in this folder.

### Step 1: `splitFreedrawByPath` (unit, domain layer)

- **Red** ([`red-1-split-output.txt`](red-1-split-output.txt)): 15 tests against a stub that returned `null`. **13 failed on their assertions.** Two passed by accident: the two "returns `null` when untouched" cases, which a do-nothing stub satisfies. That is the usual weakness of testing for "no change" first. Those two tests only became meaningful once the other 13 forced a real implementation.
- **Green** ([`green-1-split-output.txt`](green-1-split-output.txt)): 15/15 pass. One failure on the way was a bug in _my test helper_, not in the code under test. The helper handed `getElementAbsoluteCoords` an object without `type`, so the function took its non-freedraw branch and computed `NaN`.
- **What the tests cover:** middle cut, end trim, full cover, two cuts in one drag, every surviving point outside the tolerance, rebasing to `[0, 0]`, `width`/`height`, a **rotated** stroke (fragments render where the ink was), pressures kept aligned and interpolated at the cut, simulated-pressure strokes, a sparse stroke where the eraser passes _between_ two samples, just-outside-tolerance, dropping tiny pieces, single-point strokes, and a single-point eraser path (a click).

### Step 2: `applyPartialErase` (unit, editor layer)

- **Red** ([`red-2-apply-output.txt`](red-2-apply-output.txt)): 11 tests, 6 failed. The 5 that passed were all in the "must not touch" group (non-freedraw elements, locked strokes, strokes not in the candidate set, missed strokes, deleted strokes). The stub touches nothing, so it passes all of them. This is the same effect as in Step 1, at a larger scale. Negative tests can't fail against a stub that does nothing, so they only start to mean something once the positive tests have forced real behavior.
- **Green** ([`green-2-apply-output.txt`](green-2-apply-output.txt)): 11/11.
- **What the tests cover:** the original is deleted and fragments are added; style, `groupIds`, `frameId`, `link` and `customData` are copied; z-position is kept and the fractional indices are valid; full cover; other group members are left alone; thicker strokes are cut from further away (the tolerance includes the ink width).

### Step 3: through the system (integration)

[`packages/excalidraw/tests/partialEraser.test.tsx`](../../packages/excalidraw/tests/partialEraser.test.tsx) mounts `<Excalidraw>` and works the way a user does:

1. Draw a stroke with the freedraw tool by dragging the mouse.
2. Pick the eraser from the toolbar, and click it again to switch to partial mode.
3. Drag across the stroke.
4. Press `Ctrl+Z` and `Ctrl+Shift+Z`.

- **Red** ([`red-3-system-output.txt`](red-3-system-output.txt)): the first run was red for the **wrong reason** (see the next section). After fixing the harness, 5 of 7 failed for the right reason. The test checking existing whole-element erasing passed, as it should, and so did the locked-stroke test, vacuously.
- **Green** ([`green-3-system-output.txt`](green-3-system-output.txt)): 7/7, plus the eraser unit tests from A7 (27/27) and Steps 1 and 2, for 60 total. An eighth system test was added afterwards (data remanence, below).

**Writing the integration test first was the hardest part, as the assignment predicted.** The unit tests could be written against a signature I chose. The system test had to be written against _the editor's_ existing behavior, and the first Red run told me nothing about my feature:

> "still erases whole strokes in element mode" (then named `givenElementMode_whenErasingAcrossAStroke_wholeStrokeIsDeletedAsBefore`; renamed in Part 3) **failed**, but that test exercises today's eraser, which I hadn't touched.

Investigation showed that in jsdom the editor's viewport is 0×0. As a result `App.visibleElements` is empty, and a _dragged_ eraser has nothing to hit. A _click_ uses a different code path (`getElementsAtPosition`), which is why the click test seemed to do something. The fix is the existing `mockBoundingClientRect` helper, which other suites use as well. **A finding:** nothing in the existing suite drives the eraser by dragging through the editor. The A7 characterization tests reach `EraserTrail` directly, with a stub `App`. Before this feature, the drag path through `App` had no test at all.

### Tests written after the code (not test-first)

- **`restoreAppState` / serialization** (5 tests in `tests/data/restore.test.ts`): default, valid value kept, the locally stored value kept, unknown values (`"pixel"`, `""`, `1`, `null`, an object) fall back to `"element"`, and `eraserMode` is never written to a `.excalidraw` file or to the database payload. These were written after the restore code. They pin acceptance criteria 11 and 12.
- **Data remanence** (system test): this one checks a _claim in the design_, not new code (see Revision 5).

## Where the design was wrong, and what changed

1. **The tolerance formula was wrong.** DESIGN §2 said: erase where the centerline is within `max(2.25, 5/zoom) + strokeWidth / 2`. But a freedraw stroke's ink is not `strokeWidth` wide. `perfect-freehand` draws it `strokeWidth × 4.25` wide for variable-width strokes and `× 1.4` for constant-width ones. With the designed formula, a default stroke (`strokeWidth` 2, ink about 8.5 px wide) would have been cut only where the eraser came within about 6 px of the center. Ink the eraser visibly crossed near the edge would have survived. **Fix:** a new `getFreedrawStrokeRadius()` in `shape.ts`, next to the existing `getFreedrawMaxStrokeRadius()`, which is a deliberately conservative upper bound for hit-testing and the wrong measure here. _Lesson:_ I designed from the data model (`strokeWidth`) instead of from what is rendered. In this codebase the two differ by a factor of up to 4.25, and the factor is private to `shape.ts`. That is another change to an existing file that my coupling list (DESIGN §4) did not predict.

2. **`EraserTrail` does less than designed.** DESIGN §4 said that in partial mode `EraserTrail` would "collect only freedraw candidates without expanding groups." Building it showed this was unnecessary. In partial mode `EraserTrail` now does **no hit-testing at all**: it only records the path. At pointer-up, `App` passes all visible freedraw elements as candidates, and `splitFreedrawByPath` returns `null` cheaply for strokes the path missed (see the bounds check in Revision 4). The result is simpler and avoids running two different hit tests that could disagree. It also removes a misleading preview: the old code fades every element it will delete, and in partial mode it would have faded _whole_ strokes that are only going to be cut.

3. **The toggle could not go through `ActionManager` from the toolbar.** DESIGN §5 said the mode toggle would be a Command (an `Action`) dispatched polymorphically by `ActionManager`. The toolbar buttons only receive `AppClassProperties`, which does not expose `actionManager`. Calling the Action's `perform` directly from the button didn't type-check (its `perform` type is narrowed by `register`). **Fix:** the toggle logic is a plain function, `toggleEraserMode(appState)`. The `Action` and the toolbar button both call it, so there is one source of truth with two entry points. The `Action` was meant to remain for the command palette. **It wasn't actually reachable until Part 5**: the palette lists its actions explicitly, and this one was never added (see [SELF-REVIEW.md](SELF-REVIEW.md)).

4. **A dependency I planned to reuse was dropped.** I first computed a stroke's rotation center with `getElementAbsoluteCoords` from `bounds.ts`. That function requires an `elementsMap` it doesn't use for freedraw, so `freedrawSplit.ts` now computes the center from the points directly, using the same formula. The domain function now depends only on `math` and `common`. I also added the **bounds pre-check** that DESIGN §6 promised as the availability mitigation: if the eraser path's bounding box, widened by the tolerance, misses the stroke's bounding box, the function returns before any per-point work.

5. **A claim in the design is now verified.** DESIGN §6 said that erased ink "is also included in saved `.excalidraw` files," but that came from reading code, with "the implementation will add a test that confirms or rules this out." The test "keeps the erased stroke's points in a saved file" runs the real _Save to disk_ action and serializes what that action hands to the file writer. **The original stroke is in the file, with `isDeleted: true` and its complete `points` array.** The design's caveat therefore holds. It applies equally to the existing eraser and to the Delete key.

## Changes to existing code: why, and did they improve or degrade the design?

| Change | Why it was needed | Improved or degraded? |
| --- | --- | --- |
| `App.tsx`: one `if (eraserMode === "partial")` in the 1,100-line pointer-up handler, plus a 20-line method | `App` is the only place an eraser gesture is committed (DESIGN §4, point 1) | **Slightly degraded.** It adds one more tool-specific branch to the handler that A3 identified as a High Cohesion violation. It is kept to a single branch, and the logic lives in `eraser/partialErase.ts`. The design accepted this compromise up front (DESIGN §5). |
| `eraser/index.ts`: `EraserTrail` records the full path, and returns early in partial mode | Partial erasing needs the whole gesture. `EraserTrail` only kept the last segment. | **Neutral to slightly degraded.** `EraserTrail` now reads `app.state.eraserMode`, which is one more way this class depends on `App`. It already read `app.state.zoom` and `app.state.theme`. A Strategy per mode (DESIGN §5, "deliberately avoided") would remove both mode checks. |
| `Tools.tsx`: `createToolButton` gained an optional `getLabelKey` | The eraser's label shows its mode | **Improved.** It is a small, optional extension point in an existing Factory. No other button changes, and any future tool with a state-dependent label can use it. |
| `shape.ts`: `getFreedrawStrokeRadius()` | Revision 1 | **Improved.** The ink-width knowledge stays in the module that owns it (Information Expert), next to its conservative sibling, rather than being copied as magic numbers in the eraser. |
| `types.ts` / `appState.ts` / `restore.ts`: the new public field | DESIGN §4, point 3 | **Neutral.** It follows the existing pattern for `preferredSelectionTool` exactly. The storage table forced the "browser only, never exported" decision to be explicit, which is the good kind of coupling the design anticipated. |
| `restore.ts`: validate `eraserMode` | DESIGN §6: stored and imported AppState is untrusted | **Improved**, for the field itself. Most AppState keys are copied from imported data without type checks (the generic loop at `restore.ts:1291`). This one now isn't. |

## Full test suite

Command (equivalent to `yarn test:app --watch=false`; `yarn` is not on this machine's `PATH`, so the binary in `node_modules` was run directly):

```
./node_modules/.bin/vitest run
```

The suite was run three times. The output of each run is saved in this folder.

**Run 1, before updating snapshots** ([`full-suite-before-snapshot-update.txt`](full-suite-before-snapshot-update.txt). In Part 4 this was cut to an excerpt of every failing test, one representative diff and the summary, because the raw log was 5,898 lines):

```
 Snapshots  133 failed
 Test Files  3 failed | 156 passed (159)
      Tests  132 failed | 2690 passed | 47 skipped | 1 todo (2870)
```

Every snapshot failure comes from the same cause. Three suites (`contextmenu`, `history`, `regressionTests`) snapshot the _entire_ `AppState`, and `AppState` now has one more key. After the update, the snapshot diff is exactly 133 added lines, all of them `"eraserMode": "element",` (`git diff -- '*.snap'`), with no other change. That is a direct, visible cost of the "adding a public AppState field touches many files" coupling in DESIGN §4, point 3. It reached three snapshot files the design did not list.

`contextmenu.test.tsx` also showed 14 failures of a different kind, `Found multiple elements with tool name: rectangle`. To check whether my change was responsible, I stashed all of my changes and ran that file on the clean merge commit, where it passed 17/17. With my changes, the _first_ test fails on its snapshot, vitest retries it, and the retry renders a second editor into the same document. Every later toolbar lookup then finds two rectangle buttons. After updating that file's snapshots, all 17 pass. So these failures were a cascade from the snapshot mismatch, not a separate defect.

**Snapshot update** (the project's `yarn test:update`, i.e. `vitest run --update`):

```
 Snapshots  116 updated
 Test Files  159 passed (159)
      Tests  2822 passed | 47 skipped | 1 todo (2870)
```

(17 of the 133 snapshots had already been updated while diagnosing `contextmenu`.)

**Final runs, without updates.** The first final run ([`full-suite-run1-flaky.txt`](full-suite-run1-flaky.txt)) had one failure:

```
 FAIL  packages/element/tests/duplicate.test.tsx > group-related duplication > action-duplicating within group
Error: still loading
 Test Files  1 failed | 158 passed (159)
      Tests  1 failed | 2821 passed | 47 skipped | 1 todo (2870)
```

The `still loading` error is the test harness's `waitFor` timing out while the editor mounts (`tests/test-utils.ts:96`). The test is unrelated to the eraser, it passed in the run just before, and it passed 3 out of 3 times on its own (74/74 each time). I read it as a timing flake under the load of a full parallel run, of the same kind as the `cropElement` flake recorded in A7, and did not change it. The second run ([`full-suite-final.txt`](full-suite-final.txt)) was clean:

```
$ ./node_modules/.bin/vitest run
 Test Files  159 passed (159)
      Tests  2822 passed | 47 skipped | 1 todo (2870)
   Duration  75.39s
exit code 0
```

The 2822 passing tests include the 39 new ones: 15 `freedrawSplit`, 11 `partialErase`, 8 system tests in `partialEraser.test.tsx`, and 5 in `restore.test.ts`. They also include the existing A7 eraser suite, 27/27, unchanged.

Typecheck (`yarn test:typecheck` is `tsc`):

```
$ ./node_modules/.bin/tsc
(no output)  exit code 0
```

Lint on all changed and new files: `eslint --max-warnings=0` reports no warnings after `eslint --fix` and `prettier --write` (the project's `yarn fix`). The fixes were formatting and import order only.
