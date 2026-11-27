/**
 * What the controller drawing says (`view/controller-shapes.ts`, drawn by `dom/controller-sheet.ts`): the button label
 * each `$` reference stands for on a pad family, and the drawing's own captions in the player's language.
 */
import { t } from "../i18n/translate.js";
import type { DrawingKind } from "./controls-rows.js";
import { padGlyphOf, type PadFamily } from "./pad-family.js";

/** The drawing's labels by the reference the shapes use. */
export const LABEL_INDEX: Readonly<Record<string, number>> = {
  $f0: 0,
  $f1: 1,
  $f2: 2,
  $f3: 3,
  $lb: 4,
  $rb: 5,
  $lt: 6,
  $rt: 7,
  $view: 8,
  $menu: 9,
};

/** The drawing's own captions, in the current language (`controls.drawing.*`). */
const DRAWING_TEXT: Readonly<Record<string, () => string>> = {
  "Prev zone": () => t("controls.drawing.prevZone"),
  "Next zone": () => t("controls.drawing.nextZone"),
  "hold: actions": () => t("controls.drawing.holdActions"),
  "hold: abilities": () => t("controls.drawing.holdAbilities"),
  Trackpad: () => t("controls.drawing.trackpad"),
  "Back buttons (dashed): set them in Steam Input": () => t("controls.drawing.backButtons"),
  "STEAM and QUICK stay Steam's. Steam + X opens its keyboard.": () => t("controls.drawing.steamKeys"),
};

export function labelOf(ref: string, family: PadFamily): string {
  const index = LABEL_INDEX[ref];
  if (index === undefined) return DRAWING_TEXT[ref]?.() ?? ref;
  return padGlyphOf(family, index)?.label ?? "";
}

/** Controllers drawn from a picture instead of vector shapes (`public/assets/controllers/`). */
const IMAGE_FILES: Readonly<Record<"xbox" | "playstation" | "switch", string>> = {
  xbox: "xbox.png",
  switch: "switch.png",
  playstation: "playstation.png",
};

export const controllerImageUrl = (src: "xbox" | "playstation" | "switch"): string =>
  `${import.meta.env.BASE_URL}assets/controllers/${IMAGE_FILES[src]}`;

/** Which picture a pad kind's drawing uses, or null for a vector one. */
export function controllerPictureOf(kind: DrawingKind): "xbox" | "playstation" | "switch" | null {
  return kind === "xbox" ? "xbox" : kind === "playstation" ? "playstation" : kind === "nintendo" ? "switch" : null;
}
