/**
 * Characterization tests for packages/excalidraw/snapping.ts
 *
 * Object snapping runs on every pointer move while elements are dragged: it
 * decides whether snapping is active (isSnappingEnabled), how close is "close
 * enough" (getSnapDistance), and how far to nudge the dragged selection so it
 * lines up with other elements (snapDraggedElements).
 *
 * The snapping functions only read `app.state` and `app.props.gridModeEnabled`
 * (AppClassProperties), so the tests pass a minimal stand-in rather than
 * mounting the editor. Reference points/gaps are cached the same way
 * App.maybeCacheReferenceSnapPoints / maybeCacheVisibleGaps do it.
 * No production code was changed.
 *
 * These tests pin down what the code does today; they are not a statement of
 * what it ideally should do.
 */
import { KEYS } from "@excalidraw/common";
import { arrayToMap } from "@excalidraw/common";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { getDefaultAppState } from "./appState";
import {
  SnapCache,
  getReferenceSnapPoints,
  getSnapDistance,
  getVisibleGaps,
  isSnappingEnabled,
  snapDraggedElements,
} from "./snapping";
import { API } from "./tests/helpers/api";

import type { AppClassProperties, AppState } from "./types";

type StateOverrides = Partial<AppState> & { gridModeEnabledProp?: boolean };

const makeApp = ({
  gridModeEnabledProp,
  ...state
}: StateOverrides = {}): AppClassProperties =>
  ({
    state: {
      ...getDefaultAppState(),
      width: 2000,
      height: 2000,
      offsetLeft: 0,
      offsetTop: 0,
      objectsSnapModeEnabled: true,
      ...state,
    },
    props: { gridModeEnabled: gridModeEnabledProp },
  } as unknown as AppClassProperties);

const noModifiers = {
  [KEYS.CTRL_OR_CMD]: false,
  shiftKey: false,
  altKey: false,
} as any;
const withCtrl = { ...noModifiers, [KEYS.CTRL_OR_CMD]: true } as any;

const rect = (id: string, x: number, y = 0, size = 100) =>
  API.createElement({ type: "rectangle", id, x, y, width: size, height: size });

/**
 * Sets up a scene, selects `selectedId`, primes SnapCache like App does, and
 * drags the selection by `dragOffset`.
 */
const drag = (
  elements: ExcalidrawElement[],
  selectedId: string,
  dragOffset: { x: number; y: number },
  {
    event = noModifiers,
    ...stateOverrides
  }: StateOverrides & { event?: any } = {},
) => {
  const app = makeApp({
    selectedElementIds: { [selectedId]: true },
    ...stateOverrides,
  });
  const elementsMap = arrayToMap(elements);
  const nonDeleted = elements as NonDeletedExcalidrawElement[];
  const selected = nonDeleted.filter((el) => el.id === selectedId);

  SnapCache.setReferenceSnapPoints(
    getReferenceSnapPoints(nonDeleted, selected, app.state, elementsMap),
  );
  SnapCache.setVisibleGaps(
    getVisibleGaps(nonDeleted, selected, app.state, elementsMap),
  );

  return snapDraggedElements(elements, dragOffset, app, event, elementsMap);
};

afterEach(() => {
  SnapCache.destroy();
});

// -----------------------------------------------------------------------------

describe("getSnapDistance", () => {
  it("givenZoom100Percent_whenComputing_returns8SceneUnits", () => {
    expect(getSnapDistance(1)).toBe(8);
  });

  it("givenZoomIn_whenComputing_shrinksProportionally", () => {
    expect(getSnapDistance(2)).toBe(4);
    expect(getSnapDistance(4)).toBe(2);
  });

  it("givenZoomOut_whenComputing_growsProportionally", () => {
    expect(getSnapDistance(0.5)).toBe(16);
    expect(getSnapDistance(0.1)).toBeCloseTo(80);
  });

  it("givenZeroZoom_whenComputing_returnsInfinityRatherThanThrowing", () => {
    expect(getSnapDistance(0)).toBe(Infinity);
  });
});

// -----------------------------------------------------------------------------

