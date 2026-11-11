/**
 * The generated card face: what a card shows when it has no picture (a pack that ships none, a picture still on its
 * way, a 404). Drawn from the card's own record, never from a scan: a header strip with the cost chip, the name and the
 * type line, the stat line in words (ATK 3, never color alone), traits, the rules text, and the resource pips. The
 * Mod Store's tiles and galleries use it, so a pack without art is still a pack of readable cards.
 *
 * It scales from a 96 px gallery tile to a 300 px hero, with the text sizes following the width.
 */
import Phaser from "phaser";
import type { AnyCard } from "@mc/content";
import type { CardFace } from "../art/art-source.js";
import { signal, surface, typeRole } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import { cardInspectModel, type InspectModel } from "../view/inspect-model.js";
import { textStyle } from "./theme.js";
import { fitText, fitWrapped } from "./widgets.js";

/** The glyph a resource pip carries, so its type survives colorblindness and a 10 px chip. */
const PIP_GLYPH = { physical: "P", mental: "M", energy: "E", wild: "*" } as const;

/** The part of an `InspectModel` the face reads. */
export type GeneratedFaceModel = Pick<
  InspectModel,
  "name" | "typeLine" | "cost" | "traits" | "rulesText" | "resourceIcons"
> & { readonly stats: readonly { readonly label: string; readonly value: string }[] };

type StatSource = Record<string, unknown>;
const isObject = (v: unknown): v is StatSource => typeof v === "object" && v !== null;

/**
 * The printed stats of a record, for a face with no game behind it (the inspect model only fills stats from a live
 * character): a hero's side, an ally, a minion or a villain's first stage. A per-player HP reads "12/P".
 */
export function printedStatsOf(card: AnyCard, face: CardFace): { label: string; value: string }[] {
  const raw = card as unknown as StatSource;
  let from: StatSource = raw;
  if (face.kind === "hero" && isObject(raw.hero)) from = { ...raw.hero, hp: raw.hp };
  else if (face.kind === "alterEgo" && isObject(raw.alterEgo)) from = { ...raw.alterEgo, hp: raw.hp };
  else if (face.kind === "villainStage" && Array.isArray(raw.sides)) {
    const stage = (raw.sides as StatSource[])[face.sideIndex]?.stages;
    from = Array.isArray(stage) && isObject(stage[face.stageIndex]) ? (stage[face.stageIndex] as StatSource) : raw;
  }
  const value = (v: unknown): string | null => {
    if (typeof v === "number") return String(v);
    if (isObject(v) && typeof v.perPlayer === "number" && v.perPlayer > 0) return `${v.perPlayer}/P`;
    if (isObject(v) && typeof v.base === "number") return String(v.base);
    return null;
  };
  const fields: [string, unknown][] = [
    ["ATK", from.atk],
    ["THW", from.thw],
    ["DEF", from.def],
    ["SCH", from.sch],
    ["REC", from.rec],
    ["HP", from.hp ?? from.hitPoints],
  ];
  return fields.flatMap(([label, v]) => {
    const text = value(v);
    return text === null ? [] : [{ label, value: text }];
  });
}

/** The face's model for a record, which may come from an untrusted preview: a card the model cannot read shows its name. */
export function faceModelOf(card: AnyCard, face: CardFace): GeneratedFaceModel {
  try {
    const model = cardInspectModel(card, face);
    return model.stats.length > 0 ? model : { ...model, stats: printedStatsOf(card, face) };
  } catch {
    return { name: card.name, typeLine: "", cost: null, stats: [], traits: [], rulesText: "", resourceIcons: [] };
  }
}

/** The stat line: "ATK 3 · THW 1 · DEF 2 · HP 12". */
export function statLineOf(stats: GeneratedFaceModel["stats"]): string {
  return stats.map((stat) => `${stat.label} ${stat.value}`).join("  ·  ");
}

