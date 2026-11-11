# Part 3: Red, Green, Refactor on a Real Defect

## The defect

**Source:** open upstream issue [excalidraw/excalidraw#11945](https://github.com/excalidraw/excalidraw/issues/11945), _"Can't delete unlocked freedraw elements from the scene with the eraser"_ (opened 2026-08-23, still open). This is the most preferred kind of defect in the assignment: a real, open bug report that I could reproduce.

**Reproducing it.** The issue links a shared drawing. I downloaded it from the share-link backend and decrypted it with the project's own `decompressData` (the code characterized in Part 2). It contains 7 freehand strokes. All of them are unlocked, use `strokeWidth: 0.25` (the thinnest setting) and `strokeOptions: { variability: "constant", streamline: 0.5 }`.

Running the real `EraserTrail` against each stroke showed:

| Stroke | Points | Outline points | Eraser result |
| --- | --- | --- | --- |
| 5 of the 7 | 9–16 | 78–104 | erased |
| `CalqHi-…`, `8MFskv…` | 3 | **0** | **throws** `Freepath outline must have at least 2 points` |

**Root cause.** For very short, thin strokes the outline generator returns **zero** outline points. The eraser's freedraw hit test (`eraserTest` in `packages/excalidraw/eraser/index.ts`) passes that empty outline to `getFreedrawOutlineAsSegments()`, whose `invariant` throws. The exception escapes `EraserTrail.addPointToPath()`, which is called on every pointer move. The whole eraser pass is aborted, so the stroke can never be erased. Anything else the same pointer move touched is not erased either. The same strokes at `strokeWidth ≥ 0.5` have a normal outline and erase fine, which is why the bug only shows up with the thinnest pen.

This is also a case my Part 2 characterization tests had come close to: they pinned the eraser's freedraw path, but only with normal-width strokes.

## Red: `8ef92ce6d` A7-Red: Failing test for eraser unable to delete tiny thin freedraw strokes

Three tests were added to `packages/excalidraw/eraser/eraser.test.ts`, using the geometry and stroke options copied from the issue's drawing:

- `givenTinyThinFreedrawStroke_whenEraserSwipesThroughIt_erasesIt`
- `givenTinyThinFreedrawStrokeNextToRectangle_whenSwipeCrossesBoth_erasesBoth`
- `givenTinyThinFreedrawStroke_whenEraserPassesFarAway_doesNotEraseIt`

All three failed **for the right reason**, the exact error from the issue (full output in [`red-output.txt`](red-output.txt)):

```
FAIL  …(#11945) > givenTinyThinFreedrawStroke_whenEraserSwipesThroughIt_erasesIt
Error: Freepath outline must have at least 2 points
 ❯ invariant packages/common/src/utils.ts:889:11
 ❯ getFreedrawOutlineAsSegments packages/element/src/renderElement.ts:1379:3
 ❯ eraserTest packages/excalidraw/eraser/index.ts:239:28
 ❯ EraserTrail.updateElementsToBeErased packages/excalidraw/eraser/index.ts:146:28
 ❯ EraserTrail.addPointToPath packages/excalidraw/eraser/index.ts:79:35

Tests  3 failed | 24 passed (27)
```

The third test ("far away") fails too, even though the expected answer is "not erased". A swipe 12 px away still passes the cheap 15 px bounds pre-check and reaches the throwing code, which shows the crash isn't limited to direct hits.

**A false start, kept honest.** My first version of the Red test _passed_. I had built the stroke with the default `variable`-width stroke options, and that outline generator produces a valid outline even at width 0.25. The issue's strokes use `constant` width. After matching the stroke options exactly, the test failed with the issue's error. This is the trap the assignment warns about: a Red test that is green has not reproduced the defect.

## Green: `983f8dd8a` A7-Green: Fix eraser unable to delete tiny thin freedraw strokes

The least change, in `packages/excalidraw/eraser/index.ts` only:

```ts
const tolerance = Math.max(2.25, 5 / zoom); // moved up, unchanged

// Very short, thin strokes can produce an empty outline (#11945), which
// getFreedrawOutlineAsSegments() rejects. Test the stroke's own points.
if (outlinePoints.length < 2) {
  const points = element.points.map(([x, y]) =>
    pointFrom<GlobalPoint>(element.x + x, element.y + y),
  );
  return points.some(
    (point, i) =>
      lineSegmentsDistance(
        lineSegment(point, points[i + 1] ?? point),
        pathSegment,
      ) <= tolerance,
  );
}
```

When there is no usable outline, the eraser measures distance to the stroke's own centerline with the same zoom-based tolerance it already uses for outlines. Strokes with a normal outline go through exactly the same code as before.

I fixed this in the eraser rather than inside `getFreedrawOutlineAsSegments()` because the eraser is its only caller, and the `invariant` there is a reasonable contract. The eraser was the code that broke it.

**Whole suite after the fix** ([`green-output.txt`](green-output.txt)):

```
Test Files  153 passed (153)
     Tests  2738 passed | 47 skipped | 1 todo (2786)
```

The type check was clean. As an extra check, running the eraser against the issue's original drawing again showed all 7 strokes now erase.

## Refactor: `699c83413` A7-Refactor: Clean up eraser hit-testing

Structure only, with no behavior change and no test files touched (`git diff --name-only` showed only `eraser/index.ts`):

- **Split by element type.** `eraserTest` was ~120 lines with three type-specific branches inline. It now reads as: bounds pre-check, inside test, then dispatch to `freedrawEraserTest` or `linearEraserTest`, with the generic shape test left in place.
- **Removed duplication the fix introduced.** The loop "is any segment within `tolerance` of the eraser path" existed three times (freedraw outline, the new fallback, arrows and lines). It is now `isAnySegmentWithinTolerance`. The local-to-scene point mapping existed twice (the fallback and the freedraw polygon) and is now `toScenePoints`.

**Whole suite after the refactor** ([`refactor-output.txt`](refactor-output.txt)): 153 files, 2,738 passed, 47 skipped, 1 todo, 0 failed. The type check was clean.

## Not fixed (noted for later)

Part 2's characterization tests also exposed a second likely defect in the same file. The arrow and line erase tolerance `max(strokeWidth, strokeWidth * 2 / zoom)` never takes effect, because the bounds pre-check uses `strokeWidth / 2` and rejects first. Arrows are therefore equally hard to erase at every zoom level. I left it alone: there is no issue report saying what the intended reach is, and fixing it would change pinned behavior beyond this assignment's single defect.
