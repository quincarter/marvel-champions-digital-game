/**
 * The other side of a Civil War Competitive table in brief (issue #883, plan M9), as the rows under the board's title
 * bar, the way the Epic pod strip is: words first, never colour alone. It holds what a player can see across a
 * physical table (the leader, its scheme and threat, the minions, the heroes with their hit points and the number of
 * cards in hand) and nothing the other side keeps private.
 */
import { t } from "../i18n/translate.js";
import type { CompetitiveBoard } from "./board-model.js";
import { hpFraction } from "./hp-format.js";
import { packItems, wrapLine, type PodStrip, type PodStripLine } from "./pod-strip.js";

/** A `PodStrip` that also names the leader its button inspects. */
export interface CompetitiveStrip extends PodStrip {
  readonly leaderId: string | null;
}

const line = (text: string, tone: PodStripLine["tone"] = "plain"): PodStripLine => ({ kind: "shared", text, tone });

export function competitiveStripOf(board: CompetitiveBoard, maxChars: number): CompetitiveStrip {
  const other = board.other;
  const side = t(other.side === "registration" ? "comp.side.registration" : "comp.side.resistance");
  const leader = other.leader
    ? `${t("comp.area.leader", { name: other.leader.name })}${other.leader.hp ? ` ${t("comp.area.hp", { hp: hpFraction(other.leader.hp.current, other.leader.hp.max) })}` : ""}`
    : "";
  const scheme = other.mainScheme
    ? t("comp.area.scheme", { threat: `${other.mainScheme.threat}/${other.mainScheme.target ?? "-"}` })
    : "";
  const facts = [
    leader,
    scheme,
    t("comp.area.minions", { count: other.minionCount }),
    t("comp.area.sideSchemes", { count: other.sideSchemeCount }),
  ].filter((x) => x !== "");
  const heroes = other.heroes.map(
    (hero) =>
      `${hero.name}${hero.hp ? ` ${hpFraction(hero.hp.current, hero.hp.max)}` : ""} (${t("comp.area.hand", { count: hero.handCount })})`,
  );
  // Packed by item, not by word: the leader's name and each hero stay on one line; a narrow screen gets a line per item.
  const lines: PodStripLine[] = [
    ...packItems(facts, " · ", maxChars, `${t("comp.area.title", { side })}:`).map((text) => line(text)),
    ...packItems(heroes, ", ", maxChars).map((text) => line(text)),
  ];
  const alert = board.inactive ? wrapLine(line(t("comp.inactive.banner"), "alert"), maxChars) : [];
  return {
    lines: [...lines, ...alert],
    targets: 0,
    flipped: false,
    leaderId: other.leader?.instanceId ?? null,
  };
}
