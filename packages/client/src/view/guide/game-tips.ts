/**
 * Game tips: a short note the first time something new shows up on the table. Each tip shows once per device
 * (`teaching/teaching-prefs.ts`'s `seenTips`), and only while Settings ▸ "Game tips" is on.
 *
 * Two kinds:
 *  - **Situations** read off the `BoardModel`: the main scheme nearing its target, your hero low on hit points, a
 *    side scheme or a crisis icon in play, a minion engaged with you.
 *  - **Keywords and statuses** on the table, from the same table-scoped glossary the Rules reference shows
 *    (`view/rules-reference.ts`'s `rulesGlossaryOf`), so every keyword a pack adds gets a tip with no new copy
 *    here. The three always-true table-state entries (exhausted, ready, facedown boost card) are left out: they'd
 *    all fire on the first frame of every game. The guided round covers exhausting instead.
 *
 * Situations come first: they're about this moment, and a keyword tip still makes sense a turn later.
 */
import type { BoardModel } from "../board-model.js";
import type { RulesEntry } from "../rules-reference.js";

export interface Tip {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  /** Where the rule comes from ("RRG 1.8 p. 21"), for a keyword or status tip. */
  readonly cite: string | null;
}

const TABLE_STATE_IDS = new Set(["exhausted", "ready", "facedownBoostCard"]);

/** The main scheme is this far along when the "nearly complete" tip fires. */
const NEAR_TARGET = 2 / 3;

function situationTips(model: BoardModel): Tip[] {
  const tips: Tip[] = [];
  const scheme = model.mainScheme;
  if (scheme.target !== null && scheme.target > 0 && scheme.threat < scheme.target) {
    if (scheme.threat >= Math.ceil(scheme.target * NEAR_TARGET)) {
      tips.push({
        id: "situation:threatNearTarget",
        title: "The scheme is nearly complete",
        body:
          `${scheme.name} has ${scheme.threat} of ${scheme.target} threat. If it reaches ${scheme.target}, the ` +
          `villain wins. Thwarting takes threat off: your hero's Thwart, an ally, or a card that says "thwart".`,
        cite: null,
      });
    }
  }
  const hp = model.me.hp;
  if (hp && hp.current > 0 && hp.current <= Math.floor(hp.max / 3)) {
    tips.push({
      id: "situation:lowHitPoints",
      title: "You're low on hit points",
      body:
        `${model.me.name} is at ${hp.current} of ${hp.max}. At 0 you're defeated. ` +
        (model.myForm === "hero"
          ? "Flipping to your alter-ego lets you Recover, and the villain schemes instead of attacking you. " +
            "An ally can also defend for you."
          : "Recover heals you, and in alter-ego form the villain schemes rather than attacking you."),
      cite: null,
    });
  }
  if (model.sideSchemes.length > 0) {
    tips.push({
      id: "situation:sideScheme",
      title: "A side scheme is in play",
      body:
        `${model.sideSchemes[0]!.name} is a side scheme. It doesn't win the game on its own, but it has an effect ` +
        "while it's in play. Thwart all its threat off to defeat it.",
      cite: null,
    });
  }
  if (model.sideSchemes.some((scheme) => scheme.crisis)) {
    tips.push({
      id: "situation:crisis",
      title: "Crisis: the main scheme is locked",
      body:
        "A side scheme with the crisis icon is in play. While it is, your cards can't take threat off the main " +
        "scheme, so clearing that side scheme comes first.",
      cite: "RRG 1.8 p. 14",
    });
  }
  const engaged = model.minions.filter((minion) => minion.engagedWith === model.perspectiveId);
  if (engaged.length > 0) {
    tips.push({
      id: "situation:minionEngaged",
      title: "A minion is engaged with you",
      body:
        `${engaged[0]!.name} stays with you until it's defeated. It activates against you in every villain phase, ` +
        "after the villain: it attacks your hero or schemes against your alter-ego.",
      cite: null,
    });
  }
  return tips;
}

function glossaryTip(entry: RulesEntry): Tip {
  const on = entry.cardRefs.length > 0 ? ` (on ${entry.cardRefs.map((ref) => ref.name).join(", ")})` : "";
  return {
    id: `keyword:${entry.id}`,
    title: `New on the table: ${entry.displayName}${on}`,
    body: entry.definition,
    cite: entry.citeLabel || null,
  };
}

/** Every tip the table calls for right now that the player hasn't seen, most pressing first. */
export function tipsFor(model: BoardModel, glossary: readonly RulesEntry[], seen: ReadonlySet<string>): Tip[] {
  const tips = [
    ...situationTips(model),
    ...glossary.filter((entry) => !TABLE_STATE_IDS.has(entry.id)).map(glossaryTip),
  ];
  return tips.filter((tip) => !seen.has(tip.id));
}
