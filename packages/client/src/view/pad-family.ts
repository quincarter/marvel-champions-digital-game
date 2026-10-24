/**
 * Which controller is attached, and what its buttons are called.
 *
 * The Web Gamepad API's "standard" layout reports buttons by position (index 0 is the bottom face button on every
 * pad), so the intent table in `view/gamepad.ts` is positional. What differs between pads is only the label printed
 * on each position, and that is all this module answers: a family from `Gamepad.id`, and the glyph for an index in
 * that family. Pure data, so it is testable with the id strings real browsers report.
 *
 * Owner decisions (2026-10-24, `docs/controller-support.md`):
 *  - Under Steam (the Steam Deck, or any game launched through Steam Input) the pad is Steam's virtual Xbox pad, and
 *    Steam's own "Use Nintendo layout" option already swaps buttons for us, so we take what it sends as it is.
 *  - Everywhere else the player gets our own "Use Nintendo Switch layout" setting: on a Nintendo-family pad, buttons
 *    act by their printed label (A, on the right, confirms; B, at the bottom, backs out), as on a Switch.
 */

/** The three label sets a pad can carry. A handheld (Steam Deck, ROG Ally, Legion Go) uses the Xbox labels. */
export type PadFamily = "xbox" | "playstation" | "nintendo";
export const PAD_FAMILY_VALUES: readonly PadFamily[] = ["xbox", "playstation", "nintendo"];

/** The glyph-family setting: follow detection, or the player's choice when detection is wrong. */
export type PadFamilySetting = "auto" | PadFamily;
export const PAD_FAMILY_SETTING_VALUES: readonly PadFamilySetting[] = ["auto", ...PAD_FAMILY_VALUES];

export interface PadIdentity {
  readonly family: PadFamily;
  /** Steam Input's virtual pad (the Steam Deck, or a game started through Steam): take its buttons as they come. */
  readonly steam: boolean;
  /** A handheld PC's built-in controls: drawn as a handheld on the Controls screen. */
  readonly handheld: boolean;
}

const VENDOR_FAMILY: Readonly<Record<string, PadFamily>> = {
  "045e": "xbox", // Microsoft
  "054c": "playstation", // Sony
  "057e": "nintendo", // Nintendo (an 8BitDo pad in Switch mode reports as a Pro Controller)
  "28de": "xbox", // Valve: the Steam Deck and Steam Input's virtual pad
};

/** An 8BitDo product name that says it is the Switch-layout model. */
const EIGHTBITDO_SWITCH = /switch|\bns\b|\bpro\b/;

/** Valve product ids for the Steam Deck's own controls. */
const STEAM_DECK_PRODUCTS = new Set(["1205"]);

/**
 * The vendor and product ids in a `Gamepad.id`, in the forms browsers use: Chromium's "(… Vendor: 054c Product:
 * 0ce6)" and Firefox's "054c-0ce6-DualSense…". Lowercase, or null when the id carries none (Chromium's XInput ids,
 * Safari's plain names).
 */
export function vendorProductOf(id: string): { readonly vendor: string; readonly product: string } | null {
  const chromium = /vendor:\s*([0-9a-f]{4})\s+product:\s*([0-9a-f]{4})/i.exec(id);
  if (chromium) return { vendor: chromium[1]!.toLowerCase(), product: chromium[2]!.toLowerCase() };
  const firefox = /^([0-9a-f]{1,4})-([0-9a-f]{1,4})-/i.exec(id);
  if (firefox)
    return { vendor: firefox[1]!.toLowerCase().padStart(4, "0"), product: firefox[2]!.toLowerCase().padStart(4, "0") };
  return null;
}

/** What a connected pad is, from its `Gamepad.id`. An unknown pad is treated as Xbox, the layout most pads copy. */
export function detectPad(id: string): PadIdentity {
  const name = id.toLowerCase();
  const ids = vendorProductOf(id);
  const steam = ids?.vendor === "28de" || name.includes("steam");
  const handheld =
    (ids?.vendor === "28de" && STEAM_DECK_PRODUCTS.has(ids.product)) || /steam deck|rog ally|legion go|claw/.test(name);
  if (steam) return { family: "xbox", steam: true, handheld };
  // 8BitDo's own ids (its D-input modes) name the layout only in the product name; X-input mode reports as Xbox.
  if (ids?.vendor === "2dc8") return { family: EIGHTBITDO_SWITCH.test(name) ? "nintendo" : "xbox", steam, handheld };
  const byVendor = ids ? VENDOR_FAMILY[ids.vendor] : undefined;
  if (byVendor) return { family: byVendor, steam: false, handheld };
  if (/dualsense|dualshock|playstation|^wireless controller/.test(name))
    return { family: "playstation", steam, handheld };
  if (name.startsWith("8bitdo") && !EIGHTBITDO_SWITCH.test(name)) return { family: "xbox", steam, handheld };
  if (/pro controller|joy-con|nintendo|switch/.test(name)) return { family: "nintendo", steam, handheld };
  return { family: "xbox", steam, handheld };
}

