/**
 * Unit tests for splitFreedrawByPath() — the pure geometry behind the partial
 * eraser (docs/DESIGN.md). Given a freedraw element and the eraser's path in
 * scene coordinates, it returns:
 *   - null  when the eraser did not touch the stroke (nothing to change),
 *   - []    when the whole stroke was erased,
 *   - the surviving pieces otherwise, each rebased so its first point is [0, 0].
 */
import { arrayToMap, getSizeFromPoints } from "@excalidraw/common";
import {
  distanceToLineSegment,
  lineSegment,
  pointFrom,
  pointRotateRads,
} from "@excalidraw/math";

import type { GlobalPoint, LocalPoint, Radians } from "@excalidraw/math";

import { getElementAbsoluteCoords } from "../src/bounds";
import { splitFreedrawByPath } from "../src/freedrawSplit";
import { newFreeDrawElement } from "../src/newElement";

import type { FreedrawFragment } from "../src/freedrawSplit";
import type { ExcalidrawFreeDrawElement } from "../src/types";

const TOLERANCE = 5;

/** A horizontal stroke from (x, y) to (x + length, y), one point every `step`. */
const horizontalStroke = ({
  x = 0,
  y = 0,
  length = 100,
  step = 10,
  angle = 0,
  pressures = false,
}: {
  x?: number;
  y?: number;
  length?: number;
  step?: number;
  angle?: number;
  pressures?: boolean;
} = {}) => {
  const points: LocalPoint[] = [];
  for (let px = 0; px <= length; px += step) {
    points.push(pointFrom<LocalPoint>(px, 0));
  }
  return newFreeDrawElement({
    type: "freedraw",
    x,
    y,
    angle: angle as Radians,
    points,
    // pressure rises linearly from 0 to 1 along the stroke
    pressures: pressures ? points.map((p) => p[0] / length) : [],
    simulatePressure: !pressures,
  });
};

const path = (...coords: [number, number][]) =>
  coords.map(([x, y]) => pointFrom<GlobalPoint>(x, y));

/** Where a local point of `el` is drawn in the scene, rotation included. */
const toScene = (el: ExcalidrawFreeDrawElement, p: LocalPoint) => {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(el, arrayToMap([el]));
  const center = pointFrom<GlobalPoint>((x1 + x2) / 2, (y1 + y2) / 2);
  return pointRotateRads(
    pointFrom<GlobalPoint>(el.x + p[0], el.y + p[1]),
    center,
    el.angle,
  );
};

const fragmentScenePoints = (
  original: ExcalidrawFreeDrawElement,
  f: FreedrawFragment,
) =>
  f.points.map((p) =>
    toScene({ ...original, x: f.x, y: f.y, points: f.points }, p),
  );

const distanceToPath = (p: GlobalPoint, eraser: GlobalPoint[]) =>
  Math.min(
    ...eraser
      .slice(1)
      .map((q, i) => distanceToLineSegment(p, lineSegment(eraser[i], q))),
  );

describe("splitFreedrawByPath — normal behaviour", () => {
  it("returns null when the eraser doesn't touch the stroke", () => {
    const el = horizontalStroke();
    expect(
      splitFreedrawByPath(el, path([50, 100], [60, 100]), TOLERANCE),
    ).toBeNull();
  });

  it("splits a stroke erased across its middle into two fragments", () => {
    const el = horizontalStroke();
    const fragments = splitFreedrawByPath(
      el,
      path([50, -20], [50, 20]),
      TOLERANCE,
    )!;

    expect(fragments).toHaveLength(2);
    const [left, right] = fragments.map((f) => fragmentScenePoints(el, f));
    // the cut lands on the tolerance boundary, not on the nearest sample point
    expect(left[0][0]).toBeCloseTo(0);
    expect(left.at(-1)![0]).toBeCloseTo(45, 1);
    expect(right[0][0]).toBeCloseTo(55, 1);
    expect(right.at(-1)![0]).toBeCloseTo(100);
  });

  it("shortens a stroke erased across one end", () => {
    const el = horizontalStroke();
    const fragments = splitFreedrawByPath(
      el,
      path([100, -20], [100, 20]),
      TOLERANCE,
    )!;

    expect(fragments).toHaveLength(1);
    const pts = fragmentScenePoints(el, fragments[0]);
    expect(pts[0][0]).toBeCloseTo(0);
    expect(pts.at(-1)![0]).toBeCloseTo(95, 1);
  });

  it("returns no fragments when the whole stroke is erased", () => {
    const el = horizontalStroke();
    expect(
      splitFreedrawByPath(el, path([-10, 0], [110, 0]), TOLERANCE),
    ).toEqual([]);
  });

  it("splits a stroke crossed twice into three fragments", () => {
    const el = horizontalStroke();
    // down at x=30, across well below the stroke, back up at x=70
    const eraser = path([30, -20], [30, 20], [70, 20], [70, -20]);
    const fragments = splitFreedrawByPath(el, eraser, TOLERANCE)!;

    expect(fragments).toHaveLength(3);
  });

  it("keeps every surviving point outside the tolerance", () => {
    const el = horizontalStroke({ step: 3 });
    const eraser = path([30, -20], [30, 20], [70, 20], [70, -20]);
    const fragments = splitFreedrawByPath(el, eraser, TOLERANCE)!;

    for (const f of fragments) {
      for (const p of fragmentScenePoints(el, f)) {
        // boundary points sit on the tolerance edge, allow float slack
        expect(distanceToPath(p, eraser)).toBeGreaterThanOrEqual(
          TOLERANCE - 0.01,
        );
      }
    }
  });
});

