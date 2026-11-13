/**
 * Throg (by Patatasaurio & Caurel, G.Triskelion template): every ability of the pack, each modeled on the base-game card
 * named in its comment. The pack's own printed text is the authority (docs/custom-content-packs.md section 6), then the
 * RRG (v1.8) and FFG rulings for what the text does not override. English is the text language (Francisco Merchan's
 * translation); Spanish is the authors' canonical version. The text carries the curators' rules fixes of 2026-10-30
 * and 2026-11-07 (Power Stone's attach-to text, Thanos / An Unexpected Guest "find the Power Stone", the obligation
 * discarding from your hand, Hammer Throw's "ignores" covering the thwart, Thor's subtitle ODINSON), sent to the
 * authors and not yet confirmed (the pack's DRAFT file).
 *
 * Ability ids are `<card code>.<slug>`, as the importer wrote them.
 *
 * Every ability is scripted. One is an APPROXIMATION waiting for an engine primitive, marked `TODO(engine)`:
 *   1. Hammer Throw, "This attack ignores guard": no per-attack guard ignore exists (see the stub's comment).
 */
import {
  after,
  alterEgoAction,
  aScheme,
  attack,
  attachCard,
  anAttackableEnemy,
  cards,
  chooseCards,
  chooseTarget,
  chosen,
  confuse,
  constant,
  coveredByEngineRule,
  dealDamage,
  definePackAbilities,
  discard,
  discardEncounterUntil,
  draw,
  eventSource,
  exhaustCardsCost,
  exhaustThis,
  exists,
  findCard,
  forcedResponse,
  fromAnyAspect,
  gainsTrait,
  gets,
  hasAttachment,
  hasTrait,
  heroAction,
  heroInterrupt,
  heroResource,
  host,
  ifThen,
  moveCards,
  oncePerRound,
  packObligation,
  placeThreat,
  preventDamage,
  putIntoPlay,
  query,
  removeThreat,
  response,
  searchCollection,
  self,
  shuffleDeck,
  theMainScheme,
  theVillain,
  thwart,
  varOf,
  when,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  yourIdentity,
  YOUR_IDENTITY,
  zone,
} from "@mc/mod-sdk";

// The content package's `trait()` is not part of the SDK; a trait is its upper-cased name. Pet and Frog are not
// official traits (the curated source's open items), Asgard and Aerial are.
type Trait = NonNullable<Parameters<typeof gainsTrait>[0]>;
const trait = (name: string): Trait => name.toUpperCase() as Trait;
const ASGARD = trait("Asgard");
const AERIAL = trait("Aerial");
const PET = trait("Pet");

/** Frogjolnir, in play under your control (what "while you control Frogjolnir" and the cost pick look at). */
const FROGJOLNIR = query("upgrade", { name: "Frogjolnir" });
const YOUR_FROGJOLNIR = query("upgrade", { name: "Frogjolnir", controller: "you" });
const POWER_STONE = query("attachment", { name: "Power Stone" });
/** "Thanos has the Power Stone attached". */
const THANOS_WITH_STONE = query("minion", { name: "Thanos", ...hasAttachment({ name: "Power Stone" }) });
/** A card in the player's hand of any type with the Asgard or Pet trait (Between Two Worlds, Telepathic Link). */
const ASGARD_OR_PET = query([], { anyTrait: [ASGARD, PET] });

/**
 * "Find the Power Stone and put it into play." Thanos' and An Unexpected Guest's When Revealed. The Power Stone's own
 * "Attach to Thanos. If Thanos is not in play, attach to the villain." is its card data (`attachesTo`, an `ifAble` of
 * Thanos then the villain); the find puts it into play there. Already in play (on a hero, say): nothing moves (RRG
 * 1.8 "Find", p. 19: "put it into play" for a card already in play does nothing).
 */
const FIND_THE_POWER_STONE = findCard(POWER_STONE, "play");

