/**
 * The reading panels of Scenario select as parts of an `mc-sheet`: the stat strip under the roster (main scheme, starting
 * threat, villain HP, encounter sets), the ink stages panel (a box per stage, the played record, the encounter and
 * modular sets) and its phone disclosure bar. The same numbers the Phaser screen drew them with
 * (`scenes/scenario-select.ts` before the port), so the panel reads where it did.
 */
import { artLanguageNow } from "../art/art-source.js";
import { t, tPlural } from "../i18n/translate.js";
import { accent, border, ink, minType, signal, surface, typeRole } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import { encounterSetsCellText, type ScenarioDetail } from "../view/scenario-detail.js";
import { DETAIL_COLLAPSED_HEIGHT, type ScenarioSelectLayout } from "../view/scenario-select-layout.js";
import type { ScenarioRecord } from "../view/results-history.js";
import { formatScaling } from "../view/scaling-text.js";
import type { SheetBuilder } from "./sheet-builder.js";

/** The smallest a stat value is stepped down to (`ui/widgets.ts` CAPTION_FLOOR, which pulls Phaser into a node test). */
const CAPTION_FLOOR = minType.phoneLabel;

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"] as const;
const roman = (n: number): string => ROMAN[n] ?? String(n);

/** The four cells of the stat strip: label over value. */
export function statCellsOf(detail: ScenarioDetail): readonly { readonly label: string; readonly value: string }[] {
  const lang = artLanguageNow();
  const firstStage = detail.stages[0];
  const accelerating = detail.startingAcceleration.base > 0 || detail.startingAcceleration.perPlayer > 0;
  const accel = accelerating ? t("scenario.accel", { accel: formatScaling(detail.startingAcceleration, lang) }) : "";
  return [
    { label: t("scenario.mainScheme"), value: detail.mainSchemeName },
    {
      label: t("scenario.startingThreat"),
      value: `${t("scenario.threatStart", { threat: formatScaling(detail.startingThreat, lang) })}${accel}`,
    },
    {
      label: t("scenario.foeHp", { foe: detail.foeWord }),
      value: detail.villainIsRandom
        ? t("scenario.varies")
        : detail.stages.map((stage) => formatScaling(stage.hp, lang).split(" ")[0]).join(" · ") ||
          (firstStage ? formatScaling(firstStage.hp, lang) : "—"),
    },
    {
      // The strip's cell is narrow: its own, shorter label in a language that needs one (#390).
      label: t("scenario.encounterSetsCell"),
      value: encounterSetsCellText(detail),
    },
  ];
}

/**
 * The band under the roster (D02): parchment ground with a 3px ink border and an ink divider between cells, display
 * values. `rows` lays the four cells out across one row when there is room (wide) or 2x2 when there is not (narrow).
 */
export function drawStatStrip(b: SheetBuilder, rect: Rect, detail: ScenarioDetail, rows: 1 | 2): void {
  b.box(
    { x: rect.x + 1.5, y: rect.y + 1.5, width: rect.width - 3, height: rect.height - 3 },
    { fill: surface.parchment.hex, stroke: surface.ink.hex, strokeWidth: 3 },
  );
  const cells = statCellsOf(detail);
  const perRow = Math.ceil(cells.length / rows);
  const cellWidth = rect.width / perRow;
  const rowHeight = rect.height / rows;
  cells.forEach((cell, index) => {
    const col = index % perRow;
    const row = Math.floor(index / perRow);
    const x = rect.x + col * cellWidth;
    const y = rect.y + row * rowHeight;
    if (col > 0) b.box({ x: x - 1, y: y + 6, width: 2, height: rowHeight - 12 }, { fill: surface.ink.hex });
    if (row > 0) b.box({ x, y: y - 1, width: cellWidth, height: 2 }, { fill: surface.ink.hex });
    // A longer translated label shrinks to its cell rather than run into the next.
    b.text(x + 12, y + 8, cell.label, typeRole.label, {
      color: surface.ink.hex,
      alpha: ink.label,
      fitWidth: cellWidth - 20,
    });
    // One line at full size when it fits; else it wraps to the lines the cell has room for, stepping the type down
    // until it does. Never cut with an ellipsis.
    const room = rect.y + (row + 1) * rowHeight - 4 - (y + 22);
    let size = Math.min(typeRole.sectionHeader.size, 16);
    for (; size > CAPTION_FLOOR; size--) {
      const measured = b.measure(cell.value, typeRole.sectionHeader, { size, wrapWidth: cellWidth - 20 });
      if (measured.height <= Math.max(room, size * 1.3)) break;
    }
    b.text(x + 12, y + 22, cell.value, typeRole.sectionHeader, {
      color: surface.ink.hex,
      size,
      wrapWidth: cellWidth - 20,
    });
  });
}