describe("isSnappingEnabled", () => {
  const selected = [rect("a", 0)];

  it("givenSnapModeOn_andNoModifier_returnsTrue", () => {
    const app = makeApp({ objectsSnapModeEnabled: true });
    expect(
      isSnappingEnabled({
        app,
        event: noModifiers,
        selectedElements: selected,
      }),
    ).toBe(true);
  });

  it("givenSnapModeOn_whenCtrlHeld_temporarilyDisablesSnapping", () => {
    const app = makeApp({ objectsSnapModeEnabled: true });
    expect(
      isSnappingEnabled({ app, event: withCtrl, selectedElements: selected }),
    ).toBe(false);
  });

  it("givenSnapModeOff_whenCtrlHeld_temporarilyEnablesSnapping", () => {
    const app = makeApp({ objectsSnapModeEnabled: false });
    expect(
      isSnappingEnabled({ app, event: withCtrl, selectedElements: selected }),
    ).toBe(true);
  });

  it("givenSnapModeOff_andCtrlHeld_butGridModeOnInState_returnsFalse", () => {
    const app = makeApp({
      objectsSnapModeEnabled: false,
      gridModeEnabled: true,
    });
    expect(
      isSnappingEnabled({ app, event: withCtrl, selectedElements: selected }),
    ).toBe(false);
  });

  it("givenGridModePropFalse_overridesGridModeTrueInState", () => {
    const app = makeApp({
      objectsSnapModeEnabled: false,
      gridModeEnabled: true,
      gridModeEnabledProp: false,
    });
    expect(
      isSnappingEnabled({ app, event: withCtrl, selectedElements: selected }),
    ).toBe(true);
  });

  it("givenLassoTool_whileSelectingNotDragging_returnsFalse", () => {
    const app = makeApp({
      activeTool: { type: "lasso" } as AppState["activeTool"],
      selectedElementsAreBeingDragged: false,
    });
    expect(
      isSnappingEnabled({
        app,
        event: noModifiers,
        selectedElements: selected,
      }),
    ).toBe(false);
  });

  it("givenLassoTool_whileDraggingSelection_returnsTrue", () => {
    const app = makeApp({
      activeTool: { type: "lasso" } as AppState["activeTool"],
      selectedElementsAreBeingDragged: true,
    });
    expect(
      isSnappingEnabled({
        app,
        event: noModifiers,
        selectedElements: selected,
      }),
    ).toBe(true);
  });

  it("givenNoEvent_andSingleArrowSelected_returnsFalseToFavourBinding", () => {
    const app = makeApp({ objectsSnapModeEnabled: true });
    const arrow = API.createElement({ type: "arrow" });
    expect(
      isSnappingEnabled({
        app,
        event: null as any,
        selectedElements: [arrow],
      }),
    ).toBe(false);
  });

  it("givenNoEvent_andArrowSelectedWithOtherElements_followsSnapMode", () => {
    const app = makeApp({ objectsSnapModeEnabled: true });
    const arrow = API.createElement({ type: "arrow" });
    expect(
      isSnappingEnabled({
        app,
        event: null as any,
        selectedElements: [arrow, rect("r", 0)],
      }),
    ).toBe(true);
  });

  it("givenEventPresent_andSingleArrowSelected_stillSnaps", () => {
    // the arrow exception only applies on the no-event path
    const app = makeApp({ objectsSnapModeEnabled: true });
    const arrow = API.createElement({ type: "arrow" });
    expect(
      isSnappingEnabled({
        app,
        event: noModifiers,
        selectedElements: [arrow],
      }),
    ).toBe(true);
  });
});

// -----------------------------------------------------------------------------

describe("snapDraggedElements — normal case", () => {
  it("givenSelectionDraggedNearAnotherEdge_whenWithinSnapDistance_returnsOffsetThatAlignsEdges", () => {
    // A: x 0..100. B starts at x 200. Dragging B by -95 puts its left edge at
    // 105, 5px from A's right edge -> snap pulls it 5px further left.
    const elements = [rect("A", 0), rect("B", 200)];

    const { snapOffset, snapLines } = drag(elements, "B", { x: -95, y: 0 });

    expect(snapOffset).toEqual({ x: -5, y: 0 });
    expect(snapLines.length).toBeGreaterThan(0);
    expect(snapLines.every((line) => line.type === "points")).toBe(true);
  });

  it("givenSelectionDraggedNearCentreline_whenWithinSnapDistance_snapsCentreToCentre", () => {
    // B is 40 wide; its centre should snap onto A's centre (x = 50)
    const elements = [rect("A", 0, 0, 100), rect("B", 300, 300, 40)];

    // B centre starts at 320; dragging by -267 puts it at 53
    const { snapOffset } = drag(elements, "B", { x: -267, y: 0 });

    expect(snapOffset.x).toBe(-3);
  });

  it("givenSelectionInMiddleOfEqualGap_whenDraggedSlightlyOff_snapsBackToEqualSpacing", () => {
    // A at 0..100, C at 400..500, B (100 wide) centred between them -> 200..300
    const elements = [rect("A", 0), rect("C", 400), rect("B", 200, 300)];

    // drag B up to y=0 row and 4px right of the equal-gap position
    const { snapOffset, snapLines } = drag(elements, "B", { x: 4, y: -300 });

    expect(snapOffset.x).toBe(-4);
    expect(snapLines.some((line) => line.type === "gap")).toBe(true);
  });

  it("givenDragOffsetWithManyDecimals_whenSnapping_roundsTheCallersDragOffsetInPlaceTo6Places", () => {
    // current behaviour: the dragOffset argument object is mutated, rounded
    // to 6 decimal places (snapping.ts has its own local round())
    const elements = [rect("A", 0), rect("B", 1000, 1000)];
    const dragOffset = { x: 10.12345678, y: 20.4 };

    drag(elements, "B", dragOffset);

    expect(dragOffset).toEqual({ x: 10.123457, y: 20.4 });
  });

  it("givenSnappingDisabled_whenDragging_leavesTheCallersDragOffsetUntouched", () => {
    const elements = [rect("A", 0), rect("B", 1000, 1000)];
    const dragOffset = { x: 10.12345678, y: 0 };

    drag(elements, "B", dragOffset, { event: withCtrl });

    expect(dragOffset.x).toBe(10.12345678);
  });
});

