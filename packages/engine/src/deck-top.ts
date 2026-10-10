/**
 * The log of "play with the top card of your deck faceup" (`RuleSpec topOfDeckFaceup`, docs/phase7-wave8.md §3.48).
 *
 * Which card is showing is derived (`shownDeckTop`, `select.ts`) and never stored on a card. What is kept is the last
 * value the log announced (`GameState.deckTopsAnnounced`), so each change is logged once: `deckTopShown` for the card
 * now showing, `deckTopHidden` when a showing card is facedown again. `announceDeckTops` is called after every move of
 * a card (`settlePlayerDecks`, `placeAt`), after every shuffle and reset of a player deck or an encounter deck, and
 * between frames
 * (`checkStateTriggers`) for the rule itself turning on or off with nothing moved (a form change, a blank text box).
 * RRG 1.8 FAQ "Magik (#30A)" (p. 64): "As soon as she does this, she turns the new top card of her deck faceup", so a
 * draw of 2 shows the second card before it is drawn.
 *
 * The same rule over the encounter deck (`deck: "encounter"`, docs/phase7-wave9.md §3.42) is logged the same way, as
 * `encounterTopShown` / `encounterTopHidden` against `GameState.encounterTopAnnounced` (`announceEncounterTop`).
 *
 * A game none of whose cards prints the rule pays cached checks per call (`deckTopRuleCanHold`: its card pool against the
 * registry, then its scenario rules and lasting effects), never a scan of the rules in force, and writes nothing to its
 * state or its log, even when the registry holds the rule for another game's cards.
 */

import type { AbilityRegistry, EngineDeps } from "./abilities.js";
import { type Ctx, emit } from "./ctx.js";
import type { InstanceId } from "./ids.js";
import type { GameState } from "./state.js";
import { activeEncounterDeck, activeEncounterDeckId } from "./query.js";
import { deckTopFaceupPlayers, encounterTopFaceup } from "./select.js";

const NO_ABILITIES: ReadonlySet<string> = new Set();
const RULE_ABILITIES = new WeakMap<AbilityRegistry, ReadonlySet<string>>();
const POOLS_WITH_RULE = new WeakMap<GameState["cardPool"], WeakMap<AbilityRegistry, boolean>>();

/** The registry's constant abilities that carry the rule, by id; cached per registry. */
function ruleAbilityIds(abilities: AbilityRegistry): ReadonlySet<string> {
  let ids = RULE_ABILITIES.get(abilities);
  if (ids === undefined) {
    const found = Object.entries(abilities).flatMap(([id, definition]) =>
      definition.trigger.kind === "constant" &&
      (definition.trigger.rules ?? []).some((rule) => rule.kind === "topOfDeckFaceup")
        ? [id]
        : [],
    );
    ids = found.length > 0 ? new Set(found) : NO_ABILITIES;
    RULE_ABILITIES.set(abilities, ids);
  }
  return ids;
}

/** Whether this card data names one of `ids` as an ability anywhere in it (any face, stage or form). */
function namesAbility(value: unknown, ids: ReadonlySet<string>): boolean {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => namesAbility(item, ids));
  const record = value as Record<string, unknown>;
  if (typeof record.id === "string" && ids.has(record.id)) return true;
  return Object.values(record).some((item) => namesAbility(item, ids));
}

/**
 * Whether a card of this game prints the rule: one of the game's own cards (`GameState.cardPool`, fixed at setup)
 * names a constant ability of the registry that carries it. A card's abilities are read only from its card data
 * (`activeAbilityRefs`), so a game whose pool has no such card can never have the printed rule in force, whatever the
 * registry holds for other games. Cached per card pool object and registry, outside the state: a state loaded from a
 * save has a new pool object and is scanned once more.
 */
function poolPrintsRule(pool: GameState["cardPool"], abilities: AbilityRegistry): boolean {
  const ids = ruleAbilityIds(abilities);
  if (ids.size === 0) return false;
  let byRegistry = POOLS_WITH_RULE.get(pool);
  if (byRegistry === undefined) {
    byRegistry = new WeakMap();
    POOLS_WITH_RULE.set(pool, byRegistry);
  }
  let printed = byRegistry.get(abilities);
  if (printed === undefined) {
    printed = Object.values(pool).some((card) => namesAbility(card, ids));
    byRegistry.set(abilities, printed);
  }
  return printed;
}

