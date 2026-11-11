# Part 4: What the Code Told Me

How hard each piece was to test, what caused the difficulty, which design rule it breaks, and what would fix it. Every obstacle below is one I actually hit while writing the Part 2 characterization tests or the Part 3 Red test; none are hypothetical.

## Obstacles

| # | What fought me | Where | Principle violated | What I would introduce |
| --- | --- | --- | --- | --- |
| 1 | **A constructor that needs half the system.** `new EraserTrail(app)` takes the whole `App` class (11,501 lines), but only reads 5 members: `visibleElements`, `state.zoom`, `state.theme`, `scene.getNonDeletedElementsMap()` and `ownerWindow`. Mounting the editor just to hit-test a line was out of proportion, so the tests pass a hand-built stand-in cast with `as unknown as App`. That cast compiles even if the stand-in is missing a member, so the type system no longer protects the test. | `eraser/index.ts`, `animatedTrail.ts` | **Low Coupling**, Interface Segregation | A narrow `EraserContext` interface with just those 5 members, or getter functions. This is the same fix A8 applied to `Store`, which also received all of `App` and used two things. |
| 2 | **Hit-testing is welded to animation and the DOM.** The constructor creates SVG elements. Every `startPath`/`addPointToPath` calls `update()` → `start()` → `AnimationController.start(…, app.ownerWindow)`, which schedules `requestAnimationFrame` callbacks. Asking "does this line touch this rectangle?" starts an animation loop, so every test must call `trail.stop()` in `afterEach` or it leaks timers into the next test. | `EraserTrail` / `AnimatedTrail` | **High Cohesion**, Single Responsibility | Split a pure `EraserHitTester` (path in, ids out) from the visual `EraserTrail`, which would just draw. |
| 3 | **The function that matters is unreachable.** The actual geometry, `eraserTest(segment, element, elementsMap, zoom)`, is a module-private `const`. The only way to call it is to build a trail, feed it points through the `LaserPointer` smoothing library, and read back a set. The Part 3 defect lives entirely inside it. | `eraser/index.ts` | **Information Hiding gone too far** / Low Coupling | Export it (or move it to `@excalidraw/element` beside the other collision code) so it can be tested directly with a segment and an element. |
| 4 | **Global static state with temporal coupling.** `snapDraggedElements` reads reference points from `SnapCache`, a class with only `static` fields. If nothing primed the cache first, it silently returns "no snap" instead of failing (I pinned this as `givenEmptySnapCache_whenDraggingNearEdge_doesNotSnap`). Tests must replicate App's priming calls exactly and `SnapCache.destroy()` after each one, or results leak between tests. | `snapping.ts` | **Protected Variations**, Low Coupling (hidden dependency) | Pass the reference points and gaps in as parameters, or make the cache an instance owned by `App` and handed to the function. |
| 5 | **Whole-app parameter, again.** Snapping takes `AppClassProperties` but only reads `app.state` and `app.props.gridModeEnabled`. Its reference-element filter also depends on the viewport (`width`, `height`, scroll, zoom), which nothing in the signature reveals. I had to read `getVisibleAndNonSelectedElements` to learn that the stand-in needed an explicit viewport (I used 2000×2000), and I pinned that dependency in `givenReferenceElementOutsideViewport_whenDraggingNearIt_doesNotSnap`. | `snapping.ts` | **Low Coupling** | Accept `{ state, gridModeEnabled }` or the specific fields. Make the visibility filter a separate step the caller applies. |
| 6 | **A query that mutates its argument.** `snapDraggedElements(…, dragOffset, …)` returns a snap offset _and_ rounds the caller's `dragOffset` object in place, but only when snapping is enabled. I only found this because a characterization test failed. | `snapping.ts` | Command–Query Separation | Return the rounded offset as part of the result, and never write to inputs. |
| 7 | **Hidden randomness and the clock.** `createIV()` reads `window.crypto` directly, so ciphertext can never be asserted byte-for-byte; the tests can only check lengths and round trips. The eraser trail stamps every point with `performance.now()` and its size decays over time. That didn't change hit results, but it makes the object non-deterministic. | `encryption.ts`, `EraserTrail` | **Protected Variations** | Inject a random-bytes source (default `window.crypto`) and a clock (default `performance.now`). |
| 8 | **A variation hidden in data, not types.** Freedraw outlines come from two different generators, chosen by `element.strokeOptions.variability`. Only one of them returns an empty outline for tiny strokes. Nothing in the types says an outline can be empty, and the test helper `API.createElement` silently defaults to the _other_ generator. My first Red test passed because of it. | `shape.ts`, `renderElement.ts`, test helpers | **Protected Variations**, **Polymorphism** (GRASP) | Make the outline generator an explicit strategy, and give the outline a type that admits "empty", so callers must handle it. The `invariant` in `getFreedrawOutlineAsSegments` encodes a precondition that no caller checked. |
| 9 | **Reproducing the bug needed the network and a decryptor.** The only reproduction data was an encrypted share link. Loading it in the app goes through `importFromBackend`, which fetches, decrypts, decompresses and restores in one call. I had to download the blob and call `decompressData` myself in a throwaway test. | `excalidraw-app/data/index.ts` | Low Coupling (I/O mixed with decoding) | Separate "fetch bytes" from "decode bytes" so decoding a saved file is a pure function with a test seam. |

