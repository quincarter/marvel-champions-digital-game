/**
 * A link as a QR code: dark modules on a light ground with a four-module quiet zone, so a phone camera reads it
 * against a dark panel. Whole pixels per module keep the edges sharp. Shared by the Send screen (`scenes/save-data.ts`)
 * and the device-sync link screen (`scenes/sync-data.ts`).
 */
import type Phaser from "phaser";
import { encode } from "uqr";
import { surface } from "../tokens.js";

export function drawQr(scene: Phaser.Scene, text: string, x: number, y: number, size: number): void {
  const { data } = encode(text, { ecc: "M", border: 0 });
  const cell = Math.max(1, Math.floor(size / (data.length + 8)));
  const drawn = cell * (data.length + 8);
  const left = x + Math.floor((size - drawn) / 2);
  const graphics = scene.add.graphics();
  graphics.fillStyle(surface.paper.hex, 1).fillRect(left, y, drawn, drawn);
  graphics.fillStyle(surface.ink.hex, 1);
  data.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (dark) graphics.fillRect(left + (c + 4) * cell, y + (r + 4) * cell, cell, cell);
    }),
  );
}
