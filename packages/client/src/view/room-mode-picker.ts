/**
 * The room host's game mode picker: three box-art tiles (Standard, Epic, Competitive) and what the mode in focus is
 * about. Plain data and layout math only; `scenes/room-mode-picker.ts` draws it. What a mode does when chosen stays
 * with the lobby (`scenes/room-lobby.ts`): this only says which mode, and how it is described.
 *
 * Three layouts, by screen width:
 * - `side` (900 and up, desktop and landscape tablet): tiles in a row on the left, the info panel beside them.
 * - `strip` (600 to 899, a portrait tablet): bigger tiles across the top, the info panel in a wide strip under them.
 * - `compact` (a phone): small tiles across the top, the info strip under them with a notch up to the tile it
 *   describes, so the tile reads as having opened.
 */
import type { MessageKey } from "../i18n/translate.js";
import { hit } from "../tokens.js";
import type { Rect } from "./layout.js";

export type RoomModeId = "standard" | "epic" | "competitive";
export const ROOM_MODES: readonly RoomModeId[] = ["standard", "epic", "competitive"];

export interface RoomModeCopy {
  readonly title: MessageKey;
  readonly tagline: MessageKey;
  readonly facts: readonly { readonly label: MessageKey; readonly text: MessageKey }[];
  /** The scenarios whose villain art fronts the box; two split the box across its middle. */
  readonly art: readonly string[];
}

const facts = (id: RoomModeId): RoomModeCopy["facts"] => [
  { label: "room.modes.who", text: `room.modes.${id}.who` as MessageKey },
  { label: "room.modes.how", text: `room.modes.${id}.how` as MessageKey },
  { label: "room.modes.different", text: `room.modes.${id}.different` as MessageKey },
  { label: "room.modes.length", text: `room.modes.${id}.length` as MessageKey },
];

export const ROOM_MODE_COPY: Readonly<Record<RoomModeId, RoomModeCopy>> = {
  standard: {
    title: "epic.mode.standard",
    tagline: "room.modes.standard.tagline",
    facts: facts("standard"),
    art: ["rhino"],
  },
  epic: {
    title: "epic.mode.epic",
    tagline: "room.modes.epic.tagline",
    facts: facts("epic"),
    art: ["god-of-lies"],
  },
  competitive: {
    title: "comp.mode.competitive",
    tagline: "room.modes.competitive.tagline",
    facts: facts("competitive"),
    art: ["registration-iron-man", "resistance-captain-america"],
  },
};

/** The mode the info panel shows: what the pointer or focus is over, else the one picked. */
export const modeInFocus = (picked: RoomModeId, over: RoomModeId | null): RoomModeId => over ?? picked;

export type ModePickerKind = "side" | "strip" | "compact";

export interface ModePickerLayout {
  readonly kind: ModePickerKind;
  readonly box: Rect;
  readonly title: Rect;
  readonly tiles: readonly Rect[];
  readonly info: Rect;
  readonly confirm: Rect;
  readonly cancel: Rect;
  /** The tile shows its tagline under the title only when it is wide enough to read. */
  readonly tagline: boolean;
}

export const kindOfWidth = (width: number): ModePickerKind =>
  width >= 900 ? "side" : width >= 600 ? "strip" : "compact";

const GAP = 12;

export function modePickerLayout(width: number, height: number): ModePickerLayout {
  const kind = kindOfWidth(width);
  const margin = width < 500 ? 8 : 16;
  const boxW = kind === "side" ? Math.min(1160, width - margin * 2) : width - margin * 2;
  const boxH = kind === "side" ? Math.min(height - margin * 2, 620) : height - margin * 2;
  const box: Rect = {
    x: Math.round((width - boxW) / 2),
    y: Math.round((height - boxH) / 2),
    width: boxW,
    height: boxH,
  };
  const titleH = kind === "compact" ? 44 : 56;
  const title: Rect = { x: box.x, y: box.y, width: box.width, height: titleH };
  const footerH = hit.target + GAP;
  const pad = kind === "compact" ? 8 : GAP;
  const body: Rect = {
    x: box.x + pad,
    y: box.y + titleH + pad,
    width: box.width - pad * 2,
    height: box.height - titleH - footerH - pad * 2,
  };
  const cancelW = Math.round((box.width - pad * 2 - GAP) * 0.4);
  const buttonY = box.y + box.height - footerH + GAP / 2 - 2;
  const cancel: Rect = { x: box.x + pad, y: buttonY, width: cancelW, height: hit.target };
  const confirm: Rect = {
    x: cancel.x + cancelW + GAP,
    y: buttonY,
    width: box.width - pad * 2 - cancelW - GAP,
    height: hit.target,
  };

  const row = (area: Rect, tileH: number): Rect[] => {
    const w = Math.floor((area.width - GAP * 2) / 3);
    return [0, 1, 2].map((i) => ({ x: area.x + i * (w + GAP), y: area.y, width: w, height: tileH }));
  };

  if (kind === "side") {
    const tilesW = Math.round(body.width * 0.62);
    const w = Math.floor((tilesW - GAP * 2) / 3);
    const tileH = Math.min(body.height, Math.round(w * 1.7));
    const tiles = row({ ...body, width: tilesW }, tileH).map((r) => ({
      ...r,
      y: body.y + Math.round((body.height - tileH) / 2),
    }));
    const infoX = body.x + tilesW + GAP * 1.5;
    return {
      kind,
      box,
      title,
      tiles,
      info: { x: infoX, y: body.y, width: body.x + body.width - infoX, height: body.height },
      confirm,
      cancel,
      tagline: true,
    };
  }

  const w = Math.floor((body.width - GAP * 2) / 3);
  const tileH = Math.min(
    Math.round(w * (kind === "compact" ? 1.5 : 1.5)),
    Math.round(body.height * (kind === "compact" ? 0.45 : 0.5)),
  );
  const tiles = row(body, tileH);
  const infoY = body.y + tileH + (kind === "compact" ? 12 : 16);
  return {
    kind,
    box,
    title,
    tiles,
    info: { x: body.x, y: infoY, width: body.width, height: body.y + body.height - infoY },
    confirm,
    cancel,
    tagline: w >= 150,
  };
}

/** A tile split into its picture and the title band along its foot. */
export function tileParts(tile: Rect, tagline: boolean): { readonly art: Rect; readonly band: Rect } {
  const bandH = Math.round(Math.max(40, tile.height * (tagline ? 0.3 : 0.22)));
  return {
    art: { x: tile.x, y: tile.y, width: tile.width, height: tile.height - bandH },
    band: { x: tile.x, y: tile.y + tile.height - bandH, width: tile.width, height: bandH },
  };
}
