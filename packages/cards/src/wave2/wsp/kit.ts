import { trait } from "@mc/content";
import {
  action,
  anAttackableEnemy,
  attack,
  attacksGainKeywords,
  cards,
  changeToHeroFormWithTrait,
  changeToOtherHeroForm,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  dealDamage,
  defineAbilities,
  divide,
  draw,
  exhaustThis,
  gainsKeyword,
  gainsTrait,
  gets,
  heal,
  heroAction,
  heroInterrupt,
  interrupt,
  ifThen,
  modifyBasicPower,
  moveCards,
  on,
  oncePerRound,
  preventDamage,
  query,
  ready,
  removeThreat,
  response,
  heroResponse,
  theVillain,
  when,
  yourIdentity,
  you,
  youHaveTrait,
  YOUR_IDENTITY,
  zone,
} from "../../dsl/index.js";

const GIANT = trait("GIANT");
const TINY = trait("TINY");
const AERIAL = trait("AERIAL");

/**
 * Wasp / Nadia Van Dyne (13001a/b/c, a three-sided identity — Tiny hero, alter-ego, Giant hero) and her hero kit
 * (13002–13010, 13020). Modeled directly on Ant-Man's own kit (`wave2/ant/kit.ts`): the same three-sided-identity
 * primitives (docs/phase7-wave2.md §1.1/§3.2), "if you are in [Giant/Tiny] hero form" read as `youHaveTrait`.
 *
 * **§3.7's divided-power primitives (landed) cover Wasp's own Giant-form text and every divided event** (Giant
 * Help, Wasp Sting): `RuleSpec divideBasicPower` for the identity's own basic THW/ATK, `EffectSpec divide` for an
 * event's own printed "a total of N … divided among …".
 *
 * **Un-skipped this pass (docs/phase7-wave2.md §17, landed 2026-09-19):**
 * - `13001a.small-but-mighty` — "Response: After Wasp (or an event you play) defeats a minion or side scheme, deal
 *   1 damage to the villain." `on.defeats(source)` (§17.2, a `characterDefeated`/`schemeDefeated` `sourceIs`, not
 *   `playerIs`) says what "you defeat" cannot: an ally's own attack has the same defeating *player* but a different
 *   defeating *card*, so `source` names Wasp's identity or an event (`query(["identity", "event"], { owner: "you"
 *   })`) rather than accepting any card the player controls.
 * - `13002.ant-man-constant` / `13002.ant-man-constant-2` — "While you are in Giant/Tiny hero form, Ant-Man gains
 *   the Giant/Tiny trait and gets +1 ATK/THW." The identical shape Yellowjacket (12027, `ant/obligation-
 *   nemesis.ts`) has, safe now that `traitsOf`'s constant trait-grant scan evaluates a grant's own `while`/`target`
 *   under `DEFAULT_DEPS` (§17.5) — printed traits and lasting effects only, never another constant ability's own
 *   grant. Ant-Man's own Giant/Tiny trait is *printed* on Wasp's/Ant-Man's three-sided identity's own additional
 *   hero forms (§1.1/§3.2), so `youHaveTrait` still tracks a live form change correctly under that guard.
 * - `13005.rapid-growth-interrupt` — "Hero Interrupt: When you use one of your hero's basic powers (THW, ATK, or
 *   DEF), change to your Giant hero form and get +2 to that power for this use." `on.basicPowerUsing` (the
 *   interrupt twin of `basicPowerUsed`) fires before the power's own value is read, and `modifyBasicPower` (§17.4)
 *   reads which power off that event and applies a `statModifier` lasting exactly that one use, composing correctly
 *   whichever order this ability's own effects run in (change form, then get +2 to the *new* form's power). Covers
 *   DEF as well as ATK/THW (the window opens where the defender is declared, before DEF is read).
 * - `13008.red-room-training-constant-2` — "While you are in Tiny hero form, your basic attacks gain piercing." is
 *   now `attacksGainKeywords([...], { basicOnly: true })` (§17.3): matches how the attack was made (a basic attack,
 *   whoever makes it), which `via`'s own null-exclusion could only ever say the opposite of.
 */
