/**
 * Draws the docked defend decision (B1 / TB1 / TB3 in `artifacts/design-screenshots/villain-phase/`) into the villain
 * phase's panel: the attack's matchup, one card per defender with the damage range the engine reports, the stack, and
 * CONFIRM. Every number is `view/defend-choice.ts`'s (the engine's `defendPreview`), the same model the full-screen
 * sheet draws; the geometry is `view/villain-defend-layout.ts`'s. This file paints and wires the presses.
 */
import Phaser from "phaser";
import { cardOf, type GameState, type InstanceId } from "@mc/engine";
import { CARD_BACKS, artFor } from "../art/art-source.js";
import { cardArt, drawArt } from "../art/card-art.js";
import type { FocusStop } from "../scenes/focus-route.js";
import { accent, border, ink, signal, surface, typeRole } from "../tokens.js";
import { faceOf } from "../view/board-model.js";
import type { DefendChoiceView, DefendOptionView } from "../view/defend-choice.js";
import { defendMiddleLayout } from "../view/defend-choice-layout.js";
import type { Rect } from "../view/layout.js";
import { villainDefendOptionParts, type VillainDefendLayout } from "../view/villain-defend-layout.js";
import { textStyle } from "./theme.js";
import { McButton, fitText, label, paintPanel } from "./widgets.js";

export interface DefendPanelArgs {
  readonly layout: VillainDefendLayout;
  readonly view: DefendChoiceView;
  readonly game: GameState;
  /** The option picked so far, or null. */
  readonly selected: string | null;
  readonly onSelect: (optionId: string) => void;
  readonly onConfirm: () => void;
  /** EXPAND: the full-screen sheet instead. */
  readonly onExpand: () => void;
  readonly expandLabel: string;
  /** HIDE ▸ or PEEK AT TABLE ▾: the phase tucked away so the whole table shows (#231). */
  readonly onTuck: () => void;
  readonly tuckLabel: string;
  /** The action bar's rectangle when CONFIRM is drawn there (a tabbed layout): painted as ink under the button. */
  readonly footer?: Rect | null;
  readonly buttons: McButton[];
  /** The deciding seat, named in the header when more than one seat is playing (hot-seat: "your" is whoever holds the device). */
  readonly decider?: string | null;
}

/** Below this a caption is not read at a glance across a phone; the tag then says less, larger. */
const TAG_READABLE_SIZE = 12;

/** "Villain phase · step 2 — the villain activates" as the mockups set it: "VILLAIN PHASE · STEP 2 · THE VILLAIN ACTIVATES". */
export const defendEyebrowOf = (eyebrow: string): string => eyebrow.replace(/\s+—\s+/, " · ").toUpperCase();

/** "2–5 damage" as the cards set it: "2–5 DMG". */
export const defendDamageOf = (headline: string): string => headline.replace(/\s*damage$/i, " DMG").toUpperCase();

/** "5–8 of 10 HP" as the cards set it: "5–8 OF 10 HP LEFT". */
export const defendHpLeftOf = (hpAfter: string): string => `${hpAfter.toUpperCase()} LEFT`;