describe("splitFreedrawByPath — fragment shape", () => {
  it("rebases fragments to start at [0, 0] with matching size", () => {
    const el = horizontalStroke({ x: 200, y: 300 });
    const fragments = splitFreedrawByPath(
      el,
      path([250, 280], [250, 320]),
      TOLERANCE,
    )!;

    for (const f of fragments) {
      expect(f.points[0]).toEqual([0, 0]);
      expect({ width: f.width, height: f.height }).toEqual(
        getSizeFromPoints(f.points),
      );
    }
    // right fragment starts at the cut, in scene coordinates
    expect(fragments[1].x).toBeCloseTo(255, 1);
    expect(fragments[1].y).toBeCloseTo(300);
  });

  it("keeps the ink of a rotated stroke where it was drawn", () => {
    const el = horizontalStroke({ angle: Math.PI / 2 });
    // rotated 90° about its centre (50, 0): the stroke now runs vertically
    // through x=50 from y=-50 to y=50. Cut it across its middle.
    const eraser = path([30, 0], [70, 0]);
    const fragments = splitFreedrawByPath(el, eraser, TOLERANCE)!;

    expect(fragments).toHaveLength(2);
    const ends = fragments.flatMap((f) => {
      const pts = fragmentScenePoints(el, f);
      return [pts[0], pts.at(-1)!];
    });
    for (const p of ends) {
      expect(p[0]).toBeCloseTo(50, 1);
    }
    expect(ends.map((p) => Math.round(p[1])).sort((a, b) => a - b)).toEqual([
      -50, -5, 5, 50,
    ]);
  });

  it("keeps pressures aligned and interpolates them at the cut", () => {
    const el = horizontalStroke({ pressures: true });
    const fragments = splitFreedrawByPath(
      el,
      path([50, -20], [50, 20]),
      TOLERANCE,
    )!;

    for (const f of fragments) {
      expect(f.pressures).toHaveLength(f.points.length);
    }
    // pressure = x / 100 along the original stroke
    expect(fragments[0].pressures.at(-1)).toBeCloseTo(0.45, 2);
    expect(fragments[1].pressures[0]).toBeCloseTo(0.55, 2);
  });

  it("keeps pressures empty for simulated-pressure strokes", () => {
    const el = horizontalStroke();
    const fragments = splitFreedrawByPath(
      el,
      path([50, -20], [50, 20]),
      TOLERANCE,
    )!;

    for (const f of fragments) {
      expect(f.pressures).toEqual([]);
    }
  });
});

describe("splitFreedrawByPath — boundaries", () => {
  it("cuts a sparse stroke where the eraser passes between two samples", () => {
    // only two samples, 100 apart; the eraser crosses the segment between them
    const el = horizontalStroke({ step: 100 });
    const fragments = splitFreedrawByPath(
      el,
      path([50, -20], [50, 20]),
      TOLERANCE,
    )!;

    expect(fragments).toHaveLength(2);
  });

  it("doesn't cut when the eraser stays just outside the tolerance", () => {
    const el = horizontalStroke();
    expect(
      splitFreedrawByPath(el, path([0, 5.5], [100, 5.5]), TOLERANCE),
    ).toBeNull();
  });

  it("drops fragments shorter than the minimum length", () => {
    const el = horizontalStroke();
    // erases 87..97, leaving a 3-unit tail 97..100
    const eraser = path([92, -20], [92, 20]);

    expect(splitFreedrawByPath(el, eraser, TOLERANCE, 0)).toHaveLength(2);
    expect(splitFreedrawByPath(el, eraser, TOLERANCE, 5)).toHaveLength(1);
  });

  it("erases or keeps a single-point stroke as a whole", () => {
    const el = newFreeDrawElement({
      type: "freedraw",
      x: 10,
      y: 10,
      points: [pointFrom<LocalPoint>(0, 0)],
      simulatePressure: true,
    });

    expect(splitFreedrawByPath(el, path([0, 10], [20, 10]), TOLERANCE)).toEqual(
      [],
    );
    expect(
      splitFreedrawByPath(el, path([0, 50], [20, 50]), TOLERANCE),
    ).toBeNull();
  });

  it("handles a stroke with hundreds of thousands of points", () => {
    // e.g. a crafted or pasted scene (docs/DESIGN.md §6, availability)
    const el = horizontalStroke({ length: 250_000, step: 1 });
    const fragments = splitFreedrawByPath(
      el,
      path([125_000, -20], [125_000, 20]),
      TOLERANCE,
    )!;

    expect(fragments).toHaveLength(2);
    expect(fragments[1].width).toBeCloseTo(125_000 - TOLERANCE, 0);
  });

  it("cuts around a single-point eraser path (a click)", () => {
    // a click without a drag gives an eraser "path" of one point
    const el = horizontalStroke();
    const fragments = splitFreedrawByPath(el, path([50, 0]), TOLERANCE)!;

    expect(fragments).toHaveLength(2);
  });
});
