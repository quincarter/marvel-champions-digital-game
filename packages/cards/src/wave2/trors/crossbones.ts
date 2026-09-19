import { trait } from "@mc/content";
import {
  attachCard,
  boost,
  buildScenarioDeck,
  chosen,
  constant,
  coveredByEngineRule,
  dealIndirectDamage,
  defineAbilities,
  discardEncounterCards,
  discardFromHand,
  discardEncounterUntil,
  exists,
  firstPlayer,
  forcedInterrupt,
  gainsKeyword,
  giveTough,
  heal,
  heroAction,
  placeDamage,
  query,
  removeCountersFrom,
  revealCard,
  scenarioDeck,
  self,
  selectCards,
  setup,
  spend,
  statOf,
  theVillain,
  varOf,
  when,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
} from "../../dsl/index.js";

const WEAPON = trait("WEAPON");

/**
 * Crossbones scenario (`crossbones` encounter set, plus Experimental Weapons and the Hydra Assault/Weapon Master
 * modular sets): the villain (04058–04060), main scheme "Attack on Mount Athena" (04061), his own encounter set
 * (04064–04071) and the Experimental Weapons attachments (04072–04075).
 *
 * **Data gap flagged for `card-data-pipeline` (docs/phase7-wave2-scripting.md):** the 1A text prints "Three
 * modular sets (Hydra Assault, Weapon Master, and Legions of Hydra)", but `trors/encounterSets.ts` only registers
 * `hydra_assault` and `weap_master` — there is no "Legions of Hydra" `EncounterSet`. The scenario builder
 * (`../setup.ts`) uses only the two that exist.
 *
 * **Skipped (missing engine primitive):**
 * - `04058.crossbones-constant` (and `04059`/`04060`'s copies) — "While Crossbones has a Weapon attachment, his
 *   attacks gain piercing" IS scriptable as a conditional constant (`gainsKeyword` with `while: exists(...)`) and
 *   is scripted below — not actually blocked (an earlier pass over this text mistook it for the one-shot-event
 *   gap; a villain's own conditional keyword grant reads the villain's own keywords correctly).
 */
