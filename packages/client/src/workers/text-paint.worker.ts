/**
 * The text-paint worker (`ui/text-painter.ts` owns it): paints label text on an `OffscreenCanvas` and sends back
 * `ImageBitmap`s. It copies the drawing half of Phaser's `Text.updateText` and measures nothing: every line arrives
 * with its position, so the label's size, which layout reads on the main thread, never waits for this.
 *
 * Like the card-face worker it needs the app's fonts, which a worker doesn't share with the page: `init` carries the
 * page's `@font-face` sources, and they are all loaded before `ready`. A worker that can't (no `OffscreenCanvas` 2D,
 * no `self.fonts`) says so, and the main thread paints every label itself.
 */
import type { FontSource } from "../art/card-face-protocol.js";
import type { PaintJob, TextPaintRequest, TextPaintResponse } from "../ui/text-paint-protocol.js";

/** The client compiles with the DOM lib, so this names the members of the worker global actually used. */
interface WorkerGlobal {
  postMessage(message: TextPaintResponse, transfer: Transferable[]): void;
  onmessage: ((event: MessageEvent<TextPaintRequest>) => void) | null;
  readonly fonts?: FontFaceSet;
}

const worker = self as unknown as WorkerGlobal;
let ready: Promise<void> | null = null;

async function loadFonts(fonts: readonly FontSource[]): Promise<void> {
  const set = worker.fonts;
  if (!set || typeof FontFace === "undefined") throw new Error("no FontFaceSet in workers");
  await Promise.all(
    fonts.map(async (source) => {
      const face = new FontFace(source.family, source.src, source.descriptors);
      set.add(face);
      await face.load();
    }),
  );
}

function capable(): string | null {
  if (typeof OffscreenCanvas === "undefined") return "no OffscreenCanvas";
  if (!new OffscreenCanvas(1, 1).getContext("2d")) return "no OffscreenCanvas 2D context";
  return null;
}

function syncShadow(context: OffscreenCanvasRenderingContext2D, job: PaintJob, enabled: boolean): void {
  if (enabled) {
    context.shadowOffsetX = job.shadow.offsetX;
    context.shadowOffsetY = job.shadow.offsetY;
    context.shadowColor = job.shadow.color;
    context.shadowBlur = job.shadow.blur;
  } else {
    // Phaser also sets `shadowColor = 0`, which is not a color and is ignored; with no offset and no blur nothing draws.
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;
    context.shadowBlur = 0;
  }
}

/** `Text.updateText`'s drawing, line for line. */
function paint(job: PaintJob): ImageBitmap {
  const canvas = new OffscreenCanvas(job.width, job.height);
  const context = canvas.getContext("2d")!;
  context.font = job.font;
  context.save();
  context.scale(job.resolution, job.resolution);
  if (job.background) {
    context.fillStyle = job.background;
    context.fillRect(0, 0, job.width, job.height);
  }
  context.textBaseline = "alphabetic";
  context.fillStyle = job.fill;
  context.strokeStyle = job.stroke;
  context.lineWidth = job.strokeThickness;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.translate(job.paddingLeft, job.paddingTop);
  for (const line of job.lines) {
    if (job.strokeThickness && job.letterSpacing === 0) {
      syncShadow(context, job, job.shadow.stroke);
      context.strokeText(line.text, line.x, line.y);
    }
    if (!job.fill) continue;
    syncShadow(context, job, job.shadow.fill);
    if (job.letterSpacing !== 0) {
      let charX = 0;
      for (const char of line.text.split("")) {
        if (job.strokeThickness) {
          syncShadow(context, job, job.shadow.stroke);
          context.strokeText(char, line.x + charX, line.y);
          syncShadow(context, job, job.shadow.fill);
        }
        context.fillText(char, line.x + charX, line.y);
        charX += context.measureText(char).width + job.letterSpacing;
      }
    } else {
      context.fillText(line.text, line.x, line.y);
    }
  }
  context.restore();
  return canvas.transferToImageBitmap();
}

function post(message: TextPaintResponse, transfer: Transferable[] = []): void {
  worker.postMessage(message, transfer);
}

worker.onmessage = (event: MessageEvent<TextPaintRequest>) => {
  const message = event.data;
  if (message.type === "init") {
    const problem = capable();
    if (problem) {
      post({ type: "ready", ok: false, reason: problem });
      return;
    }
    ready = loadFonts(message.fonts);
    ready.then(
      () => post({ type: "ready", ok: true }),
      (error: unknown) => post({ type: "ready", ok: false, reason: String(error) }),
    );
    return;
  }
  void (ready ?? Promise.reject(new Error("not initialised"))).then(
    () => {
      const results: { id: number; bitmap: ImageBitmap }[] = [];
      const failed: number[] = [];
      for (const job of message.jobs) {
        try {
          results.push({ id: job.id, bitmap: paint(job) });
        } catch {
          failed.push(job.id);
        }
      }
      if (results.length > 0)
        post(
          { type: "painted", results },
          results.map((result) => result.bitmap),
        );
      if (failed.length > 0) post({ type: "failed", ids: failed, reason: "paint threw" });
    },
    () => post({ type: "failed", ids: message.jobs.map((job) => job.id), reason: "no fonts" }),
  );
};
