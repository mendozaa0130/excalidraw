# Part 3: Working to Excalidraw's Rules

This page lists the conventions Excalidraw ships, what each one made me change, and where I would have chosen differently.

## What the project ships, and what it doesn't

| Looked for | Found | Where |
| --- | --- | --- |
| `CONTRIBUTING.md` | One line that points to the docs site | `CONTRIBUTING.md` |
| Contributing guide | Yes, in the repo and live | `dev-docs/docs/introduction/contributing.mdx`. `docs.excalidraw.com/docs/introduction/contributing` now returns a 308 redirect to `plus.excalidraw.com/docs/sdk/contributing`. The live page matches the repo copy on everything below. |
| Pull request template | **None.** There is no `.github/PULL_REQUEST_TEMPLATE*` and no `docs/pull_request_template.md`. The contributing guide does not ask for a description format either. | (absent) |
| PR title check | Yes, enforced in CI | `.github/workflows/semantic-pr-title.yml` |
| Style guide | Coding standards for AI assistants, plus two rules for agents | `.github/copilot-instructions.md`, `AGENTS.md` |
| Formatter and linter | Prettier (`@excalidraw/prettier-config`) and ESLint (`@excalidraw/eslint-config` + `react-app` + repo overrides) | `package.json`, `.eslintrc.json`, `.lintstagedrc.js`, `.editorconfig` |
| CI gates | `yarn test:other`, `yarn test:code`, `yarn test:typecheck`, plus the test suite | `.github/workflows/lint.yml`, `test.yml` |
| DCO / sign-off | **Not required** (see below) | (absent) |
| CLA | **Not required** (see below) | (absent) |
| Branch naming | No rule. The convention can only be inferred from existing branches. | contributing guide and `git branch -r` |

## The rules that constrained me

### Commit and PR titles: semantic prefix _and_ a required scope

The contributing guide says:

> "Make sure the title starts with a semantic prefix: **feat**: A new feature, **fix**: A bug fix, **docs**: Documentation only changes, … **test**: Adding missing tests or correcting existing tests …"

The CI workflow is stricter than the guide. It **requires a scope** and limits which scopes are allowed:

```yaml
# .github/workflows/semantic-pr-title.yml
requireScope: true
scopes: |
  app
  editor
  packages/excalidraw
  packages/utils
  docker
  repo
```

**What this changed:**

- **The scope.** My change touches both `packages/element` and `packages/excalidraw`, and neither `element` nor `eraser` is an allowed scope. The last 300 upstream subjects show how maintainers use the list: `fix(editor)` 81 times and `feat(editor)` 62 times, with `editor` covering everything under `packages/` that changes editor behavior. `feat(packages/excalidraw)` (20 times) is used for changes to the npm package's API surface. My feature is both, so I picked `editor`, because it is the user-facing behavior. The `AppState.eraserMode` API change is described in the body and in `CHANGELOG.md`.
- **The documentation commits** use `docs(repo)`, which upstream uses for repository-level docs.
- **Subject style:** all lowercase, imperative, no trailing period. None of the last 400 upstream subjects end in a period. The median subject is 60 characters long.
- **No `(#1234)` suffix.** Upstream subjects end in `(#PR)` because GitHub's squash-merge appends it. There is no PR yet, so adding one by hand would make up a number.

### Testing expectations

> "It's also a good idea to consider if your change should include additional tests. This is highly recommended for new features or bug-fixes."
>
> "Finally - always manually test your changes using the convenient staging environment deployed for each pull request. … For larger features consider testing your change in multiple browsers as well."

The feature has 39 new tests (see [BUILD.md](BUILD.md)). The staging environment only exists for PRs to `excalidraw/excalidraw`, so it does not apply to work in this fork. Manual testing in a browser was still open at the end of Part 3. It was done in Part 4 against the dev server ([CODE-COMPLETE.md](CODE-COMPLETE.md)).

### "For major changes, please open an issue first"

> "Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change."

