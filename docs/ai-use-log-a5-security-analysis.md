# AI Use Log — Assignment A5 (Security Analysis)

**Tool:** Claude Code (model: Opus 5.5, `claude-opus-5-5`)
**Dates:** 2026-11-02 to 2026-11-03
**Repository:** github.com/mendozaa0130/excalidraw (fork)

This log records, in the order it happened, what Claude Code did versus what I (the
student) did, for transparency. It covers Parts 1–4. Parts 5–8 are not done yet.

**Testing limits:** the assignment says not to attack the project's public instance or
anyone's deployment. Claude made no requests to Excalidraw's servers, Firebase or Sentry.
Its only test ran offline on this machine. Its only network requests were to GitHub (my
fork, my wiki and a PlantUML download), plus an OWASP search.

## Part 1: Misuse case diagram

I pasted the Part 1 prompt. Claude:

- Read my use case diagram (`docs/use-case-diagram.puml`) and the collaboration,
  storage, export and link-handling code.
- Pointed out that Excalidraw has no logins or roles, so the prompt's examples (Steal
  Session, Escalate Privileges) do not fit. It used the room link as the equivalent
  credential and chose five misuse cases: Steal Room Link, Read Another User's Drawing,
  Overwrite a Stored Scene, Plant Malicious Link in a Scene, and Recover Source Scene from
  Exported Image. It also chose two attackers, an External Attacker and a Malicious
  Collaborator, and five controls with file and line references.
- Found from reading `firebase-project/firestore.rules` that anyone who knows a room ID
  can overwrite a stored scene. It labelled this a known gap and said it was not tested
  against a live backend.
- Could not render the diagram at first because the permission check blocked a
  downloaded PlantUML jar. **I installed PlantUML with Homebrew** instead.
- Proposed committing to a new branch. **I told it to commit to `master`.** It ran the
  test suite through `vitest`, because `yarn` is not installed: all 143 test files passed.
  It then committed, pushed and created the wiki page.

## Part 2: Two fully-dressed misuse cases

I pasted the Part 2 prompt. Claude:

- Followed the fully-dressed format from my Requirements and Use Cases page and chose
  **Steal Room Link** and **Overwrite a Stored Scene**. It checked every step against the
  code, including the join flow, `saveToFirebase`, the version check in `reconcile.ts`,
  and the fact that ending a session never deletes the stored scene.
- Suspected that the room key could reach Sentry in a navigation breadcrumb, which
  `beforeSend` does not scrub. It tested this offline with the installed Sentry SDK,
  the app's scrub logic copied in, and an in-memory transport.
  - **Its first test was a false negative.** History tracking was not running in the
    test environment, so no breadcrumb was recorded at all. Claude noticed this, added
    a positive control and reran it. The second run showed the key in the breadcrumb.
  - Claude corrected the Part 1 table, which had described the Sentry scrub as more
    complete than it is.
- Warned me that publishing the attack walkthroughs and the Sentry finding on a public
  wiki would disclose an unfixed issue in the real project. **I chose to go ahead.**

## Threat Modeling Lab (feeds Parts 3 and 4)

I pasted the lab instructions and then the tool's screens. Claude cannot use the tool
because it runs in my browser. Claude:

- Suggested the system description, four assets, five entry points, and nine threats,
  each with ratings and a mitigation. It checked the code for each one, including the
  CI workflow triggers and whether a Content Security Policy is set.
- Explained why the other STRIDE questions do not apply, for example why Tampering,
  Repudiation, Denial of Service and Elevation of Privilege do not apply to the room key.

**I entered everything into the tool and exported the report myself.** My export has
three assets and seven threats, not the four and nine Claude suggested. The top three
risks are the same.

## Part 3: Trust boundary diagram

I pasted the Part 3 prompt. Claude:

- Checked the validation at every crossing in the code: link parsing, decryption and
  `restoreElements`, the Firestore and Storage rules, file, paste and SVG handling, the
  `#json=`, `#url=` and `#addLibrary=` imports, the AI backend and its sandboxed
  iframe, embeds, Sentry, and the GitHub Actions workflows.
- Drew the diagram in PlantUML with 8 boundaries and 15 numbered crossings, numbering
  them so that 1–5 match the threat model's entry points. It removed one crossing
  (localStorage) after noticing that it does not actually cross a boundary.
- Found two problems that were not in the threat model:
  - a `#url=` link loads a scene from any host, with no allowlist;
  - the release job installs an unpinned `@actions/core` after `NPM_TOKEN` is already
    in the npm config.
- Chose **decryption treated as proof of authorship** as the misplaced trust.
- Committed, pushed and updated the wiki, together with Part 2. It did not run the test
  suite because only files in `docs/` changed.

## Part 4: Threat model

I pasted the Part 4 prompt. Claude:

- Used the top three risks from the tool's report so that Part 4 and the report agree.
  It checked the OWASP Top 10:2025 numbering on owasp.org and also gave the 2021 numbers.
- Wrote each mitigation to say which file or layer owns the control and why that place
  is right. For example, write authorization belongs in the Firestore rules because every
  write goes through them, while authorship checks belong in `excalidraw-app` rather than
  the shared `reconcile.ts` library.
- **Confused the lab with the assignment.** It told me Part 4 needed the tool's PDF, then
  mistook an unrelated OWASP page I had saved for the report. **I told it that this was
  not what Part 4 asks for.** Claude then read the assignment and lab documents and found
  that the PDF is a lab step, not Part 4 itself. It also found three things it had missed:
  - the wiki page has to be named "Security Analysis";
  - the documentation commit has to be titled "A5: Add security analysis and misuse
    cases";
  - this log is required, which it had earlier called optional.

## Repo mechanics

- **I asked Claude to fix those three.** It renamed `docs/misuse-cases.md` to
  `docs/security-analysis.md` and renamed the wiki page to Security Analysis. It wrote this
  log from its record of both sessions and committed both with the required title.
- **Earlier commits do not use the required title.** The commits for Parts 1–4
  (`0ae64cc5b`, `0cae4a76c` and `80c29d9d7`) were already pushed to `master` under other
  titles. Rewriting them would mean force-pushing over pushed history, so they were left
  as they are.
- **Who wrote what:** Claude made all commits, pushed to my fork and published the wiki at
  my direction. The write-up is in my voice, but Claude drafted it.
