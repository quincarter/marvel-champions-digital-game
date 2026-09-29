import {
  action,
  addCounters,
  after,
  alterEgoAction,
  bindTargets,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  costModifier,
  countOf,
  defineAbilities,
  discardFromHand,
  discardThis,
  draw,
  each,
  exhaustThis,
  heroResource,
  heroResponse,
  ifThen,
  isHero,
  on,
  putIntoPlay,
  query,
  removeCounter,
  removeThreat,
  resolveSpecialsOf,
  response,
  scaled,
  shuffleDeck,
  superlative,
  threatOn,
  you,
  YOUR_IDENTITY,
  yourIdentity,
  zone,
} from "../../../dsl/index.js";

/** Spider-Man's (27030a) two Specials, by ability id (`identity.ts`). */
const VENOM_BLAST = "27030a.spider-man-constant";
const SPIDER_CAMOUFLAGE = "27030a.spider-man-constant-2";

/**
 * Spider-Man / Miles Morales (`sm` 27035–27041, MC27 p. 20, docs/phase7-wave5.md §3.32) — his own supports, upgrades
 * and allies other than events. His identity (27030a/b) is `identity.ts`, his signature events (27031–27034)
 * `events.ts`.
 *
 * **Ganke Lee (support, 27035)**: "Action: Exhaust Ganke Lee → draw 1 card. If you are in hero form, choose and
 * discard 1 card from your hand." A plain `action` (either form may play/use it — nothing here is `heroAction`/
 * `alterEgoAction`, matching the printed unlabeled "Action:"), `ifThen(isHero(), …)` gating the drawback the same
 * "current form at resolution" shape every other form-conditional effect in this pack uses. `discardFromHand(1)`
 * (no `random`) resolves as a player choice, matching "choose and discard" exactly.
 *
 * **Jefferson Davis (support, 27036)**: "Alter-Ego Action: Exhaust Jefferson Davis → remove 1 threat from the
 * scheme with the least threat." Every scheme (main or side) is a candidate — `superlative("lowest", each(query(
 * "scheme")), threatOn(chosen("candidate")))` — bound then chosen from, the same tie-break-by-player-choice shape
 * Beetle's own "discard the lowest-cost upgrade" already uses (`wave4/hood/sinister-syndicate.ts`'s
 * `24043.beetle-forced-response`), since RRG 1.8 doesn't otherwise resolve a printed superlative's tie itself.
 *
 * **Power Within (upgrade, 27037)** and **Defense Mechanism (upgrade, 27038)**: "Hero Response: After your hero
 * uses a basic power, discard [this] → resolve Spider-Man's 'Venom Blast'/'Spider Camouflage' ability." —
 * `on.basicPowerUsed(YOUR_IDENTITY)` (docs/phase7-wave3.md's own "Lashing Vines" precedent, `dsl/wave3-primitives.
 * test.ts`), `discardThis` cost, then `resolveSpecialsOf(yourIdentity, …)` naming only the Special printed on each
 * card, by the identity's ability id (`abilities`, docs/phase7-wave5.md §4.1 Q63), the same call Web-Shot/Swing In
 * make (`events.ts`): 27030a prints two Specials, and the other must not resolve.
 *
 * **Web-Shooter (upgrade, 27039)**: identical printed text to Core's own Web-Shooter (`01008`, `core/heroes/
 * spider-man.ts`) — `heroResource({ wild: 1 }, { cost: [exhaustThis, removeCounter("web")] })` verbatim, a second
 * physical copy (this precon's own, per `quantityInSet: 2`) rather than an alias, matching how this pack's own
 * events reuse Ghost-Spider's printed text as a distinct id (`events.ts`'s "Young Love" docblock) rather than
 * importing the Core ability object across packs.
 *
 * **Monica Chang (ally, 27040, `justice` aspect)**: "Response: After Monica Chang enters play, search your deck,
 * hand and discard pile for a copy of Surveillance Team support and put it into play. Place 1 snoop counter on
 * each Surveillance Team you control." The three-zone search + "put into play" (not "add to hand") shape follows
 * War Machine's own Iron Man ally (`wave4/warm/war-machine-kit.ts`'s `23002.iron-man-response`) with `putIntoPlay`
 * in place of `moveCards(…, "hand")`, plus an unconditional `shuffleDeck()` after searching it (found in the deck
 * or not — the same "always shuffle after a deck search" reading Iron Man's own response already uses). "1 snoop
 * counter on each Surveillance Team you control" is every copy in play at once (`addCounters` over `each(query(
 * "support", { name: …, controller: "you" }))`), including the one just found.
 *
 * **Spider-Woman (ally, 27041, `justice` aspect)**: "Reduce the cost to play Spider-Woman by 1 for each confused
 * enemy in play." A `costModifier` scaling with `countOf(query("enemy", { hasStatus: "confused" }))`, the same
 * per-count discount shape Hercules's own "for each minion engaged with you" already uses (`wave1/thor/pack-
 * cards.ts`'s `06011.hercules-constant`) — active from hand (docs/phase7-wave1.md §3.10).
 */
export const SPIDER_MAN_MORALES_SUPPORT_UPGRADES_ALLIES = defineAbilities({
  "27035.ganke-lee-action": action({ cost: exhaustThis }, draw(1), ifThen(isHero(), discardFromHand(1))),

  "27036.jefferson-davis-action": alterEgoAction(
    { cost: exhaustThis },
    bindTargets("least", superlative("lowest", each(query("scheme")), threatOn(chosen("candidate")))),
    chooseTarget("scheme", { inSlot: "least" }),
    removeThreat(1, chosen("scheme")),
  ),

  "27037.power-within-response": heroResponse(
    on.basicPowerUsed(YOUR_IDENTITY),
    { cost: discardThis },
    resolveSpecialsOf(yourIdentity, undefined, { abilities: [VENOM_BLAST] }),
  ),

  "27038.defense-mechanism-response": heroResponse(
    on.basicPowerUsed(YOUR_IDENTITY),
    { cost: discardThis },
    resolveSpecialsOf(yourIdentity, undefined, { abilities: [SPIDER_CAMOUFLAGE] }),
  ),

  "27039.web-shooter-resource": heroResource({ wild: 1 }, { cost: [exhaustThis, removeCounter("web")] }),

  "27040.monica-chang-response": response(
    after.entersPlay("self"),
    chooseCards(
      "found",
      zone(["deck", "hand", "discard"], you, { filter: query("support", { name: "Surveillance Team" }) }),
      { min: 1, max: 1 },
    ),
    putIntoPlay(chosen("found"), you),
    shuffleDeck(),
    addCounters("snoop", 1, each(query("support", { name: "Surveillance Team", controller: "you" }))),
  ),

  "27041.spider-woman-constant": constant(
    costModifier({
      delta: scaled(countOf(query("enemy", { hasStatus: "confused" })), { times: -1 }),
      appliesTo: query("ally", { self: true }),
      activeIn: "hand",
    }),
  ),
});