Issues [#4904](https://github.com/excalidraw/excalidraw/issues/4904) and [#9199](https://github.com/excalidraw/excalidraw/issues/9199) already exist. #4904 was opened by a maintainer and is labeled `discussion` with "consensus not reached". To follow this rule for an upstream PR, I would comment on #9199 with the design summary (mode vs. modifier, freedraw only, tiny-fragment dropping). That comment answers the open questions a contributor raised there, and a maintainer would need to agree before I opened a PR. **I have not posted it.** Posting on the upstream tracker is a public action and is outside this assignment.

### Coding standards: `.github/copilot-instructions.md`

These are written for AI assistants. Because this code was written with Claude Code, they apply directly.

> "Where possible, prefer implementations without allocation" "When there is an option, opt for more performant solutions and trade RAM usage for less CPU cycles"

**This changed my code.** The Part 2 version of `splitFreedrawByPath` allocated a new point array for every sample it tested, and `distanceToLineSegment` allocated more inside each test. Every sample of every touched stroke created garbage on the pointer-up path. In Part 3 the hit test was rewritten to use a `Float64Array` of eraser segments and a scalar `pointSegmentDistanceSq`, so it no longer allocates. Points are now created only for cut boundaries, which become part of the output. The bounds early-exit added in Part 2 already followed the CPU-over-RAM rule. All 15 unit tests pass unchanged, which is what showed the rewrite kept the behavior the same.

> "Use ALL_CAPS for constants" → `BOUNDARY_ITERATIONS`, `MIN_FRAGMENT_LENGTH` "Use PascalCase for … type aliases" → `FreedrawFragment` "always use the Point type instead of { x, y}" → the new APIs take `GlobalPoint[]` and return `LocalPoint[]`. The one `{ x, y }` in my code is `App.handleEraser`'s existing `scenePointer` parameter, which I did not touch.

> "Always log errors with contextual information"

**Not applicable.** The new code has no error paths. A miss returns `null`, and invalid input is normalized in `restoreAppState`. I did not add logging, because the surrounding eraser code doesn't log either.

`AGENTS.md`'s two rules (use `app.ownerDocument`/`app.ownerWindow`, and `Merge<>` over `Omit & …`) don't apply. The feature uses no DOM globals and doesn't override any types.

### Formatter, linter and import order

`.eslintrc.json` enforces an import order: external, then `@excalidraw/**`, then parent, sibling, and type imports last, with blank lines between groups (`"newlines-between": "always-and-inside-groups"`). Separate `import type` statements are also required (`consistent-type-imports` with `fixStyle: "separate-type-imports"`). I ran the project's own commands:

```
yarn test:code        → eslint --max-warnings=0 --ext .js,.ts,.tsx .        exit 0
yarn test:typecheck   → tsc                                                exit 0
yarn test:other       → prettier --list-different "**/*.{css,scss,json,md,html,yml}"
```

**What the linter changed:** 20 warnings on my files, all fixed by `eslint --fix` / `prettier --write` (the project's `yarn fix`). They were prettier line-wrapping and the import groups in `Tools.tsx` and `partialEraser.test.tsx`.

**`test:other` does not pass on this fork, and none of the failing files are mine.** It lists 1,146 files, all under `docs/`: the earlier course write-ups and the generated `docs/coverage-*` HTML reports, which were committed before this feature. Upstream has no `docs/` folder, so a PR to upstream would contain none of them. All files I added or changed, including `docs/DESIGN.md` (reformatted by Prettier with whitespace and `*`→`_` changes only), pass `prettier --list-different`.

**Pre-commit hook:** `.husky/pre-commit` exists, but its only command, `# yarn lint-staged`, is commented out. Nothing runs on commit, so the checks above had to be run by hand.

### Matching code style beyond the linter

- **Test names.** In Part 2 I used the `givenX_whenY_thenZ` names from my A7 work. The project does not use them. Across `packages/excalidraw/tests` and `packages/element/tests`, test names are plain sentences: 478 start with `it("should …`, and most of the rest start with a verb (`keeps …`, `does …`, `flips …`). The only `given…` tests in the repo are mine. **I renamed all 39 new tests** (for example, `givenRotatedStroke_whenSplit_survivingInkStaysWhereItWasDrawn` became `"keeps the ink of a rotated stroke where it was drawn"`). In `restore.test.ts` the new tests use `should …`, matching the existing tests in that file. _I would have chosen differently_: given/when/then names state the precondition, the action and the expected result, which makes a failure easier to read. The project's style wins. I did **not** rename the A7 characterization tests in `eraser.test.ts`, since they are already committed under that assignment.
- **File layout.**
  - Domain tests live in `packages/element/tests/`, so `freedrawSplit.test.ts` goes there.
  - Editor unit tests sit next to their module, as `eraser/eraser.test.ts` already did, so `partialErase.test.ts` goes in `eraser/`.
  - Tests that drive the whole editor live in `packages/excalidraw/tests/`, which is where `partialEraser.test.tsx` goes.
  - The new Action follows `actionToggle*.ts(x)` naming in `actions/`, is registered with `register()`, and is exported from `actions/index.ts`. Its name is added to the `ActionName` union.
- **Comment conventions.** The codebase marks performance shortcuts with `// PERF:` (e.g. `eraserTest`'s bounds check) and caveats with `// NOTE:`. The new bounds check uses `// PERF:`.
- **AppState fields** follow the existing pattern exactly. Each one has a JSDoc on the type, a default in `getDefaultAppState`, and an entry in `APP_STATE_STORAGE_CONF`. `preferredSelectionTool` is the closest example.
- **CHANGELOG.** `packages/excalidraw/CHANGELOG.md` says: _"The change should be grouped under one of the below section and must contain PR link."_ The entry is under `## Unreleased`, using the heading-per-change format of recent entries. Instead of a PR link (none exists yet), it links the two upstream issues and says it comes from the fork. **This breaks the rule** until a PR exists. The fix is to replace the issue links with the PR link when the PR is opened.

## DCO and CLA

**Neither is required.**

- **The documentation doesn't ask for one.** The contributing guide (repo copy and live page) does not mention a Developer Certificate of Origin, a `Signed-off-by` line or a contributor license agreement.
- **No workflow checks for one.** None of the 12 workflows in `.github/workflows/` checks for a DCO or CLA. There is no DCO app config and no CLA bot config.
- **History confirms it.** 426 of the last 1,000 upstream commits carry `Signed-off-by`, but 421 of those come from one maintainer and 5 from dependabot. The share varies from 37% to 3% depending on the period, which is what a personal habit looks like, not an enforced rule.
- **The license** is MIT (`LICENSE`), with no CLA language.

My commits therefore carry no sign-off. They do carry a `Co-Authored-By:` trailer for Claude. That is a common trailer upstream (361 of the last 1,000 commits, written as `Co-authored-by` or `Co-Authored-By`), and it is accurate.

## Branch

The guide only says _"Create a branch for your PR with `git checkout -b your-branch-name`"_ and does not name a pattern. Upstream branches use two patterns:

- `<handle>/<topic>` for maintainers (`dwelle/arrowhead-hitbox`, 58 `dwelle/*` branches)
- `<type>/<topic>` or `<type>-<topic>` for features and fixes (`feat/freedraw-ovoids`, `feat/save-warning`, `fix-frame-clipping`)

I used **`feat/partial-eraser`**: the same `feat` type as the commit prefix, and a topic matching `feat/freedraw-ovoids`, the closest existing feature branch. All three commits are on this branch, off `master`. `master` was not committed to.

## Commits on `feat/partial-eraser`

| # | Subject | Contents |
| --- | --- | --- |
| 1 | `docs(repo): add design note for the partial eraser` | `docs/DESIGN.md` and the two Mermaid sources, as written before the code (Prettier-formatted) |
| 2 | `feat(editor): add a partial eraser mode that cuts freedraw strokes` | Source, tests, the 3 updated snapshot files, locale strings, CHANGELOG |
| 3 | `docs(repo): record the partial eraser build, project rules, demo and review` | `docs/final-project/` (Parts 2–4 write-ups, test output, demo) |

The design was committed _after_ it was written, because the user had not yet asked for commits. Its content is the pre-build version, apart from Prettier formatting. The design changes found during the build are recorded in BUILD.md ("Where the design was wrong"), not edited back into DESIGN.md.