**What was easy, for contrast:** `encryption.ts` was the easiest of the three (21 tests, 100% coverage) because its functions take their inputs as arguments and return results. Its only hidden dependency is the global `crypto` (obstacle 7). That contrast is the measurement: the code that was easy to test is the code that follows Low Coupling.

## Coverage, before and after

Same tool and config both times (`vitest.coverage.config.mts`, Vitest + V8, first-party source only). The after-run summary is in [`coverage-after/`](coverage-after/coverage-report.txt).

| Scope                | Metric    | Before (Part 1) | After      | Change    |
| -------------------- | --------- | --------------- | ---------- | --------- |
| **Whole project**    | **Lines** | **77.77%**      | **78.24%** | +0.47     |
|                      | Branches  | 85.40%          | 85.48%     | +0.08     |
|                      | Functions | 73.52%          | 74.00%     | +0.48     |
| `data/encryption.ts` | Lines     | 34.0%           | **100%**   | +66.0     |
| `eraser/index.ts`    | Lines     | 20.7%           | **88.4%**  | +67.7     |
|                      | Branches  | **100%**        | **87.3%**  | **−12.7** |
| `snapping.ts`        | Lines     | 42.9%           | 70.1%      | +27.2     |

The project number barely moved, as the assignment predicted: the three files are about 2% of the measured lines.

The eraser's **branch** coverage _went down_ while its line coverage quadrupled. This is the V8 counting quirk from Part 1 happening live. Before, almost none of the eraser's functions ran, and V8 counts an unexecuted function as a single "covered" branch, so it reported 100%. Once the tests ran those functions, V8 could see their real branches, and some of them (restore mode on grouped bound text, rotated freedraw) are still untaken. The before figure was not a fact about the code; it was a fact about what V8 had not looked at yet.

## Is the defect worth reporting upstream?

**Yes, but as a comment on the existing issue, not a new issue or a third PR.** Issue [#11945](https://github.com/excalidraw/excalidraw/issues/11945) has been open since 2026-08-23. What is already there:

- **A commenter decrypted the same scene but could not reproduce the bug.** They reported that a direct swipe "erases fine", including the zero-width stroke, and asked for more information about input and zoom. They never identified the exception.
- **[#11972](https://github.com/excalidraw/excalidraw/pull/11972)** (+4 lines) adds `if (outlinePoints.length < 2) return false;`. That stops the crash, so _other_ elements in the same swipe get erased, but the tiny strokes themselves can **never** be erased. It does not fix what the issue title reports. My test `givenTinyThinFreedrawStroke_whenEraserSwipesThroughIt_erasesIt` would still fail against it.
- **[#12031](https://github.com/excalidraw/excalidraw/pull/12031)** makes `getFreedrawOutlineAsSegments` return `[]` instead of throwing, and falls back to a distance check in the eraser. That is the same idea as my fix, plus a change to the shared helper.

Neither PR has been merged after more than two months, and the issue thread still has no confirmed root cause. A short comment would genuinely help maintainers choose between the PRs. It would cover:

1. The exact cause: `constant`-width strokes at `strokeWidth` 0.25 get a zero-point outline, and the eraser then hits the `invariant` in `getFreedrawOutlineAsSegments`.
2. Why the earlier commenter likely couldn't reproduce it: the bug only appears with `strokeOptions.variability: "constant"`. With the default `variable` options, the same points produce a valid outline. That is exactly how my own first Red test passed by mistake.
3. That #11972 stops the crash but leaves these strokes un-erasable.
4. The three regression tests, which use the issue's exact stroke data.

I have **not** posted this. Posting to the real project's tracker is a public action under my GitHub account, so it is my decision, not something to do automatically as part of the assignment.

Two smaller findings from Part 2 are different cases:

- **Arrow erase tolerance never takes effect at any zoom.** I found no report. It is worth a short issue, phrased as a question ("is the zoom-scaled tolerance meant to apply?"), because the intended reach is not clear from the code.
- **Ending a swipe exactly on a stroke line doesn't erase.** This looks related to the open PR [#11704](https://github.com/excalidraw/excalidraw/pull/11704) ("detect segment intersections at endpoints"). I have not verified that #11704 changes this case, so I would check that before mentioning it.