export interface SidePanelInput {
  readonly layout: ScenarioSelectLayout;
  /** Null until a villain is picked. */
  readonly detail: ScenarioDetail | null;
  /** The draft's difficulty: standard reads the standard stages, any other the expert ones. */
  readonly difficulty: string;
  readonly record: ScenarioRecord | null;
  /** The phone's stages disclosure is open. */
  readonly stagesOpen: boolean;
}

export interface SidePanelResult {
  /** The record line, for the dev e2e hook. */
  readonly recordText: string;
  /** The phone's disclosure bar (the stages toggle), when the panel is one. */
  readonly bar: Rect | null;
}

/** The stage range the difficulty plays, so a stage box can read "used now" against "the other mode". */
function stageRangeOf(detail: ScenarioDetail, difficulty: string): readonly [number, number] {
  return difficulty === "standard" ? detail.villainStagesStandard : detail.villainStagesExpert;
}

/**
 * The ink stages panel: a header, one outlined box per stage (bright at the current difficulty, dim otherwise), the
 * played record and the encounter sets. On a phone it is a disclosure: its bar is the toggle (`stages-toggle`), shut
 * it shows only the bar, open a sheet risen over the roster from that bar.
 */
export function drawSidePanel(b: SheetBuilder, input: SidePanelInput): SidePanelResult {
  const { layout, detail, difficulty, record, stagesOpen } = input;
  const rect = layout.detail;
  const paper = surface.paper.hex;
  b.box(rect, { fill: surface.ink.hex });
  if (detail === null) {
    // No villain picked yet: the panel says what it will show, and the record below has nothing to read.
    if (layout.wide) {
      b.text(rect.x + 16, rect.y + 16, t("scenario.stages"), typeRole.sectionHeader, { color: paper });
      b.text(rect.x + 16, rect.y + 48, t("scenario.pickVillainStages"), typeRole.body, {
        color: paper,
        alpha: ink.label,
        wrapWidth: rect.width - 32,
      });
    } else {
      const midY = rect.y + rect.height - DETAIL_COLLAPSED_HEIGHT / 2;
      b.text(rect.x + 16, midY, t("scenario.stages"), typeRole.sectionHeader, { color: paper, origin: [0, 0.5] });
      b.text(rect.x + rect.width - 16, midY, t("scenario.pickVillain"), typeRole.label, {
        color: paper,
        alpha: ink.label,
        origin: [1, 0.5],
      });
    }
    return { recordText: "", bar: null };
  }
  const [rangeStart, rangeEnd] = stageRangeOf(detail, difficulty);
  let y = rect.y + 16;
  let bar: Rect | null = null;
  if (layout.wide) {
    b.text(rect.x + 16, y, t("scenario.stages"), typeRole.sectionHeader, { color: paper });
    y += 28;
  } else {
    // The bar names what is inside even when shut, so the stages are one tap away rather than gone.
    bar = {
      x: rect.x,
      y: rect.y + rect.height - DETAIL_COLLAPSED_HEIGHT,
      width: rect.width,
      height: DETAIL_COLLAPSED_HEIGHT,
    };
    if (stagesOpen) b.box({ x: bar.x, y: bar.y, width: bar.width, height: 1 }, { fill: paper, alpha: ink.disabled });
    b.text(bar.x + 16, bar.y + bar.height / 2, t("scenario.stages"), typeRole.sectionHeader, {
      color: paper,
      origin: [0, 0.5],
    });
    b.text(bar.x + bar.width - 16, bar.y + bar.height / 2, stagesOpen ? "▾" : "▴", typeRole.sectionHeader, {
      color: paper,
      origin: [1, 0.5],
    });
    if (!stagesOpen) {
      const summary = t("scenario.stageSummary", {
        name: detail.displayName.toUpperCase(),
        from: roman(rangeStart),
        to: rangeEnd > rangeStart ? `–${roman(rangeEnd)}` : "",
      });
      b.text(bar.x + bar.width - 40, bar.y + bar.height / 2, summary, typeRole.label, {
        color: paper,
        alpha: ink.label,
        origin: [1, 0.5],
        fitWidth: bar.width - 40 - 170,
      });
      b.tap("stages-toggle", bar);
      return { recordText: "", bar };
    }
    drawStatStrip(b, layout.statStrip, detail, layout.statStripRows);
    b.tap("stages-toggle", bar);
    y = layout.statStrip.y + layout.statStrip.height + 14;
  }
  if (detail.otherVillainNames.length > 0) {
    const note = t("scenario.more", {
      count: detail.otherVillainNames.length,
      names: detail.otherVillainNames.join(", "),
    });
    const size = b.text(rect.x + 16, y, note, typeRole.label, {
      color: paper,
      alpha: ink.label,
      wrapWidth: rect.width - 32,
    });
    y += size.height + 8;
  }
  // Where the panel's own content has to stop: above the CTA on a wide layout, above its own bar on a phone sheet.
  const contentBottom = layout.wide
    ? (layout.secondary ?? layout.next).y - 8
    : rect.y + rect.height - DETAIL_COLLAPSED_HEIGHT - 8;
  const lang = artLanguageNow();
  for (const stage of detail.villainIsRandom ? detail.stages.slice(0, 1) : detail.stages) {
    const boxHeight = 44;
    if (y + boxHeight > contentBottom) break;
    const current = stage.stageNumber >= rangeStart && stage.stageNumber <= rangeEnd;
    b.box(
      { x: rect.x + 16, y, width: rect.width - 32, height: boxHeight },
      { stroke: paper, strokeWidth: current ? 2 : 1, ...(current ? {} : { alpha: ink.disabled }) },
    );
    const stageLabel = stage.stageLabel ?? roman(stage.stageNumber);
    const who = detail.villainChoices.length > 0 ? t("scenario.yourVillain") : detail.villainName;
    b.text(rect.x + 24, y + 6, `${stageLabel} · ${who.toUpperCase()}`, typeRole.sectionHeader, {
      color: paper,
      size: 15,
      alpha: current ? 1 : ink.disabled,
      fitWidth: rect.width - 48,
    });
    b.text(
      rect.x + 24,
      y + 26,
      detail.villainIsRandom
        ? t("scenario.drawnAtRandom")
        : t("scenario.stageStats", { sch: stage.sch, hp: formatScaling(stage.hp, lang), atk: stage.atk }),
      typeRole.label,
      { color: paper, alpha: current ? ink.label : ink.disabled },
    );
    y += boxHeight + 8;
  }
  y += 8;
  if (y + 64 > contentBottom) return { recordText: "", bar };
  b.box({ x: rect.x + 16, y, width: rect.width - 32, height: 1 }, { fill: paper, alpha: ink.disabled });
  y += 12;
  const played = record !== null && record.combined.gamesPlayed > 0;
  const tally = played
    ? `${tPlural("scenario.wins", record.combined.wins)} · ${tPlural("scenario.losses", record.combined.losses)}`
    : t("scenario.notPlayed");
  const beaten = played && record.combined.wins > 0;
  const subline = !played
    ? null
    : record.combined.bestClearRounds !== null
      ? t("scenario.bestClear", { round: record.combined.bestClearRounds })
      : beaten
        ? null
        : t("scenario.notBeaten");
  const recordText = played
    ? t("scenario.recordLine", { tally, subline: subline ? ` ${subline}.` : "" })
    : t("scenario.notPlayedDot");
  // The record is a filled band at menu-button size so it reads from the couch: win-state green once beaten, a deep red
  // when played but never won, the advisory yellow before it has been played (issue 141 follow-up).
  b.text(rect.x + 16, y, t("scenario.record"), typeRole.label, { color: paper, alpha: ink.label });
  y += 16;
  const textColor = played ? paper : surface.inkOnHue.hex;
  const tallySize = b.measure(tally, typeRole.menuButton, { wrapWidth: rect.width - 56 });
  let bandHeight = tallySize.height + 20;
  const subSize = subline ? b.measure(subline, typeRole.emphasis, { size: 13 }) : null;
  if (subSize) bandHeight += subSize.height + 2;
  b.box(
    { x: rect.x + 16, y, width: rect.width - 32, height: bandHeight },
    {
      fill: beaten ? signal.heal.hex : played ? accent.redDeep.hex : signal.caution.hex,
      stroke: surface.inkOnHue.hex,
      strokeWidth: border.detail,
    },
  );
  b.text(rect.x + 28, y + 10, tally, typeRole.menuButton, { color: textColor, wrapWidth: rect.width - 56 });
  if (subline) {
    b.text(rect.x + 28, y + 10 + tallySize.height + 2, subline, typeRole.emphasis, { color: textColor, size: 13 });
  }
  y += bandHeight + 14;
  // "Encounter sets" / "Recommended modular" as label-over-value blocks, matching the seats panel's own
  // OBLIGATION / NEMESIS SET treatment.
  const blocks: readonly { readonly heading: string; readonly value: string }[] = [
    { heading: t("scenario.encounterSets"), value: detail.fixedEncounterSetNames.join(", ") || t("scenario.none") },
    detail.modularSummary
      ? { heading: t("scenario.modularSets"), value: detail.modularSummary }
      : {
          heading: t("scenario.recommendedModular"),
          value: detail.recommendedModularSetNames.join(", ") || t("scenario.none"),
        },
  ];
  const textWidth = rect.width - 32;
  for (const block of blocks) {
    if (y + 40 > contentBottom) break;
    b.text(rect.x + 16, y, block.heading, typeRole.label, { color: paper, alpha: ink.label });
    y += 16;
    const value = b.text(rect.x + 16, y, block.value, typeRole.body, { color: paper, wrapWidth: textWidth });
    y += value.height + 12;
  }
  return { recordText, bar };
}
