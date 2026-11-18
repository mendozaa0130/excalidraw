import { pointDistance, pointFrom, pointRotateRads } from "@excalidraw/math";

import type { GlobalPoint, LocalPoint, Radians } from "@excalidraw/math";

import { getBoundsFromPoints } from "./bounds";

import type { ExcalidrawFreeDrawElement } from "./types";

/**
 * One surviving piece of a freedraw stroke after a partial erase. The
 * fields are exactly those that differ from the original element; every
 * other property (style, groupIds, frameId, ...) is copied by the caller.
 */
export type FreedrawFragment = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** rebased so that `points[0]` is `[0, 0]` */
  points: LocalPoint[];
  /** same length as `points`, or empty when the original had no pressures */
  pressures: number[];
};

/** bisection steps when locating a cut; 2^-12 of a sample gap is plenty */
const BOUNDARY_ITERATIONS = 12;

/**
 * Cuts the parts of a freedraw stroke that lie within `tolerance` of the
 * eraser path (scene coordinates) and returns the surviving pieces.
 *
 * @returns `null` if the eraser did not touch the stroke, `[]` if the whole
 *   stroke was erased, otherwise the remaining fragments in stroke order.
 *   Fragments with fewer than 2 points or shorter than `minFragmentLength`
 *   are dropped. A single-point stroke is either erased whole (`[]`) or
 *   untouched (`null`).
 *
 * Pure: reads only the element's geometry and never mutates it.
 */
export const splitFreedrawByPath = (
  element: ExcalidrawFreeDrawElement,
  eraserPath: readonly GlobalPoint[],
  tolerance: number,
  minFragmentLength = 0,
): FreedrawFragment[] | null => {
  if (eraserPath.length === 0 || element.points.length === 0) {
    return null;
  }

  const center = getRotationCenter(element);

  // Work in the stroke's own unrotated frame: rotate the eraser path the
  // opposite way instead of rotating every stroke point.
  const localEraser = eraserPath.map((p) => {
    const unrotated = pointRotateRads(p, center, -element.angle as Radians);
    return pointFrom<LocalPoint>(
      unrotated[0] - element.x,
      unrotated[1] - element.y,
    );
  });
  // eraser segments flattened as [x1, y1, x2, y2, ...]: the hit test below
  // runs for every sample and must not allocate
  const segments = new Float64Array(Math.max(1, localEraser.length - 1) * 4);
  for (let i = 0; i < segments.length / 4; i++) {
    const p = localEraser[i];
    const q = localEraser[Math.min(i + 1, localEraser.length - 1)];
    segments.set([p[0], p[1], q[0], q[1]], i * 4);
  }
  const toleranceSq = tolerance * tolerance;

  // PERF: skip the per-point work when the eraser is nowhere near the stroke
  const [sx1, sy1, sx2, sy2] = getBoundsFromPoints(element.points);
  const [ex1, ey1, ex2, ey2] = getBoundsFromPoints(localEraser);
  if (
    ex2 + tolerance < sx1 ||
    ex1 - tolerance > sx2 ||
    ey2 + tolerance < sy1 ||
    ey1 - tolerance > sy2
  ) {
    return null;
  }

  const isErasedAt = (x: number, y: number) => {
    for (let i = 0; i < segments.length; i += 4) {
      if (
        pointSegmentDistanceSq(
          x,
          y,
          segments[i],
          segments[i + 1],
          segments[i + 2],
          segments[i + 3],
        ) <= toleranceSq
      ) {
        return true;
      }
    }
    return false;
  };

  const { points } = element;
  const hasPressures = element.pressures.length === points.length;
  const pressureAt = (i: number) => (hasPressures ? element.pressures[i] : 0);

  if (points.length === 1) {
    return isErasedAt(points[0][0], points[0][1]) ? [] : null;
  }

  // sample each segment densely enough that the eraser can't slip between
  // two samples; the samples are only used for classification
  const sampleStep = Math.max(tolerance / 2, 0.5);

  type Run = { points: LocalPoint[]; pressures: number[] };
  const runs: Run[] = [];
  let current: Run | null = isErasedAt(points[0][0], points[0][1])
    ? null
    : { points: [points[0]], pressures: [pressureAt(0)] };
  let touched = current === null;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const pa = pressureAt(i);
    const pb = pressureAt(i + 1);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];

    const samples = Math.max(1, Math.ceil(pointDistance(a, b) / sampleStep));
    let prevT = 0;
    let prevErased = current === null;

    for (let k = 1; k <= samples; k++) {
      const t = k / samples;
      const erased = isErasedAt(a[0] + dx * t, a[1] + dy * t);

      if (erased !== prevErased) {
        touched = true;
        // bisect for the boundary between prevT and t
        let lo = prevT;
        let hi = t;
        for (let n = 0; n < BOUNDARY_ITERATIONS; n++) {
          const mid = (lo + hi) / 2;
          if (isErasedAt(a[0] + dx * mid, a[1] + dy * mid) === prevErased) {
            lo = mid;
          } else {
            hi = mid;
          }
        }
        // take the side of the boundary that is *not* erased
        const tb = prevErased ? hi : lo;
        const boundary = pointFrom<LocalPoint>(a[0] + dx * tb, a[1] + dy * tb);
        const boundaryPressure = pa + (pb - pa) * tb;

        if (prevErased) {
          current = { points: [boundary], pressures: [boundaryPressure] };
        } else if (current) {
          current.points.push(boundary);
          current.pressures.push(boundaryPressure);
          runs.push(current);
          current = null;
        }
      }

      prevT = t;
      prevErased = erased;
    }

    if (current && !prevErased) {
      current.points.push(b);
      current.pressures.push(pb);
    }
  }

  if (current) {
    runs.push(current);
  }

  if (!touched) {
    return null;
  }

  return runs
    .filter(
      (run) =>
        run.points.length >= 2 &&
        polylineLength(run.points) >= minFragmentLength,
    )
    .map((run) => toFragment(element, center, run, hasPressures));
};

