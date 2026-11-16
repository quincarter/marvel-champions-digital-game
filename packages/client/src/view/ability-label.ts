/**
 * A human name for one action ability on a card in play, for the board's
 * ability affordance and the Inspect picker (PLAN.md Phase 4, "Abilities on
 * cards in play are not reachable from the UI").
 *
 * `AbilityReference.label` — the printed sub-ability name, e.g. "Rechannel",
 * "Spider-Sense" — only exists "when the card names it" (`@mc/content`
 * `schema/abilities.ts`). Scanning every real Core game (Rhino solo, Klaw
 * 2-player, Ultron 4-player; see this file's test), no action ability that
 * ever reaches the player through `useAbility` carries one: the labeled ones
 * in Core content are all resource or interrupt/response abilities, consumed
 * as payment or triggers rather than tapped from the board. So the fallback
 * path below — the card's own name plus its cost, read straight off the
 * engine's `AbilityCost` — is what every real Core case uses today. This
 * still checks the printed label first, so a future card that does name an
 * action ability is named correctly rather than by its cost alone.
 *
 * Either way, nothing here is invented: every word traces back to
 * `AbilityReference.label`, `faceUpName`, or a field on `AbilityCost`.
 */

import { cardTextDisplay } from "./card-text-display.js";
import type { AbilityId } from "@mc/content";
import {
  activeAbilityRefs,
  controllerOf,
  costAsDetermined,
  type AbilityCost,
  type EngineDeps,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { faceUpName } from "./names.js";

/**
 * Abilities the engine owns for a keyword (`keyword-abilities.ts`; ids carry a `keyword:` head) have no card
 * script and no `deps.abilities` entry, so their wording lives here: the keyword and its reminder text.
 */
const KEYWORD_ABILITY_TEXT: Readonly<Record<string, { readonly name: string; readonly reminder: string }>> = {
  "keyword:temporary": { name: "Temporary", reminder: "discard at the end of the round" },
};

/** "Temporary — discard at the end of the round" for an engine-owned keyword ability id; null for any other id. */
export function keywordAbilityLabel(id: AbilityId): string | null {
  const text = KEYWORD_ABILITY_TEXT[id as string];
  return text ? `${text.name} — ${text.reminder}` : null;
}

/** "Aunt May — exhaust" or, once a card names the ability, "Rocket Boots — Afterburners". */
export function abilityLabelOf(
  state: GameState,
  instanceId: InstanceId,
  abilityId: AbilityId,
  deps: EngineDeps,
): string {
  // The live face, not the card: an alter-ego's action is "Wanda Maximoff — Superpowered Siblings", and offering
  // it under the hero's name sent the player to the wrong side of the card for it.
  const name = faceUpName(state, instanceId);
  const short = abilityShortLabelOf(state, instanceId, abilityId, deps);
  return short ? `${name} — ${short}` : name;
}

/**
 * The same label with the card's own name left off, for the affordance drawn
 * *on* the card.
 *
 * The card is right there with its name on it, so repeating it spends the line's
 * whole width on the one thing the player can already read: at a play-area
 * panel's width "Surveillance Team — exhaust, remove 1 snoop counter" showed as
 * "▶ Surveillance Te…" — the name twice and the cost not at all. The cost is the
 * half the player cannot see anywhere else on the table.
 *
 * Null when the engine's `AbilityCost` yields no phrase at all, so the caller
 * decides what a nameless, costless ability should say rather than being handed
 * an invented word.
 */
export function abilityShortLabelOf(
  state: GameState,
  instanceId: InstanceId,
  abilityId: AbilityId,
  deps: EngineDeps,
): string | null {
  const printed = activeAbilityRefs(state, instanceId).find((ref) => ref.id === abilityId)?.label;
  // The data keeps icons as bracket tokens ("[star] Gather Intel"); every surface draws the label verbatim.
  if (printed) return cardTextDisplay(printed);
  const keyword = keywordAbilityLabel(abilityId);
  if (keyword) return keyword;
  // RRG "Special": a card's own printed sub-heading is literally the word "Special" (Invocation cards, Wakanda
  // Forever!'s targets) — never named on the `AbilityReference` itself (there is nothing else to call it), so this
  // is the one case where the label isn't traced back to printed data via `.label`/`AbilityCost`.
  if (deps.abilities[abilityId]?.trigger.kind === "special") return "Special";
  // Navigation Column (16172) etc.: `conditional` costs read the wrong branch (or none) unless resolved against
  // the board first (`costAsDetermined`, engine `actions.ts` §3.49) — the written cost is only ever a template.
  const written = deps.abilities[abilityId]?.cost;
  const controllerId = controllerOf(state, instanceId);
  const determined = controllerId ? costAsDetermined(state, deps, instanceId, controllerId, written) : written;
  return costPhrase(determined);
}

/** "Spend X [energy]", or with a cap "spend up to 2 resources" (Nebula's Ship, issue #174), never "spend X any". */
function chosenSpendPhrase(x: NonNullable<AbilityCost["resourcesX"]>): string {
  const kind = x.resource === "any" ? "" : ` ${x.resource}`;
  if (x.max === undefined) return `spend X${kind || " resources"}`;
  return `spend up to ${x.max}${kind} resource${x.max === 1 ? "" : "s"}`;
}

/**
 * The cost in the engine's own terms, comma-joined in the order `AbilityCost`
 * declares its fields. Never a made-up verb: each phrase names exactly the
 * field that produced it, so a new cost shape either gets a phrase here or
 * silently contributes nothing rather than a guess.
 */
export function costPhrase(cost: AbilityCost | undefined): string | null {
  return costWords(cost).phrase;
}

/**
 * `costPhrase`, but null when any part of the cost has no words of its own here (a discard narrowed by a resource icon
 * or a trait, Haywire 29038): for a line that states the whole cost (an attachment's removal chip), which must say
 * "see card" rather than offer a cheaper-sounding cost than the card prints.
 */
export function fullCostPhrase(cost: AbilityCost | undefined): string | null {
  const { phrase, unsaid } = costWords(cost);
  return unsaid ? null : phrase;
}

/** Card types a "discard a … you control" cost names plainly (`discardCards` with nothing narrower than its type). */
const DISCARD_TYPE_WORDS: Readonly<Record<string, string>> = {
  ally: "an ally",
  upgrade: "an upgrade",
  support: "a support",
};

/** "discard an ally you control", or null when the pick is narrower than one card type (a resource icon, a trait). */
function discardCardsPhrase(pick: NonNullable<AbilityCost["discardCards"]>): string | null {
  const { categories, ...narrower } = pick.query;
  if (Object.keys(narrower).length > 0 || pick.min !== 1 || (pick.max ?? 1) !== 1) return null;
  if ("measure" in pick || "superlative" in pick) return null;
  const word = categories?.length === 1 ? DISCARD_TYPE_WORDS[categories[0]!] : undefined;
  return word ? `discard ${word} you control` : null;
}

/**
 * The `AbilityCost` fields `costWords` has words for. Any other field set on a cost (exhausting another card, Love
 * Triangle 55062) is a part the phrase leaves out, so `fullCostPhrase` gives none rather than a cheaper-sounding cost.
 * `changeFormFolded` is engine bookkeeping, never a printed part.
 */
const WORDED_COST_FIELDS: ReadonlySet<string> = new Set([
  "changeForm",
  "changeFormFolded",
  "chooseTarget",
  "damageSelf",
  "damageThisCard",
  "discardCards",
  "discardFromHand",
  "discardSelf",
  "eachPlayer",
  "either",
  "exhaustIdentity",
  "exhaustSelf",
  "healCharacter",
  "healIdentity",
  "indirectDamage",
  "payPrintedCostOf",
  "resources",
  "resourcesX",
  "spendCounters",
]);

function costWords(cost: AbilityCost | undefined): { readonly phrase: string | null; readonly unsaid: boolean } {
  if (!cost) return { phrase: null, unsaid: false };
  let unsaid = Object.entries(cost).some(([field, part]) => part !== undefined && !WORDED_COST_FIELDS.has(field));
  const parts: string[] = [];
  // "Choose to either discard a card … or take 2 indirect damage →" (Haywire 29038): each branch said in full, joined
  // by "or"; a branch with no phrase of its own leaves the whole choice unsaid rather than half of it.
  if (cost.either) {
    const branches = cost.either.map((branch) => costWords(branch));
    if (branches.every((branch) => branch.phrase !== null && !branch.unsaid)) {
      parts.push(branches.map((branch) => branch.phrase).join(" or "));
    } else unsaid = true;
  }
  // Roughly the order printed cost text uses (RRG "Cost" gives no rule for
  // it): exhaust, then what's spent, then what's discarded — "Spend 1
  // [physical] resource and discard Tenacity" reads spend-then-discard, not
  // the other way around.
  // "Change to hero form and discard this card →" (Entrapment 61024): printed first.
  if (cost.changeForm) parts.push(`change to ${cost.changeForm === "hero" ? "hero" : "alter-ego"} form`);
  if (cost.exhaustSelf) parts.push("exhaust");
  if (cost.exhaustIdentity) parts.push("exhaust your identity");
  const everyone = eachPlayerPhrase(cost.eachPlayer);
  if (everyone) parts.push(everyone);
  const resources = resourcePhrase(cost.resources);
  if (resources) parts.push(resources);
  if (cost.resourcesX) parts.push(chosenSpendPhrase(cost.resourcesX));
  // "Choose a non-Elite minion. Remove X evidence counters …" (61009): the card prints the choice first.
  if (cost.chooseTarget) parts.push("choose a card");
  if (cost.spendCounters) {
    const { amount, counterType } = cost.spendCounters;
    // An amount read from the board ("X equal to 2 less than that minion's remaining hit points", 61009) is a value
    // spec: said as X, as a computed `damageSelf` is said without a figure.
    parts.push(
      typeof amount === "number"
        ? `remove ${amount} ${counterType} counter${amount === 1 ? "" : "s"}`
        : `remove X ${counterType} counters`,
    );
  }
  // A computed amount (Wolverine's Claws: "take damage equal to its printed cost") is a value spec, not a number,
  // and printing it showed "[object Object]" on the button: say the cost without a figure instead.
  if (cost.damageSelf !== undefined)
    parts.push(typeof cost.damageSelf === "number" ? `take ${cost.damageSelf} damage` : "take damage");
  if (cost.damageThisCard !== undefined)
    parts.push(
      typeof cost.damageThisCard === "number" ? `deal ${cost.damageThisCard} damage to it` : "deal damage to it",
    );
  if (cost.healIdentity !== undefined)
    parts.push(typeof cost.healIdentity === "number" ? `heal ${cost.healIdentity} damage` : "heal damage");
  if (cost.healCharacter) parts.push(`heal ${cost.healCharacter.amount} damage from a character`);
  if (cost.discardFromHand) {
    const { min, max, filter, combined } = cost.discardFromHand;
    // A filter other than a trait (a printed [energy] resource, Haywire 29038) has no words below: the full phrase is
    // not offered as if any card would do.
    if (filter && Object.keys(filter).some((key) => key !== "trait")) unsaid = true;
    // "Attack cards" from `filter.trait` (Advanced Glider, `sm` 27136): traits are stored upper-cased (`trait()`,
    // `@mc/content`), so this titles just the one word rather than shouting it back at the player. Every other
    // filter shape falls back to the generic "cards" rather than guessing a phrase for it.
    const noun = filter?.trait ? `${filter.trait.charAt(0)}${filter.trait.slice(1).toLowerCase()} cards` : "cards";
    if (combined) {
      parts.push(`discard ${noun} with a combined cost of ${combined.atLeast} or more`);
    } else if (min === max) {
      parts.push(`discard ${min} card${min === 1 ? "" : "s"}`);
    } else if (max !== undefined) {
      parts.push(`discard up to ${max} ${noun}`);
    } else if (min > 0) {
      parts.push(`discard at least ${min} ${noun}`);
    } else {
      // Shield Toss (`03006`): `discardFromHandCost(0, undefined, "x")` — no printed ceiling, X decided when paid.
      parts.push(`discard any number of ${noun}`);
    }
  }
  if (cost.discardCards) {
    const words = discardCardsPhrase(cost.discardCards);
    if (words) parts.push(words);
    else unsaid = true;
  }
  if (typeof cost.indirectDamage === "number") parts.push(`take ${cost.indirectDamage} indirect damage`);
  if (cost.discardSelf) parts.push("discard this card");
  if (cost.payPrintedCostOf) parts.push("pay a card's printed cost");
  return { phrase: parts.length > 0 ? parts.join(", ") : null, unsaid };
}

/**
 * "each player exhausts, takes 1 damage": `AbilityCost.eachPlayer`, a cost every player in the game pays in kind
 * (Crown of the Enchantress). Null when the cost has none or names no component.
 */
export function eachPlayerPhrase(each: AbilityCost["eachPlayer"]): string | null {
  if (!each) return null;
  const doing: string[] = [];
  if (each.exhaustIdentity) doing.push("exhausts");
  if (each.damageSelf) doing.push(`takes ${each.damageSelf} damage`);
  return doing.length > 0 ? `each player ${doing.join(", ")}` : null;
}

function resourcePhrase(resources: AbilityCost["resources"]): string | null {
  if (!resources) return null;
  if (typeof resources === "number") return resources > 0 ? `spend ${resources}` : null;
  const typed = Object.entries(resources)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] > 0)
    .map(([type, amount]) => `${amount} ${type}`);
  return typed.length > 0 ? `spend ${typed.join(", ")}` : null;
}
