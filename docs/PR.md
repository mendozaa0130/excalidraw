# feat(editor): add a partial eraser mode that cuts freedraw strokes

> Pull request description, written for review. **Not submitted**: this lives in the fork `mendozaa0130/excalidraw` on branch `feat/partial-eraser`.

## Problem

The eraser deletes whole elements. A freehand stroke is everything drawn between pen-down and pen-up, which is often a whole word or a long squiggle. So fixing one mistake in handwriting means deleting all of it and redrawing it. In a group, the whole group goes.

This has been requested several times, and the issues are still open:

- **#9199**, _"Eraser Tool Erases Entire Stroke Instead of Partial Erasing"_. A maintainer replied: _"IMO partial removal makes sense as well … so I'll leave this one in the backlog."_
- **#4904**, _"non-atomic erasing for linear & freedraw shapes"_, opened by a maintainer: it _"should split the shape into two when a middle point is removed"_ and _"if we implement this we should make this opt-in."_ It is labeled `discussion`.
- **#10332**, a duplicate of #9199.

Closes #9199. Partially addresses #4904: freedraw only, see _Left out_.

## What changed

**User-facing**

- The eraser gets a second mode, **partial**. It is opt-in, and the default stays `"element"`, which is today's behavior. You switch modes by **clicking the eraser button while the eraser is already active**, the same gesture as selection ⇄ lasso. The command palette also has **Toggle partial eraser**. The button label and the hint bar show which mode is on.
- In partial mode, dragging across a freedraw stroke removes only what the eraser covered:
  - crossing the middle splits the stroke in two;
  - crossing an end shortens it;
  - covering all of it deletes it;
  - crossing it several times in one drag leaves several pieces.
- The whole drag is **one undo step**.
- Rectangles, text, arrows, images and other non-freedraw elements are **not affected** in partial mode, and neither are locked strokes. Cutting one stroke in a group does not erase the rest of the group.

**Public API**

- `AppState.eraserMode: "element" | "partial"`.
  - It is stored in the browser and never exported or sent to the server: `APP_STATE_STORAGE_CONF` is `{ browser: true, export: false, server: false }`.
  - Hosts can set it with `initialData.appState` or `updateScene`.
  - `restoreAppState` replaces any value other than the two allowed ones with `"element"`.

**How it's built** (start reading at the top)

| Where | What |
| --- | --- |
| `element/src/freedrawSplit.ts` (new) | `splitFreedrawByPath(element, eraserPath, tolerance, minFragmentLength)`. A pure function. It returns `null` if the stroke was untouched, `[]` if it was fully erased, and otherwise the surviving runs. It works in the stroke's unrotated local frame, samples densely enough that the eraser can't slip between two points, and bisects to place each cut on the tolerance boundary. Pressures are interpolated at the cut. Each fragment is re-positioned so that it renders where its ink was, which matters for rotated strokes, since a fragment rotates about its own center. The hit test doesn't allocate. |
| `element/src/shape.ts` | `getFreedrawStrokeRadius()`: the ink half-width. Erasing has to match the ink the user sees, and that ink is up to `4.25 × strokeWidth` wide, not `strokeWidth`. |
| `excalidraw/eraser/partialErase.ts` (new) | `applyPartialErase(elements, candidateIds, path, zoom)`. It marks each cut stroke `isDeleted` and inserts its fragments right after it as new `freedraw` elements created with `newFreeDrawElement`. Fragments copy the original's style, `groupIds`, `frameId`, `link` and `customData`, and `syncMovedIndices` gives them the original's z-position. |
| `excalidraw/eraser/index.ts` | `EraserTrail` now records the gesture's full path. In partial mode it marks nothing as pending deletion, because fading whole elements would preview the wrong result. |
| `excalidraw/components/App.tsx` | One branch on pointer-up: in partial mode, apply the cut to visible freedraw strokes, then `store.scheduleCapture()` and `scene.replaceAllElements()`, so the change is one history entry. |
| `Tools.tsx`, `HintViewer.tsx`, `CommandPalette.tsx`, `actions/actionToggleEraserMode.ts` | The toggle, its label and hint, and the palette entry. |
| `types.ts`, `appState.ts`, `data/restore.ts`, `locales/en.json`, `CHANGELOG.md` | The new field, its default, its storage policy, restore validation, the strings, and the changelog. |

Renderers, collaboration and reconciliation, the file format, and `excalidraw-app/` are **unchanged**. Fragments are ordinary freedraw elements.

## How it was tested

**Automated.** These are the new tests (43):