/**
 * The point freedraw elements rotate about: the centre of their points'
 * bounds (same as `getElementAbsoluteCoords()` computes for freedraw).
 */
const getRotationCenter = (element: ExcalidrawFreeDrawElement) => {
  const [x1, y1, x2, y2] = getBoundsFromPoints(element.points);
  return pointFrom<GlobalPoint>(
    element.x + (x1 + x2) / 2,
    element.y + (y1 + y2) / 2,
  );
};

/** squared distance from (x, y) to segment (x1, y1)–(x2, y2), allocation-free */
const pointSegmentDistanceSq = (
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  const t =
    lengthSq === 0
      ? 0
      : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSq));
  const ex = x1 + dx * t - x;
  const ey = y1 + dy * t - y;
  return ex * ex + ey * ey;
};

const polylineLength = (points: readonly LocalPoint[]) =>
  points.slice(1).reduce((sum, p, i) => sum + pointDistance(points[i], p), 0);

/**
 * Turns a run of points (in the original element's local frame) into a
 * standalone fragment that renders in the same place. A fragment rotates
 * about the centre of its *own* bounds, so for a rotated stroke its x/y must
 * be chosen such that that centre lands where it was in the original.
 */
const toFragment = (
  element: ExcalidrawFreeDrawElement,
  originalCenter: GlobalPoint,
  run: { points: LocalPoint[]; pressures: number[] },
  hasPressures: boolean,
): FreedrawFragment => {
  const [minX, minY, maxX, maxY] = getBoundsFromPoints(run.points);
  const runCenter = pointRotateRads(
    pointFrom<GlobalPoint>(
      element.x + (minX + maxX) / 2,
      element.y + (minY + maxY) / 2,
    ),
    originalCenter,
    element.angle,
  );

  const [ox, oy] = run.points[0];
  const points = run.points.map((p) =>
    pointFrom<LocalPoint>(p[0] - ox, p[1] - oy),
  );

  return {
    // centre of the rebased bounds is ((minX + maxX) / 2 - ox, ...)
    x: runCenter[0] - ((minX + maxX) / 2 - ox),
    y: runCenter[1] - ((minY + maxY) / 2 - oy),
    // rebasing doesn't change the size; computed in a loop, not by spreading
    // the points into Math.min/max (which overflows the stack on huge strokes)
    width: maxX - minX,
    height: maxY - minY,
    points,
    pressures: hasPressures ? run.pressures : [],
  };
};
