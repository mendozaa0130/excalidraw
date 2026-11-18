// Drives the running excalidraw-app dev server like a user to demonstrate
// the partial eraser. Start the app (`yarn start`, port 3001), then:
//   node docs/final-project/demo/demo.mjs docs/final-project/demo
import { createRequire } from "module";
import fs from "fs";

const require = createRequire(
  new URL("../../../package.json", import.meta.url),
);
const { chromium } = require("playwright");

const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 700 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto("http://localhost:3001");
await page.waitForSelector("canvas.interactive");
await page.waitForTimeout(1500);

const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });

const scene = () =>
  page.evaluate(() => {
    const els = window.h?.elements ?? [];
    return els
      .filter((e) => !e.isDeleted)
      .map((e) => `${e.type}:${e.id.slice(0, 6)}`);
  });

const drag = async (from, to, steps = 30) => {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(...to, { steps });
  await page.mouse.up();
};

// 1. draw a wavy freehand stroke
await page.click('[data-testid="toolbar-freedraw"]');
await page.mouse.move(300, 330);
await page.mouse.down();
for (let x = 300; x <= 900; x += 10) {
  await page.mouse.move(x, 330 + 25 * Math.sin((x - 300) / 40));
}
await page.mouse.up();

// 2. and a rectangle whose edges the eraser will also cross
await page.click('[data-testid="toolbar-rectangle"]');
await drag([560, 420], [700, 520], 10);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
console.log("before:", await scene());
await shot("1-before");

// 3. pick the eraser, then click its button again -> partial mode
await page.click('[data-testid="toolbar-eraser"]');
await page.waitForTimeout(200);
await page.click('[data-testid="toolbar-eraser"]');
await page.waitForTimeout(300);
console.log(
  "eraserMode:",
  await page.evaluate(() => window.h?.state.eraserMode),
  "| button label:",
  await page.getAttribute('[data-testid="toolbar-eraser"]', "aria-label"),
  "| hint:",
  await page.textContent(".HintViewer").catch(() => null),
);
await shot("2-partial-mode-selected");

// 4. drag the eraser down through the stroke and the rectangle
await drag([630, 260], [630, 560], 40);
await page.waitForTimeout(400);
console.log("after:", await scene());
await shot("3-after-partial-erase");

// 5. undo restores the original stroke in one step
await page.keyboard.press(
  process.platform === "darwin" ? "Meta+z" : "Control+z",
);
await page.waitForTimeout(400);
console.log("after undo:", await scene());
await shot("4-after-undo");

console.log("page errors:", errors.length ? errors : "none");
await browser.close();
