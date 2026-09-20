import {
  action,
  adjustBoostCount,
  alterEgoAction,
  anAttackableEnemy,
  attack,
  boostIconsOn,
  cancelRevealedCard,
  cards,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  confuse,
  coveredByEngineRule,
  dealDamage,
  defineAbilities,
  discardEncounterCards,
  discardFromHandCost,
  discardThis,
  draw,
  encounterCards,
  eventTarget,
  exhaustThis,
  FRIENDLY_CHARACTER,
  giveTough,
  heroAction,
  heroInterrupt,
  ifThen,
  inPlay,
  interrupt,
  moveCards,
  on,
  oncePerPhase,
  oncePerRound,
  option,
  playFromHandIgnoringCost,
  preventDamage,
  query,
  ready,
  removeThreat,
  replaceBoostCount,
  scaled,
  selectCards,
  self,
  stun,
  topOfDeck,
  totalPrintedCost,
  valueAtLeast,
  valueEquals,
  varOf,
  you,
  zone,
} from "../../dsl/index.js";
import { cardName } from "../names.js";

const A_CHARACTER = query("character");

/**
 * Scarlet Witch / Wanda Maximoff (15001a/b) and her hero kit (15002–15009).
 *
 * **Chaos Control (15001a) — Interrupt: "When boost icons on an encounter card would be counted, discard the top
 * card of the encounter deck and count the number of boost icons on that card instead."** Scripted against the
 * `boostIconsCounting` window the engine actually has: an activation's own boost step
 * (`packages/engine/src/resolve/enemy-activation.ts`, docs/phase7-wave2.md §3.6). `on.boostIconsCounted()`
 * (`dsl/abilities.ts`) is the exact primitive this pass names Chaos Control and Scarlet Witch's own Crest for.
 * **What this does NOT cover, by design (task brief; docs/phase7-wave2.md §3.6/§4.8):** several cards elsewhere in
 * this pack (Hex Bolt 15004, Molecular Decay 15005, Wiccan 15011, Luminous 15025, Chaos Manipulation 15027, and the
 * `qsv`-pack Scarlet Witch ally 14002) count boost icons on a card through their *own* `discardEncounterCards`/
 * `<bind>.boostIcons` reads, not through an activation's boost step — whether Chaos Control's "would be counted"
 * reaches *those* reads too is an open rules question with no FFG ruling on record
 * (docs/phase7-wave2.md §3.13.11/§4.8), deliberately surfaced to the user rather than guessed at here. Chaos
 * Control is scripted **only** against the window that exists today. If the broader reading is later confirmed,
 * widening the engine's `boostIconsCounting` window to also fire around a card effect's own boost-icon read is an
 * engine-side change; this script would not need to change at all, since it always discards-and-replaces whatever
 * the interrupted count would otherwise have used.
 *
 * **Agatha Harkness (15007) — "look at the top 3 cards of your deck. Add 1 of those to your hand and place the rest
 * on the bottom of your deck in any order"** is three sequential player choices (keep one, then place each of the
 * other two on the bottom one at a time), not `EffectSpec.reorderCards` — that primitive's own `to` field is
 * hardcoded to `"encounterDeckTop"` (built for Heimdall's identically-worded "put the others back in any order",
 * `wave1/thor/local.ts`, which reorders the *encounter* deck's own top, not a player's deck at all), so it can't
 * reach a player's own deck, let alone its bottom. Two single-card `chooseCards` steps (rather than one two-card
 * step) make the player's choice of *order* an explicit decision point instead of leaning on answer-array order for
 * something the client isn't guaranteed to present as ordered (`chooseCards`'s own request has no `ordered: true`
 * flag the way `reorderCards`'s does). Not a primitive gap: every step is an existing, general-purpose builder, and
 * the result is exactly "you choose which of the two goes on the bottom first."
 *
 * **Chaos Magic (15003) — "Play a card from your hand, ignoring its resource cost. Discard cards … equal to that
 * card's printed resource cost"** needed one more step than `playFromHandIgnoringCost` (`dsl/effects.ts`,
 * docs/phase7-wave2.md §3.8) supplies on its own: that effect's own "which card" prompt never binds the card it
 * played (its internal `_play.*` bindings are cleared before the card enters play — `resolve/effects-frame.ts`'s
 * `executePlayFromHand`), so a later effect in the same ability has nothing to point `totalPrintedCost` at. Fixed by
 * choosing the card *first* (`chooseCards`, binding it to a slot) and then restricting `playFromHandIgnoringCost`'s
 * own candidate filter to `{ inSlot: "played" }` — the same "an already-bound slot as the only legal candidate"
 * idiom `wave1/{gob,hlk,twc,bkw,drs}/local.ts` use for a tied villain/scheme pick — confirmed to work on a *hand*
 * card because `playFromHand`'s own candidate list is filtered by `matchesQuery` directly over hand-card instance
 * ids (`resolve/effects-frame.ts`'s `executePlayFromHand`), never through `chooseTarget`'s own candidate function
 * (`selectTargets`, `cardsInPlay(state)`-scoped), which is the exact trap `wave1/drs/nemesis.ts`'s own docblock
 * documents for `chooseTarget`+`inSlot` against a hand card. **Also fixes a one-line docblock mislabel while
 * reading this primitive**: `dsl/effects.ts`'s own comment on `playFromHandIgnoringCost` cited this card as
 * "(Chaos Magic, `qsv` pack)" — Chaos Magic is 15003, `scw`, not a `qsv` card; corrected in that file's own comment
 * as part of this pass (a doc-only fix, no shape change).
 *
 * **Molecular Decay (15005)** reads "Deal 5 damage … and discard the top 2 cards … For each boost icon discarded
 * this way, deal 1 additional damage" as one combined `attack` (`scaled(<bind>.boostIcons, { plus: 5 })`), the same
 * "one attack for the base plus the bonus" reading Repulsor Blast (01031, Core) already established for the
 * identical sentence shape, rather than two separate damage effects.
 *
 * **Hex Bolt (15004)** — "Discard the top 3 cards of the encounter deck. For each card discarded this way that has
 * boost icons equal to: 0/1/2/3+, …" is `discardEncounterCards(3, { forEachDiscarded })`: FAQ "Hex Bolt (#4)" (RRG
 * 1.8 p. 61) — "resolve the first sentence of Hex Bolt entirely, without interruption. Then, determine and resolve
 * the appropriate bulleted abilities based off of what was discarded" — is exactly `forEachDiscarded`'s own shape
 * ("every discard happens first … one pass per discarded card, in discard order", `resolve/apply-effect.ts`), so no
 * extra sequencing was needed beyond using the primitive as documented. "Place a status card on a character" names
 * no type, so it is scripted as a player choice among the three (RRG 1.8 gives no default for an unspecified status
 * card), the same reading `wave1/drs`'s Vapors of Valtorr already uses. Its four extra ability refs
 * (`.hex-bolt-constant` through `-constant-4`) are the parser's own per-bullet split (the same ingestion artifact
 * `qsv`'s Double Time and several `trors` cards carry) — `.hex-bolt-action` already carries the whole printed text,
 * so the extras are stood up empty (`coveredByEngineRule()`).
 *
 * **Scarlet Witch's Crest (15009)** is the card `adjustBoostCount`'s own docblock names as its motivating example
 * (`dsl/effects.ts`, docs/phase7-wave2.md §3.6) — "increase or decrease … by 1" is a `chooseOne` between the two
 * signed `adjustBoostCount` calls.
 */
