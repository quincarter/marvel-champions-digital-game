import { trait } from "@mc/content";
import type { TargetQuery } from "@mc/engine";
import { JUSTICE } from "../../../core/aspects/justice.js";
import {
  after,
  cards,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  dealDamage,
  defineAbilities,
  exhaustCardsCost,
  exhaustThis,
  exists,
  heroAction,
  heroInterrupt,
  interrupt,
  modifyBasicPower,
  moveCards,
  on,
  playFromHandReducingCost,
  playOnlyIf,
  preventDamage,
  query,
  ready,
  removeCounter,
  response,
  shuffleDeck,
  varOf,
  when,
  you,
  zone,
} from "../../../dsl/index.js";

const SHIELD = trait("S.H.I.E.L.D.");
const WEB_WARRIOR = trait("WEB-WARRIOR");

/** "A S.H.I.E.L.D. card you control", any category — Dum Dum Dugan's own cost, Government Liaison's and Sky-
 * Destroyer's played-card filter. Agent 13 (trait S.H.I.E.L.D. SPY) and Sky-Destroyer itself (trait S.H.I.E.L.D.
 * VEHICLE) print a *different* trait string and so do not match this — the same distinct-trait reading
 * docs/phase7-wave5.md §2.1 draws for "Agent 13 (27046 and 29022, two printings)" (an exact name/trait match, not a
 * substring one). */
const A_SHIELD_CARD: TargetQuery = { trait: SHIELD, controller: "you" };
const A_SHIELD_ALLY: TargetQuery = { categories: ["ally"], trait: SHIELD, controller: "you" };
const A_SHIELD_SUPPORT: TargetQuery = { categories: ["support"], trait: SHIELD, controller: "you" };
const A_WEB_WARRIOR_CARD: TargetQuery = {
  categories: ["identity", "ally", "upgrade", "support"],
  trait: WEB_WARRIOR,
  controller: "you",
};

/**
 * Spider-Man / Miles Morales's (`sm` 27030a–27055) non-signature supports and allies scripted directly (docs/
 * phase7-wave5.md): Field Agent (27044), Agent 13 (27046), Dum Dum Dugan (27047), Ghost-Spider (27048, the ally —
 * not the hero identity, `../ghost-spider/`), Spider-Man / Peter Parker (27049), Government Liaison (27054),
 * Sky-Destroyer (27055). Surveillance Team (27045) reprints Core's 01064 verbatim (identical printed text, same
 * two-ability shape) and is aliased to `JUSTICE["01064.surveillance-team-action"]` rather than re-scripted — see
 * the module docblock note below and this file's own coverage test. 27051–27053 are basic resources with no
 * abilities (data only, out of this group). His events, obligation/nemesis set and identity are separate modules.
 *
 * **Field Agent (27044)** — "Hero Interrupt: When a S.H.I.E.L.D. ally would take any amount of consequential
 * damage, exhaust Field Agent and remove 1 backup counter from it → prevent 1 of that damage." "Consequential
 * damage" has no dedicated `EventPattern` field (the engine's `dealDamage` event carries a `consequential: true`
 * body flag, but `eventIs`/`eventAtLeast` only read string/number fields, and `requireResults`'s `attack.made` /
 * `thwart.made` prefixes are mutually exclusive, not an "either" `on.consequentialDamage` can express without a
 * mandatory `from: "attack" | "thwart"`) — a genuine DSL/engine gap shared by Cannonball's and Falcon's own "would
 * take any amount of consequential damage" reprints of this exact phrase (`angel`/`falcon`, not yet scripted).
 * Scripted instead from the one fact that already holds: `pushConsequentialDamage` (`packages/engine/src/
 * actions.ts`) is the *only* `dealDamage` push whose `sourceInstanceId` is the same instance as its own target, so
 * mirroring the target query onto `sourceIs` narrows to "a S.H.I.E.L.D. ally deals non-attack damage to itself" —
 * exactly consequential damage as currently modeled, nothing else. Flag for `game-rules-architect`: a real
 * `consequential` `EventPattern` boolean would replace this and unblock Cannonball/Falcon directly.
 *
 * **Agent 13 (27046)** — "[star] Response: After Agent 13 attacks or thwarts, choose a S.H.I.E.L.D. support →
 * ready that support." The printed "[star]" is the card's own unique-icon glyph reprinted before the ability line
 * (bp's Aneka/T'Challa/Black Panther precedent), not a keyword; scripted as a plain `response`.
 *
 * **Dum Dum Dugan (27047)** — "Interrupt: When you use one of Dum Dum Dugan's basic powers, exhaust up to 3
 * S.H.I.E.L.D. cards you control. For each card exhausted this way, Dum Dum Dugan gets +1 to that power for this
 * use." `on.basicPowerUsing("self")` (no `power` filter: "one of … basic powers" is any of them, the wave 2 §3.11
 * precedent) with `exhaustCardsCost` (`min: 1, max: 3` — RRG 1.8 "Cost", p. 14: an "up to" cost requires a
 * minimum of 1, so declining the ability entirely is how "exhaust up to 3" becomes "exhaust 0") and
 * `modifyBasicPower`, the `vision` Machine Man (26022) shape with an exhaust cost standing in for its
 * spent-resources one.
 *
 * **Ghost-Spider (ally, 27048)** — "Play only if you control a Web-Warrior card. Interrupt: When Ghost-Spider
 * leaves play, search your deck for an identity-specific event and add it to your hand. (Shuffle.)" A different
 * card from the hero Ghost-Spider (`../ghost-spider/`, a separate identity's own kit) that happens to share her
 * name; `A_WEB_WARRIOR_CARD` and the leaves-play interrupt are this module's own, mirroring `../ghost-spider/
 * support-upgrades-allies.ts`'s `27017.spider-man-constant`/`-interrupt` shape (`playOnlyIf`/`on.leavesPlay`) and
 * `gam` Nebula's search-and-shuffle response for "search your deck for an X and add it to your hand. Shuffle."
 * "Identity-specific event" is `query("event", { identitySetOf: you })` (RRG 1.8 "Identity-Specific Card", p. 23).
 *
 * **Spider-Man / Peter Parker (ally, 27049)** — printed "Requirement ([energy] [mental] [physical])", engine-
 * enforced purely from the card's own `keywords` array (`requiredResources`, `packages/engine/src/actions.ts`) —
 * every other Requirement card in this same file (27006, 27016) carries `{ name: "requirement", ... }` in
 * `keywords` and needs *no* separate ability ref for it, but 27049's (and its silk 52022 reprint's) `keywords` is
 * empty despite both listing a `27049.spider-man-constant`/`52022.spider-man-constant` ability id — a
 * `card-data-pipeline` data gap, not a scriptable behavior (no DSL/engine primitive re-implements a schema keyword
 * from inside an `AbilityDefinition`; granting "requirement" via `gainsKeyword` would not reach `requiredResources`,
 * which reads the printed card object directly). Registered as an inert `constant()` so the ref is not left
 * unregistered; flagged here and in this wave's report for `card-data-pipeline` to add the keyword instead. The
 * Response ("After Spider-Man attacks or thwarts, choose another Web-Warrior character → ready that character")
 * is scripted normally.
 *
 * **Government Liaison (27054)** — "Hero Action: Exhaust Government Liaison → play a S.H.I.E.L.D. card from your
 * hand, reducing its resource cost by 1." `playFromHandReducingCost(1, you, { filter: A_SHIELD_CARD })`, the
 * `valk`/`ant` Team-Building-Exercise-family precedent.
 *
 * **Sky-Destroyer (27055)** — "Response: After you play a S.H.I.E.L.D. card, exhaust Sky-Destroyer → deal 2
 * damage to an enemy." `after.youPlayedCard(A_SHIELD_CARD)`.
 */
