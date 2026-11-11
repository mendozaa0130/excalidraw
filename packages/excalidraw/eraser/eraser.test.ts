/**
 * Characterization tests for packages/excalidraw/eraser/index.ts (EraserTrail)
 *
 * EraserTrail decides which elements the eraser tool deletes while the user
 * drags across the canvas. Only the *last segment* of the eraser path is
 * hit-tested on each addPointToPath() call, and hits are accumulated until
 * the path ends.
 *
 * EraserTrail only reads a handful of App members (visibleElements,
 * state.zoom, state.theme, scene.getNonDeletedElementsMap, ownerWindow), so
 * the tests pass a minimal stand-in instead of mounting the whole editor.
 * No production code was changed.
 *
 * These tests pin down what the code does today, including quirks; they are
 * not a statement of what it ideally should do.
 */
import { arrayToMap } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import { API } from "../tests/helpers/api";

import { EraserTrail } from "./index";

import type App from "../components/App";

const makeApp = (elements: ExcalidrawElement[], zoom = 1) =>
  ({
    visibleElements: elements,
    state: {
      zoom: { value: zoom },
      theme: "light",
      scrollX: 0,
      scrollY: 0,
      offsetLeft: 0,
      offsetTop: 0,
    },
    scene: {
      getNonDeletedElementsMap: () =>
        arrayToMap(elements.filter((el) => !el.isDeleted)),
    },
    ownerWindow: window,
  } as unknown as App);

/** Drags the eraser through the given points and returns the final result. */
const erase = (
  trail: EraserTrail,
  [start, ...rest]: [number, number][],
  restore = false,
) => {
  trail.startPath(start[0], start[1]);
  let result: string[] = [];
  for (const [x, y] of rest) {
    result = trail.addPointToPath(x, y, restore);
  }
  return result;
};

let trail: EraserTrail | null = null;
const createTrail = (elements: ExcalidrawElement[], zoom = 1) => {
  trail = new EraserTrail(makeApp(elements, zoom));
  return trail;
};

afterEach(() => {
  trail?.stop();
  trail = null;
});

// A 100x100 rectangle at the origin with a 2px stroke.
const rect = (props: Parameters<typeof API.createElement>[0] = {}) =>
  API.createElement({
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    strokeWidth: 2,
    backgroundColor: "transparent",
    ...props,
  });

