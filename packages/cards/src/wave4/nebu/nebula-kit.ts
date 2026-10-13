import { trait } from "@mc/content";
import {
  after,
  alterEgoAction,
  andThen,
  anEnemy,
  attackAnEnemy,
  attacksGainKeywords,
  cards,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  confuse,
  constant,
  coveredByEngineRule,
  defineAbilities,
  discard,
  discardDeckUntil,
  draw,
  each,
  encounterCards,
  exhaustThis,
  forcedResponse,
  gainsKeyword,
  gets,
  giveTough,
  heroAction,
  ignores,
  isHero,
  moveCards,
  on,
  option,
  putIntoPlay,
  query,
  reorderCards,
  resolveSpecialsOf,
  resource,
  response,
  rule,
  selectCards,
  special,
  stun,
  thwartAScheme,
  varOf,
  you,
  yourIdentity,
  YOUR_IDENTITY,
  zone,
} from "../../dsl/index.js";

const TECHNIQUE = trait("TECHNIQUE");
const YOUR_TECHNIQUE_UPGRADES = query("upgrade", { controller: "you", trait: TECHNIQUE });

/**
 * Nebula (22001a/b) and her signature hero kit (22002–22010, printed `aspect: "hero:22001a"`): the shared
 * "Technique" mechanic (docs/phase7-wave4.md §3.23, `resolveSpecials`/`resolveSpecialsOf`, already landed and
 * reused as-is — no new primitive needed for this pack).
 *
 * **The identity's own loop**: Combat Protocols (hero face, 22001a) is a Forced Response, not a "Special" itself —
 * "After your turn begins, resolve the 'Special' ability on each technique upgrade you control, then discard each
 * technique upgrade resolved this way." The set of upgrades is bound once (`selectCards`) *before* any of their
 * Specials resolve, so a Special that somehow changed what's in play mid-resolution still only discards the
 * upgrades that actually existed and were offered at the start of this response — never a copy played afterward,
 * and never one already gone by the time this discard step runs (the shared `resolveSpecials({ of })` path already
 * drops ids that no longer exist, `packages/engine/src/resolve/effects-frame.ts`). Cybernetic Upgrades (alter-ego
 * face, 22001b) is a separate response that isn't gated to a form by any `heroResponse`/`alterEgoResponse` builder
 * — an identity's own two faces carry disjoint `abilities` arrays in `@mc/content` (`packages/content/src/data/
 * nebu/cards.ts`), so whichever face is currently up is the only one whose refs are ever "active"
 * (`activeAbilityRefs`); nothing here needs to say so again. Technique upgrades carry no printed form restriction
 * of their own, so a player can play one during alter-ego form specifically to trigger this draw before flipping
 * to hero.
 *
 * **Evasive Maneuvering's "ignores the guard keyword, the patrol keyword, and the crisis icon" (22005)** is the
 * standing `characterIgnores` exemption (docs/phase7-wave4.md §3.24), scoped to hero form.
 */