/**
 * Whether anything in this game could put the rule in force: a printed constant of one of its cards, the scenario, a
 * lasting grant. The gate `announceDeckTops` asks before it reads the rules in force; exported for its test.
 */
export function deckTopRuleCanHold(state: GameState, deps: EngineDeps): boolean {
  return (
    poolPrintsRule(state.cardPool, deps.abilities) ||
    (state.scenarioRules.rules ?? []).some((rule) => rule.kind === "topOfDeckFaceup") ||
    state.lastingEffects.some((e) => e.kind === "ruleGrant" && e.rule.kind === "topOfDeckFaceup")
  );
}

/**
 * Logs every change in what is showing on top of a player deck since the last call, in player order, and records it.
 * Idempotent: a second call with nothing changed logs nothing. Does nothing while a hold is open (`holdDeckTops`).
 */
export function announceDeckTops(ctx: Ctx): void {
  if ((ctx.deckTopsHeld ?? 0) > 0) return;
  const known = ctx.state.deckTopsAnnounced;
  if (!known && ctx.state.encounterTopAnnounced === undefined && !deckTopRuleCanHold(ctx.state, ctx.deps)) return;
  announceEncounterTop(ctx);
  const faceup = deckTopFaceupPlayers(ctx.state, ctx.deps);
  const next: Record<string, InstanceId> = {};
  let changed = false;
  for (const player of ctx.state.players) {
    const was = known?.[player.playerId];
    const top = faceup.includes(player.playerId) ? player.deck[0] : undefined;
    if (top !== undefined) {
      next[player.playerId] = top;
      if (top === was) continue;
      changed = true;
      emit(ctx, {
        type: "deckTopShown",
        playerId: player.playerId,
        instanceId: top,
        cardId: ctx.state.instances[top]!.cardId,
      });
      continue;
    }
    if (was === undefined) continue;
    changed = true;
    // The rule stopped holding over a card that was showing: it is facedown again. With the rule still on, the deck
    // is empty: the shown card's own move is in the log already and there is nothing left to hide.
    if (!faceup.includes(player.playerId)) emit(ctx, { type: "deckTopHidden", playerId: player.playerId });
  }
  if (!changed) return;
  const { deckTopsAnnounced: _was, ...rest } = ctx.state;
  ctx.state = Object.keys(next).length > 0 ? { ...rest, deckTopsAnnounced: next } : rest;
}

/**
 * The encounter deck's half of `announceDeckTops` (`RuleSpec topOfDeckFaceup { deck: "encounter" }`,
 * docs/phase7-wave9.md §3.42): `encounterTopShown` for a card newly showing on top of the active villain's encounter
 * deck, `encounterTopHidden` when the rule stopped holding over a card that was showing. A showing card that left an
 * emptied deck logs nothing: its own move says so, and the reset that follows logs the new deck's top card
 * (`resetEncounterDeckIfEmpty`).
 */
function announceEncounterTop(ctx: Ctx): void {
  const was = ctx.state.encounterTopAnnounced;
  const faceup = encounterTopFaceup(ctx.state, ctx.deps);
  const top = faceup ? activeEncounterDeck(ctx.state).deck[0] : undefined;
  if (top === was) return;
  const deckId = activeEncounterDeckId(ctx.state);
  if (top !== undefined) {
    emit(ctx, { type: "encounterTopShown", deckId, instanceId: top, cardId: ctx.state.instances[top]!.cardId });
    ctx.state = { ...ctx.state, encounterTopAnnounced: top };
    return;
  }
  if (!faceup) emit(ctx, { type: "encounterTopHidden", deckId });
  const { encounterTopAnnounced: _was, ...rest } = ctx.state;
  ctx.state = rest;
}

/**
 * Runs `run` as one change to the decks: nothing is announced until it is done, then the result is. For an exchange
 * that passes through a state no player sees: a swap lifts the top card before the other card takes its place (RRG 1.8
 * "'Swap'", p. 42), and a find takes its card out of a deck that is shuffled before anyone reads its top (RRG 1.8
 * "Search", p. 39). Nested holds announce once, when the outermost ends.
 */
export function holdDeckTops<T>(ctx: Ctx, run: () => T): T {
  ctx.deckTopsHeld = (ctx.deckTopsHeld ?? 0) + 1;
  try {
    return run();
  } finally {
    ctx.deckTopsHeld = (ctx.deckTopsHeld ?? 1) - 1;
    announceDeckTops(ctx);
  }
}
