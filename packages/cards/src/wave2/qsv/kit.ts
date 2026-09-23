import {
  action,
  alterEgoAction,
  boostIconsOn,
  cards,
  chooseCards,
  chooseOptions,
  chooseTarget,
  chosen,
  constant,
  coveredByEngineRule,
  dealDamage,
  defineAbilities,
  discardFromHandCost,
  draw,
  encounterCards,
  exhaustThis,
  gets,
  heroAction,
  heroResponse,
  ifThen,
  inPlay,
  interrupt,
  modifyBasicPower,
  modifyStat,
  moveCards,
  on,
  oncePerPhase,
  oncePerRound,
  option,
  query,
  ready,
  removeThreat,
  resource,
  response,
  self,
  selectCards,
  stun,
  varOf,
  you,
  yourIdentity,
  YOUR_IDENTITY,
  zone,
} from "../../dsl/index.js";
import { cardName } from "../names.js";

/**
 * Quicksilver / Pietro Maximoff (14001a/b) and his hero kit (14002–14011).
 *
 * **§17.4's `on.basicPowerUsing`/`modifyBasicPower` (landed, docs/phase7-wave2.md) covers Scarlet Witch's own
 * interrupt (14002)**: "discard the top card of the encounter deck. For each boost icon discarded this way, [she]
 * gets +1 to that power for this use" reads exactly like Rapid Growth's own shape, except the bonus is a live
 * `ValueSpec` (`boostIconsOn`) rather than a fixed `+2`, which `modifyBasicPower(Amount)` already accepts.
 *
 * **"Discard the top card of the encounter deck" is `selectCards` + `moveCards`, not a search**: `encounterCards(
 * ["deck"], undefined, 1)` names exactly the top card (`top: 1`), so nothing needs to "stop on a match" the way
 * `discardEncounterUntil` does — the card is simply moved to discard and its boost icons read off the bound slot
 * (`boostIconsOn(chosen(...))`, already used this way for Black Panther's Ritual Combat, `core/heroes/black-
 * panther.ts`) wherever the card ends up.
 *
 * **Speed Cyclone's "X" cost (14006) is `playCard.x`** (docs/phase7-wave2.md §3.8, built for this exact card,
 * cited in `commands.ts`'s own docblock): bound as the play's var `x`, read by `chooseTarget.count` the same way
 * Shield Toss (03006, `wave1/cap/kit.ts`) reads a cost-bound X. OPEN QUESTION, carried over from that same
 * precedent: X = 0 is allowed (`chooseTarget`'s own `min` equals `count`, and RRG 1.8 "Cost" (p. 14)'s "at least
 * one" rule is about *paying* a cost, not about a chosen X value), so Speed Cyclone can be played for 0 to stun no
 * enemies — not obviously wrong (a real card could genuinely have no legal target), but not confirmed against any
 * FFG source either.
 *
 * **Serval Industries' "shuffle 2 Quicksilver cards" (14007) reads "Quicksilver cards" as `identitySetOf: you`**
 * (RRG 1.8 "Identity-Specific Card", p. 23 — the set icon, `aspect: "hero:14001a"` on every card in his own kit),
 * not a literal name match. `min: 0` (not the printed "2" exactly): RRG 1.8 "Choose (Option)" (p. 12) resolves as
 * much of an effect as possible when it can't be fully resolved, so a discard pile with 0 or 1 matching cards still
 * lets the (voluntary, Alter-Ego) Action be taken — the same reading Ant-Man's/Wasp's own "up to N" shuffle-back
 * abilities use for an identically-shaped effect.
 *
 * **`14009.friction-resistance-response` is now scripted** (docs/phase7-wave2.md §21/§23): "Hero Response: After
 * you ready Quicksilver, ready this card." is `on.cardReadied(YOUR_IDENTITY)` — the "-ed" twin of `cardReadying`,
 * an announcement pushed only once a ready actually happens (a "cannot ready" rule in play, or a card already
 * ready, announces nothing). The Resource half of the same card (`14009.friction-resistance-resource`) needed
 * nothing new and was already scripted.
 *
 * **Maximum Velocity's "Max 1 per phase."** is `playRestrictions.maxPerPhase` on the 14005 record
 * (`@mc/content`), engine-enforced in `packages/engine/src/actions.ts` — data only, no ability ref of its own
 * (the maxperphase-fix pass taught the ingestion parser this sentence, matching "Max 1 per player"/"Max 1 per
 * round"). `14005.maximum-velocity-action` (the +2/+2/+2 effect itself) is scripted normally below.
 */
