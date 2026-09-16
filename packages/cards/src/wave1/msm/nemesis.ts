import { trait } from "@mc/content";
import type { EffectSpec } from "@mc/engine";
import {
  cards,
  constant,
  countOf,
  defineAbilities,
  each,
  eachPlayer,
  engagedPlayerOf,
  exhaust,
  exists,
  forEachPlayer,
  heal,
  heroAction,
  ifThen,
  moveCards,
  not,
  query,
  rule,
  self,
  selectCards,
  spend,
  sum,
  surge,
  theVillain,
  thatPlayer,
  topOfDeck,
  varAtLeast,
  varOf,
  whenRevealed,
} from "../../dsl/index.js";

const PERSONA = trait("Persona");

/**
 * Ms. Marvel's nemesis set: Generation Why? (05026, side scheme), Thomas Edison (05027, nemesis minion), Edison's
 * Giant Robot (05028, minion), Harvest (05029, treachery ×2).
 */
export const MSM_NEMESIS = defineAbilities({
  // Generation Why? — When Revealed: Discard the top card of each player's deck for each ally and Persona support
  // in play. The count is `count(ally) + count(support, trait: Persona)` — two disjoint queries (a plain ally can
  // lack Persona, and every Persona card in this pack is a support, never an ally) summed with `sum(...)`
  // (`ValueSpec` `sum`, landed 2026-09-15 for exactly this card — docs/phase7-wave1-scripting.md §6), since a
  // single query's `trait` filter would apply to every category it lists (`categories: ["ally", "support"], trait:
  // PERSONA` would wrongly require allies to have the Persona trait too).
  "05026.when-revealed": whenRevealed(
    forEachPlayer(eachPlayer, moveCards(topOfDeck(sum(countOf(query("ally")), countOf(query("support", { trait: PERSONA }))), thatPlayer), "discard")),
  ),

  // Thomas Edison — Thomas Edison cannot take damage while you are engaged with another minion. (Ms. Marvel's
  // nemesis minion.) "You" here is the player engaged with him (RRG "You, Your" reads an encounter card's "you" as
  // whoever it's speaking to); `engagedPlayerOf(self)` reads that player live.
  "05027.thomas-edison-constant": constant(
    rule({
      kind: "cannotTakeDamage",
      target: { self: true },
      while: exists(query("minion", { engagedWithPlayer: engagedPlayerOf(self), self: false })),
    }),
  ),

  // Edison's Giant Robot — Edison's Giant Robot cannot take damage.
  "05028.edisons-giant-robot-constant": constant(rule({ kind: "cannotTakeDamage", target: { self: true } })),
  // Edison's Giant Robot — Hero Action: Spend a [mental] resource → until the end of the phase, treat this card's
  // printed text box as if it were blank. `blankTextBox` (engine `spec.ts`/`lasting.ts`) was landed with this exact
  // card named in its own doc comment; `dsl/effects.ts` has no builder sugar for it yet.
  "05028.edisons-giant-robot-action": heroAction(
    { cost: spend({ mental: 1 }) },
    { kind: "blankTextBox", target: self, until: "endOfPhase" } as EffectSpec,
  ),

  // Harvest — When Revealed: Exhaust each Persona support in play. For each support exhausted this way, the
  // villain heals 1 damage. If no Persona support was exhausted this way, this card gains surge.
  // "Exhausted this way" only counts supports that were actually ready beforehand (exhausting an already-exhausted
  // card changes nothing) — `selectCards` looks at (and binds the count of) the ready ones *before* the `exhaust`
  // effect runs, since it targets exactly the set the `exhaust` is about to act on.
  "05029.when-revealed": whenRevealed(
    selectCards("readyPersona", cards(each(query("support", { trait: PERSONA, exhausted: false })))),
    exhaust(each(query("support", { trait: PERSONA }))),
    heal(varOf("readyPersona.count"), theVillain),
    ifThen(not(varAtLeast("readyPersona.count", 1)), surge()),
  ),
});
