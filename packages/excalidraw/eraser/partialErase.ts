import { arrayToMap } from "@excalidraw/common";
import {
  getFreedrawStrokeRadius,
  isFreeDrawElement,
  newElementWith,
  newFreeDrawElement,
  splitFreedrawByPath,
  syncMovedIndices,
} from "@excalidraw/element";

import type { GlobalPoint } from "@excalidraw/math";

import type {
  ExcalidrawElement,
  ExcalidrawFreeDrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";

/**
 * How close (scene units) to the eraser path a stroke's centreline must be
 * to be cut: the eraser's own reach — the same zoom-aware value the
 * whole-element eraser uses for freedraw — plus the stroke's ink half-width,
 * so that what disappears matches the ink the eraser visibly crossed.
 */
const getPartialEraseTolerance = (
  element: ExcalidrawFreeDrawElement,
  zoom: number,
) => Math.max(2.25, 5 / zoom) + getFreedrawStrokeRadius(element);

/** fragments shorter than this (scene units at zoom 1) are not kept */
const MIN_FRAGMENT_LENGTH = 1;

/**
 * Applies a partial erase to the scene (docs/DESIGN.md, Approach A).
 *
 * Every unlocked, non-deleted freedraw element among `candidateIds` is cut
 * where it lies within the eraser's reach. A cut stroke is marked deleted
 * and its surviving pieces are inserted directly after it as new freedraw
 * elements, so they keep its z-position. Other elements are not touched.
 *
 * @returns the next elements array (including deleted), or `null` if nothing
 *   changed.
 */
export const applyPartialErase = (
  elements: readonly OrderedExcalidrawElement[],
  candidateIds: ReadonlySet<ExcalidrawElement["id"]>,
  eraserPath: readonly GlobalPoint[],
  zoom: number,
): OrderedExcalidrawElement[] | null => {
  const nextElements: ExcalidrawElement[] = [];
  const fragmentsAdded: ExcalidrawElement[] = [];
  let didChange = false;

  for (const element of elements) {
    if (
      !candidateIds.has(element.id) ||
      !isFreeDrawElement(element) ||
      element.isDeleted ||
      element.locked
    ) {
      nextElements.push(element);
      continue;
    }

    const fragments = splitFreedrawByPath(
      element,
      eraserPath,
      getPartialEraseTolerance(element, zoom),
      MIN_FRAGMENT_LENGTH / zoom,
    );

    if (fragments === null) {
      nextElements.push(element);
      continue;
    }

    didChange = true;
    nextElements.push(newElementWith(element, { isDeleted: true }));

    for (const fragment of fragments) {
      const fragmentElement = newFreeDrawElement({
        type: "freedraw",
        ...fragment,
        simulatePressure: element.simulatePressure,
        strokeOptions: element.strokeOptions,
        angle: element.angle,
        strokeColor: element.strokeColor,
        backgroundColor: element.backgroundColor,
        fillStyle: element.fillStyle,
        strokeWidth: element.strokeWidth,
        strokeStyle: element.strokeStyle,
        roughness: element.roughness,
        opacity: element.opacity,
        roundness: element.roundness,
        groupIds: element.groupIds,
        frameId: element.frameId,
        link: element.link,
        customData: element.customData,
      });
      nextElements.push(fragmentElement);
      fragmentsAdded.push(fragmentElement);
    }
  }

  if (!didChange) {
    return null;
  }

  // fragments were created without an index; give them ones that sit
  // between their neighbours (i.e. where the original stroke was)
  return syncMovedIndices(nextElements, arrayToMap(fragmentsAdded));
};
