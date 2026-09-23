# AI Use Log — Assignment A2b (SSDs and Operation Contracts)

**Tool:** Claude Code (model: Sonnet 5, `claude-sonnet-5`)
**Date:** 2026-09-23
**Repository:** github.com/mendozaa0130/excalidraw (fork)

This log records, in the order it happened, what Claude Code did versus what I (the
student) wrote myself, for transparency.

## Part 1: Noun phrase analysis and domain model update

I gave Claude the assignment's Part 1 prompt (list noun phrases from the three
fully-dressed use cases, classify each as a conceptual class/attribute/neither, then
update the domain model so every conceptual class appears). Claude:

- Pulled every noun phrase from the Preconditions, Success Guarantee, Main Success
  Scenario, and Extensions of all three fully-dressed use cases (Draw a Diagram,
  Collaborate in Real Time, Export a Drawing), deliberately leaving out the
  Stakeholders/Interests text since that describes goals, not domain state.
- Classified each phrase and wrote the reasoning column, applying Larman's
  number/text rule of thumb (e.g. ruling out the undo history stack, the WebSocket
  connection, and the collaboration link as implementation/UI mechanisms rather than
  domain classes).
- Proposed one new conceptual class the existing model was missing — **Export**
  (for "the resulting PNG or SVG file") — with its attributes and two associations,
  plus two attributes missing from existing classes (`Element.size`,
  `CollaborationSession.encryptionKey`). I did not specify these; Claude derived them
  from the use case text.
- Drafted the "What Changed and Why" paragraph explaining the addition. I rewrote
  this paragraph myself afterward in my own words before Claude added Parts 2–3, so
  the version in the final page is mine, not Claude's original draft.

## Part 2: System sequence diagrams

I gave Claude the assignment's Part 2 prompt (one SSD per fully-dressed use case,
system as a single black box, events named as system operations with parameters,
loop boxes for repeated steps). Claude:

- Designed all three SSDs as Mermaid `sequenceDiagram` sources, choosing the
  operation names and parameters itself (`selectTool`, `startElement`,
  `resizeElement`, `commitElement`; `startCollaboration`, `joinCollaboration`,
  `updateElement`; `openExportDialog`, `setExportOptions`, `exportDrawing`) and
  mapping each one back to specific MSS steps in the write-up.
- Chose to show the Collaborate in Real Time use case with two Drawer actor
  instances (host and joiner) rather than a second actor type, since the use case's
  primary actor plays both roles at different points.
- Installed `@mermaid-js/mermaid-cli` via `npx` to render each `.mmd` source to a
  PNG, working around a permissions problem in the local npm cache (a stale,
  root-owned cache entry blocking writes) by pointing `npm_config_cache` at a scratch
  directory instead of modifying the system cache.

## Part 3: Operation contracts

I gave Claude the assignment's Part 3 prompt (one contract per SSD, for an event
that changes something, in the four-section format with postconditions restricted
to instance-created/deleted, attribute-set, and association-formed/broken). Claude:

- Wrote three contracts: `commitElement(...)` for Draw a Diagram,
  `startCollaboration(drawingId)` for Collaborate in Real Time, and
  `exportDrawing(format)` for Export a Drawing.
- Initially wrote the Draw a Diagram SSD and contract so the Element instance was
  created at `startElement(category, x, y)`, reasoning that its parameters lined up
  most directly with the "creates a new element" language in the use case. I asked
  Claude to move creation to `commitElement` instead, on the reasoning that the
  dragged shape is only a draft until the pointer is released. Claude then revised
  both the SSD (adding a `draftId` returned by `startElement`, and expanding
  `commitElement` to take the draft's final `category`/`x`/`y`/`width`/`height` and
  return the persisted `elementId`) and the contract to match, so the operation's
  parameters, the diagram, and the postconditions stay consistent with each other.
- Checked every class and attribute named in each contract's postconditions against
  the Part 1 domain model before finalizing, rather than inventing fields the model
  didn't have.

## Assembly and repo mechanics

Claude assembled `docs/ssds-and-operation-contracts.md` (noun phrase table, updated
domain model, three SSDs, three contracts) and wrote this log itself, from its own
record of the session. It committed the `/docs` changes and this log to the repo,
pushed to my fork, and updated the wiki at my direction, under the commit message
the assignment specifies. Submitting the wiki page link on OAKS remains for me to do.