describe("EraserTrail — normal behaviour", () => {
  it("givenPathCrossingRectangleEdge_whenErasing_marksRectangleForErasure", () => {
    const r = rect({ id: "r" });
    const t = createTrail([r]);

    expect(
      erase(t, [
        [-20, 50],
        [20, 50],
      ]),
    ).toEqual(["r"]);
  });

  it("givenTransparentRectangle_whenPathStaysInside_doesNotErase", () => {
    const r = rect({ id: "r", backgroundColor: "transparent" });
    const t = createTrail([r]);

    expect(
      erase(t, [
        [30, 50],
        [70, 50],
      ]),
    ).toEqual([]);
  });

  it("givenFilledRectangle_whenPathStaysInside_erasesIt", () => {
    const r = rect({ id: "r", backgroundColor: "#ffc9c9" });
    const t = createTrail([r]);

    expect(
      erase(t, [
        [30, 50],
        [70, 50],
      ]),
    ).toEqual(["r"]);
  });

  it("givenPathCrossingTwoElements_whenErasing_accumulatesBothInHitOrder", () => {
    const a = rect({ id: "a" });
    const b = rect({ id: "b", x: 200 });
    const t = createTrail([a, b]);

    expect(
      erase(t, [
        [-20, 50],
        [20, 50],
        [180, 50],
        [220, 50],
      ]),
    ).toEqual(["a", "b"]);
  });

  it("givenGroupedElements_whenOneIsHit_marksEveryElementOfThatGroup", () => {
    const a = rect({ id: "a", groupIds: ["g1"] });
    const b = rect({ id: "b", x: 500, groupIds: ["g1"] });
    const c = rect({ id: "c", x: 1000 });
    const t = createTrail([a, b, c]);

    const result = erase(t, [
      [-20, 50],
      [20, 50],
    ]);

    expect(result.sort()).toEqual(["a", "b"]);
  });

  it("givenNestedGroups_whenInnerMemberIsHit_marksTheWholeOutermostGroup", () => {
    // groupIds are ordered innermost -> outermost; the eraser uses .at(-1)
    const a = rect({ id: "a", groupIds: ["inner", "outer"] });
    const b = rect({ id: "b", x: 500, groupIds: ["inner", "outer"] });
    const c = rect({ id: "c", x: 1000, groupIds: ["outer"] });
    const t = createTrail([a, b, c]);

    const result = erase(t, [
      [-20, 50],
      [20, 50],
    ]);

    expect(result.sort()).toEqual(["a", "b", "c"]);
  });

  it("givenContainerWithBoundText_whenContainerIsHit_marksTextToo", () => {
    const container = rect({
      id: "box",
      boundElements: [{ type: "text", id: "label" }],
    });
    const label = API.createElement({
      type: "text",
      id: "label",
      text: "hi",
      x: 40,
      y: 40,
      width: 20,
      height: 20,
      containerId: "box",
    });
    const t = createTrail([container, label]);

    const result = erase(t, [
      [-20, 50],
      [20, 50],
    ]);

    expect(result.sort()).toEqual(["box", "label"]);
  });

  it("givenRestoreFlag_whenPathCrossesMarkedElementAgain_unmarksIt", () => {
    const a = rect({ id: "a" });
    const b = rect({ id: "b", x: 200 });
    const t = createTrail([a, b]);

    erase(t, [
      [-20, 50],
      [20, 50],
      [180, 50],
      [220, 50],
    ]);
    // keep going, now in "restore" mode (alt held), back across b
    const result = t.addPointToPath(180, 60, true);

    expect(result).toEqual(["a"]);
  });

  it("givenRestoreOfOneGroupMember_whenUnmarked_unmarksTheWholeGroup", () => {
    const a = rect({ id: "a", groupIds: ["g"] });
    const b = rect({ id: "b", x: 500, groupIds: ["g"] });
    const t = createTrail([a, b]);

    erase(t, [
      [-20, 50],
      [20, 50],
    ]);
    const result = t.addPointToPath(-20, 60, true);

    expect(result).toEqual([]);
  });

  it("givenNewStroke_whenStartPathIsCalled_previousHitsAreForgotten", () => {
    const a = rect({ id: "a" });
    const b = rect({ id: "b", x: 200 });
    const t = createTrail([a, b]);

    erase(t, [
      [-20, 50],
      [20, 50],
    ]);

    expect(
      erase(t, [
        [180, 50],
        [220, 50],
      ]),
    ).toEqual(["b"]);
  });
});

describe("EraserTrail — boundaries", () => {
  it("givenZeroLengthSegmentDirectlyOnStroke_whenErasing_doesNotErase", () => {
    const r = rect({ id: "r" });
    const t = createTrail([r]);

    // pointer pressed on the top edge and not moved
    t.startPath(50, 0);

    expect(t.addPointToPath(50, 0)).toEqual([]);
  });

  it("givenPathStoppingTwoPixelsBeforeStroke_whenErasing_doesNotErase", () => {
    const r = rect({ id: "r" });
    const t = createTrail([r]);

    expect(
      erase(t, [
        [-20, 50],
        [-2, 50],
      ]),
    ).toEqual([]);
  });

  it("givenPathEndingExactlyOnStrokeLine_whenErasing_doesNotErase", () => {
    const r = rect({ id: "r" });
    const t = createTrail([r]);

    expect(
      erase(t, [
        [-20, 50],
        [0, 50],
      ]),
    ).toEqual([]);
  });

  it("givenPathEndingHalfAPixelPastStrokeLine_whenErasing_erases", () => {
    const r = rect({ id: "r" });
    const t = createTrail([r]);

    expect(
      erase(t, [
        [-20, 50],
        [0.5, 50],
      ]),
    ).toEqual(["r"]);
  });

  it("givenEarlierSegmentCrossedElement_whenOnlyLatestSegmentIsTested_hitIsStillKept", () => {
    const r = rect({ id: "r" });
    const t = createTrail([r]);

    erase(t, [
      [-20, 50],
      [20, 50],
    ]);
    // next segment is far away from the rectangle
    expect(t.addPointToPath(500, 500)).toEqual(["r"]);
  });

  it.each([1, 2, 0.5, 0.25])(
    "givenArrowWith2pxStroke_atZoom%s_erasesAt2pxDistanceButNotAt3px",
    (zoom) => {
      // NOTE (current behaviour, likely unintended): the code computes a
      // zoom-dependent tolerance max(strokeWidth, strokeWidth * 2 / zoom),
      // which would be 16px at zoom 0.25. In practice the cheaper bounds
      // pre-check (threshold = strokeWidth / 2) rejects the arrow first, so
      // the effective reach is the same at every zoom level.
      const makeArrow = () =>
        API.createElement({
          type: "arrow",
          id: "arrow",
          x: 0,
          y: 0,
          width: 100,
          height: 0,
          strokeWidth: 2,
          points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
        });

      expect(
        erase(createTrail([makeArrow()], zoom), [
          [20, 2],
          [80, 2],
        ]),
      ).toEqual(["arrow"]);
      trail?.stop();

      expect(
        erase(createTrail([makeArrow()], zoom), [
          [20, 3],
          [80, 3],
        ]),
      ).toEqual([]);
    },
  );
});