export const SPIDER_MAN_MORALES_PRECON_PLAYER_CARDS = defineAbilities({
  "27044.field-agent-interrupt": heroInterrupt(
    { ...when.damage(A_SHIELD_ALLY, { fromAttack: false }), sourceIs: A_SHIELD_ALLY },
    { cost: [exhaustThis, removeCounter("backup")] },
    preventDamage(1),
  ),

  // Surveillance Team — Core reprint (01064, module docblock): identical printed text, aliased rather than re-scripted.
  "27045.surveillance-team-action": JUSTICE["01064.surveillance-team-action"]!,

  "27046.agent-13-response": response(
    after.attacksOrThwarts("self"),
    chooseTarget("support", A_SHIELD_SUPPORT),
    ready(chosen("support")),
  ),

  "27047.dum-dum-dugan-interrupt": interrupt(
    on.basicPowerUsing("self"),
    // RRG 1.8 "Cost" (p. 14): an "up to" cost requires a minimum of 1 — declining the whole interrupt (not paying
    // the cost at all) is how "exhaust up to 3" becomes "exhaust 0" in practice, not a min:0 pick.
    { cost: exhaustCardsCost(A_SHIELD_CARD, { min: 1, max: 3, bind: "n" }) },
    modifyBasicPower(varOf("n")),
  ),

  "27048.ghost-spider-constant": constant(playOnlyIf(exists(A_WEB_WARRIOR_CARD))),
  "27048.ghost-spider-interrupt": interrupt(
    on.leavesPlay("self"),
    chooseCards("found", zone("deck", you, { filter: query("event", { identitySetOf: you }) }), { min: 0, max: 1 }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),

  // Requirement ([energy] [mental] [physical]) — engine-enforced from `keywords`, missing on this card's own data
  // (module docblock). Registered inert so the ref is not left unscripted; not a script bug to fix here.
  "27049.spider-man-constant": constant(),
  "27049.spider-man-response": response(
    after.attacksOrThwarts("self"),
    chooseTarget("character", { categories: ["identity", "ally"], trait: WEB_WARRIOR, controller: "you", self: false }),
    ready(chosen("character")),
  ),

  "27054.government-liaison-action": heroAction(
    { cost: exhaustThis },
    playFromHandReducingCost(1, you, { filter: A_SHIELD_CARD }),
  ),

  "27055.sky-destroyer-response": response(
    after.youPlayedCard(A_SHIELD_CARD),
    { cost: exhaustThis },
    chooseTarget("enemy", query("enemy")),
    dealDamage(2, chosen("enemy")),
  ),
});
