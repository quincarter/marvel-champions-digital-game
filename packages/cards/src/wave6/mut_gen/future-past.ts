import { trait } from "@mc/content";
import {
  anyOfCards,
  atMost,
  attachCard,
  boost,
  chosen,
  constant,
  dealAsEncounterCard,
  dealIndirectDamage,
  defineAbilities,
  discardEncounterCards,
  eachPlayer,
  encounterCards,
  encounterSetAside,
  forEachPlayer,
  gainsTrait,
  gets,
  maxDamageTaken,
  putIntoPlay,
  query,
  selectCards,
  self,
  setAside,
  shuffleEncounterDeck,
  thatPlayer,
  topOfDeck,
  tuckCards,
  varOf,
  whenDefeated,
  whenRevealed,
  you,
} from "../../dsl/index.js";

const HOST_MINION = query("minion", { hostOfSelf: true });
const NEMESIS_MINION = query("minion", { nemesisMinionOf: you });

/**
 * The Future Past encounter set (`future_past`, `mut_gen` 32166-32170, MC32 pp. 7-19, docs/phase7-wave6.md §2, §3.4,
 * §3.24): Nimrod, Bastion, Nimrod's Portal, Bastion's Machinations and Nano-Sentinel Tech. The campaign draws on it as
 * the Future Past deck (the side schemes 32171-32175 are campaign cards, `campaign-cards.ts`); outside the campaign it
 * is an ordinary modular set. Moving the cards between decks is campaign composition, not card text.
 *
 * **Nimrod's cap** counts damage taken each phase; damage above it is neither taken nor prevented and gives no excess
 * or overkill (§4.1 Q9 amended: RRG 1.8 "Overkill", p. 31, excess is damage taken).
 * **Bastion's boost** deals the boost card itself to the attacked player; it is out of the boost area when the effect
 * resolves and sits in the encounter discard pile (as Sentinel Mark VI, `sentinels.ts`). A Future Past card that is
 * dealt facedown and never revealed returns to the Future Past deck next scenario (§4.1 Q13).
 * **Nano-Sentinel Tech** prints no "attach to" text: like Old Grudge (`sm` 27172) its When Revealed does the search,
 * puts the minion into play engaged with the player and attaches the card (RRG 1.8 "Reveal", p. 38); the search
 * shuffles the encounter deck afterwards (RRG 1.8 "Search", p. 40). With no nemesis minion to find the card is
 * discarded by the reveal frame (it never attached).
 */
export const FUTURE_PAST_ABILITIES = defineAbilities({
  // Nimrod (32166) — Stalwart. Victory 1 (data). Nimrod cannot take more than 3 damage each phase.
  "32166.nimrod-constant": constant(maxDamageTaken({ self: true }, 3, { per: "phase" })),

  // Bastion (32167) — Toughness. Villainous. Victory 1 (data). [star] Boost: Deal this card to yourself as a facedown
  // encounter card.
  "32167.boost": boost(dealAsEncounterCard(self, you)),

  // Nimrod's Portal (32168) — Victory 1 (data). When Defeated: In player order, each player discards the top 2 cards of
  // the encounter deck and takes indirect damage equal to the number of boost icons discarded this way.
  "32168.when-defeated": whenDefeated(
    forEachPlayer(
      eachPlayer,
      discardEncounterCards(2, { bind: "d" }),
      dealIndirectDamage(thatPlayer, varOf("d.boostIcons")),
    ),
  ),

  // Bastion's Machinations (32169) — Victory 1, amplify (data). When Revealed: Each player places the top 9 cards of
  // their deck facedown under here.
  "32169.when-revealed": whenRevealed(forEachPlayer(eachPlayer, tuckCards(topOfDeck(9, thatPlayer), self, true))),

  // Nano-Sentinel Tech (32170) — Victory 1 (data). Attached minion gets +4 hit points and gains the Sentinel trait.
  "32170.nano-sentinel-tech-constant": constant(gets("hp", 4, HOST_MINION), gainsTrait(trait("SENTINEL"), HOST_MINION)),
  // When Revealed: Search the encounter deck, discard pile, and set-aside area for your nemesis minion. Put it into play
  // engaged with you and attach this card to it.
  "32170.when-revealed": whenRevealed(
    selectCards(
      "nemesisMinion",
      atMost(
        1,
        anyOfCards(
          encounterCards(["deck", "discard"], NEMESIS_MINION),
          setAside(you, NEMESIS_MINION),
          encounterSetAside(NEMESIS_MINION),
        ),
      ),
    ),
    shuffleEncounterDeck(),
    putIntoPlay(chosen("nemesisMinion"), you),
    attachCard(self, chosen("nemesisMinion")),
  ),
});