/** The family glyphs are drawn in: the player's setting, else what was detected, else Xbox. */
export function resolvePadFamily(setting: PadFamilySetting, detected: PadIdentity | null): PadFamily {
  return setting === "auto" ? (detected?.family ?? "xbox") : setting;
}

/** True when buttons act by their Nintendo label: our setting is on, the family is Nintendo, and Steam isn't driving. */
export function usesNintendoSwap(family: PadFamily, nintendoLayout: boolean, detected: PadIdentity | null): boolean {
  return nintendoLayout && family === "nintendo" && detected?.steam !== true;
}

/**
 * The standard-layout index whose meaning a press on `index` takes. With the Nintendo swap the face buttons trade
 * places (bottom with right, left with top), so a press on the right button (A on a Switch) acts as the bottom one
 * (confirm). The swap is its own inverse, so this also maps an intent's bound index to the button to draw.
 */
export function physicalIndexOf(index: number, swap: boolean): number {
  if (!swap) return index;
  return index === 0 ? 1 : index === 1 ? 0 : index === 2 ? 3 : index === 3 ? 2 : index;
}

/** How a glyph is drawn: a round face button, a shoulder or trigger pill, a small system button, a stick or the D-pad. */
export type GlyphShape = "face" | "shoulder" | "trigger" | "system" | "stick" | "dpad";

export interface PadGlyph {
  /** The printed label, or a symbol for PlayStation's face buttons. */
  readonly label: string;
  readonly shape: GlyphShape;
  /** Spoken / long name, for a Controls row ("Right trigger"). */
  readonly name: string;
}

const FACE: Readonly<Record<PadFamily, readonly [string, string, string, string]>> = {
  // Indices 0 bottom, 1 right, 2 left, 3 top.
  xbox: ["A", "B", "X", "Y"],
  playstation: ["✕", "○", "□", "△"],
  nintendo: ["B", "A", "Y", "X"],
};

const SHOULDERS: Readonly<Record<PadFamily, readonly [string, string, string, string]>> = {
  xbox: ["LB", "RB", "LT", "RT"],
  playstation: ["L1", "R1", "L2", "R2"],
  nintendo: ["L", "R", "ZL", "ZR"],
};

const SYSTEM: Readonly<Record<PadFamily, readonly [string, string]>> = {
  // View / Select, Menu / Start.
  xbox: ["View", "Menu"],
  playstation: ["Create", "Options"],
  nintendo: ["−", "+"],
};

/** The glyph printed at a standard-layout index on this family's pad, or null for an index the layout doesn't name. */
export function padGlyphOf(family: PadFamily, index: number): PadGlyph | null {
  const face = FACE[family];
  const shoulders = SHOULDERS[family];
  const system = SYSTEM[family];
  switch (index) {
    case 0:
    case 1:
    case 2:
    case 3:
      return { label: face[index]!, shape: "face", name: `${face[index]} button` };
    case 4:
      return { label: shoulders[0], shape: "shoulder", name: "Left bumper" };
    case 5:
      return { label: shoulders[1], shape: "shoulder", name: "Right bumper" };
    case 6:
      return { label: shoulders[2], shape: "trigger", name: "Left trigger" };
    case 7:
      return { label: shoulders[3], shape: "trigger", name: "Right trigger" };
    case 8:
      return { label: system[0], shape: "system", name: system[0] };
    case 9:
      return { label: system[1], shape: "system", name: system[1] };
    case 10:
      return { label: "L3", shape: "stick", name: "Left stick press" };
    case 11:
      return { label: "R3", shape: "stick", name: "Right stick press" };
    case 12:
      return { label: "▲", shape: "dpad", name: "D-pad up" };
    case 13:
      return { label: "▼", shape: "dpad", name: "D-pad down" };
    case 14:
      return { label: "◀", shape: "dpad", name: "D-pad left" };
    case 15:
      return { label: "▶", shape: "dpad", name: "D-pad right" };
    default:
      // A browser that reports more buttons than the standard 17 (a handheld's back buttons, rarely): "Extra 1", …
      return index > 16 ? { label: `E${index - 16}`, shape: "system", name: `Extra ${index - 16}` } : null;
  }
}

/** The family's display name for a toast or a Controls heading. */
export function padFamilyName(family: PadFamily): string {
  return family === "xbox" ? "Xbox" : family === "playstation" ? "PlayStation" : "Nintendo Switch";
}
