import { trait } from "@mc/content";
import {
  allOf,
  attacksGainKeywords,
  cards,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  defineAbilities,
  discard,
  discardCardsCost,
  each,
  enemyAttack,
  forcedInterrupt,
  forcedResponse,
  friendlyCharacterAttacks,
  gets,
  heroAction,
  ifThen,
  made,
  moveCards,
  not,
  on,
  query,
  self,
  surge,
  valueEquals,
  varOf,
  whenRevealed,
  you,
} from "../../dsl/index.js";
import { obligation } from "../../core/obligations.js";

const TECHNIQUE = trait("TECHNIQUE");

/** Every technique upgrade Nebula controls (the same query her own kit uses, `nebula-kit.ts`). */
const YOUR_TECHNIQUE_UPGRADES = query("upgrade", { controller: "you", trait: TECHNIQUE });

/** Nebula's own hero identity, whoever controls it (the shared "Gamora" precedent, `wave3/gam/gamora-obligation-
 * nemesis.ts`'s own docblock: an identity query, not `named`, so it still matches whichever face is up). */
const NEBULA = query("identity", { name: "Nebula" });
/** The Gamora character currently in play against Nebula — the ally (22002) or her own nemesis minion (22028):
 * both are titled "Gamora", and the nemesis interrupt below guarantees at most one is ever in play at once. */
const GAMORA_CHARACTER = query(["ally", "minion"], { name: "Gamora" });

/**
 * Inferiority Complex (22027), Nebula's obligation, and her nemesis set: Gamora (22028, the nemesis minion —
 * distinct from the Gamora ally, 22002), Self-Preservation (22029), Lethal Weapon (22030), Old Rivals ×2 (22031).
 */
export const NEBULA_OBLIGATION_NEMESIS = defineAbilities({
  // Inferiority Complex — Give to Nebula player. You may flip to alter-ego form. Choose:
  // • Exhaust your alter-ego → remove Inferiority Complex from the game.
  // • Choose and discard 2 Technique upgrades you control. If no upgrade was discarded this way, this card gains
  //   surge. Discard this obligation.
  // The shared `obligation()` shape (`core/obligations.ts`) already appends "Discard this obligation" after the
  // alternative's own effects, matching this card's own final line.
  "22027.obligation": obligation("Nebula", {
    label: "Choose and discard 2 Technique upgrades you control",
    effects: [
      // `min: 2, max: 2`: RRG 1.8 "Choose (Option)" (p. 12) resolves as much of a mandatory "choose 2" as possible
      // rather than letting the player voluntarily discard fewer — the engine already caps `minSelections` to
      // however many candidates actually exist (`executeChooseCards`, `packages/engine/src/resolve/effects-
      // frame.ts`), so this discards both when she controls 2+, fewer when she controls fewer, and offers no
      // choice at all (0 discarded, `moved.count` 0) when she controls none — exactly "if no upgrade was discarded
      // this way".
      chooseCards("discarded", cards(each(YOUR_TECHNIQUE_UPGRADES)), { min: 2, max: 2 }),
      moveCards(cards(chosen("discarded")), "discard", "moved"),
      ifThen(valueEquals(varOf("moved.count"), 0), surge()),
    ],
  }),

  // Gamora (nemesis minion, 22028) — Retaliate 2 (data). Forced Interrupt: When this minion would enter play,
  // discard the Gamora ally from play. (Nebula's nemesis minion.) The same shape as Gamora's own nemesis minion
  // Nebula (18026, `wave3/gam/gamora-obligation-nemesis.ts`) — `cardEntersPlay` is interruptible, so the ally is
  // gone before the minion's own keywords (and the ally limit) ever see it.
  "22028.gamora-forced-interrupt": forcedInterrupt(
    on.entersPlay("self"),
    discard(each(query("ally", { name: "Gamora" }))),
  ),
  // Gamora (nemesis minion, 22028) — [star] Forced Response: After Gamora attacks and damages you, choose and
  // discard an upgrade you control. "You" is whoever this minion is engaged with, so an ordinary "against you"
  // enemy-attack pattern already reads it correctly (RRG 1.8 "You, Your", p. 49).
  "22028.gamora-forced-response": forcedResponse(
    on.enemyAttacks("self", { againstYou: true, damages: true }),
    chooseTarget("upgrade", query("upgrade", { controller: "you" })),
    discard(chosen("upgrade")),
  ),

  // Self-Preservation (side scheme, 22029) — Nebula gets -1 THW, -1 ATK, and -1 DEF. Gamora gets +1 ATK and her
  // attacks gain piercing.
  "22029.self-preservation-constant": constant(
    gets("thw", -1, NEBULA),
    gets("atk", -1, NEBULA),
    gets("def", -1, NEBULA),
  ),
  "22029.self-preservation-constant-2": constant(
    gets("atk", 1, GAMORA_CHARACTER),
    attacksGainKeywords(["piercing"], { attacker: GAMORA_CHARACTER }),
  ),

  // Lethal Weapon (attachment, 22030) — Attach to Gamora, or the villain if unable (data). Hero Action: Discard an
  // upgrade you control → discard this attachment (the in-play discard cost, docs/phase7-wave4.md §3.25).
  "22030.lethal-weapon-action": heroAction(
    { cost: discardCardsCost(query("upgrade", { controller: "you" })) },
    discard(self),
  ),

  // Old Rivals (treachery ×2, 22031) — errata (RRG 1.8 p. 67): When Revealed: Gamora attacks you. If the Gamora hero or
  // ally is in play, she attacks you (resolve her ATK against you without exhausting her). If no attack was made this
  // way, this card gains surge. Ruling, Jun 25, 2026 (4) #1: the first sentence is the Gamora minion, the second the
  // hero or ally (a friendly character's own attack, docs/phase7-wave4.md §3.26).
  "22031.when-revealed": whenRevealed(
    enemyAttack(each(query("minion", { name: "Gamora" })), { against: you, bind: "minion" }),
    friendlyCharacterAttacks(each(query(["hero", "ally"], { name: "Gamora" })), you, { bind: "friendly" }),
    ifThen(allOf(not(made("minion")), not(made("friendly"))), surge()),
  ),
});