export default definePackAbilities({
  // =========================================================================
  // 01a Throg (hero identity)
  // =========================================================================

  // "While you control Frogjolnir, Throg gains the Asgard trait." A trait grant to himself (Cloak of Levitation 09009
  // for the shape, scoped by `while`).
  "x.throg-ptt.01a.throg-constant": constant(gainsTrait(ASGARD, { self: true }, { while: exists(YOUR_FROGJOLNIR) })),

  // Toad-ally Unexpected!: "Response: After a side scheme enters play, draw 2 cards. (Limit once per phase.)" As Thor's
  // "Have at thee!" (06001a): the limit is the identity's own. Any side scheme, whoever's and however it enters play
  // (revealed, or put into play by an effect such as Defender of the Nine Puddles).
  "x.throg-ptt.01a.toad-ally-unexpected": response(
    after.entersPlay(query("sideScheme")),
    { limit: { count: 1, period: "phase" } },
    draw(2),
  ),

  // =========================================================================
  // 01b Puddlegulper (alter-ego)
  // =========================================================================

  // Worthy: "Action: Search your deck and discard pile for the Frogjolnir upgrade and add it to your hand. (Shuffle
  // your deck.) (Limit once per round.)" Exactly Thor's Worthy (06001b, Mjolnir).
  "x.throg-ptt.01b.worthy": alterEgoAction(
    { limit: oncePerRound },
    moveCards(zone(["deck", "discard"], you, { filter: FROGJOLNIR }), "hand"),
    shuffleDeck(),
  ),

  // =========================================================================
  // 02 Frogjolnir (upgrade)
  // =========================================================================

  // "Restricted." is data. "Throg gets +1 ATK and gains the Aerial trait." Thor's Mjolnir (06009), word for word.
  "x.throg-ptt.02.frogjolnir-constant": constant(gets("atk", 1, YOUR_IDENTITY), gainsTrait(AERIAL, YOUR_IDENTITY)),

  // =========================================================================
  // 03 Frog of Thunder (upgrade)
  // =========================================================================

  // "You get +2 hit points." (Thor's Helmet 06010 is +5.)
  "x.throg-ptt.03.frog-of-thunder-constant": constant(gets("hp", 2, YOUR_IDENTITY)),
  // "Hero Resource: If you control a hero or ally with the Asgard trait, exhaust Frog of Thunder -> generate an
  // [energy] resource." God of Thunder (06008) with the "If" as the ability's own condition (`while`): the resource
  // is offered only while you control an Asgard hero or ally. Throg is one while he controls Frogjolnir (granted
  // traits count, RRG 1.8 "Gains", p. 21).
  "x.throg-ptt.03.frog-of-thunder-resource": heroResource(
    { energy: 1 },
    { cost: exhaustThis, while: exists(query(["hero", "ally"], { trait: ASGARD, controller: "you" })) },
  ),

  // =========================================================================
  // 04 Hammer Throw (event)
  // =========================================================================

  // "Hero Action (attack/thwart): Exhaust Frogjolnir -> deal 4 damage to an enemy, remove 4 threat from a scheme, and
  // return Frogjolnir to your hand. This attack ignores guard, and this thwart ignores crisis and patrol." Thor's
  // Hammer Throw (06005): the exhaust is a cost on a Frogjolnir you control, bound as `exhausted` and returned to
  // hand. The thwart ignores crisis and patrol natively (`thwart.ignoreCrisis` / `ignorePatrol`).
  //
  // TODO(engine): "This attack ignores guard." needs a one-use guard ignore for the player's own attack: either
  // `attack(n, target, { ignores: ["guard"] })` (the sibling of `thwart.ignorePatrol`, and of `BasicPowerTerms.ignores`,
  // which says "not built for guard") or `applyRuleUntil(characterIgnores guard, "endOfAttack", undefined, { attack:
  // "initiated" })` for a player attack (today `attack: "initiated"` is for `enemyAttack` only, and "current" needs an
  // attack already in progress, which is none when this effect runs). Timing: the attack's whole resolution, from the
  // choice of the enemy (`anAttackableEnemy` reads `canAttack`) to its end. Source: the card text; RRG 1.8 "Ignore",
  // p. 23, "Guard", p. 21. UNTIL THEN this attack respects guard (narrower than the text: with a guard minion engaged it
  // may only choose the guard minion).
  "x.throg-ptt.04.hammer-throw-constant": heroAction(
    { label: ["attack", "thwart"], cost: exhaustCardsCost(FROGJOLNIR) },
    anAttackableEnemy("enemy"),
    attack(4, chosen("enemy")),
    aScheme("scheme"),
    thwart(4, chosen("scheme"), { ignoreCrisis: true, ignorePatrol: true }),
    moveCards(cards(chosen("exhausted")), "hand"),
  ),

  // =========================================================================
  // 05 Frogbolt (event)
  // =========================================================================

  // "Hero Action (attack/thwart): Deal X damage to the villain and remove X threat from each side scheme. This attack
  // gains piercing if you have the Aerial trait." The card's cost is X (`specialCost: "X"`, `cost: -1` on MarvelCDB):
  // `x` is the play's own var for the printed X (Speed Cyclone 14006, Lethal Intent 22010), the resources paid to
  // play it. Lightning Strike (06006) for the Aerial branch: the keyword is fixed on the effect, so two branches of the
  // same attack. The thwart is on every side scheme at once (Mach 1's "each scheme" shape, `thwart` over `each`).
  "x.throg-ptt.05.frogbolt-constant": heroAction(
    { label: ["attack", "thwart"] },
    ifThen(
      hasTrait(yourIdentity, AERIAL),
      attack(varOf("x"), theVillain, { keywords: ["piercing"] }),
      attack(varOf("x"), theVillain),
    ),
    thwart(varOf("x"), { kind: "each", query: query("sideScheme") }),
  ),

  // =========================================================================
  // 06 Telepathic Link (event)
  // =========================================================================

  // "Hero Action: Search your collection for a card with the Pet or Asgard trait from any aspect and add it to your
  // hand. Remove this card from the game." Armed to the Teeth (44009)'s collection search with a trait filter (an OR of
  // traits) in place of a type: a card of any type, from the five aspects (`fromAnyAspect`: no basic, hero-specific
  // or campaign card). The found card joins the game as a new card you own, then goes to your hand. Pet is not an
  // official trait: a card in the pool carries it only if a pack gives it.
  "x.throg-ptt.06.telepathic-link-action": heroAction(
    searchCollection(
      {
        categories: ["ally", "event", "support", "upgrade", "resource"],
        aspects: fromAnyAspect,
        traits: [ASGARD, PET],
      },
      "found",
    ),
    moveCards(cards(chosen("found")), "hand"),
    moveCards(cards(self), "removedFromGame"),
  ),

  // =========================================================================
  // 07 Defender of the Nine Puddles (event)
  // =========================================================================

  // "Hero Action (attack): Discard cards from the top of the encounter deck until you discard a side scheme. Put that
  // side scheme into play -> deal 5 damage to an enemy." Thor's Defender of the Nine Realms (06003) with a side scheme
  // for the minion and an attack for the thwart: the two setup steps are `costEffects: 2`, the "(attack)" label belongs
  // to the final sentence. The side scheme is put into play, not revealed: no When Revealed, and its Hinder and
  // starting threat apply as for any side scheme entering play (ENGINE_NOTES).
  "x.throg-ptt.07.defender-of-the-nine-puddles-action": heroAction(
    { label: "attack", costEffects: 2 },
    discardEncounterUntil(query("sideScheme"), "scheme"),
    putIntoPlay(chosen("scheme")),
    anAttackableEnemy("enemy"),
    attack(5, chosen("enemy")),
  ),

  // =========================================================================
  // 08 Amphibious Agility (event)
  // =========================================================================

  // "Hero Interrupt (defense): When you would take any amount of damage from an attack, prevent 3 of that damage.
  // (Prevent 5 of that damage instead if you have the Aerial trait.)" Backflip's trigger (01003, `fromAttack`) with
  // Wiggle Room's partial prevention (05005).
  "x.throg-ptt.08.amphibious-agility-interrupt": heroInterrupt(
    when.damage(YOUR_IDENTITY, { fromAttack: true }),
    { label: "defense" },
    ifThen(hasTrait(yourIdentity, AERIAL), preventDamage(5), preventDamage(3)),
  ),

  // =========================================================================
  // 09 Thor (ally)
  // =========================================================================

  // "Response: After Thor defeats an enemy, remove 2 threat from a scheme." Beta Ray Bill (17012): "after X attacks
  // and defeats". The removal is not a thwart.
  "x.throg-ptt.09.thor-response": response(
    after.attacks("self", { target: query("enemy"), defeats: true }),
    aScheme("scheme"),
    removeThreat(2, chosen("scheme")),
  ),

  // =========================================================================
  // 10 Between Two Worlds (obligation)
  // =========================================================================

  // "Give this card to the player who controls Puddlegulper. You may change to alter-ego form. Choose one: Exhaust
  // Puddlegulper -> remove Between Two Worlds from the game. / Discard 1 card with the Asgard or Pet trait from your
  // hand. You are confused. Discard this obligation." Unfulfilled Destiny (18024), the shared `obligation()` shape. The
  // second option's discard is not a cost (no arrow), so it is offered always: with no such card in hand nothing is
  // discarded and you are still confused. "Discard from your hand" is the curators' fix (the source said "discard"),
  // sent to the authors.
  "x.throg-ptt.10.obligation": packObligation("Puddlegulper", {
    label: "Discard 1 Asgard or Pet card from your hand. You are confused. Discard this obligation",
    effects: [
      chooseCards("discarded", zone("hand", you, { filter: ASGARD_OR_PET }), { min: 1, max: 1 }),
      discard(chosen("discarded")),
      confuse(yourIdentity),
    ],
  }),

  // =========================================================================
  // 11 Thanos (minion, nemesis)
  // =========================================================================

  // "Steady. Villainous." are data keywords. "When Revealed: Find the Power Stone and put it into play."
  "x.throg-ptt.11.when-revealed": whenRevealed(FIND_THE_POWER_STONE),

  // =========================================================================
  // 12 An Unexpected Guest (side scheme, nemesis)
  // =========================================================================

  // "Incite 2." is a data keyword. "When Revealed: Find the Power Stone and put it into play." If Thanos is not in
  // play the Stone attaches to the villain (its own attach text).
  "x.throg-ptt.12.when-revealed": whenRevealed(FIND_THE_POWER_STONE),

  // =========================================================================
  // 13 Power Stone (attachment, nemesis)
  // =========================================================================

  // "Attach to Thanos. If Thanos is not in play, attach to the villain." (data: `attachesTo`) "Permanent." (data
  // keyword). Its stat boxes (+1 ATK, +1 SCH) are data too.
  "x.throg-ptt.13.power-stone-constant": coveredByEngineRule(),
  // "Forced Response: After a hero or villain deals 3 or more damage to the attached character with a single attack,
  // attach this card to the attacking hero or villain." The damage is dealt by the attack (`dealt: 3`, the printed
  // "deals"; a prevented or toughed hit still counts), the source is the attacker, a hero (an identity in hero form,
  // not an ally) or a villain (not a minion). Hall of Heroes' Hydra-style chain: Hulk's Forced Response (01050) for
  // the shape.
  "x.throg-ptt.13.power-stone-forced-response": forcedResponse(
    {
      ...after.damage("host", { fromAttack: true, dealt: 3 }),
      sourceIs: { anyOf: [query("hero"), query("villain")] },
    },
    attachCard(self, eventSource),
  ),
  // "Hero Action: Spend 2 resources of any type -> attach this card to another hero." Spend cost of 2 of any type
  // (Goblin Gimmicks' `{ generic: 2 }` shape, here as the ability's cost); "another hero" is any hero but the one it is
  // on.
  "x.throg-ptt.13.power-stone-action": heroAction(
    { cost: { resources: 2 }, while: exists(query("hero", { hostOfSelf: true })) },
    chooseTarget("newHost", query("hero", { excluding: host })),
    attachCard(self, chosen("newHost")),
  ),

  // =========================================================================
  // 14 Inevitable Power (treachery, nemesis)
  // =========================================================================

  // "When Revealed (Alter-Ego): Place 2 threat on the main scheme."
  "x.throg-ptt.14.when-revealed-alter-ego": whenRevealedAlterEgo(placeThreat(2, theMainScheme)),
  // "When Revealed (Hero): Deal 2 damage to your hero (3 damage instead if Thanos has the Power Stone attached)."
  "x.throg-ptt.14.when-revealed-hero": whenRevealedHero(
    ifThen(exists(THANOS_WITH_STONE), dealDamage(3, yourIdentity), dealDamage(2, yourIdentity)),
  ),
});