export function drawVillainDefendPanel(scene: Phaser.Scene, args: DefendPanelArgs): Map<string, FocusStop> {
  const { layout, view, game } = args;
  const stops = new Map<string, FocusStop>();
  const compact = layout.compact;

  const ground = scene.add.graphics();
  ground
    .fillStyle(surface.ink.hex, 1)
    .fillRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);
  ground.lineStyle(border.object, surface.paper.hex, 1);
  ground.strokeRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);

  // Header.
  const cause = view.summary.cause;
  const eyebrow = label(
    scene,
    layout.eyebrow.x,
    layout.eyebrow.y,
    args.decider ? `${args.decider.toUpperCase()} · ${defendEyebrowOf(cause.eyebrow)}` : defendEyebrowOf(cause.eyebrow),
    { ...typeRole.label, size: compact ? 9 : 11 },
    cause.kind === "cardEffect" ? signal.caution.hex : surface.paper.hex,
    1,
  );
  fitText(eyebrow, layout.eyebrow.width, compact ? 9 : 11);
  const title = scene.add
    .text(
      layout.title.x,
      layout.title.y,
      `${view.summary.attackerName} attacks ${view.summary.targetName}`.toUpperCase(),
      textStyle({ ...typeRole.screenTitle }, accent.heroRed.hex),
    )
    .setOrigin(0, 0)
    .setLetterSpacing(1);
  fitText(title, layout.title.width, compact ? 28 : 40);
  args.buttons.push(
    new McButton(scene, {
      kind: "onInk",
      label: args.expandLabel,
      type: typeRole.label,
      rect: layout.expand,
      onClick: args.onExpand,
    }),
  );
  stops.set("expand", { rect: layout.expand, activate: args.onExpand });

  if (layout.matchup.height > 0) drawMatchup(scene, layout, view, game);

  label(
    scene,
    layout.optionsLabel.x,
    layout.optionsLabel.y + 4,
    "Declare a defender",
    typeRole.label,
    surface.paper.hex,
    ink.label,
  );
  view.options.forEach((option, index) => {
    const slot = layout.options[index];
    if (!slot) return;
    drawOption(scene, layout, slot, option, option.optionId === args.selected, game);
    const zone = scene.add
      .zone(slot.x, slot.y, slot.width, slot.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on("pointerup", () => args.onSelect(option.optionId));
    stops.set(`option:${option.optionId}`, { rect: slot, activate: () => args.onSelect(option.optionId) });
  });

  drawStack(scene, layout.stack, view);

  const picked = view.options.find((option) => option.optionId === args.selected) ?? null;
  if (layout.confirmInFooter && args.footer) {
    const footerGround = scene.add.graphics();
    footerGround
      .fillStyle(surface.ink.hex, 1)
      .fillRect(args.footer.x, args.footer.y, args.footer.width, args.footer.height);
  }
  args.buttons.push(
    new McButton(scene, {
      kind: "primary",
      label: picked ? `Confirm: ${picked.title} ▸` : "Confirm ▸",
      type: typeRole.barTitle,
      rect: layout.confirm,
      enabled: picked !== null,
      reason: "choose a defender to continue",
      onClick: args.onConfirm,
    }),
  );
  stops.set("confirm", { rect: layout.confirm, activate: args.onConfirm });
  // After the footer's ink ground, which a phone's PEEK AT TABLE shares with CONFIRM.
  args.buttons.push(
    new McButton(scene, {
      kind: "onInk",
      label: args.tuckLabel,
      type: typeRole.label,
      rect: layout.tuck,
      onClick: args.onTuck,
    }),
  );
  stops.set("tuck", { rect: layout.tuck, activate: args.onTuck });
  return stops;
}

/** A card's scan at its current face, with a plain ink plate until (or unless) the image arrives. */
function drawScan(scene: Phaser.Scene, game: GameState, instanceId: InstanceId, rect: Rect): void {
  const source = artFor(cardOf(game, instanceId), faceOf(game, instanceId));
  const key = source ? cardArt(scene).request(scene, source) : null;
  if (key && drawArt(scene, key, rect, { fit: "contain" })) return;
  scene.add.graphics().fillStyle(surface.ink.hex, 0.85).fillRect(rect.x, rect.y, rect.width, rect.height);
}

