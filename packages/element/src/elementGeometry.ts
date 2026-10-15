import type { GlobalPoint, LineSegment } from "@excalidraw/math";

import {
  intersectDiamondWithLineSegment,
  intersectEllipseWithLineSegment,
  intersectLinearOrFreeDrawWithLineSegment,
  intersectRectanguloidWithLineSegment,
} from "./collision";
import {
  distanceToDiamondElement,
  distanceToEllipseElement,
  distanceToFreeDrawElement,
  distanceToLinearOrFreeDraElement,
  distanceToRectanguloidElement,
} from "./distance";

import type {
  ElementsMap,
  ExcalidrawDiamondElement,
  ExcalidrawElement,
  ExcalidrawElementType,
  ExcalidrawEllipseElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawLinearElement,
  ExcalidrawRectanguloidElement,
} from "./types";

/**
 * Geometry operations whose implementation depends on the element's type.
 *
 * Each element type is mapped to one strategy in `elementGeometry` below.
 * Adding a new element type is a compile error until it is registered there.
 */
export interface ElementGeometryStrategy<
  T extends ExcalidrawElement = ExcalidrawElement,
> {
  /** Distance from `p` to the element's outline. */
  distanceTo(element: T, elementsMap: ElementsMap, p: GlobalPoint): number;
  /** Intersections of `segment` with the element's outline. */
  intersectLineSegment(
    element: T,
    elementsMap: ElementsMap,
    segment: LineSegment<GlobalPoint>,
    offset: number,
    onlyFirst: boolean,
  ): GlobalPoint[];
}

// NOTE: the methods call into `distance.ts` / `collision.ts` lazily (instead of
// referencing the functions directly) because both of those modules import
// this one, and a direct reference would be read before they're initialized.

const rectanguloidGeometry: ElementGeometryStrategy<ExcalidrawRectanguloidElement> =
  {
    distanceTo: (element, elementsMap, p) =>
      distanceToRectanguloidElement(element, elementsMap, p),
    intersectLineSegment: (element, elementsMap, segment, offset, onlyFirst) =>
      intersectRectanguloidWithLineSegment(
        element,
        elementsMap,
        segment,
        offset,
        onlyFirst,
      ),
  };

const diamondGeometry: ElementGeometryStrategy<ExcalidrawDiamondElement> = {
  distanceTo: (element, elementsMap, p) =>
    distanceToDiamondElement(element, elementsMap, p),
  intersectLineSegment: (element, elementsMap, segment, offset, onlyFirst) =>
    intersectDiamondWithLineSegment(
      element,
      elementsMap,
      segment,
      offset,
      onlyFirst,
    ),
};

const ellipseGeometry: ElementGeometryStrategy<ExcalidrawEllipseElement> = {
  distanceTo: (element, elementsMap, p) =>
    distanceToEllipseElement(element, elementsMap, p),
  intersectLineSegment: (element, elementsMap, segment, offset) =>
    intersectEllipseWithLineSegment(element, elementsMap, segment, offset),
};

const linearGeometry: ElementGeometryStrategy<ExcalidrawLinearElement> = {
  distanceTo: (element, elementsMap, p) =>
    distanceToLinearOrFreeDraElement(element, elementsMap, p),
  intersectLineSegment: (element, elementsMap, segment, offset, onlyFirst) =>
    intersectLinearOrFreeDrawWithLineSegment(
      element,
      segment,
      elementsMap,
      onlyFirst,
    ),
};

const freeDrawGeometry: ElementGeometryStrategy<ExcalidrawFreeDrawElement> = {
  distanceTo: (element, elementsMap, p) =>
    distanceToFreeDrawElement(element, elementsMap, p),
  intersectLineSegment: (element, elementsMap, segment, offset, onlyFirst) =>
    intersectLinearOrFreeDrawWithLineSegment(
      element,
      segment,
      elementsMap,
      onlyFirst,
    ),
};

/**
 * The geometry strategy for every element type. The mapped type requires an
 * entry for each `ExcalidrawElementType`.
 */
const elementGeometry: {
  [K in ExcalidrawElementType]: ElementGeometryStrategy<
    ExcalidrawElement & { type: K }
  >;
} = {
  selection: rectanguloidGeometry,
  rectangle: rectanguloidGeometry,
  stickynote: rectanguloidGeometry,
  image: rectanguloidGeometry,
  text: rectanguloidGeometry,
  iframe: rectanguloidGeometry,
  embeddable: rectanguloidGeometry,
  frame: rectanguloidGeometry,
  magicframe: rectanguloidGeometry,
  diamond: diamondGeometry,
  ellipse: ellipseGeometry,
  line: linearGeometry,
  arrow: linearGeometry,
  freedraw: freeDrawGeometry,
};

export const getElementGeometry = <T extends ExcalidrawElement>(
  element: T,
): ElementGeometryStrategy<T> =>
  elementGeometry[element.type] as unknown as ElementGeometryStrategy<T>;