/** The size a face's text scale takes from its width: 1 at 150 px wide. */
export const faceScaleOf = (width: number): number => Math.max(0.62, Math.min(1.8, width / 150));

/** Draws the face into `rect` and returns every object, for the caller to put in a list row. */
export function drawGeneratedFace(
  scene: Phaser.Scene,
  rect: Rect,
  model: GeneratedFaceModel,
): Phaser.GameObjects.GameObject[] {
  const objects: Phaser.GameObjects.GameObject[] = [];
  const s = faceScaleOf(rect.width);
  const pad = Math.max(3, Math.round(5 * s));
  const g = scene.add.graphics();
  g.fillStyle(surface.paper.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  objects.push(g);

  // Header: cost chip, then the name.
  const headerH = Math.round(Math.max(18, 24 * s));
  let nameX = rect.x + pad;
  if (model.cost !== null) {
    const chipW = Math.round(headerH * 0.85);
    g.fillStyle(signal.cost.hex, 1).fillRect(rect.x, rect.y, chipW, headerH);
    const cost = scene.add
      .text(
        rect.x + chipW / 2,
        rect.y + headerH / 2,
        String(model.cost),
        textStyle(typeRole.statSmall, surface.paper.hex),
      )
      .setOrigin(0.5)
      .setFontSize(Math.round(14 * s));
    objects.push(cost);
    nameX = rect.x + chipW + pad;
  }
  const name = scene.add
    .text(nameX, rect.y + headerH / 2, model.name, textStyle({ ...typeRole.rowTitle, weight: 800 }, surface.ink.hex))
    .setOrigin(0, 0.5);
  fitText(name, rect.x + rect.width - nameX - pad, Math.round(13 * s));
  objects.push(name);
  g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y + headerH, rect.width, 2);

  let y = rect.y + headerH + 2 + Math.round(3 * s);
  const wrap = rect.width - pad * 2;
  const line = (text: string, size: number, alpha: number, lines: number, weight: 400 | 700 | 800 = 700): number => {
    if (text === "") return 0;
    const t = scene.add
      .text(rect.x + pad, y, text, textStyle({ ...typeRole.body, weight }, surface.ink.hex, alpha))
      .setFontSize(size);
    fitWrapped(t, wrap, lines, size);
    objects.push(t);
    const height = t.height + Math.round(2 * s);
    y += height;
    return height;
  };
  line(model.typeLine, Math.round(9 * s), 0.8, 1);
  line(statLineOf(model.stats), Math.round(9 * s), 1, 2, 800);
  line(model.traits.join(" · "), Math.round(8 * s), 0.75, 1);

  // Resource pips along the foot; the rules text takes what is left above them.
  const pip = Math.round(Math.max(10, 13 * s));
  const pipsH = model.resourceIcons.length > 0 ? pip + pad : 0;
  model.resourceIcons.slice(0, 6).forEach((icon, index) => {
    const x = rect.x + pad + index * (pip + 3);
    const y0 = rect.y + rect.height - pad - pip;
    g.fillStyle(signal.cost.hex, 1).fillRect(x, y0, pip, pip);
    objects.push(
      scene.add
        .text(x + pip / 2, y0 + pip / 2, PIP_GLYPH[icon], textStyle(typeRole.label, surface.paper.hex))
        .setOrigin(0.5)
        .setFontSize(Math.round(8 * s)),
    );
  });
  const rulesH = rect.y + rect.height - pad - pipsH - y;
  const rulesSize = Math.max(7, Math.round(8.5 * s));
  if (rulesH > 8 && model.rulesText) {
    const rules = scene.add
      .text(rect.x + pad, y + 2, model.rulesText, textStyle({ ...typeRole.body, weight: 400 }, surface.ink.hex, 0.95))
      .setFontSize(rulesSize)
      .setWordWrapWidth(wrap, true)
      .setMaxLines(Math.max(1, Math.floor(rulesH / (rulesSize * 1.6))));
    objects.push(rules);
  }
  g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
  return objects;
}