export const QSV_KIT = defineAbilities({
  // Super Speed — Response: After you use one of Quicksilver's basic powers (THW, ATK, or DEF), ready him. (Limit
  // once per phase.)
  "14001a.super-speed": response(on.basicPowerUsed("self"), { limit: oncePerPhase }, ready(self)),

  // Superpowered Siblings — Action: Discard 2 cards from your hand → draw 2 cards (draw 3 instead if Scarlet
  // Witch — printed card name "Scarlet Witch", subtitle "Wanda Maximoff", 14002 — is in play). (Limit once per
  // round.) Printed on the alter-ego face itself, so a plain `action`, not `alterEgoAction` — the same convention
  // Wasp's G.I.R.L. (`13001b.girl`) and Ant-Man's alter-ego-face actions already use.
  "14001b.superpowered-siblings": action(
    { cost: discardFromHandCost(2, 2), limit: oncePerRound },
    ifThen(inPlay(cardName("14002")), draw(3), draw(2)),
  ),

  // Scarlet Witch (ally, 14002) — Interrupt: When you use one of Scarlet Witch's basic powers, discard the top
  // card of the encounter deck. For each boost icon discarded this way, Scarlet Witch gets +1 to that power for
  // this use (module docblock).
  "14002.scarlet-witch-interrupt": interrupt(
    on.basicPowerUsing("self"),
    selectCards("discarded", encounterCards(["deck"], undefined, 1)),
    moveCards(cards(chosen("discarded")), "discard"),
    modifyBasicPower(boostIconsOn(chosen("discarded"))),
  ),

  // Always Be Running — Hero Action: Ready Quicksilver.
  "14003.always-be-running-action": heroAction(ready(yourIdentity)),

  // Double Time — Hero Action: Choose two of the following (you may choose the same option twice): Deal 2 damage
  // to an enemy / Remove 2 threat from a scheme (`chooseOptions`, built for this exact card). The two extra
  // ability refs (`-constant`/`-constant-2`) are the two bulleted lines, the same parser artifact other packs'
  // bulleted "choose" abilities carry (Absorbing Man's Omni-Morph Duplication, `trors`) — `.double-time-action`
  // already carries both bullets, so they're stood up empty.
  "14004.double-time-action": heroAction(
    chooseOptions(
      2,
      [
        option("Deal 2 damage to an enemy", chooseTarget("enemy", query("enemy")), dealDamage(2, chosen("enemy"))),
        option(
          "Remove 2 threat from a scheme",
          chooseTarget("scheme", query("scheme")),
          removeThreat(2, chosen("scheme")),
        ),
      ],
      { allowRepeat: true },
    ),
  ),
  "14004.double-time-constant": coveredByEngineRule(),
  "14004.double-time-constant-2": coveredByEngineRule(),

  // Maximum Velocity — Max 1 per phase (data: `playRestrictions.maxPerPhase`, engine-enforced). Hero Action: you
  // get +2 THW, +2 ATK, and +2 DEF until the end of the round.
  "14005.maximum-velocity-action": heroAction(
    modifyStat("thw", 2, yourIdentity, "endOfRound"),
    modifyStat("atk", 2, yourIdentity, "endOfRound"),
    modifyStat("def", 2, yourIdentity, "endOfRound"),
  ),

  // Speed Cyclone — Hero Action: Stun X Enemies (module docblock).
  "14006.speed-cyclone-action": heroAction(
    chooseTarget("enemies", query("enemy"), { count: varOf("x") }),
    stun(chosen("enemies")),
  ),

  // Serval Industries — Alter-Ego Action: Exhaust Serval Industries → shuffle 2 Quicksilver cards from your
  // discard pile into your deck (module docblock).
  "14007.serval-industries-action": alterEgoAction(
    { cost: exhaustThis },
    chooseCards("shuffled", zone("discard", you, { filter: { identitySetOf: you } }), { min: 0, max: 2 }),
    moveCards(cards(chosen("shuffled")), "deckShuffle"),
  ),

  // Accelerated Reflex — Quicksilver gets +1 DEF.
  "14008.accelerated-reflex-constant": constant(gets("def", 1, YOUR_IDENTITY)),

  // Friction Resistance — Hero Response: After you ready Quicksilver, ready this card (module docblock, §21).
  "14009.friction-resistance-response": heroResponse(on.cardReadied(YOUR_IDENTITY), ready(self)),
  // Resource: Exhaust Friction Resistance → generate a [physical] resource.
  "14009.friction-resistance-resource": resource({ physical: 1 }, { cost: exhaustThis }),

  // Hyper Perception — Quicksilver gets +1 THW.
  "14010.hyper-perception-constant": constant(gets("thw", 1, YOUR_IDENTITY)),

  // Reinforced Sinew — Quicksilver gets +1 ATK.
  "14011.reinforced-sinew-constant": constant(gets("atk", 1, YOUR_IDENTITY)),
});