describe("EraserTrail — failure / no-op paths", () => {
  it("givenLockedElement_whenPathCrossesIt_neverErases", () => {
    const r = rect({ id: "r", locked: true });
    const t = createTrail([r]);

    expect(
      erase(t, [
        [-20, 50],
        [20, 50],
      ]),
    ).toEqual([]);
  });

  it("givenNoStartPath_whenAddingPoint_returnsEmptyWithoutThrowing", () => {
    const r = rect({ id: "r" });
    const t = createTrail([r]);

    expect(() => t.addPointToPath(0, 50)).not.toThrow();
    expect(t.addPointToPath(20, 50)).toEqual([]);
  });

  it("givenRestoreFlag_whenElementWasNeverMarked_doesNothing", () => {
    const r = rect({ id: "r" });
    const t = createTrail([r]);

    expect(
      erase(
        t,
        [
          [-20, 50],
          [20, 50],
        ],
        true,
      ),
    ).toEqual([]);
  });

  it("givenElementNotInVisibleElements_whenPathCrossesIt_isIgnored", () => {
    // e.g. an element scrolled off-screen: only app.visibleElements are tested
    const t = createTrail([]);

    expect(
      erase(t, [
        [-20, 50],
        [20, 50],
      ]),
    ).toEqual([]);
  });

  it("givenEndPath_whenCalled_clearsAllMarkedElements", () => {
    const r = rect({ id: "r" });
    const t = createTrail([r]);

    erase(t, [
      [-20, 50],
      [20, 50],
    ]);
    t.endPath();

    // a lone point after endPath has no current trail -> nothing marked
    expect(t.addPointToPath(30, 50)).toEqual([]);
  });
});

// Regression: https://github.com/excalidraw/excalidraw/issues/11945
// "Can't delete unlocked freedraw elements from the scene with the eraser".
// Geometry and stroke options copied from the drawing linked in the issue:
// very short constant-width strokes with stroke width 0.25. The outline
// generator returns no points for them, and the eraser freedraw hit test throws
// "Freepath outline must have at least 2 points".
describe("EraserTrail — tiny thin freedraw strokes (#11945)", () => {
  const tinyStroke = (id: string, x = 0, y = 0) =>
    API.createElement({
      type: "freedraw",
      id,
      x,
      y,
      width: 0.5714285714285552,
      height: 0.5714285714284415,
      strokeWidth: 0.25,
      strokeOptions: { variability: "constant", streamline: 0.5 },
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(0.5714285714285552, -0.5714285714284415),
        pointFrom<LocalPoint>(0.5714285714285552, -0.5714285714284415),
      ],
    });

  it("givenTinyThinFreedrawStroke_whenEraserSwipesThroughIt_erasesIt", () => {
    const t = createTrail([tinyStroke("dot")]);

    expect(
      erase(t, [
        [-30, 0],
        [30, 0],
      ]),
    ).toEqual(["dot"]);
  });

  it("givenTinyThinFreedrawStrokeNextToRectangle_whenSwipeCrossesBoth_erasesBoth", () => {
    const r = rect({ id: "r" });
    const t = createTrail([r, tinyStroke("dot", 110, 50)]);

    expect(
      erase(t, [
        [80, 50],
        [130, 50],
      ]).sort(),
    ).toEqual(["dot", "r"]);
  });

  it("givenTinyThinFreedrawStroke_whenEraserPassesFarAway_doesNotEraseIt", () => {
    const t = createTrail([tinyStroke("dot")]);

    expect(
      erase(t, [
        [-30, 12],
        [30, 12],
      ]),
    ).toEqual([]);
  });
});