/** The attacker, BASE ATK and an arrow, the defender, the facedown boost, and the note (the sheet's "incoming attack"). */
function drawMatchup(scene: Phaser.Scene, layout: VillainDefendLayout, view: DefendChoiceView, game: GameState): void {
  const parts = layout.matchupParts;
  const summary = view.summary;
  const g = scene.add.graphics();
  paintPanel(g, layout.matchup, "card", "rest");
  drawScan(scene, game, summary.attackerInstanceId, parts.attacker);
  drawScan(scene, game, summary.targetInstanceId, parts.target);
  g.lineStyle(3, accent.heroRed.hex, 1).strokeRect(
    parts.target.x - 2,
    parts.target.y - 2,
    parts.target.width + 4,
    parts.target.height + 4,
  );
  fitText(
    scene.add.text(
      parts.attackerCaption.x,
      parts.attackerCaption.y,
      summary.attackerName,
      textStyle(typeRole.rowTitle, surface.ink.hex),
    ),
    parts.attackerCaption.width,
    typeRole.rowTitle.size,
  );
  const targetTag = scene.add
    .text(
      parts.targetCaption.x + parts.targetCaption.width,
      parts.targetCaption.y,
      summary.targetCaption,
      textStyle(typeRole.rowTitle, accent.heroRed.hex),
    )
    .setOrigin(1, 0);
  fitText(targetTag, parts.targetCaption.width, typeRole.rowTitle.size);
  // A tag that only fits by shrinking below a readable size says the character alone ("Spider-Man") at full size.
  if (Number.parseFloat(String(targetTag.style.fontSize)) < TAG_READABLE_SIZE) {
    targetTag.setText(summary.targetCardName);
    fitText(targetTag, parts.targetCaption.width, typeRole.rowTitle.size);
  }

  const mid = parts.middle;
  const midX = mid.x + mid.width / 2;
  const column = defendMiddleLayout(mid);
  if (column.baseLabelY !== null) {
    label(scene, midX, column.baseLabelY, "base atk", typeRole.label, surface.ink.hex, ink.label).setOrigin(0.5, 0);
  }
  scene.add
    .text(midX, column.atkY, String(summary.baseAtk), textStyle(typeRole.stat, accent.heroRed.hex))
    .setOrigin(0.5, 0)
    .setFontSize(column.atkSize);
  const half = column.arrowHalf;
  g.fillStyle(accent.heroRed.hex, 1).fillRect(mid.x + 4, column.arrowY - 3, mid.width - 20, 6);
  g.fillTriangle(
    mid.x + mid.width - 18,
    column.arrowY - half,
    mid.x + mid.width - 18,
    column.arrowY + half,
    mid.x + mid.width - 2,
    column.arrowY,
  );
  const boosts = Math.min(summary.facedownCount, 4);
  if (boosts > 0 && column.backHeight >= 22) {
    const backWidth = Math.round(column.backHeight * (63 / 88));
    const step = boosts > 1 ? Math.min(backWidth + 4, (mid.width - backWidth) / (boosts - 1)) : 0;
    const rowWidth = backWidth + step * (boosts - 1);
    const backKey = cardArt(scene).request(scene, CARD_BACKS.encounter);
    for (let index = 0; index < boosts; index++) {
      const rect: Rect = {
        x: midX - rowWidth / 2 + index * step,
        y: column.backsY,
        width: backWidth,
        height: column.backHeight,
      };
      if (!drawArt(scene, backKey, rect, { fit: "cover" }))
        g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    }
  }
  const boostText = mid.width < 120 ? `+${summary.facedownCount} boost` : `+ ${summary.facedownCount} boost facedown`;
  label(scene, midX, column.boostLabelY, boostText, typeRole.label, surface.ink.hex, ink.secondary).setOrigin(0.5, 0);

  // The notes, only where they have a readable width, clipped to their own rect.
  const notes = parts.notes;
  if (notes.width < 120) return;
  const lines: { readonly text: string; readonly role: "body" | "label" }[] = [
    ...summary.forcedNotes.map((text) => ({ text, role: "body" as const })),
    ...(summary.boostAbilityNote ? [{ text: summary.boostAbilityNote, role: "body" as const }] : []),
    { text: `Play a defense event: ${view.defenseEventsNote}`, role: "body" },
    { text: view.rangeCaveat, role: "body" },
  ];
  let y = notes.y;
  for (const line of lines) {
    const style =
      line.role === "label"
        ? textStyle(typeRole.label, surface.ink.hex, ink.label)
        : textStyle(typeRole.body, surface.ink.hex, ink.secondary);
    const text = scene.add.text(notes.x, y, line.text, style).setWordWrapWidth(notes.width);
    if (y + text.height > notes.y + notes.height) {
      text.destroy();
      break;
    }
    y += text.height + 4;
  }
}

