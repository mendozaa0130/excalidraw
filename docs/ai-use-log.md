# AI Use Log — Assignment 2 (Build Demo and Applied Analysis)

**Tool:** Claude Code (model: Sonnet 5, `claude-sonnet-5`)
**Session:** https://claude.ai/code/session_01GQbMEQyoNgEC1ebg8KSEkA
**Date:** 2026-09-13
**Repository:** github.com/mendozaa0130/excalidraw (fork)

This log records, in the order it happened, what Claude Code did versus what I (the
student) wrote myself, for transparency.

## Domain model

I gave Claude the assignment's requirements for a conceptual domain model (five-plus
classes drawn from the problem domain, associations with multiplicities and role
names, attributes only, no methods/visibility/types). Claude:

- Asked me to choose a diagram source format (I picked Mermaid) and where the
  rendered page should live (my GitHub wiki).
- Designed the domain model itself — it chose the seven classes (`Drawing`,
  `Element`, `Group`, `Frame`, `Collaborator`, `CollaborationSession`, `Library`),
  their attributes, and the associations/multiplicities/role names between them. I
  did not specify these classes; Claude proposed them based on Excalidraw's product
  domain.
- Installed `@mermaid-js/mermaid-cli` and rendered the `.mmd` source to a PNG.
- Committed `docs/domain-model.mmd` and `docs/domain-model.png` to the repo.
- Drafted the `Domain-Model` wiki page (class table, association list, embedded
  image, embedded Mermaid source) and pushed it to my wiki after I confirmed it
  should go live.

## Representational gap

I gave Claude the assignment's Part 4 prompt (trace three domain concepts into the
code, name the match quality, explain the cost of the worst one). Claude:

- Searched the actual codebase (`packages/element/src/types.ts`, `Scene.ts`,
  `groups.ts`, `frame.ts`, `packages/excalidraw/types.ts`,
  `excalidraw-app/collab/Collab.tsx`, `Portal.tsx`,
  `excalidraw-app/data/localStorage.ts`, `packages/excalidraw/components/App.tsx`)
  to find where `Element`, `Collaborator`, and `Drawing` are — or aren't —
  represented.
- Chose the three concepts, wrote the comparison table, and wrote the analysis of
  why `Drawing` is a poor match and what that costs the project. This reasoning is
  Claude's, produced by reading the code, not mine.
- I reviewed it and approved posting it to the wiki as-is.

## Build Notes and Part 2: Analysis and Design

These sections were written entirely by me, not Claude — I pasted my own finished
text for both into the conversation. Claude's role was limited to assembling this
text into the final wiki page in the order the assignment specifies (Build Notes →
analysis/design discussion → domain model → representational gap → the two
iteration paragraphs); it did not originate, edit, or rewrite any of this content.

## Assembly and repo mechanics

Claude handled the git/GitHub mechanics at my direction: creating and pushing the
wiki pages, committing files to `/docs`, and amending the earlier domain-model
commit into one commit titled `A2: Add build notes and applied analysis` (which
required a force-push to my fork, since that commit had already been pushed
publicly) so the domain model source and this log land together under the commit
message the assignment specifies. It also wrote this log itself, from its own
record of the session.