- `element/tests/freedrawSplit.test.ts` (16): middle, end, full cover, several cuts, the tolerance boundary, rebasing, rotation, pressures, sparse samples, tiny fragments, single points, a click, and a 250,000-point stroke.
- `eraser/partialErase.test.ts` (10): delete plus fragments, copied properties, z-order and valid fractional indices, and what must stay untouched (other types, locked, non-candidates, deleted).
- `eraser/eraser.test.ts` (+2): in partial mode, `EraserTrail` marks nothing, not even the group of an element it hits.
- `tests/partialEraser.test.tsx` (10, mounts `<Excalidraw>`): draw → toggle from the toolbar → drag → 2 strokes → `Ctrl+Z` gives back the original id → `Ctrl+Shift+Z`. Also: rectangles survive, element mode is unchanged, `updateScene` sets the mode, click-to-cut, locked strokes, the hint bar, the command palette, and that the original ink stays in a saved file (see _Risks_).
- `tests/data/restore.test.ts` (+5): default, valid, locally stored, invalid values, and never serialized.

```
yarn test:typecheck          # tsc: exit 0
yarn test:code               # eslint --max-warnings=0: exit 0
yarn test:app --watch=false  # 159 files, 2826 passed, 47 skipped, 1 todo
```

Three snapshot files change. Each change is exactly one added line, `"eraserMode": "element",`, in snapshots of the full `AppState` (133 lines in total).

**Manual** (Chromium, `yarn start`):

1. Draw a long freehand stroke with the pen tool (P), and a rectangle under part of it.
2. Press E, then **click the eraser button again**. The hint reads _"Erasing parts of pen strokes…"_ and the button's label becomes _"Eraser (partial: cuts pen strokes)"_.
3. Drag down across the middle of the stroke and the rectangle. The stroke splits in two where the eraser crossed it, and the rectangle stays.
4. Press Cmd/Ctrl+Z. The stroke comes back whole in one step.
5. Click the eraser button again to go back to whole-element erasing, and confirm it behaves as before.

The same steps run headless in a Playwright script, which also logs the element ids at each step.

## Left out on purpose

- **Lines and arrows.** They have bindings, arrowheads, `roundness` and their own point editor, and cutting them raises a separate set of questions. #4904 asks for them too, so this is a possible follow-up.
- **Shapes and text.** A rectangle with a gap can't be represented as a rectangle.
- **A live preview of the cut while dragging.** The cut is applied on pointer-up, and the eraser trail shows where you dragged. A preview would require the renderer to draw part of an element.
- **A modifier key instead of a mode.** `Alt` is already "revert" while erasing, and pen and touch users have no modifier key.
- **A keyboard shortcut and a properties-panel control.** The panel is hidden while the eraser is active with nothing selected.
- **Merging pieces back together**, and other erasing tools such as a pixel eraser.

## Risks and backward compatibility

- **Default behavior is unchanged.** Without opting in, nothing changes, and the existing eraser tests pass unmodified.
- **Files and collaboration.** No element schema change, so no migration is needed. A file from this version opens correctly in older versions. Mixed-version rooms work, because an older client simply receives one deletion and N new elements through the normal reconcile path.
- **Ids change, in partial mode only.** A cut stroke is replaced by fragments with new ids. `#element=` links, comment anchors and host data keyed by id outside `customData` no longer point at it. That's the same as if the stroke had been deleted, but here it happens on a partial edit. Fragments keep `link` and `customData`.
- **Erased ink stays in the data.** The original stroke stays as an `isDeleted` tombstone with its full `points`, in history, in what collaborators receive, and **in saved `.excalidraw` files**. A test confirms the saved-file case. This is how deletion already works for the eraser and the Delete key, but users may expect partially erased ink to be gone.
- **More elements.** Each cut adds elements, so heavy scrubbing grows the scene. Fragments shorter than 1 scene unit (adjusted for zoom) are dropped.
- **Host types.** `AppState` gains a required field. Hosts that build a complete `AppState` literal by hand, rather than starting from `getDefaultAppState()`, need to add it. `onChange` consumers will see the new key.

## Please look closely at

1. **Tolerance** (`partialErase.ts`, `getPartialEraseTolerance`). It is the existing freedraw eraser reach, `max(2.25, 5/zoom)`, plus the nominal ink half-width at full pressure. For variable-width strokes drawn with light pressure, the ink is thinner than that, so a cut can be slightly wider than the visible ink. Is "matches the ink at full pressure" the right target, or should it use the pressure at each point?
2. **New ids vs. stable ids** (see _Risks_). The alternative was storing erased ranges or a mask on the element. That keeps ids stable, but older readers would draw the erased ink again. I'd like a maintainer's view before going further, since it decides whether lines and arrows can follow the same approach.
3. **The cut ends are drawn as new stroke ends.** Each fragment's outline is regenerated by perfect-freehand, so the new ends taper like the start and end of a stroke. At default settings the demo screenshots look clean, but I haven't checked thick, high-variability strokes, where the piece next to the gap may come out thinner than the ink was before. Acceptable, or should fragments carry something like "don't taper this end"?
4. **The toggle gesture.** Clicking the active eraser button copies selection ⇄ lasso, but it is hard to discover. The palette entry and the hint help. Would you rather have a visible control?
5. **`App.tsx`.** The change is one branch in the already very long pointer-up handler. I kept it to a single call into `eraser/partialErase.ts`, but a per-mode eraser strategy object would be cleaner if a third mode ever appears.
