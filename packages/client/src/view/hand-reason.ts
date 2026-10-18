/**
 * The short tag for a `no_valid_target` play refusal on a hand card. The engine words several different refusals with
 * that one code, so the tag is read from its message, and only the messages listed here are known: a trait-gated card
 * (White Queen, New Recruits while in alter-ego form) says what it needs; a card with nothing to aim at says "no
 * target"; anything the list does not know reads as a neutral "can't play" rather than a guess. The full sentence is
 * always in Inspect. `hand-reason.test.ts` lists every engine message mapped here, so a wording change in
 * `packages/engine/src/actions.ts` fails that test instead of quietly changing the tag.
 */

/** Messages that are the whole sentence, with the tag each one gets. */
const EXACT: Readonly<Record<string, string>> = {
  "this card's play restriction is not met": "restricted",
  "this event's condition is not met": "condition unmet",
  "this event has no valid target": "no target",
  "upgrade has no valid host": "no target",
};

export const NEUTRAL_PLAY_TAG = "can't play";
export const ENTER_PLAY_BARRED_TAG = "can't enter play";

export function noTargetTag(message: string): string {
  const exact = EXACT[message.toLowerCase()];
  if (exact) return exact;
  const identityTrait = /^play only if your identity has the (.+) trait$/i.exec(message);
  if (identityTrait) return `needs ${identityTrait[1]}`;
  const prerequisite = /^prerequisite: your identity must have the (.+) trait$/i.exec(message);
  if (prerequisite) return `needs ${prerequisite[1]}`;
  const controlled = /^play only if you control an? (.+) character$/i.exec(message);
  if (controlled) return `needs ${controlled[1]} in play`;
  if (/^nothing in play to /i.test(message)) return "no target";
  // A rule that keeps the card out of play: "Teddy Altman: Winged Shape cannot enter play" (Hulkling's one Shapeshift
  // upgrade), or a campaign's "<card> cannot enter play during this game". The full sentence is in Inspect.
  if (/ cannot enter play( during this game)?$/i.test(message)) return ENTER_PLAY_BARRED_TAG;
  return NEUTRAL_PLAY_TAG;
}
