# AI Use Log — Assignment 3 (Requirements and Use Cases)

**Tool:** Claude Code (model: Sonnet 5, `claude-sonnet-5`)
**Session:** https://claude.ai/code/session_01AkRv6hbZowKptvXwM8gruc
**Date:** 2026-09-17
**Repository:** github.com/mendozaa0130/excalidraw (fork)

This log records, in the order it happened, what Claude Code did versus what I (the
student) wrote myself, for transparency.

## Requirements (FURPS+)

I gave Claude the assignment's FURPS+ prompt (at least one requirement per category,
each with cited evidence from the codebase). Claude:

- Searched the actual codebase for evidence rather than inventing requirements —
  grepped for i18n/locale files, accessibility (`aria-label`) usage, the error
  boundary and its Sentry integration, `localStorage` persistence, `throttleRAF`
  usage in the renderer, the element type union, the collaboration stack
  (`socket.io-client`, Firebase), the AES-GCM encryption module, and the root
  `LICENSE` file.
- Chose the ten specific requirements (two per FURPS+ category) and wrote each
  one's evidence citation (file path, line numbers, and what the code/config
  actually does). I did not specify these requirements or their evidence; that
  reasoning is Claude's, produced by reading the code.
- I reviewed the requirements and evidence and approved them as accurate to my
  fork.

## Actors, brief use cases, and fully-dressed use cases

I gave Claude the assignment's Part 2–4 prompts. Claude:

- Chose the three actors (Drawer as primary, the collaboration WebSocket/Firestore
  backend as supporting, an Excalidraw maintainer reviewing Sentry crash reports as
  offstage) and justified each from code it found (`Collab.tsx`/`Portal.tsx` for
  the backend, `TopErrorBoundary.tsx`'s Sentry reporting for the offstage actor).
- Chose to make the three brief use cases and the three fully-dressed use cases
  the same set (Draw a Diagram, Collaborate in Real Time, Export a Drawing) rather
  than writing six different use cases, since the assignment allows the
  fully-dressed ones to expand the brief ones.
- Drafted the main success scenarios and extensions, then re-checked every step
  against the running code before finalizing — for example, it initially wrote a
  vague "connection drops mid-session, reconnect" extension for the collaboration
  use case, then found and read the actual fallback logic in `Collab.tsx`
  (`fallbackInitializationHandler`, the `first-in-room` socket event, and the
  5-second `INITIAL_SCENE_UPDATE_TIMEOUT`) and rewrote the extension to match what
  the code does instead of what sounded plausible. It also verified the text-entry
  commit keys (`Escape` / `Ctrl+Enter`) in `wysiwyg/textWysiwyg.tsx` and the
  export-dialog error path (`CANVAS_POSSIBLY_TOO_BIG` → `setRenderError`) in
  `ImageExportDialog.tsx` before citing them, rather than assuming they existed.
- I reviewed the use cases against this description of the code and approved them.

## Use case diagram

I asked Claude to produce a PlantUML diagram per the assignment's tooling
recommendation. Claude:

- Wrote `docs/use-case-diagram.puml` (system boundary, the three actors, the three
  use cases, and dashed "notifies" associations from each use case to the offstage
  Maintainer actor).
- Downloaded a PlantUML `.jar` release from PlantUML's GitHub releases and rendered
  the diagram to PNG locally with Java, rather than sending the diagram to a
  third-party web rendering service. The first render failed because Graphviz's
  `dot` binary wasn't installed; Claude added `!pragma layout smetana` to use
  PlantUML's built-in pure-Java layout engine instead, which rendered
  `docs/use-case-diagram.png` successfully.

## Assembly and repo mechanics

Claude wrote `docs/requirements-and-use-cases.md` (the page content for Parts 1-5)
and this log itself, and committed `docs/requirements-and-use-cases.md`,
`docs/use-case-diagram.puml`, `docs/use-case-diagram.png`, and this log to the repo
at my direction under the commit message the assignment specifies. Pushing the
wiki page itself and submitting the OAKS link remain for me to do.
