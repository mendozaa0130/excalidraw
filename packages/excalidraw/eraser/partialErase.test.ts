/**
 * Unit tests for applyPartialErase() (docs/DESIGN.md, Approach A): given the
 * scene's elements, the ids the eraser touched and the eraser path, it marks
 * cut freedraw strokes deleted and inserts their surviving fragments as new
 * freedraw elements in the same z-position. Everything else is left alone.
 */
import {
  newFreeDrawElement,
  syncInvalidIndices,
  validateFractionalIndices,
} from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import type { GlobalPoint, LocalPoint } from "@excalidraw/math";
import type {
  ExcalidrawElement,
  ExcalidrawFreeDrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";

import { API } from "../tests/helpers/api";

import { applyPartialErase } from "./partialErase";

/** horizontal stroke from (0, y) to (100, y) */
const stroke = (
  props: Partial<Parameters<typeof newFreeDrawElement>[0]> = {},
) => {
  const points: LocalPoint[] = [];
  for (let x = 0; x <= 100; x += 10) {
    points.push(pointFrom<LocalPoint>(x, 0));
  }
  return newFreeDrawElement({
    type: "freedraw",
    x: 0,
    y: 0,
    points,
    simulatePressure: true,
    ...props,
  });
};

const scene = (...elements: ExcalidrawElement[]) =>
  syncInvalidIndices(elements) as OrderedExcalidrawElement[];

const ids = (...elements: ExcalidrawElement[]) =>
  new Set(elements.map((e) => e.id));

/** vertical eraser swipe through x */
const swipeAt = (x: number, y = 0) => [
  pointFrom<GlobalPoint>(x, y - 30),
  pointFrom<GlobalPoint>(x, y + 30),
];

const live = (elements: readonly ExcalidrawElement[] | null) =>
  (elements ?? []).filter((e) => !e.isDeleted);

describe("applyPartialErase — normal behaviour", () => {
  it("deletes a cut stroke and adds its fragments as new elements", () => {
    const s = stroke();
    const result = applyPartialErase(scene(s), ids(s), swipeAt(50), 1)!;

    expect(result.find((e) => e.id === s.id)?.isDeleted).toBe(true);
    const fragments = live(result);
    expect(fragments).toHaveLength(2);
    for (const f of fragments) {
      expect(f.type).toBe("freedraw");
      expect(f.id).not.toBe(s.id);
    }
  });

  it("copies style, groups, frame, link and customData to fragments", () => {
    const s = stroke({
      strokeColor: "#e03131",
      backgroundColor: "#ffc9c9",
      strokeWidth: 4,
      opacity: 60,
      roughness: 2,
      groupIds: ["g1"],
      frameId: "frame-1",
      link: "https://example.com",
      customData: { tag: "kept" },
      strokeOptions: { variability: "constant", streamline: 0.3 },
    });
    const [f] = live(applyPartialErase(scene(s), ids(s), swipeAt(50), 1));
    const copied = f as ExcalidrawFreeDrawElement;

    expect(copied).toMatchObject({
      strokeColor: "#e03131",
      backgroundColor: "#ffc9c9",
      strokeWidth: 4,
      opacity: 60,
      roughness: 2,
      groupIds: ["g1"],
      frameId: "frame-1",
      link: "https://example.com",
      customData: { tag: "kept" },
      strokeOptions: { variability: "constant", streamline: 0.3 },
      simulatePressure: true,
      angle: s.angle,
    });
  });

  it("inserts fragments at the cut stroke's z-position", () => {
    const below = API.createElement({ type: "rectangle", x: 500, y: 500 });
    const s = stroke();
    const above = API.createElement({ type: "rectangle", x: 600, y: 600 });

    const result = applyPartialErase(
      scene(below, s, above),
      ids(s),
      swipeAt(50),
      1,
    )!;
    const order = live(result).map((e) =>
      e.id === below.id ? "below" : e.id === above.id ? "above" : "fragment",
    );

    expect(order).toEqual(["below", "fragment", "fragment", "above"]);
    expect(() =>
      validateFractionalIndices(result, {
        shouldThrow: true,
        includeBoundTextValidation: false,
        ignoreLogs: true,
      }),
    ).not.toThrow();
  });

  it("deletes a fully covered stroke without adding fragments", () => {
    const s = stroke();
    const eraser = [
      pointFrom<GlobalPoint>(-10, 0),
      pointFrom<GlobalPoint>(110, 0),
    ];
    const result = applyPartialErase(scene(s), ids(s), eraser, 1)!;

    expect(live(result)).toHaveLength(0);
    expect(result).toHaveLength(1);
  });
});

describe("applyPartialErase — what it must not touch", () => {
  it("doesn't touch non-freedraw elements", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 40,
      y: -10,
      width: 20,
      height: 20,
    });
    expect(
      applyPartialErase(scene(rect), ids(rect), swipeAt(50), 1),
    ).toBeNull();
  });

  it("doesn't touch locked strokes", () => {
    const s = stroke({ locked: true });
    expect(applyPartialErase(scene(s), ids(s), swipeAt(50), 1)).toBeNull();
  });

  it("doesn't touch strokes that aren't candidates", () => {
    const s = stroke();
    const other = stroke({ y: 200 });
    const result = applyPartialErase(
      scene(s, other),
      ids(other),
      swipeAt(50),
      1,
    );

    expect(result).toBeNull();
  });

  it("returns null when the eraser misses every candidate", () => {
    const s = stroke();
    expect(applyPartialErase(scene(s), ids(s), swipeAt(50, 300), 1)).toBeNull();
  });

  it("ignores deleted strokes", () => {
    const s = { ...stroke(), isDeleted: true };
    expect(applyPartialErase(scene(s), ids(s), swipeAt(50), 1)).toBeNull();
  });
});

describe("applyPartialErase — tolerance", () => {
  it("includes the stroke's ink width in the tolerance", () => {
    // centreline at y=0; a 4px-wide variable stroke has ink ~8.5px each side
    const thick = stroke({ strokeWidth: 4 });
    const thin = stroke({ strokeWidth: 0.5 });
    const nearEdge = [
      pointFrom<GlobalPoint>(40, 9),
      pointFrom<GlobalPoint>(60, 9),
    ];

    expect(
      applyPartialErase(scene(thick), ids(thick), nearEdge, 1),
    ).not.toBeNull();
    expect(applyPartialErase(scene(thin), ids(thin), nearEdge, 1)).toBeNull();
  });
});