export const SCW_KIT = defineAbilities({
  // Chaos Control — Interrupt: When boost icons on an encounter card would be counted, discard the top card of the
  // encounter deck and count the number of boost icons on that card instead. (Limit once per phase.) Module
  // docblock: scripted against the activation-boost-count window only.
  "15001a.chaos-control": interrupt(
    on.boostIconsCounted(),
    { limit: oncePerPhase },
    selectCards("discarded", encounterCards(["deck"], undefined, 1)),
    moveCards(cards(chosen("discarded")), "discard"),
    replaceBoostCount(chosen("discarded")),
  ),

  // Superpowered Siblings — Action: Discard 2 cards from your hand → draw 2 cards (draw 3 cards instead if Pietro
  // Maximoff is in play). (Limit once per round.) Printed on the alter-ego face itself, so a plain `action`, not
  // `alterEgoAction` (the same convention `qsv/kit.ts`'s own `14001b.superpowered-siblings` sibling uses).
  "15001b.superpowered-siblings": action(
    { cost: discardFromHandCost(2, 2), limit: oncePerRound },
    ifThen(inPlay(cardName("15002")), draw(3), draw(2)),
  ),

  // Quicksilver (ally, 15002) — Action: Ready Quicksilver. (Limit once per phase.)
  "15002.quicksilver-action": action({ limit: oncePerPhase }, ready(self)),

  // Chaos Magic — Hero Action: Play a card from your hand, ignoring its resource cost. Discard cards from the top
  // of the encounter deck equal to that card's printed resource cost (module docblock).
  "15003.chaos-magic-action": heroAction(
    chooseCards("played", zone("hand", you), { min: 1, max: 1 }),
    playFromHandIgnoringCost(you, { filter: { inSlot: "played" } }),
    discardEncounterCards(totalPrintedCost(chosen("played"))),
  ),

  // Hex Bolt — Hero Action: Discard the top 3 cards of the encounter deck. For each card discarded this way that
  // has boost icons equal to: 0, deal 2 damage to an enemy. / 1, remove 2 threat from a scheme. / 2, draw 1 card. /
  // 3+, place a status card on a character (module docblock).
  "15004.hex-bolt-action": heroAction(
    discardEncounterCards(3, {
      forEachDiscarded: {
        slot: "card",
        effects: [
          ifThen(valueEquals(boostIconsOn(chosen("card")), 0), [
            chooseTarget("enemy", query("enemy")),
            dealDamage(2, chosen("enemy")),
          ]),
          ifThen(valueEquals(boostIconsOn(chosen("card")), 1), [
            chooseTarget("scheme", query("scheme")),
            removeThreat(2, chosen("scheme")),
          ]),
          ifThen(valueEquals(boostIconsOn(chosen("card")), 2), draw(1)),
          ifThen(valueAtLeast(boostIconsOn(chosen("card")), 3), [
            chooseTarget("target", A_CHARACTER),
            chooseOne(
              option("Stun", stun(chosen("target"))),
              option("Confuse", confuse(chosen("target"))),
              option("Give a tough status card", giveTough(chosen("target"))),
            ),
          ]),
        ],
      },
    }),
  ),
  "15004.hex-bolt-constant": coveredByEngineRule(),
  "15004.hex-bolt-constant-2": coveredByEngineRule(),
  "15004.hex-bolt-constant-3": coveredByEngineRule(),
  "15004.hex-bolt-constant-4": coveredByEngineRule(),

  // Molecular Decay — Hero Action (attack): Deal 5 damage to an enemy and discard the top 2 cards of the encounter
  // deck. For each boost icon discarded this way, deal 1 additional damage to that enemy (module docblock).
  "15005.molecular-decay-action": heroAction(
    { label: "attack" },
    anAttackableEnemy(),
    discardEncounterCards(2, { bind: "d" }),
    attack(scaled(varOf("d.boostIcons"), { plus: 5 }), chosen("enemy")),
  ),

  // Warp Reality — Hero Interrupt: When an encounter card is revealed from the encounter deck, cancel all of its
  // effects and discard it. Discard cards from the top of the encounter deck equal to the number of boost icons on
  // that card.
  "15006.warp-reality-interrupt": heroInterrupt(
    on.encounterCardRevealed(),
    cancelRevealedCard(),
    discardEncounterCards(boostIconsOn(eventTarget)),
  ),

  // Agatha Harkness — Alter-Ego Action: Exhaust Agatha Harkness → look at the top 3 cards of your deck. Add 1 of
  // those to your hand and place the rest on the bottom of your deck in any order (module docblock).
  "15007.agatha-harkness-action": alterEgoAction(
    { cost: exhaustThis },
    selectCards("looked", topOfDeck(3)),
    chooseCards("kept", cards(chosen("looked")), { min: 1, max: 1 }),
    moveCards(cards(chosen("kept")), "hand"),
    chooseCards("first", cards(chosen("looked"), { excludeSlots: ["kept"] }), { min: 1, max: 1 }),
    moveCards(cards(chosen("first")), "deckBottom"),
    chooseCards("second", cards(chosen("looked"), { excludeSlots: ["kept", "first"] }), { min: 1, max: 1 }),
    moveCards(cards(chosen("second")), "deckBottom"),
  ),

  // Magic Shield — Hero Interrupt: When a friendly character would take any amount of damage, discard Magic
  // Shield → prevent 3 of that damage.
  "15008.magic-shield-interrupt": heroInterrupt(on.damage(FRIENDLY_CHARACTER), { cost: discardThis }, preventDamage(3)),

  // Scarlet Witch's Crest — Interrupt: When boost icons on an encounter card are counted, exhaust Scarlet Witch's
  // Crest → increase or decrease the number of boost icons on that card by 1 for this count (module docblock).
  "15009.scarlet-witchs-crest-interrupt": interrupt(
    on.boostIconsCounted(),
    { cost: exhaustThis },
    chooseOne(option("Increase by 1", adjustBoostCount(1)), option("Decrease by 1", adjustBoostCount(-1))),
  ),
});
