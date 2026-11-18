import { CaptureUpdateAction } from "@excalidraw/element";

import { eraser } from "../components/icons";

import { register } from "./register";

import type { AppState } from "../types";
import type { ActionResult } from "./types";

/** the single place that decides what "toggle the eraser mode" means */
export const toggleEraserMode = (
  appState: Readonly<AppState>,
): ActionResult => ({
  appState: {
    ...appState,
    eraserMode: appState.eraserMode === "partial" ? "element" : "partial",
  },
  captureUpdate: CaptureUpdateAction.EVENTUALLY,
});

/**
 * Switches the eraser between deleting whole elements and cutting only the
 * touched parts of freedraw strokes (docs/DESIGN.md). The toolbar's eraser
 * button triggers it when clicked while the eraser is already active.
 */
export const actionToggleEraserMode = register({
  name: "eraserMode",
  label: "labels.toggleEraserMode",
  icon: eraser,
  keywords: ["eraser", "partial", "split", "cut", "pen", "stroke"],
  viewMode: false,
  trackEvent: {
    category: "toolbar",
    predicate: (appState) => appState.eraserMode === "partial",
  },
  perform: (elements, appState) => toggleEraserMode(appState),
  checked: (appState) => appState.eraserMode === "partial",
});