export const WASP_KIT = defineAbilities({
  // Small but Mighty — Response: after Wasp (or an event you play) defeats a minion or side scheme, deal 1 damage
  // to the villain (module docblock, §17.2).
  "13001a.small-but-mighty": response(on.defeats(query(["identity", "event"], { owner: "you" })), dealDamage(1, theVillain)),

  // G.I.R.L. — Action: Shuffle up to 2 cards with a printed [mental] resource from your discard pile into your
  // deck. (Limit once per round.)
  "13001b.girl": action(
    { limit: oncePerRound },
    chooseCards("mental", zone("discard", you, { filter: { printedResource: "mental" } }), { min: 0, max: 2 }),
    moveCards(cards(chosen("mental")), "deckShuffle"),
  ),

  // Wasp (Giant face, 13001c) — [star] Threat removed by your basic thwart power can be divided among schemes as
  // you choose. [star] Damage dealt by your basic attack power can be divided among enemies as you choose
  // (docs/phase7-wave2.md §3.7, FAQ "Wasp (#1C)").
  "13001c.wasp-constant": constant({ rules: [{ kind: "divideBasicPower", power: "thwart", target: YOUR_IDENTITY }] }),
  "13001c.wasp-constant-2": constant({ rules: [{ kind: "divideBasicPower", power: "attack", target: YOUR_IDENTITY }] }),

  // Ant-Man (13002, ally) — while you are in Giant/Tiny hero form, Ant-Man gains the Giant/Tiny trait and gets +1
  // ATK/THW (module docblock, §17.5).
  "13002.ant-man-constant": constant(gainsTrait(GIANT, { self: true }, { while: youHaveTrait(GIANT) }), gets("atk", 1, { self: true }, { while: youHaveTrait(GIANT) })),
  "13002.ant-man-constant-2": constant(gainsTrait(TINY, { self: true }, { while: youHaveTrait(TINY) }), gets("thw", 1, { self: true }, { while: youHaveTrait(TINY) })),

  // Giant Help — Hero Action (thwart): Remove 3 threat from a scheme (remove a total of 4 threat divided among
  // schemes as you choose instead if you are in Giant hero form).
  "13003.giant-help-action": heroAction(
    { label: "thwart" },
    ifThen(
      youHaveTrait(GIANT),
      divide("threat", 4, query("scheme"), { chooser: you }),
      [chooseTarget("scheme", query("scheme")), removeThreat(3, chosen("scheme"))],
    ),
  ),

  // Pinpoint Strike — Hero Action (attack): Deal 7 damage to an enemy. If you are in Tiny hero form, this attack
  // deals 1 additional damage to that enemy and gains overkill.
  "13004.pinpoint-strike-action": heroAction(
    { label: "attack" },
    anAttackableEnemy(),
    ifThen(youHaveTrait(TINY), attack(8, chosen("enemy"), { overkill: true }), attack(7, chosen("enemy"))),
  ),

  // Rapid Growth — Hero Interrupt: when you use one of your hero's basic powers (THW, ATK, or DEF), change to your
  // Giant hero form and get +2 to that power for this use (module docblock, §17.4). `YOUR_IDENTITY`, not `self`:
  // the printed text is "your hero's basic powers", which excludes an ally's own basic power use.
  "13005.rapid-growth-interrupt": heroInterrupt(on.basicPowerUsing(YOUR_IDENTITY), changeToHeroFormWithTrait(GIANT), modifyBasicPower(2)),

  // Wasp Sting — two Hero Actions (attack), each gated to one hero form (the form check precedes the effect, as
  // Ant-Man's own form-gated actions do): if Giant, deal a total of 4 damage divided among enemies you choose; if
  // Tiny, deal 5 damage to an enemy.
  "13006.wasp-sting-action": heroAction({ label: "attack", while: youHaveTrait(GIANT) }, divide("damage", 4, query("enemy"), { chooser: you })),
  "13006.wasp-sting-hero-action": heroAction({ label: "attack", while: youHaveTrait(TINY) }, chooseTarget("enemy", query("enemy")), attack(5, chosen("enemy"))),

  // Pym Particles (resource) — Hero Response: after you spend this card, heal 2 damage from your hero if you are
  // in Giant hero form, or draw 1 card if you are in Tiny hero form. Same shape as Ant-Man's own Pym Particles
  // (12006, `ant/kit.ts`) — "Hero Response" already gates to hero form, so the else branch is exactly Tiny.
  "13007.pym-particles-response": heroResponse(on.youSpendThis(), ifThen(youHaveTrait(GIANT), heal(2, yourIdentity), draw(1))),

  // Red Room Training — While you are in Giant hero form, you gain retaliate 1. While you are in Tiny hero form,
  // your basic attacks gain piercing (module docblock, §17.3).
  "13008.red-room-training-constant": constant(gainsKeyword({ name: "retaliate", value: 1 }, YOUR_IDENTITY, { while: youHaveTrait(GIANT) })),
  "13008.red-room-training-constant-2": constant(attacksGainKeywords(["piercing"], { attacker: YOUR_IDENTITY, basicOnly: true, while: youHaveTrait(TINY) })),

  // Bio-Synthetic Wings — Wasp gains the Aerial trait (unconditional — safe: `traitsOf`'s poisoned scan only
  // recurses on a *conditional* `while: hasTrait(...)` trait grant, and this one has no `while` at all).
  // Interrupt: When you would take any amount of damage, if you are in Tiny hero form, exhaust Bio-Synthetic Wings
  // → prevent 1 of that damage.
  "13009.bio-synthetic-wings-constant": constant(gainsTrait(AERIAL, YOUR_IDENTITY)),
  "13009.bio-synthetic-wings-interrupt": interrupt(when.damage("host"), { cost: exhaustThis, while: youHaveTrait(TINY) }, preventDamage(1)),

  // Wasp's Helmet — While you are in Giant hero form, you get +1 THW. While you are in Tiny hero form, you get +1
  // ATK. Pure stat modifiers (no trait grant) — safe under the same reasoning as Bio-Synthetic Wings above.
  "13010.wasps-helmet-constant": constant(gets("thw", 1, YOUR_IDENTITY, { while: youHaveTrait(GIANT) })),
  "13010.wasps-helmet-constant-2": constant(gets("atk", 1, YOUR_IDENTITY, { while: youHaveTrait(TINY) })),

  // Swarm Tactics — Team-Up (Ant-Man and Wasp), Max 1 per deck (data). Hero Action: change to your other hero
  // form. Ready your hero. Wasp's own printing of the identical card Ant-Man's own set prints as 12020
  // (`ant/kit.ts`) — a real RRG "Copy" (same printed text, different collector number per pack), not aliased by
  // `reprints.ts` (which only matches wave2-against-wave1/Core, not wave2-against-wave2).
  "13020.swarm-tactics-action": heroAction(changeToOtherHeroForm(), ready(yourIdentity)),
});
