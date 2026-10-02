# AI Use Log — Assignment A3 (Logical Architecture and Interaction Diagrams)

**Tool:** Claude Code (model: Opus 5.5, `claude-opus-5-5`)
**Date:** 2026-10-01
**Repository:** github.com/mendozaa0130/excalidraw (fork)

This log records, in the order it happened, what Claude Code did versus what I (the
student) wrote myself, for transparency.

## Part 1: Naming the architectural style

I gave Claude the assignment's Part 1 prompt (work out the style from the code itself:
directory names and import direction, then write one paragraph). Claude:

- Listed the top-level and package directories and counted cross-package
  `from "@excalidraw/<pkg>"` imports with `grep`, then checked whether every
  upward import from `packages/element` into `packages/excalidraw` was
  `import type` (all of them are).
- Read the `ActionManager`, `Store` and `History` setup in `App.tsx` to support the
  command-pattern and observer claims.
- Wrote a first paragraph calling the project "layered, event-driven inside the
  editor, and client-server at the app edge."

I then pasted two lecture slides into the session (logical vs. deployment
architecture, and the definition of logical architecture). In response, Claude:

- Pointed out that its own paragraph had mixed a deployment property
  (client-server: browser, WebSocket relay, Firebase) and runtime behavior (events
  firing) into what should be a purely structural description, and rewrote the
  paragraph twice. The final version names only layers, packages and dependency
  direction, and restates the observer and command patterns as dependency facts
  (`history.ts` imports `Store`, but `store.ts` never imports `History`;
  `actions/manager.tsx` depends only on the `Action` interface).

## Part 2: Logical architecture diagram

I gave Claude the Part 2 prompt (draw the layers, real packages, and dependency
arrows; commit the source to `/docs`). Claude:

- Placed `packages/utils` by reading its source rather than its name, and found it
  belongs in two layers: `src/export.ts` wraps the editor, while `src/shape.ts` is
  geometry used by `element`. It also found three real runtime cycles (editor ⇄
  `utils/export`, `element` ⇄ `utils/shape`, `common` ⇄ `math`).
- Noticed that its earlier import counts included test files and recounted using
  non-test code only (for example, editor → element went from 520 to 452). The
  diagram and page use the corrected numbers.
- Before pushing, Claude rebased the commit onto my fork, which had picked up 13
  upstream commits, including a large change to `App.tsx`. Claude noticed this would
  invalidate the page's cited line numbers. It re-checked every count and line
  reference against the updated code and corrected them: the App.tsx line numbers
  shifted by 181, editor → element became 456, and element → editor `import type`
  statements became 38. The handler length (about 1,120 lines), its 30 type checks,
  and the 22 capture calls were unchanged. It also corrected an earlier
  claim of "47 action files", which was the raw size of the `actions/` directory
  including tests and helpers; there are 36 non-test `action*.ts(x)` files.
- Went through several layout attempts. With the upward violation arrows in the same
  diagram, Mermaid's layout engine put the Foundation layer at the top. Reversing
  those edges fixed the layout but, as Claude confirmed by inspecting the SVG
  markers, silently dropped their arrowheads. The ELK layout engine wasn't
  available in the local mermaid-cli. Claude settled on two diagrams: one with
  only the downward layer dependencies (all arrows pointing the same way) and a
  separate "where the layering breaks" diagram for the five violations.
- Rendered the diagrams with `@mermaid-js/mermaid-cli`, installed into a scratch
  directory with a scratch npm cache, because the local `~/.npm` cache had a
  permissions error (the same problem as in A2b).

## Part 3: Interaction diagrams

I gave Claude the Part 3–5 prompt. For the interaction diagrams, Claude:

- Read last week's SSDs and chose to expand `commitElement` from Draw a Diagram.
  It traced the real code path from `App.onPointerUpFromPointerDownHandler` through
  `Scene.mutateElement`, `Store.scheduleCapture`, `componentDidUpdate` →
  `Store.commit`, `StoreSnapshot.maybeClone`, `StoreChange.create`,
  `StoreDelta.calculate`, the `Emitter`, and `History.record`. It mapped each SSD
  parameter to the state it corresponds to in code.
- Chose undo (Ctrl+Z) as the second operation, traced through `ActionManager`, the
  `undo` action from `createUndoAction`, `History.undo`/`perform`,
  `HistoryDelta.applyTo`, and `App.syncActionResult`. In the diagram source, it
  noted that the `undo` participant is an object implementing the `Action`
  interface rather than a class.
- Included the loops and conditionals present in the code (the invisibly-small
  discard, the tool-lock checks, the key-matching loop, the gesture-in-progress
  check, and History's "pop until a visible change" loop).

## Part 4: Architectural concern

Claude chose the domain-layer `Store` depending on the editor's `App` component.
It quoted the import, the constructor, the `this.app.scene` / `this.app.state`
calls, and `new Store(this)` in `App.tsx`. It checked that no test constructs a
`Store` directly and counted that all 22 `render` calls in `history.test.tsx`
render the full `<Excalidraw>` editor, which it used as evidence of the testing cost.

## Part 5: GRASP

Claude chose and wrote up Information Expert (`History`), Polymorphism
(`ActionManager.handleKeyDown` with the `Action` interface), and a High Cohesion
violation (`App.onPointerUpFromPointerDownHandler`, about 1,120 lines with 30
tool/element-type checks). For the violation it also cited the maintainers' own
`TODO` in `store.ts` and the 22 `scheduleCapture`/`scheduleAction` calls in
`App.tsx`. Claude re-checked the line numbers and counts against the code before
committing.

## Assembly and repo mechanics

Claude combined everything into `docs/logical-architecture.md`, the source for the
"Logical Architecture" wiki page. It committed all diagram sources (`.mmd`), their
PNG renders, the page, and this log under the commit message the assignment
specifies, and wrote this log itself from its record of the session. Pushing to my
fork, publishing the wiki page, and submitting the OAKS link were done at my
direction or by me.