export const CROSSBONES_SET = defineAbilities({
  // Crossbones (I) — [star] While Crossbones has a Weapon attachment, his attacks gain piercing.
  "04058.crossbones-constant": constant(gainsKeyword({ name: "piercing" }, query("villain", { self: true }), { while: exists(query("attachment", { trait: WEAPON, host: self })) })),
  // Crossbones (II) — same constant, plus When Revealed: search for Crossbones' Machine Gun and attach it. Shuffle.
  "04059.crossbones-constant": constant(gainsKeyword({ name: "piercing" }, query("villain", { self: true }), { while: exists(query("attachment", { trait: WEAPON, host: self })) })),
  "04059.when-revealed": whenRevealed(
    selectCards("found", { kind: "encounter", zones: ["deck", "discard"], filter: query("attachment", { name: "Crossbones' Machine Gun" }) }),
    attachCard(chosen("found"), theVillain),
    { kind: "shuffleEncounterDeck" },
  ),
  // Crossbones (III) — same constant, plus When Revealed: reveal the top card of the Experimental Weapons deck.
  "04060.crossbones-constant": constant(gainsKeyword({ name: "piercing" }, query("villain", { self: true }), { while: exists(query("attachment", { trait: WEAPON, host: self })) })),
  "04060.when-revealed": whenRevealed(
    selectCards("top", scenarioDeck("Experimental Weapons", { top: 1 })),
    revealCard(chosen("top"), firstPlayer),
  ),

  // Attack on Mount Athena 1A — Setup: Create the Experimental Weapons deck and set it next to the main scheme deck.
  "04061a.setup": setup(buildScenarioDeck("Experimental Weapons")),
  // The Infinity Stone (2A/2B) — When Revealed: Reveal the top card of the Experimental Weapons deck.
  "04062b.when-revealed": whenRevealed(selectCards("top", scenarioDeck("Experimental Weapons", { top: 1 })), revealCard(chosen("top"), firstPlayer)),
  // The Getaway (3A/3B) — When Revealed: Reveal the top card of the Experimental Weapons deck. If completed, lose (data).
  "04063b.when-revealed": whenRevealed(selectCards("top", scenarioDeck("Experimental Weapons", { top: 1 })), revealCard(chosen("top"), firstPlayer)),

  // Crossbones' Machine Gun — Attach to Crossbones (data). Uses (2 [per_hero] ammo counters) (data).
  // [star] Forced Interrupt: When Crossbones attacks you, remove 1 ammo counter from this card and discard the top
  // card of the encounter deck → take indirect damage equal to the number of boost icons on the discarded card.
  // The data emits a second ("-constant") ability ref alongside the forced interrupt with no separate printed
  // text of its own (the "Uses" line is data, not a scripted constant) — an empty constant, like a keyword-only
  // card's ref elsewhere in this pack (`04031b.jessica-drew-constant`, `spider-woman-kit.ts`).
  "04064.crossbones-machine-gun-constant": coveredByEngineRule(),
  "04064.crossbones-machine-gun-forced-interrupt": forcedInterrupt(
    when.enemyAttacks("host", { againstYou: true }),
    removeCountersFrom(self, "ammo", 1),
    discardEncounterCards(1, { bind: "d" }),
    dealIndirectDamage("group", varOf("d.boostIcons")),
  ),

  // Crossbones' Armor — Attach to Crossbones. Forced Interrupt: When Crossbones would take any amount of damage,
  // place it here instead. If there is 5 or more damage here, discard Crossbones' Armor.
  "04065.crossbones-armor-forced-interrupt": forcedInterrupt(
    when.damage("host"),
    { kind: "replaceTriggeringEvent", with: [placeDamage({ kind: "eventAmount" }, self)] },
  ),

  // Hydra Bomber (04066) is a verbatim Core reprint (01110) — aliased by `../reprints.ts`, not scripted here.

  // Full Auto — When Revealed (Alter-Ego): Surge. When Revealed (Hero): Discard X cards from the top of the
  // encounter deck, where X is Crossbones' ATK. Take 1 indirect damage for each boost icon discarded this way.
  "04067.when-revealed-alter-ego": whenRevealedAlterEgo({ kind: "gainSurge" }),
  "04067.when-revealed-hero": whenRevealedHero(
    discardEncounterCards(statOf(theVillain, "atk"), { bind: "d" }),
    dealIndirectDamage("group", varOf("d.boostIcons")),
  ),

  // Hard as Nails — When Revealed: Give the villain a tough status card. If you cannot, heal 3 damage from it instead.
  "04068.when-revealed": whenRevealed({
    kind: "if",
    condition: { kind: "not", of: { kind: "hasStatus", of: { kind: "villain" }, status: "tough" } },
    then: [giveTough({ kind: "villain" })],
    otherwise: [heal(3, { kind: "villain" })],
  }),
  // [star] Boost: Give the villain a tough status card. If you cannot, heal 3 damage from it instead.
  "04068.boost": boost({
    kind: "if",
    condition: { kind: "not", of: { kind: "hasStatus", of: { kind: "villain" }, status: "tough" } },
    then: [giveTough({ kind: "villain" })],
    otherwise: [heal(3, { kind: "villain" })],
  }),

  // Raid the Armory — Incite 1 (data). When Revealed: Discard cards from the top of the encounter deck until a
  // Weapon attachment is discarded. Reveal that card.
  "04069.when-revealed": whenRevealed(discardEncounterUntil(query("attachment", { trait: WEAPON }), "found"), revealCard(chosen("found"), firstPlayer)),

  // Crossbones' Assault — When Defeated: Crossbones activates against the player who defeated this scheme.
  // SKIPPED: needs a "player who defeated it" reference (the defeating player of a *scheme*, not a character — no
  // TargetRef/PlayerRef reads a scheme's own `characterDefeated`/`schemeDefeated` defeating player today). Closest
  // existing primitive: `on.defeated`'s `byYou` filter on the *responding* ability, which can't name that player
  // as a `PlayerRef` for a later effect the way this needs.

  // Cornered Staff — When Revealed: Discard 1 [per_hero] cards from the top of the encounter deck. Place 1
  // additional threat here for each boost icon discarded this way.
  "04071.when-revealed": whenRevealed(
    discardEncounterCards({ kind: "perPlayer", base: 0, perPlayer: 1 }, { bind: "d" }),
    { kind: "placeThreat", target: self, amount: varOf("d.boostIcons") },
  ),

  // Laser Rifle — Attach to the Villain (data). [star] Forced Interrupt: When attached villain attacks, the
  // attack gains ranged (persistent attachment: host gains ranged, safe). Hero Action: Spend [E][P] → discard.
  "04072.laser-rifle-forced-interrupt": constant(gainsKeyword({ name: "ranged" }, query("enemy", { hostOfSelf: true }))),
  "04072.laser-rifle-action": heroAction({ cost: spend({ energy: 1, physical: 1 }) }, { kind: "discardFromPlay", target: self }),

  // Energy Shield — Attach to the villain. Attached villain gains retaliate 1. Hero Action: Spend [E][M] → discard.
  "04073.energy-shield-constant": constant(gainsKeyword({ name: "retaliate", value: 1 }, query("enemy", { hostOfSelf: true }))),
  "04073.energy-shield-action": heroAction({ cost: spend({ energy: 1, mental: 1 }) }, { kind: "discardFromPlay", target: self }),

  // Power Gauntlets — Attach to the Villain. [star] Forced Response: After the attached villain attacks and
  // damages you, discard 1 card from your hand. Hero Action: Spend [M][P] → discard.
  "04074.power-gauntlets-forced-response": {
    trigger: { kind: "response", forced: true, on: { on: "enemyAttack", sourceIs: { hostOfSelf: true }, playerIs: "controller", usesAttackedPlayer: true, requireResults: { damage: 1 } } },
    effects: [discardFromHand(1)],
  },
  "04074.power-gauntlets-action": heroAction({ cost: spend({ mental: 1, physical: 1 }) }, { kind: "discardFromPlay", target: self }),

  // Exo-Suit — Attach to the villain (data, +1 ATK +1 SCH). Hero Action: Spend [E][M][P] → discard this card.
  "04075.exo-suit-action": heroAction({ cost: spend({ energy: 1, mental: 1, physical: 1 }) }, { kind: "discardFromPlay", target: self }),
});
