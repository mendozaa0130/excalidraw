# AI Use Log — Assignment A7 (Automated Testing)

**Tool:** Claude Code (model: Opus 5.5, `claude-opus-5-5`) **Dates:** 2026-11-10 to 2026-11-11 **Repository:** github.com/mendozaa0130/excalidraw (fork)

This log records, in the order it happened, what Claude Code did versus what I (the student) did, for transparency. It covers Parts 1–5 and the deliverables.

**Network use:** Claude's network requests were read-only GitHub lookups (my fork, my wiki, and the public issue and pull request API for `excalidraw/excalidraw`), plus one download of the public scene linked in upstream issue #11945 from Excalidraw's share-link backend, which was needed to reproduce that bug. Nothing was posted to the upstream project.

## Before the assignment: syncing the fork

- I asked whether the original repo had new updates. Claude fetched `upstream` and reported 22 new commits, with my fork 21 commits ahead.
- **I told it to merge.** It merged `upstream/master` into `master` with no conflicts (`08884bf69`), ran the type check, and confirmed my A5 Sentry fix was untouched.
- **I told it to push.** Before that, I asked whether pushing would send my work to the original repo. Claude explained that `origin` is my fork and `upstream` is read-only for me. It then pushed to my fork and ran the full test suite (150 files, 2,660 passed).

## Part 1: Find the gaps

I pasted the Part 1 prompt. Claude:

- Found that coverage tooling already existed (Vitest + `@vitest/coverage-v8`) and ran it. The built-in command reported **67.93%** lines. Claude noticed that 64% of the measured lines were in `node_modules`.
- Tried to narrow the scope with command-line flags. **They were silently ignored**, and Claude noticed because the totals did not change. A config file in the scratchpad then failed to load. It finally added `vitest.coverage.config.mts` to the repo, which measures only first-party source: **77.77% lines, 85.40% branches**.
- Found that `.gitignore` ignores any folder named `coverage`. It used `docs/coverage-baseline/` rather than editing `.gitignore`.
- Wrote `docs/coverage-baseline.md`, including why the number should not be fully trusted: V8 inflates branch coverage, the canvas is mocked, many tests are snapshot-only, and one test has an empty body.
  - **Its assertion-counting script gave false positives.** It flagged `flip.test.tsx` and `selection.test.ts` as having no assertions. Claude read them, found the assertions in helper functions, and only cited the genuinely empty test.

## Part 2: Characterization tests

I pasted the Part 2 prompt. Claude:

- Used the coverage data to choose central code with zero tests: share-link encryption, the eraser and object snapping. It avoided small helpers.
- Wrote 75 tests in three commits. For the eraser and snapping it built minimal stand-ins for `App` instead of mounting the editor, and changed no production code.
- **Four of its first expectations were wrong.** It had written what it thought the code should do: ending a swipe on a stroke erases, a zero-length swipe erases, arrow reach grows when zoomed out, and `round()` rounds to whole numbers. In each case it probed the real behavior with a temporary test, then pinned what the code actually does.
- Found a likely latent bug this way: the eraser's zoom-dependent arrow tolerance never takes effect. It pinned the behavior and documented it, without fixing it.
- Checked the tests with mutations: it broke the production code on purpose, two or three times per component, confirmed the tests failed, then restored the code with `git checkout`.
- **It told me in its summary that five guesses were wrong. It was four.** It corrected this later, in Part 5.

## Part 3: Red, Green, Refactor

I pasted the Part 3 prompt. Claude:

- Proposed the arrow-tolerance bug, then searched the upstream tracker first, because an open issue is the assignment's preferred source. It found **#11945**, downloaded the scene linked in the issue, decrypted it with the project's own `decompressData`, and ran the real eraser against each stroke. Two strokes made the eraser throw `Freepath outline must have at least 2 points`.
- **Its first Red test passed.** It had created the stroke with default stroke options instead of the issue's `constant` ones. Claude noticed the test was green, found the difference, and matched the issue's data. The test then failed with the issue's error.
- Committed Red, Green and Refactor separately, with the required titles, and saved the test output for each step in `docs/a7-tdd/`. After Green it reran the issue's original drawing: all 7 strokes erase.
- Did the refactor with tests unchanged and showed that only `eraser/index.ts` changed.

## Parts 4 and 5: Analysis and write-up

I pasted the Part 4 and 5 prompts. Claude:

- Listed nine obstacles it had actually hit, with the GRASP or design rule each violates and a fix. It linked the `App` coupling to my A8 `Store` refactor.
- Re-ran coverage: **77.77% → 78.24%** lines. It pointed out that the eraser's branch coverage fell from 100% to 87% as its line coverage rose, which is the V8 quirk from Part 1.
- Checked upstream before answering "worth reporting?" and found two open fix PRs.
  - **Its first draft said an upstream commenter had already found the root cause.** Claude then read the comment, which says the opposite: they could not reproduce it. It rewrote the section before committing. It also confirmed from the patch that PR #11972 makes these strokes un-erasable rather than fixing them.
- Recommended a comment on #11945 rather than a new issue. **It did not post anything**, because that would be public under my account. It left the decision to me.
- Drafted the one-page write-up, including where the assistant misled me.

## Deliverables

- I pasted the deliverables list. Claude interpreted the **Testing Evolution** section, which none of the pasted parts defined, as the test suite's progression through the assignment, with test counts and coverage at each commit.
- Regenerated the full HTML coverage report for the "after" run, to match the baseline. **The first attempt failed** on a pre-existing flaky test (`cropElement.test.tsx`, a random scale plus exact float equality), and Vitest deleted the report folder. Claude reran that test file 6 times (all passed), documented the flakiness without fixing it, reran coverage cleanly and updated the branch figure (85.48% to 85.51%) from that run.
- **Who wrote what:** Claude made all commits, pushed to my fork and published the wiki at my direction. The write-up is in my voice, but Claude drafted it.
