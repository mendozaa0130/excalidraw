/**
 * System tests for the partial eraser (docs/DESIGN.md). These drive the
 * mounted editor the way a user would: pick tools from the toolbar, drag the
 * mouse across the canvas, press Ctrl+Z — and assert on the resulting scene.
 */
import React from "react";
import { vi } from "vitest";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { serializeAsJSON } from "../data/json";
import { actionSaveFileToDisk } from "../actions";

import { CommandPalette } from "../components/CommandPalette/CommandPalette";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import {
  act,
  fireEvent,
  GlobalTestState,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
} from "./test-utils";

const { h } = window;
const mouse = new Pointer("mouse");

const liveFreedraw = () =>
  h.elements.filter((e) => e.type === "freedraw" && !e.isDeleted);

/** draws a horizontal freedraw stroke from (x, y) to (x + 100, y) */
const drawStroke = (x: number, y: number) => {
  UI.clickTool("freedraw");
  mouse.moveTo(x, y);
  mouse.down();
  for (let i = 0; i < 10; i++) {
    mouse.move(10, 0);
  }
  mouse.up();
};

/** vertical eraser drag through x, from y - 40 to y + 40 */
const eraseAcross = (x: number, y: number) => {
  mouse.moveTo(x, y - 40);
  mouse.down();
  for (let i = 0; i < 8; i++) {
    mouse.move(0, 10);
  }
  mouse.up();
};

/** a real pointer click on the toolbar button (keyboard activation differs) */
const pointerClickToolbarButton = (tool: "eraser") => {
  const button = GlobalTestState.renderResult.getByToolName(tool);
  fireEvent.pointerDown(button, { pointerType: "mouse" });
  fireEvent.click(button);
};

describe("partial eraser — through the editor", () => {
  // jsdom lays nothing out, so without this the editor's viewport is 0x0,
  // `app.visibleElements` is empty and a dragged eraser has nothing to hit
  beforeAll(() => {
    mockBoundingClientRect({});
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    mouse.reset();
  });

  it("toggles partial mode when the active eraser button is clicked", () => {
    expect(h.state.eraserMode).toBe("element");

    UI.clickTool("eraser");
    expect(h.state.activeTool.type).toBe("eraser");
    expect(h.state.eraserMode).toBe("element");

    pointerClickToolbarButton("eraser");
    expect(h.state.activeTool.type).toBe("eraser");
    expect(h.state.eraserMode).toBe("partial");

    pointerClickToolbarButton("eraser");
    expect(h.state.eraserMode).toBe("element");
  });

  it("explains the active eraser mode in the hint bar", () => {
    const hint = () =>
      h.app.ownerDocument.querySelector(".HintViewer")?.textContent ?? "";

    UI.clickTool("eraser");
    expect(hint()).toContain("revert the elements marked for deletion");

    pointerClickToolbarButton("eraser");
    expect(hint()).toContain("Erasing parts of pen strokes");
    expect(hint()).not.toContain("revert");
  });

  it("splits a stroke erased across its middle, as one undo step", () => {
    drawStroke(100, 100);
    const [original] = liveFreedraw();
    expect(liveFreedraw()).toHaveLength(1);
    const undoDepthBefore = API.getUndoStack().length;

    UI.clickTool("eraser");
    pointerClickToolbarButton("eraser");
    eraseAcross(150, 100);

    const fragments = liveFreedraw();
    expect(fragments).toHaveLength(2);
    expect(fragments.map((e) => e.id)).not.toContain(original.id);
    expect(h.elements.find((e) => e.id === original.id)?.isDeleted).toBe(true);
    // the whole drag is one history entry
    expect(API.getUndoStack().length).toBe(undoDepthBefore + 1);

    Keyboard.undo();
    expect(liveFreedraw().map((e) => e.id)).toEqual([original.id]);

    Keyboard.redo();
    expect(liveFreedraw()).toHaveLength(2);
    expect(liveFreedraw().map((e) => e.id)).not.toContain(original.id);
  });

  it("doesn't erase non-freedraw elements in partial mode", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 130,
      y: 80,
      width: 40,
      height: 40,
      backgroundColor: "#ffc9c9",
      fillStyle: "solid",
    });
    API.setElements([rect]);
    drawStroke(100, 200);

    UI.clickTool("eraser");
    pointerClickToolbarButton("eraser");
    eraseAcross(150, 100);
    eraseAcross(150, 200);

    expect(h.elements.find((e) => e.id === rect.id)?.isDeleted).toBe(false);
    expect(liveFreedraw()).toHaveLength(2);
  });

  it("still erases whole strokes in element mode", () => {
    drawStroke(100, 100);

    UI.clickTool("eraser");
    eraseAcross(150, 100);

    expect(liveFreedraw()).toHaveLength(0);
  });

  it("uses the eraser mode a host sets through updateScene", () => {
    drawStroke(100, 100);

    API.updateScene({ appState: { eraserMode: "partial" } });
    UI.clickTool("eraser");
    eraseAcross(150, 100);

    expect(liveFreedraw()).toHaveLength(2);
  });

  it("cuts a gap where a stroke is clicked without dragging", () => {
    drawStroke(100, 100);

    UI.clickTool("eraser");
    pointerClickToolbarButton("eraser");
    mouse.moveTo(150, 100);
    mouse.click();

    expect(liveFreedraw()).toHaveLength(2);
  });

  it("doesn't cut locked strokes", () => {
    drawStroke(100, 100);
    const [stroke] = liveFreedraw();
    API.updateElement(stroke as ExcalidrawElement, { locked: true });

    UI.clickTool("eraser");
    pointerClickToolbarButton("eraser");
    eraseAcross(150, 100);

    expect(liveFreedraw().map((e) => e.id)).toEqual([stroke.id]);
  });
});

