# Part 1: Find the Gaps — Coverage Baseline

## Tool and how it was run

- **Tool:** Vitest 3.0.6 with the `@vitest/coverage-v8` provider (V8's built-in coverage instrumentation, reported through Istanbul reporters). This was already a dev dependency of the project; nothing new had to be installed.
- **Command:**
  ```bash
  yarn vitest run --config vitest.coverage.config.mts
  ```
- **Config:** [`vitest.coverage.config.mts`](../vitest.coverage.config.mts) extends the project's normal `vitest.config.mts` and only changes what gets measured (see "Scoping" below).
- **Suite result during the run:** 150 test files, 2,660 tests passed, 47 skipped, 1 todo, 0 failed.
- **Codebase state:** `master` after merging upstream `excalidraw/excalidraw` on 2026-11-10 (merge commit `08884bf69`).

## Report location

| File | What it is |
| --- | --- |
| [`coverage-baseline/index.html`](coverage-baseline/index.html) | Browsable HTML report, per file, with uncovered lines highlighted |
| [`coverage-baseline/coverage-report.txt`](coverage-baseline/coverage-report.txt) | Plain-text table for every file |
| [`coverage-baseline/coverage-summary.json`](coverage-baseline/coverage-summary.json) | Machine-readable totals per file |

## Overall result

| Metric       | Covered / Total   | Percent    |
| ------------ | ----------------- | ---------- |
| **Lines**    | 114,082 / 146,687 | **77.77%** |
| **Branches** | 16,625 / 19,467   | **85.40%** |
| Functions    | 3,105 / 4,223     | 73.52%     |
| Statements   | 114,082 / 146,687 | 77.77%     |

**Kinds of coverage measured:** line, branch, function and statement coverage. The headline numbers are **line coverage 77.8%** and **branch coverage 85.4%**.

### By package

| Package | Lines | Branches | Functions | Lines measured |
| --- | --- | --- | --- | --- |
| `packages/math` | 92.8% | 94.1% | 87.2% | 2,376 |
| `packages/fractional-indexing` | 92.2% | 88.1% | 100.0% | 322 |
| `packages/common` | 89.0% | 87.4% | 85.2% | 3,641 |
| `packages/element` | 86.1% | 90.1% | 92.5% | 38,866 |
| `packages/utils` | 76.5% | 84.1% | 66.7% | 595 |
| `packages/excalidraw` | 75.8% | 82.9% | 68.4% | 93,575 |
| `packages/laser-pointer` | 72.3% | 78.7% | 76.9% | 527 |
| `excalidraw-app` | **46.1%** | **57.1%** | **36.2%** | 6,785 |

### Largest gaps (most uncovered lines)

| File | Lines | Branches | Uncovered lines |
| --- | --- | --- | --- |
| `packages/excalidraw/components/App.tsx` | 80.2% | 85.1% | 2,275 |
| `packages/excalidraw/subset/woff2/woff2-bindings.ts` | 49.4% | 56.5% | 2,050 |
| `packages/element/src/binding.ts` | 66.8% | 90.2% | 1,157 |
| `packages/excalidraw/components/CommandPalette/CommandPalette.tsx` | 12.8% | 60.0% | 911 |
| `packages/excalidraw/snapping.ts` | 42.9% | 57.7% | 807 |
| `packages/excalidraw/components/ConvertElementTypePopup.tsx` | 35.7% | 59.3% | 624 |
| `excalidraw-app/App.tsx` | 53.9% | 54.0% | 613 |
| `excalidraw-app/collab/Collab.tsx` | 49.0% | 58.1% | 564 |
| `packages/excalidraw/components/PublishLibrary.tsx` | 8.2% | 100% | 512 |
| `packages/element/src/arrows/focus.ts` | 43.4% | 78.8% | 325 |
| `packages/excalidraw/eraser/index.ts` | 20.7% | 100% | 241 |
| `packages/excalidraw/renderer/renderSnaps.ts` | 19.2% | 16.7% | — |

The weakest area is the **web app layer (`excalidraw-app/`)**: collaboration (`collab/Collab.tsx`), Firebase/share-link data handling and the app shell are under 50% line coverage. That is also where most of the security-relevant code from the earlier threat model lives (share links, encryption keys in URL fragments, the collaboration server), so it is the obvious place to aim new tests. `snapping.ts`, the eraser, and `binding.ts` are the largest untested pieces of core editor logic.

## Scoping: why the number differs from the default config

Running the project's built-in `yarn test:coverage` gives **67.93% lines / 84.76% branches**, but that figure is not trustworthy. The default config has no `include` list, so V8 also instruments every third-party module the tests load. In that report **283,511 of 444,627 measured lines (64%) were in `node_modules`** (Mermaid, Cytoscape, KaTeX, pica, …), plus `scripts/`, `examples/` and `dev-docs/`, none of which this project's tests are meant to cover.

`vitest.coverage.config.mts` restricts measurement to first-party source (`packages/**`, `excalidraw-app/**`) and excludes tests, snapshots, type declaration files and build output. The 77.77% figure above is from that scoped run.

## Do I believe the number?

**Partly. I trust it as a rough map of which code never runs. I do not trust it as a measure of how well the code is tested.** Reasons:

1. **The branch number is inflated by how V8 counts branches.** Branch coverage is supposed to be the stricter metric, yet here it is _higher_ than line coverage (85.4% vs 77.8%). V8 only records the individual branches of a function once that function has executed; a function that never runs is counted as a single branch. Large untested areas therefore barely dent the branch total. For example, `PublishLibrary.tsx` and `eraser/index.ts` report **100% branch coverage with only 8% and 21% line coverage**. The line number is the more honest of the two for this project.

2. **Rendering is "covered" without being checked.** Tests run in jsdom with `vitest-canvas-mock`, which replaces the HTML canvas with a stub that accepts drawing calls and draws nothing. `staticScene.ts` (94.8%), `renderElement.ts` (88.8%) and `scene/export.ts` (96.1%) look well tested, but only 3 test files ever inspect the recorded canvas calls. Most of those lines ran with nothing looking at the result, exactly the `divide(10, 2)` situation from the assignment.

3. **A large part of the suite asserts through big snapshots.** There are 46 snapshot files totalling about 1.5 MB; the largest (`history.test.tsx.snap`, 561 KB; `regressionTests.test.tsx.snap`, 379 KB) store whole `appState`/element dumps. 33 tests assert _only_ through snapshots. These catch "something changed", but they will happily lock in wrong behaviour and are usually re-accepted with `yarn test:update` (which the project's own `CLAUDE.md` tells contributors to run before every commit).

4. **Some tests assert nothing at all.** For example, `packages/excalidraw/tests/history.test.tsx:5105`, _"should unbind remotely deleted bindable elements from arrow when the arrow is added through the history"_, has an empty body (`async () => {}`). It passes, appears in the pass count, and claims to test a behaviour it never exercises. 47 more tests are skipped.

5. **App.tsx coverage comes from integration tests.** `App.tsx` is 80% covered because almost every UI test mounts the whole editor, so most of its ~11,000 lines run as a side effect of tests about something else.

6. **One distortion in the other direction:** pure TypeScript type files (`types.ts` in several packages, 3,283 lines) contain no runtime code but are counted as 0% covered because the project sets `ignoreEmptyLines: false`. Excluding them would raise line coverage to about **79.6%**. That does not change the conclusions above.

**Bottom line:** the real line coverage of first-party code is about 78–80%, but the _meaningful_ coverage, where a test would fail if the code produced the wrong answer, is lower, and the true gaps are concentrated in `excalidraw-app/` (collaboration and sharing), snapping, the eraser and arrow binding.

## Reproducing

```bash
yarn install
yarn vitest run --config vitest.coverage.config.mts
open docs/coverage-baseline/index.html
```
