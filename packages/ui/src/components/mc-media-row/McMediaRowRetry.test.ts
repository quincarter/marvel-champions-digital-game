import { afterEach, describe, expect, it } from "vitest";
import "./mc-media-row.js";
import type { McMediaRow } from "./McMediaRow.js";
import type { McPictureTile } from "../mc-picture-tile/McPictureTile.js";

afterEach(() => document.body.replaceChildren());

async function row(props: Partial<McMediaRow>): Promise<McMediaRow> {
  const el = document.createElement("mc-media-row");
  Object.assign(el, { heading: "Pack", src: "blob:a", letter: "P", ...props });
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const tileOf = (el: McMediaRow): McPictureTile => el.shadowRoot!.querySelector("mc-picture-tile")!;

describe("mc-media-row naming where its picture came from", () => {
  it("gives the tile the picture as one value, with its retry key, so a stale pack URL is asked for again", async () => {
    const el = await row({ retry: "pack-art:x:cover.webp" });
    expect(tileOf(el).picture).toEqual({ src: "blob:a", missing: "P", retry: "pack-art:x:cover.webp" });
  });

  it("keeps the focal point of a cropped picture", async () => {
    const el = await row({ retry: "k", fit: "cover", focusX: 0.2, focusY: 0.7 });
    expect(tileOf(el).picture).toMatchObject({ cover: { x: 0.2, y: 0.7, centered: false } });
  });

  it("passes the plain properties when it names no source", async () => {
    const el = await row({});
    expect(tileOf(el).picture).toBeNull();
    expect(tileOf(el).src).toBe("blob:a");
  });
});