describe("partial eraser — what an erased stroke leaves behind (docs/DESIGN.md §6)", () => {
  beforeAll(() => {
    mockBoundingClientRect({});
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("keeps the erased stroke's points in a saved file", async () => {
    const onExport = vi.fn(() => new Promise<void>(() => {}));
    await render(
      <Excalidraw handleKeyboardGlobally={true} onExport={onExport} />,
    );
    mouse.reset();
    drawStroke(100, 100);
    const [original] = liveFreedraw();

    UI.clickTool("eraser");
    pointerClickToolbarButton("eraser");
    eraseAcross(150, 100);

    act(() => {
      h.app.actionManager.executeAction(actionSaveFileToDisk);
    });
    await vi.waitFor(() => expect(onExport).toHaveBeenCalled());

    // what the save action hands to the file writer...
    const { elements, appState } = (onExport.mock.calls[0] as any)[1];
    // ...and what the file writer would serialize
    const saved = JSON.parse(serializeAsJSON(elements, appState, {}, "local"));
    const tombstone = saved.elements.find((e: any) => e.id === original.id);

    expect(tombstone).toBeDefined();
    expect(tombstone.isDeleted).toBe(true);
    expect(tombstone.points).toEqual(
      (original as typeof original & { points: unknown }).points,
    );
  });
});

describe("partial eraser — command palette", () => {
  it("toggles partial mode from the command palette", async () => {
    // the palette is opt-in for hosts; excalidraw-app renders it like this
    await render(
      <Excalidraw handleKeyboardGlobally={true}>
        <CommandPalette />
      </Excalidraw>,
    );
    act(() => {
      h.setState({ openDialog: { name: "commandPalette" } });
    });
    const item = await vi.waitFor(() => {
      const found = Array.from(
        h.app.ownerDocument.querySelectorAll(".command-item"),
      ).find((el) => el.textContent?.includes("Toggle partial eraser"));
      expect(found).toBeDefined();
      return found!;
    });

    fireEvent.click(item);

    expect(h.state.eraserMode).toBe("partial");
  });
});
