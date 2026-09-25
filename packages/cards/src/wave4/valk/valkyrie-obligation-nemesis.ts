import { trait } from "@mc/content";
import {
  alterEgoAction,
  anyOfCards,
  attachCard,
  cards,
  chooseCards,
  chosen,
  constant,
  controllerOf,
  defineAbilities,
  encounterCards,
  engage,
  host,
  ifThen,
  moveCards,
  partOf,
  query,
  rule,
  self,
  setAside,
  shuffleEncounterDeck,
  spend,
  surge,
  treatAttachedAllyAsMinion,
  whenRevealed,
  you,
  yourIdentity,
  playersCannotDiscard,
} from "../../dsl/index.js";
import type { Predicate, TargetRef } from "@mc/engine";

/** "If you cannot, this card gains surge" (Goblin Glider, `wave1/gob/local.ts`'s own precedent — a pack-local
 * wrapper, `Predicate.isAttached` has no shared DSL builder): whether `attachesTo` found a legal host for this card
 * (RRG 1.8 "Attach To", p. 8 — a card that cannot attach is discarded, but its own When Revealed still resolves and
 * reads this). Beguiled's own "Otherwise, this card gains surge" is exactly this question. */
const isAttached = (of: TargetRef): Predicate => ({ kind: "isAttached", of });

/** "…the enemy with Death-Glow attached" is the kit's own — this module is `valkyrie-kit.ts`'s obligation/nemesis
 * sibling. */
const ENTHRALLED = trait("ENTHRALLED");
const ATTACK = trait("ATTACK");
/** Whoever this rule's card speaks for: an obligation's own controller (RRG 1.8 "Obligation", p. 30, quoted in
 * `core/obligations.ts`'s own docblock) for Trouble in Otherworld, or an attachment's host for Seduced. */
const YOUR_IDENTITY = query("identity", { controller: "you" });

/**
 * Trouble in Otherworld (25028), Valkyrie's obligation, and her nemesis set: Enchantress (25029, the same minion `mts`
 * reprints in its own Enchantress modular, 21177), Powerful Enchantments (25030), Beguiled (25031, errata RRG 1.8
 * p. 67: the Condition trait and the quoted When Revealed), Seduced x2 (25032).
 */
export const VALKYRIE_OBLIGATION_NEMESIS = defineAbilities({
  // Trouble in Otherworld — Give to the Brunnhilde player (data). Valkyrie cannot attack the enemy with Death-Glow
  // attached. Alter-Ego Action: Spend [energy][mental] resources → remove Trouble in Otherworld from the game. Not
  // the shared "flip / choose / discard this obligation" shape (`core/obligations.ts`'s `obligation()`): this
  // obligation's own two lines are a standing constant plus a plain removal action, matching the two ability refs the
  // pipeline emitted (`-constant`, `-action`).
  "25028.trouble-in-otherworld-constant": constant(
    rule({
      kind: "cannotAttack",
      target: query("enemy", { hasAttachment: { name: "Death-Glow" } }),
      attacker: YOUR_IDENTITY,
    }),
  ),
  "25028.trouble-in-otherworld-action": alterEgoAction(
    { cost: spend({ energy: 1, mental: 1 }) },
    moveCards(cards(self), "removedFromGame"),
  ),

  // Enchantress (minion, 25029) — When Revealed: Search the encounter deck, discard pile, and set-aside area for a
  // copy of Seduced and attach it to your identity. (Shuffle.) "You" is the revealing player (RRG 1.8 "You, Your",
  // p. 49), read the same way as every other When Revealed's `yourIdentity`. "The set-aside area" is *this player's
  // own* nemesis-set-aside pile (`PlayerState.setAside`, `CardSelector setAside` — the same home Death-Glow starts
  // in, `valkyrie-kit.ts`), not the shared scenario set-aside pool `encounterSetAside` reads.
  "25029.when-revealed": whenRevealed(
    chooseCards(
      "seduced",
      anyOfCards(
        encounterCards(["deck", "discard"], query("attachment", { name: "Seduced" })),
        setAside(you, query("attachment", { name: "Seduced" })),
      ),
      { min: 1, max: 1 },
    ),
    attachCard(chosen("seduced"), yourIdentity),
    shuffleEncounterDeck(),
  ),

  // Powerful Enchantments (side scheme, 25030) — Hinder 1[per_hero] (data). Players cannot discard attachments that
  // are attached to friendly characters (`playersCannotDiscard`, docs/phase7-wave4.md §3.44: a friendly character is a
  // hero or alter-ego identity or an ally a player controls; the host's defeat still discards them).
  "25030.powerful-enchantments-constant": constant(
    playersCannotDiscard(
      query("attachment", { host: { kind: "each", query: query(["identity", "ally"], { controller: "any" }) } }),
    ),
  ),

  // Beguiled (attachment, 25031, errata RRG 1.8 p. 67: Condition trait, already in data) — Treat attached ally as an
  // Enthralled minion with a blank text box. Attached minion's SCH is equal to its printed THW and it does not take
  // consequential damage (both already true of `treatAttachedAllyAsMinion`: `schFromThw` and, per docs/phase7-
  // wave4.md §3.29's own note, "an ally treated as a minion takes none" — it can no longer be chosen as a basic
  // attacker/thwarter, the only way consequential damage is ever assessed). When Revealed: Attach to the ally with
  // the highest cost without Beguiled attached (data `attachesTo`, the superlative host `game-rules-architect`
  // landed for this exact card). Attached ally engages its controller. Otherwise, this card gains surge — `isAttached`
  // reads whether the printed `attachesTo` found a legal host (RRG 1.8 "Attach To", p. 8: a card that cannot attach
  // is discarded, but its own When Revealed still resolves and reads this, the Goblin Glider shape).
  "25031.beguiled-constant": constant(treatAttachedAllyAsMinion([ENTHRALLED])),
  "25031.beguiled-constant-2": partOf("25031.beguiled-constant"),
  "25031.when-revealed": whenRevealed(ifThen(isAttached(self), engage(host, controllerOf(host)), surge())),

  // Seduced (attachment x2, 25032) — Attach to your identity (data). You cannot make basic attacks or play attack
  // events. Alter-Ego Action: Spend [energy][mental] resources → discard this card.
  "25032.seduced-constant": constant(
    rule({ kind: "cannotAttack", target: query("enemy"), attacker: { hostOfSelf: true } }),
    rule({ kind: "cannotPlay", player: controllerOf(host), cards: query("event", { trait: ATTACK }) }),
  ),
  "25032.seduced-action": alterEgoAction({ cost: spend({ energy: 1, mental: 1 }) }, moveCards(cards(self), "discard")),
});