export const NEBULA_KIT = defineAbilities({
  // Nebula (hero, 22001a) — Combat Protocols, Forced Response: After your turn begins, resolve the "Special"
  // ability on each technique upgrade you control, then discard each technique upgrade resolved this way (module
  // docblock).
  // `resolveSpecialsOf` on an empty set of technique upgrades is vacuously true (mirroring `16088.nebula-forced-
  // interrupt`'s own reading), so it always fully resolves with the current engine; `andThen` is the faithful
  // reading of the printed "then" (RRG 1.8 "'Then'", p. 44) without changing behavior today.
  "22001a.nebula-constant": forcedResponse(
    after.yourTurnBegins(),
    selectCards("techs", cards(each(YOUR_TECHNIQUE_UPGRADES))),
    resolveSpecialsOf(chosen("techs")),
    andThen(discard(chosen("techs"))),
  ),

  // Nebula (alter-ego, 22001b) — Cybernetic Upgrades, Response: After you play a technique upgrade, draw 2 cards.
  // (Limit once per round.)
  "22001b.nebula-constant": response(
    on.youPlayedCard(YOUR_TECHNIQUE_UPGRADES),
    { limit: { count: 1, period: "round" } },
    draw(2),
  ),

  // Gamora (ally, 22002) — Response: After you play Gamora, choose a technique upgrade you control, then resolve
  // its "Special" ability.
  // The required `chooseTarget` finds nothing with no technique upgrade in play, so "then resolve its 'Special'
  // ability" doesn't attempt to resolve either (RRG 1.8 "'Then'", p. 44).
  "22002.gamora-response": response(
    on.youPlayThis(),
    chooseTarget("tech", YOUR_TECHNIQUE_UPGRADES),
    andThen(resolveSpecialsOf(chosen("tech"))),
  ),

  // Nebula's Ship (support, 22003) — Resource: Exhaust Nebula's Ship → generate a [wild] resource. Plain
  // "Resource:" (no form label, matching the printed text — this isn't restricted to hero form the way `heroResource`
  // scopes).
  "22003.nebulas-ship-resource": resource({ wild: 1 }, { cost: exhaustThis }),

  // Cutthroat Ambition (upgrade, 22004) — While Nebula is in hero form, her attacks gain piercing and overkill.
  // Special (thwart): Remove 3 threat from a scheme.
  "22004.cutthroat-ambition-constant": constant(
    attacksGainKeywords(["piercing", "overkill"], { attacker: YOUR_IDENTITY, while: isHero() }),
  ),
  "22004.cutthroat-ambition-special": special({ label: "thwart" }, thwartAScheme(3)),

  // Evasive Maneuvering (upgrade, 22005) — While in hero form, Nebula ignores the guard keyword, the patrol
  // keyword, and the crisis icon (§3.24). Special: Choose to either stun or confuse an enemy.
  "22005.evasive-maneuvering-constant": constant(ignores(YOUR_IDENTITY, ["guard", "patrol", "crisis"], isHero())),
  "22005.evasive-maneuvering-constant-2": special(
    anEnemy("enemy"),
    chooseOne(option("Stun it", stun(chosen("enemy"))), option("Confuse it", confuse(chosen("enemy")))),
  ),

  // Unyielding Persistence (upgrade, 22006) — While in hero form, Nebula gets +1 THW, +1 ATK, and gains stalwart.
  // Special: Give Nebula a tough status card.
  "22006.unyielding-persistence-constant": constant(
    gets("thw", 1, YOUR_IDENTITY, { while: isHero() }),
    gets("atk", 1, YOUR_IDENTITY, { while: isHero() }),
    gainsKeyword({ name: "stalwart" }, YOUR_IDENTITY, { while: isHero() }),
  ),
  "22006.unyielding-persistence-constant-2": special(giveTough(yourIdentity)),

  // Weapons Master (upgrade, 22007) — While in hero form, Nebula gains retaliate 1. Special (attack): Deal 4
  // damage to an enemy.
  "22007.weapons-master-constant": constant(
    gainsKeyword({ name: "retaliate", value: 1 }, YOUR_IDENTITY, { while: isHero() }),
  ),
  "22007.weapons-master-special": special({ label: "attack" }, attackAnEnemy(4)),

  // Wide Stance (upgrade, 22008) — While Nebula is in hero form, reduce the amount of damage she takes from each
  // attack by 1 (docs/phase7-wave4.md §3.23, `RuleSpec reduceDamageTaken`, already landed for exactly this card's
  // wording — Wide Stance, `gmw` 16098). Special: Look at the top 3 cards of the encounter deck. Discard 1 and put
  // the others back in any order (the "Heimdall" shape, `core/heroes/thor/pack-cards.ts`, reused verbatim).
  "22008.wide-stance-constant": constant(
    rule({ kind: "reduceDamageTaken", target: YOUR_IDENTITY, amount: 1, fromAttack: true, while: isHero() }),
  ),
  "22008.wide-stance-constant-2": special(
    selectCards("looked", encounterCards(["deck"], undefined, 3)),
    chooseCards("discarded", cards(chosen("looked")), { min: 1, max: 1 }),
    moveCards(cards(chosen("discarded")), "discard"),
    reorderCards(cards(chosen("looked"), { excludeSlots: ["discarded"] })),
  ),

  // Combat Ready (event, 22009) — Alter-Ego Action: Choose one:
  // • Shuffle up to 2 technique upgrades from your discard pile into your deck.
  // • Discard cards from the top of your deck until you discard a technique upgrade. Put that upgrade into play,
  //   then resolve its "Special" ability.
  // The two extra ability refs (`-constant`/`-constant-2`) are the two bulleted lines, the same parser artifact
  // other packs' bulleted "choose" abilities carry (Quicksilver's Double Time, `wave2/qsv/kit.ts`) — the action ref
  // already carries both bullets, so they're stood up empty.
  "22009.combat-ready-action": alterEgoAction(
    chooseOne(
      option(
        "Shuffle up to 2 technique upgrades from your discard pile into your deck",
        chooseCards("shuffled", zone("discard", you, { filter: query("upgrade", { trait: TECHNIQUE }) }), {
          min: 0,
          max: 2,
        }),
        moveCards(cards(chosen("shuffled")), "deckShuffle"),
      ),
      option(
        "Discard cards from the top of your deck until you discard a technique upgrade",
        // "Discard … until … . Put that upgrade into play, then resolve its 'Special' ability." — the search
        // itself failing (deck exhausted, no technique upgrade found) is `discardDeckUntil`'s own
        // `discardUntilFoundNothing` (docs/then-sweep.md); `putIntoPlay` on an empty `chosen("found")` is then
        // vacuous, so the printed "then" here — gating the resolve on the put-into-play — never fails on its own
        // with the current engine. `andThen` is still the faithful reading (RRG 1.8 "'Then'", p. 44).
        discardDeckUntil(query("upgrade", { trait: TECHNIQUE }), "found"),
        putIntoPlay(chosen("found")),
        andThen(resolveSpecialsOf(chosen("found"))),
      ),
    ),
  ),
  "22009.combat-ready-constant": coveredByEngineRule(),
  "22009.combat-ready-constant-2": coveredByEngineRule(),

  // Lethal Intent (event, 22010) — Hero Action: Choose up to X technique upgrades you control. Resolve each of
  // their "Special" abilities (in the order of your choice). `x` is the play's own bound var for the printed "X"
  // cost (`specialCost: "X"`, docs/phase7-wave2.md §3.8, the Speed Cyclone precedent, `wave2/qsv/kit.ts`).
  "22010.lethal-intent-action": heroAction(
    chooseTarget("techs", YOUR_TECHNIQUE_UPGRADES, { count: varOf("x"), upTo: true }),
    resolveSpecialsOf(chosen("techs")),
  ),
});