describe("snapDraggedElements — boundaries", () => {
  it.each([
    [8, -8],
    [7, -7],
  ])(
    "givenGapOf%spx_atZoom1_snaps",
    (distance: number, expectedOffset: number) => {
      const elements = [rect("A", 0), rect("B", 1000, 1000)];
      // place B's left edge `distance` px to the right of A's right edge (100)
      const { snapOffset } = drag(elements, "B", {
        x: 100 + distance - 1000,
        y: -1000 + 500,
      });
      expect(snapOffset.x).toBe(expectedOffset);
    },
  );

  it("givenGapOf9px_atZoom1_justOutsideSnapDistance_doesNotSnap", () => {
    const elements = [rect("A", 0), rect("B", 1000, 1000)];
    const { snapOffset, snapLines } = drag(elements, "B", {
      x: 100 + 9 - 1000,
      y: -500,
    });
    expect(snapOffset).toEqual({ x: 0, y: 0 });
    expect(snapLines).toEqual([]);
  });

  it("givenGapOf5px_atZoom2_isOutsideTheShrunkenSnapDistance_doesNotSnap", () => {
    const elements = [rect("A", 0), rect("B", 1000, 1000)];
    const { snapOffset } = drag(
      elements,
      "B",
      { x: 100 + 5 - 1000, y: -500 },
      { zoom: { value: 2 as any } },
    );
    expect(snapOffset.x).toBe(0);
  });

  it("givenGapOf4px_atZoom2_isExactlyOnTheSnapDistance_snaps", () => {
    const elements = [rect("A", 0), rect("B", 1000, 1000)];
    const { snapOffset } = drag(
      elements,
      "B",
      { x: 100 + 4 - 1000, y: -500 },
      { zoom: { value: 2 as any } },
    );
    expect(snapOffset.x).toBe(-4);
  });

  it("givenAlreadyAligned_whenDragged_returnsZeroOffsetButStillReportsSnapLines", () => {
    const elements = [rect("A", 0), rect("B", 1000, 1000)];
    const { snapOffset, snapLines } = drag(elements, "B", {
      x: 100 - 1000,
      y: -500,
    });
    expect(snapOffset).toEqual({ x: 0, y: 0 });
    expect(snapLines.length).toBeGreaterThan(0);
  });
});

describe("snapDraggedElements — disabled / failure paths", () => {
  it("givenCtrlHeldWithSnapModeOn_whenDraggingNearEdge_returnsZeroOffsetAndNoLines", () => {
    const elements = [rect("A", 0), rect("B", 200)];
    const result = drag(elements, "B", { x: -95, y: 0 }, { event: withCtrl });

    expect(result).toEqual({ snapOffset: { x: 0, y: 0 }, snapLines: [] });
  });

  it("givenNothingSelected_whenCalled_returnsZeroOffsetAndNoLines", () => {
    const elements = [rect("A", 0), rect("B", 200)];
    const result = drag(elements, "nobody", { x: -95, y: 0 });

    expect(result).toEqual({ snapOffset: { x: 0, y: 0 }, snapLines: [] });
  });

  it("givenEmptySnapCache_whenDraggingNearEdge_doesNotSnap", () => {
    // if App never primed the cache, there is nothing to snap to
    const elements = [rect("A", 0), rect("B", 200)];
    const app = makeApp({ selectedElementIds: { B: true } });

    const { snapOffset } = snapDraggedElements(
      elements,
      { x: -95, y: 0 },
      app,
      noModifiers,
      arrayToMap(elements),
    );

    expect(snapOffset).toEqual({ x: 0, y: 0 });
  });

  it("givenOnlyElementInScene_whenDragged_hasNothingToSnapTo", () => {
    const elements = [rect("B", 200)];
    const { snapOffset, snapLines } = drag(elements, "B", { x: -95, y: 3 });

    expect(snapOffset).toEqual({ x: 0, y: 0 });
    expect(snapLines).toEqual([]);
  });

  it("givenReferenceElementOutsideViewport_whenDraggingNearIt_doesNotSnap", () => {
    // only elements inside the viewport are used as snap references
    const elements = [rect("A", 0), rect("B", 200)];
    const { snapOffset } = drag(
      elements,
      "B",
      { x: -95, y: 0 },
      { width: 150, height: 150, scrollX: -150 },
    );

    expect(snapOffset.x).toBe(0);
  });
});