/** One defender card: picture, title, what it exhausts, the damage range and what is left. Selected rings red with a check. */
function drawOption(
  scene: Phaser.Scene,
  layout: VillainDefendLayout,
  slot: Rect,
  option: DefendOptionView,
  selected: boolean,
  game: GameState,
): void {
  const g = scene.add.graphics();
  paintPanel(g, slot, "card", selected ? "selected" : "rest");
  if (selected)
    g.lineStyle(4, accent.heroRed.hex, 1).strokeRect(slot.x - 2, slot.y - 2, slot.width + 4, slot.height + 4);
  const parts = villainDefendOptionParts(slot, layout.orientation);
  if (parts.picture) drawScan(scene, game, option.pictureInstanceId, parts.picture);

  const text = parts.text;
  const small = slot.height < 150;
  if (layout.dense) {
    drawDenseOption(scene, text, option, selected);
    return;
  }
  let y = text.y;
  const title = scene.add.text(
    text.x,
    y,
    selected ? `${option.title} ✓` : option.title,
    textStyle({ ...typeRole.rowTitle, size: small ? 13 : 16 }, surface.ink.hex),
  );
  fitText(title, text.width, small ? 13 : 16);
  y += title.height + 2;
  const costLine =
    option.kind === "decline"
      ? "Stays ready."
      : `Exhausts ${option.exhaustsNames.join(", ")}${option.defenseReduction > 0 ? ` · DEF ${option.defenseReduction}` : ""}.`;
  const cost = scene.add
    .text(text.x, y, costLine, textStyle({ ...typeRole.body, size: small ? 11 : 12 }, surface.ink.hex, ink.secondary))
    .setWordWrapWidth(text.width)
    .setMaxLines(2);
  y += cost.height + 4;
  const damage = scene.add.text(
    text.x,
    y,
    defendDamageOf(option.damageHeadline),
    textStyle(typeRole.stat, accent.heroRed.hex),
  );
  fitText(damage, text.width, small ? 24 : 34);
  y += damage.height + 2;
  const hpLines = [
    ...(option.hpAfter ? [defendHpLeftOf(option.hpAfter)] : []),
    ...(option.defeatAt !== null ? [`DEFEATED AT ${option.defeatAt}+`] : []),
  ];
  for (const line of hpLines) {
    const hp = label(
      scene,
      text.x,
      y,
      line,
      { ...typeRole.label, size: small ? 9 : 10 },
      surface.ink.hex,
      ink.secondary,
    );
    fitText(hp, text.width, small ? 9 : 10);
    y += hp.height + 2;
  }
  // Tough, Overkill and Retaliate, where the card still has a line to spare; the defeat threshold is said above.
  const rest = option.consequences.filter((line) => !line.endsWith(" is defeated."));
  const room = Math.floor((text.y + text.height - y) / 14);
  if (rest.length > 0 && room >= 1) {
    scene.add
      .text(text.x, y + 2, rest.join(" "), textStyle({ ...typeRole.body, size: 11 }, surface.ink.hex, ink.secondary))
      .setWordWrapWidth(text.width)
      .setMaxLines(room);
  }
}

/** The dense shape: the title and the damage on one line, what it exhausts and the HP left under it. */
function drawDenseOption(scene: Phaser.Scene, text: Rect, option: DefendOptionView, selected: boolean): void {
  const damage = scene.add
    .text(
      text.x + text.width,
      text.y,
      defendDamageOf(option.damageHeadline),
      textStyle(typeRole.stat, accent.heroRed.hex),
    )
    .setOrigin(1, 0);
  fitText(damage, text.width * 0.4, 20);
  const title = scene.add.text(
    text.x,
    text.y,
    selected ? `${option.title} ✓` : option.title,
    textStyle({ ...typeRole.rowTitle, size: 13 }, surface.ink.hex),
  );
  fitText(title, Math.max(1, text.width - damage.width - 8), 13);
  const costLine =
    option.kind === "decline"
      ? "Stays ready."
      : `Exhausts ${option.exhaustsNames.join(", ")}${option.defenseReduction > 0 ? ` · DEF ${option.defenseReduction}` : ""}.`;
  const cost = scene.add
    .text(
      text.x,
      text.y + Math.max(title.height, damage.height) + 2,
      costLine,
      textStyle({ ...typeRole.body, size: 11 }, surface.ink.hex, ink.secondary),
    )
    .setWordWrapWidth(text.width)
    .setMaxLines(1);
  const hp = [
    ...(option.hpAfter ? [defendHpLeftOf(option.hpAfter)] : []),
    ...(option.defeatAt !== null ? [`DEFEATED AT ${option.defeatAt}+`] : []),
  ].join(" · ");
  if (hp) {
    const hpText = label(
      scene,
      text.x,
      cost.y + cost.height + 2,
      hp,
      { ...typeRole.label, size: 9 },
      surface.ink.hex,
      ink.secondary,
    );
    fitText(hpText, text.width, 9);
  }
}

/** "THE STACK · 2", the open window in yellow with "← here". */
function drawStack(scene: Phaser.Scene, rect: Rect, view: DefendChoiceView): void {
  if (rect.height <= 0 || rect.width < 80) return;
  label(scene, rect.x, rect.y, `The stack · ${view.stack.length}`, typeRole.label, surface.paper.hex, ink.body);
  let y = rect.y + 18;
  for (const row of view.stack) {
    if (y + 14 > rect.y + rect.height) break;
    const style = row.openWindow
      ? textStyle({ ...typeRole.body, size: 12 }, signal.caution.hex, 1)
      : textStyle({ ...typeRole.body, size: 12 }, surface.paper.hex, ink.secondary);
    const line = scene.add
      .text(rect.x, y, row.openWindow ? `${row.label} ← here` : row.label, style)
      .setWordWrapWidth(rect.width)
      .setMaxLines(1);
    y += line.height + 2;
  }
}
