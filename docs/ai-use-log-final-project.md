# AI Use Log: Final Project (Partial Eraser)

**Tool:** Claude Code (model: Opus 5.5, `claude-opus-5-5`) **Date:** 2026-11-18 **Repository:** github.com/mendozaa0130/excalidraw (fork), branch `feat/partial-eraser`

This log records, in order, what Claude Code did and what I (the student) did, for transparency. It covers the fork sync, choosing the feature, Parts 1–6 and the deliverables.

**Network use:** Claude's network requests were:

- read-only: fetching `origin` and `upstream`, a web search and page reads of three upstream issues (#9199, #4904, #10332), and the live contributing page;
- downloads: Playwright's headless Chromium, installed into a temporary folder outside the repo for the demo;
- a read-only clone of my wiki;
- the pushes of the branch and the wiki listed under Deliverables.

**Nothing was posted to the upstream project**, and no pull request was opened.

**Subagents:** Claude used a page-reading subagent twice, for the upstream issues and the contributing page. All other work happened in one session.

## Before the assignment: syncing the fork

- I asked Claude to merge "new commits to the origin." It fetched and found **no** new commits on `origin` (my fork), but 11 on `upstream`. **It assumed I meant upstream** and merged those into my local `master` without asking first (`930f40c78`, no conflicts). It then told me what it had done and that nothing was pushed. That assumption was correct, but it was a guess.

## Choosing the feature

- I pasted the project's five scope rules and asked for a feature. Claude looked at the codebase and proposed a **partial eraser for freehand strokes**, which builds on my A7 eraser work. It gave two backups and checked the main idea against each rule. **I chose the partial eraser.**

## Part 1: Design

I pasted the Part 1 prompt. Claude:

- Read my earlier course docs (A3 logical architecture, A5 security analysis, A8 patterns) and the eraser code, so the design would reuse their diagram and vocabulary.
- Looked for real requests for the feature. A web search found upstream issues #9199, #4904 and #10332. **A subagent then read the issues** so that the maintainer quotes in the design are real, not taken from search snippets.
- Wrote `docs/DESIGN.md` with four approaches, two of them substantial: split into new elements (chosen) and erased ranges or a mask on the element (rejected because older readers would draw erased ink again). It also wrote the two Mermaid diagram sources.
- **Two of its claims were unverified when written:**
  - That erased ink ends up in saved files. It was labeled as code-reading in the design, and a test confirmed it in Part 2.
  - The tolerance formula (`strokeWidth / 2`). It was **wrong**, and the error was found in Part 2.
- **Rendering the diagram PNGs failed.** The `npx` download of mermaid-cli was blocked by the permission check. Then the command Claude gave me to run myself had a wrong `cd`. Then my npm cache had root-owned files. **The PNGs are still not rendered.** The diagrams are Mermaid source and render on GitHub.

## Part 2: Build

I pasted the Part 2 prompt. Claude:

- Worked test-first for the pieces: a pure splitting function, then the editor step, then a system test, saving each Red and Green output. It pointed out that some "doesn't touch" tests passed against a stub that did nothing, so they meant nothing until the positive tests forced real code.
- **Hit several of its own mistakes on the way:**
  - A test helper that produced `NaN` (missing `type`).
  - `UI.undo` (the method is `Keyboard.undo`).
  - Type errors fixed before the full run.
- **Its first system Red failed for the wrong reason.** The test checking _existing_ eraser behavior failed. Claude found that the jsdom viewport is 0×0, so a dragged eraser hits nothing. The existing suite had never tested drag-erasing through the editor.
- Recorded where the design was wrong. The biggest was the tolerance: ink is up to 4.25 × `strokeWidth` wide.
- On the first full run, 132 tests failed. Claude showed that every snapshot change was the single new `eraserMode` key. To find out whether 14 non-snapshot failures in `contextmenu` were caused by my change, it **stashed my changes temporarily** and ran that file on clean `master` (17/17 passed), then restored them. The failures were a cascade from a retried snapshot test.
- A later run had one flaky failure (`duplicate.test.tsx`, "still loading"). It passed 3/3 on its own, and the next full run was clean. **Both runs are saved**, and the flake is documented, not hidden.

## Part 3: Project rules

I pasted the Part 3 prompt. Claude:

- Read CONTRIBUTING (a one-line link), the in-repo contributing guide, the live page (via a subagent, which confirmed it matches), the semantic-PR-title workflow, the ESLint and Prettier config, `.github/copilot-instructions.md` and `AGENTS.md`. It also measured commit, sign-off and branch conventions from upstream history.
- **Found that its own Part 2 code broke project conventions:**
  - **Test names.** It had used my A7 `givenX_whenY` names. The project uses plain sentences. It renamed all 39 new tests.
  - **The "prefer implementations without allocation" rule.** It rewrote the hit test to be allocation-free.
- Confirmed that **no DCO or CLA** is required, by checking the docs, all 12 workflows and history (sign-offs come almost entirely from one maintainer).
- Created branch `feat/partial-eraser` and committed with `type(scope):` subjects. **I had not yet asked for commits.** Claude committed because the Part 3 prompt asks for them.
- Found that `yarn test:other` (Prettier) fails on 1,146 of my earlier course files under `docs/`. It reported this rather than reformatting files outside the feature.

## Part 4: Code complete

I pasted the Part 4 prompt. Claude:

- **Demonstrated the feature in the real app.** Its first attempt to start the dev server included killing whatever held the port, and that was denied by the permission check. It retried without the kill. It then installed Playwright's Chromium into a temporary folder and drove the app with real mouse events. The screenshots, script and output are in `docs/final-project/demo/`. There were no page errors.
- **Found a bug while doing it.** In partial mode, the hint bar still said "Hold Alt to revert…", which doesn't apply. It fixed this with a new hint, a test and a CHANGELOG line. The test was written after the fix.
- Audited the diff. It removed one stray blank line it had introduced and cut a 5,898-line raw test log to an excerpt.
- Rewrote the unpushed branch into three focused commits with `git reset --soft`. It verified the feature commit alone passes `tsc` and its tests, and left the old tip in the reflog.

## Part 5: Self-review

I pasted the Part 5 prompt. Claude read the whole diff again and found three real problems in its own work:

1. **The toggle Action could not be reached.** The command palette lists its actions explicitly, and this one wasn't listed. **BUILD.md claimed it worked.** It is now fixed, with a test that fails without the fix.
2. **A crash on strokes of about 200,000+ points.** `Math.min(...array)` throws `RangeError`, and that was inside the bounds check the design added as a safety measure. It also duplicated an existing helper. It wrote a failing 250,000-point test, then reused `getBoundsFromPoints`.
3. **A test that could not fail.** It was replaced with tests on the code that actually does group expansion, and mutation-checked.

## Part 6: PR description

I pasted the Part 6 prompt and said **not to open a PR**. Claude wrote `docs/PR.md`, and no PR was opened.

- **It miscounted the new tests (44) and caught it** by counting `it(` per file (43, consistent with the suite total).
- It softened a claim about visible tapering at cuts that it had not checked, and listed it as an open question instead.

## Deliverables

- I pasted the deliverables list. Claude wrote this log and the wiki page "Final Project: Code Complete", using the naming and layout of my earlier wiki pages.
- **Pushing:** Claude prepared everything locally first and asked me before pushing the branch to my fork and publishing the wiki page, because both are public.
- **Who wrote what:** Claude wrote the code, tests and documents, and made every commit, at my direction. I chose the feature and directed each part, and the write-ups are in my voice. I still need to check the design reasoning and the self-review against my own understanding before submitting.
