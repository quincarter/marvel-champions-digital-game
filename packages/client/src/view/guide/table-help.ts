/**
 * "What am I looking at?": the Board's ? button. It explains the table as it is right now, from the same
 * `BoardModel` the table draws and the same table-scoped glossary the Rules reference shows (`rulesGlossaryOf`).
 * Nothing here is an example or a general rule dump: every line names something on this table.
 *
 * Sections, in reading order: where the round is, how this game is won and lost, you, what's after you, your
 * team, and every keyword and status on the table.
 */
import type { BoardModel, CharacterPanel } from "../board-model.js";
import type { RulesEntry } from "../rules-reference.js";

export interface TableHelpSection {
  readonly heading: string;
  readonly lines: readonly string[];
}

const TABLE_STATE_IDS = new Set(["exhausted", "ready", "facedownBoostCard"]);

function hpText(panel: CharacterPanel): string {
  return panel.hp ? `${panel.hp.current}/${panel.hp.max} HP` : "";
}

function phaseLine(model: BoardModel): string {
  switch (model.phase) {
    case "setup":
      return "The game is being set up.";
    case "player":
      return (
        "Player phase: each player takes a turn, playing cards, using powers and abilities in any order, then " +
        "ends it. Once every player has ended their turn, hands refill and exhausted cards ready."
      );
    case "villain":
      return (
        "Villain phase: threat goes on the main scheme, the villain and minions activate against each player, " +
        "then encounter cards are dealt and revealed."
      );
    case "gameOver":
      return "The game is over.";
  }
}

function stakes(model: BoardModel): string[] {
  const lines: string[] = [];
  const villains = model.villains.length > 0 ? model.villains.filter((v) => !v.defeated).map((v) => v.panel) : [];
  for (const villain of villains.length > 0 ? villains : [model.villain]) {
    lines.push(
      `${villain.name}${villain.subtitle ? ` (${villain.subtitle})` : ""}: ${hpText(villain) || "hit points unknown"}. ` +
        "Defeat the final stage to win.",
    );
  }
  const scheme = model.mainScheme;
  lines.push(
    scheme.target !== null
      ? `${scheme.name}: ${scheme.threat} of ${scheme.target} threat. If it reaches ${scheme.target}, the villain ` +
          "wins. Thwarting removes threat."
      : `${scheme.name}: ${scheme.threat} threat.`,
  );
  for (const side of model.sideSchemes) {
    lines.push(
      `${side.name} (side scheme): ${side.threat} threat.` +
        (side.crisis ? " Crisis: while it's in play, your cards can't remove threat from the main scheme." : "") +
        " Thwart all its threat to defeat it.",
    );
  }
  if (model.victoryCondition) {
    lines.push(`This scenario also counts ${model.victoryCondition.count} of ${model.victoryCondition.target}.`);
  }
  return lines;
}

function you(model: BoardModel): string[] {
  const me = model.me;
  const lines = [
    model.myForm === "hero"
      ? `${me.name}, hero form${me.hp ? `, ${hpText(me)}` : ""}. You can attack and thwart; the villain attacks you.`
      : `${me.name}, alter-ego form${me.hp ? `, ${hpText(me)}` : ""}. You can recover; the villain schemes ` +
        "instead of attacking you.",
    me.exhausted
      ? "Your identity is exhausted: its basic powers and defending wait until it readies."
      : "Your identity is ready: it can use one basic power, or defend in the villain phase.",
    `Hand: ${model.hand.length} card${model.hand.length === 1 ? "" : "s"}; you draw back up to ${model.handLimit} ` +
      "at the end of the player phase.",
  ];
  for (const status of me.statuses) {
    lines.push(`You're ${status.status}${status.count > 1 ? ` (${status.count})` : ""}. See its entry below.`);
  }
  if (model.myPlayArea.length > 0) {
    lines.push(`In play: ${model.myPlayArea.map((card) => card.name).join(", ")}.`);
  }
  return lines;
}

function enemies(model: BoardModel): string[] {
  const engaged = model.minions.filter((minion) => minion.engagedWith === model.perspectiveId);
  const others = model.minions.filter((minion) => minion.engagedWith !== model.perspectiveId);
  const line = (minion: CharacterPanel): string => {
    const keywords = minion.keywords.length > 0 ? ` · ${minion.keywords.join(", ")}` : "";
    return `${minion.name}: ${hpText(minion)}${keywords}.`;
  };
  const lines: string[] = [];
  if (engaged.length > 0) {
    lines.push("Engaged with you. Each activates against you every villain phase, after the villain:");
    lines.push(...engaged.map(line));
  }
  if (others.length > 0) {
    lines.push("Engaged with other players:");
    lines.push(...others.map(line));
  }
  if (lines.length === 0) lines.push("No minions are in play.");
  return lines;
}

function team(model: BoardModel): string[] {
  return model.team.map((seat) => {
    const state = seat.eliminated ? "defeated" : seat.form === "hero" ? "hero form" : "alter-ego form";
    const hp = seat.hp ? `, ${seat.hp.current}/${seat.hp.max} HP` : "";
    return `${seat.name}: ${state}${hp}${seat.isFirstPlayer ? ", first player" : ""}.`;
  });
}

export function tableHelpOf(model: BoardModel, glossary: readonly RulesEntry[]): readonly TableHelpSection[] {
  const sections: TableHelpSection[] = [
    { heading: `Round ${model.round} · ${model.stepLabel}`, lines: [phaseLine(model)] },
    { heading: "Winning and losing", lines: stakes(model) },
    { heading: "You", lines: you(model) },
    { heading: "Minions", lines: enemies(model) },
  ];
  if (model.team.length > 0) sections.push({ heading: "Your team", lines: team(model) });
  const terms = glossary.filter((entry) => !TABLE_STATE_IDS.has(entry.id));
  if (terms.length > 0) {
    sections.push({
      heading: "Keywords and statuses on the table",
      lines: terms.map((entry) => {
        const on = entry.cardRefs.length > 0 ? ` (${entry.cardRefs.map((ref) => ref.name).join(", ")})` : "";
        return `${entry.displayName}${on}: ${entry.definition}`;
      }),
    });
  }
  return sections;
}
