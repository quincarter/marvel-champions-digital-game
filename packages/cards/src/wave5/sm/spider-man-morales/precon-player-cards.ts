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
 * Destroyer's played-card filter. Agent 13 (S.H.I.E.L.D. and SPY) and Sky-Destroyer itself (S.H.I.E.L.D. and
 * VEHICLE) match too: a printed line such as "S.H.I.E.L.D. Spy." is two traits (owner ruling 2026-10-06). */
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
 * damage, exhaust Field Agent and remove 1 backup counter from it → prevent 1 of that damage."
 * `when.damage(A_SHIELD_ALLY, { consequential: true })`: an ally's consequential damage from an attack or a thwart
 * alike, and no other damage (`EventPattern.consequential`, docs/phase7-wave5.md §4.1 Q62).
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
 * enforced purely from the card's own `keywords` array (`requiredResources`, `packages/engine/src/actions.ts`),
 * same as every other Requirement card in this file (27006, 27016): `keywords` carries `{ name: "requirement",
 * ... }` and there is no separate ability ref for it. (Multi-icon Requirement with spaces between icons —
 * `[energy] [mental] [physical]` — used to fail to parse into `keywords` at all, dropping the requirement
 * entirely; fixed in `card-data-pipeline`'s ingest, packages/content/scripts/marvelcdb/parse-text.ts.) The
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
    when.damage(A_SHIELD_ALLY, { consequential: true }),
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

  // Requirement ([energy] [mental] [physical]) — engine-enforced from `keywords` (module docblock); no ability
  // ref for it, same as every other Requirement card in this file.
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
