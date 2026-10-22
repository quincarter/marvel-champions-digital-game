/**
 * Beat builders for a lettered comic page: one wide and one phone beat per panel rectangle, shared by every story file
 * that reads a page whose balloons are printed in the art (MojoMania's two pages, Shadowland's six).
 */
import type { ComicBeat } from "./story.js";

/**
 * The reading areas the beats are framed for: a 1440x900 window's is 1440x705 (2.04:1) and a 390x844 phone's 390x680
 * (0.574:1). The reader's camera (`view/comic-pan.ts`'s `cinematicCameraPlan`) fills the area with the beat's
 * rectangle and pans along whatever overflows, so a rectangle of another shape gets its far edge cut at rest: that
 * is what clipped the balloons that sit hard against (or cross) these pages' panel borders. Each beat is therefore the
 * panel with a 4% margin, widened (or heightened) around its center to the area's own shape, clamped inside the
 * page, which shows a slice of the neighboring panel instead of cutting a balloon. A tablet's area is close enough
 * that its pan is a few percent.
 */
const WIDE_AREA = 1440 / 705;
const NARROW_AREA = 390 / 680;
const MARGIN = 1.04;

const framedOn =
  (pageWidth: number, pageHeight: number) =>
  (x: number, y: number, w: number, h: number, aspect: number): ComicBeat["panel"] => {
    let nw = w * MARGIN;
    let nh = h * MARGIN;
    if (nw / nh > aspect) nh = nw / aspect;
    else nw = nh * aspect;
    // A page too small to hold the shape gives up the shape, never the panel.
    nw = Math.min(nw, pageWidth);
    nh = Math.min(nh, pageHeight);
    const left = Math.max(0, Math.min(pageWidth - nw, x + w / 2 - nw / 2));
    const top = Math.max(0, Math.min(pageHeight - nh, y + h / 2 - nh / 2));
    return { x: Math.round(left), y: Math.round(top), w: Math.round(nw), h: Math.round(nh) };
  };

/** One lettered panel as the beats a wide area and a phone each read it by (the page's own balloons are the story). */
export const beatsOn =
  (pageWidth: number, pageHeight: number) =>
  (x: number, y: number, w: number, h: number, only?: "wide" | "narrow"): ComicBeat[] => {
    const framed = framedOn(pageWidth, pageHeight);
    // `show` is the panel's own border: the widened framing's slivers of the neighbors are covered (`ComicBeat.show`).
    const show = { x, y, w, h };
    const wide: ComicBeat = { panel: framed(x, y, w, h, WIDE_AREA), show, lines: [], wideOnly: true };
    const narrow: ComicBeat = { panel: framed(x, y, w, h, NARROW_AREA), show, lines: [], narrowOnly: true };
    return only === "wide" ? [wide] : only === "narrow" ? [narrow] : [wide, narrow];
  };

/** The closing beat that pulls back to the whole page: it is the page's own shape, so it is not reframed. */
export const wholePage = (pageWidth: number, pageHeight: number): ComicBeat => ({
  panel: { x: 0, y: 0, w: pageWidth, h: pageHeight },
  lines: [],
  wideOnly: true,
});
