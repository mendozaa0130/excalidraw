# A7: Testing Excalidraw — Write-Up

Details: [coverage baseline](coverage-baseline.md) · [what the code told me](a7-what-the-code-told-me.md) · [red-green-refactor](a7-tdd/README.md)

## What did testing this code tell me about how the project is built?

Excalidraw is built around one very large `App` class (11,501 lines), and much of the editor's logic takes a reference to all of it. The eraser needs 5 of `App`'s members and the snapping code reads only `app.state` and one prop, yet both demand the whole object. To test them without mounting the editor I had to hand-build stand-ins and cast them with `as unknown as App`. The code that was easy to test, `encryption.ts`, was easy because it takes plain arguments and returns plain results. It went from 34% to 100% coverage with 21 tests, while the eraser needed a fake app, an animation loop shut down after every test, and its real logic sat in a private function.

The suite looks strong (2,700+ tests, 78% line coverage), but much of it mounts the whole editor and asserts through large snapshots. As a result, code like the renderer is "covered" without anything checking its output. The coverage number describes how much code _runs_, not how much is _checked_.

## What was the defect, how did I find it, and what was the smallest fix?

Upstream issue [#11945](https://github.com/excalidraw/excalidraw/issues/11945): the eraser cannot delete some freehand strokes. I downloaded the drawing linked in the issue and decrypted it with the project's own decoder. Running the real eraser against each stroke showed that the two failing strokes are 3-point, constant-width strokes at the thinnest width (0.25). For those, the outline generator returns **no points**, and the eraser passes that empty outline to a helper whose `invariant` throws. The exception aborts the whole eraser pass on every pointer move.

The smallest fix (one `if` in `eraser/index.ts`): when the outline has fewer than 2 points, measure distance to the stroke's own points with the tolerance the eraser already uses. The Red test failed with the issue's exact error. After the fix, the whole suite passed (2,738 tests), and all 7 strokes in the issue's drawing erase. Two upstream PRs are open; one of them stops the crash but still leaves these strokes un-erasable.

## Where did the AI assistant help, and where did it mislead me?

**Helped:**

- Decrypting the issue's drawing and probing each stroke led straight to the exception. The upstream thread had not found it in two months.
- Mutation checks: it broke the production code on purpose (non-random IVs, erasing locked elements, `<=` changed to `<`) to prove the new tests fail when behavior changes.
- It noticed that the default coverage command counted `node_modules`, which was 64% of the measured lines.

**Misled, or would have:**

- **A Red test that passed.** Its first reproduction test built the stroke with default stroke options. It passed immediately, so it had not reproduced the bug. It only failed once the stroke options were copied exactly from the issue's data. Taken at face value, it would have "confirmed" there was no bug.
- **Tests of what the code _should_ do.** Four of its first characterization expectations were wrong. For example, it assumed `round()` rounds to whole numbers (it rounds to 6 decimals), that ending a swipe on a stroke erases it, and that arrow reach grows when zoomed out. Characterization tests must be corrected to the code's actual behavior, not the assistant's guess.
- **Throwaway tests that assert nothing.** To explore, it wrote "probe" tests that only `console.log` results. They pass no matter what and would raise coverage. They were deleted, but they are the `divide(10, 2)` example from the assignment.
- **Overconfident claims.** Its first Part 4 draft said an upstream commenter "had already found the same root cause". Reading the comment showed the opposite: they could not reproduce it. Its script for finding tests without assertions also flagged `flip.test.tsx`, whose assertions live in helper functions.

## Which component would I least like to change without tests?

**`excalidraw-app/collab/` and the share-link code around it.** It is the least tested area (`Collab.tsx` 49% lines, `excalidraw-app/` 46% overall). It depends on the network, Firebase and WebSockets, which makes it the hardest to test. And it is where a mistake costs the most: it handles the encryption keys in room and share links, so a silent regression could send a drawing unencrypted or to the wrong room, and no test would notice. `App.tsx` is bigger, but its many integration tests would at least catch a crash.
