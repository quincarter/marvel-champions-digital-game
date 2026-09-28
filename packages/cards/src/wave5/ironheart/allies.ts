import { trait } from "@mc/content";
import { SPIDER_MAN_MORALES_PRECON_PLAYER_CARDS } from "../sm/spider-man-morales/precon-player-cards.js";
import {
  addCounters,
  after,
  choosePlayer,
  chooseOne,
  chooseTarget,
  chosen,
  chosenPlayer,
  constant,
  countersOn,
  defineAbilities,
  exhaustThis,
  gainsKeyword,
  gainsKeywordX,
  gainsTrait,
  gets,
  heroAction,
  heroResponse,
  modifyStat,
  modifyStatOf,
  on,
  option,
  query,
  ready,
  response,
  self,
  spend,
  valueEquals,
} from "../../dsl/index.js";

const CHAMPION = trait("CHAMPION");
const AERIAL = trait("AERIAL");
const ELITE = trait("ELITE");

/**
 * Ironheart's non-signature allies (`ironheart` 29004-29024, docs/phase7-wave5.md's Ironheart row), all of them in
 * her own real precon (`ironheart-leadership`, `packages/content/src/data/ironheart/starterDecks.ts`): Brawn
 * (29004), Cloud 9 (29014), Falcon (29015), Patriot (29016), Agent 13 (29022, a reprint), Snowguard (29023), Vivian
 * (29024). Text is read directly from `packages/content/src/data/ironheart/cards.ts` (no errata on RRG 1.8), and
 * confirmed against each card's own scan in `assets/card-art/bundles/cards/<id>.png`.
 *
 * **Brawn (29004)** — "While Brawn is exhausted, he gains: 'Resource: Generate a [mental] resource. (Limit once per
 * phase.)'" **Not scripted — engine gap, reported rather than hacked around** (agent-rules.md's testing bar): a
 * resource ability's own `AbilityTriggerSpec` (`kind: "resource"`, `packages/engine/src/abilities.ts`) carries no
 * `while` gate the way `action`'s does (`AbilityOptions.while`, wired only for `trigger.kind === "action"` in
 * `packages/engine/src/actions.ts`'s `disabledActionReason`), and no `ConstantPart` field grants a whole new
 * triggered/resource ability conditionally the way `keywordGrants`/`traitGrants` grant a keyword or trait. Card data
 * still carries the single ref `29004.brawn-constant`; it is intentionally left unregistered here rather than always
 * offering the resource (wrong when Brawn is ready) or never offering it (wrong when he's exhausted).
 *
 * **Cloud 9 (29014)** — "Hero Action: Exhaust Cloud 9 → choose a player. Until the end of the phase, each Aerial
 * character that player controls gets +1 THW." `choosePlayer()` + `modifyStatOf("thw", 1, query("character", {
 * trait: AERIAL, controlledBy: chosenPlayer() }), "endOfPhase")` is Core's own Lead from the Front precedent
 * (`core/aspects/leadership.ts` `01070.lead-from-the-front-action`'s `THAT_PLAYERS_CHARACTERS`), narrowed to the
 * Aerial trait.
 *
 * **Falcon (29015)** — "Hero Response: After Falcon attacks or thwarts, spend a [energy] resource → ready another
 * champion character you control." `after.attacksOrThwarts("self")` with `chooseTarget("character", { categories:
 * ["identity", "ally"], trait: CHAMPION, controller: "you", self: false })` is Spider-Man/Peter Parker's own "ready
 * another Web-Warrior character" shape verbatim (`wave5/sm/spider-man-morales/precon-player-cards.ts`
 * `27049.spider-man-response`), Champion in place of Web-Warrior.
 *
 * **Patriot (29016)** — "Hero Response: After Patriot enters play, choose a champion character → that character
 * gets +1 to each of its basic powers until the end of the round." "Each of its basic powers" is THW, ATK and DEF
 * (RRG 1.8 "Basic Power", p. 9): three `modifyStat` calls, `until: "endOfRound"`. No "you control"/"another" printed
 * here (unlike Falcon), so the query is any champion character in play, Champions Mobile Bunker's own unrestricted
 * `query("identity", { trait: CHAMPION })` shape widened to `["identity", "ally"]` (`wave5/nova/support-upgrades-
 * allies.ts` `28020.champions-mobile-bunker-action`).
 *
 * **Agent 13 (29022)** — a second printing of `sm` 27046 (already scripted, `wave5/sm/spider-man-morales/precon-
 * player-cards.ts`; that module's own docblock notes both printings by id): identical printed text ("[star]
 * Response: After Agent 13 attacks or thwarts, choose a S.H.I.E.L.D. support → ready that support."), aliased
 * rather than re-scripted, the Surveillance Team/Core-01064 precedent (`27045.surveillance-team-action`).
 *
 * **Snowguard (29023)** — "Response: After Snowguard enters play, place up to 3 shift counters here. While the
 * shift counters here are equal to (X), she gets: (1) +3 ATK and her attacks gain overkill. (2) +3 THW and gains
 * the Aerial trait. (3) +5 hit points and gains retaliate 1." The one-time placement is a player choice of exactly
 * how many (0 to 3, "up to" on an effect permits 0, RRG 1.8 "Cost" p. 14's floor applies only to costs) —
 * `addCounters`'s own `upTo` instead caps a running total ("to a maximum of N", Groot's growth counters), the wrong
 * shape for a one-time "choose a quantity", so this is `chooseOne` over four fixed-amount options, the same
 * enumerate-the-choice idiom Ironheart's own New and Improved (29007) and Champions Mobile Bunker (`wave5/nova/
 * support-upgrades-allies.ts` 28020) use for a bounded numeric/option choice. "While … equal to (X)" is *exactly*
 * X, not X-or-more (only one of the three bullets ever applies, since only one tier is ever reached) —
 * `valueEquals(countersOn(self, "shift"), N)` (`dsl/values.ts`), not `counterAtLeast`, which would leave tier 1's
 * bonus still active at 2 or 3 counters. "Her attacks gain overkill" is a character-level keyword grant
 * (`gainsKeyword({ name: "overkill" }, …)`), read by `attackKeywordsOf`'s own "attacker's own printed or granted
 * keyword" clause (`packages/engine/src/keywords.ts`) exactly like "Kidpool's/Wolverine's/Badoon Warlord's attacks
 * gain piercing/overkill" elsewhere in the pool — not `attack(..., { overkill: true })`, which is a one-off
 * per-attack effect, not a standing grant. "Gains retaliate 1" is `gainsKeywordX("retaliate", 1, …)` (Mandrill's own
 * precedent, `wave4/hood/wrecking-crew.ts`).
 *
 * **Vivian (29024)** — "Hero Response: After Vivian enters play, choose an attachment, non-Elite minion, or
 * non-permanent side scheme. Until the end of the round, treat that card's printed text box as if it were blank
 * (except for Traits)." One choice over a union whose parts carry different filters: `TargetQuery.anyOf` of
 * `query("attachment")`, `query("minion", { withoutTrait: ELITE })` (the Red Skull "non-Elite minion" precedent,
 * `wave2/trors/red-skull.ts`) and `query("sideScheme", { withoutKeyword: "permanent" })`, which reads Permanent as
 * the keyword's own protection does (`keywords.ts` `queryHasKeyword`: printed even through a blank, granted counts,
 * docs/phase7-wave5.md §4.1 Q45). The blank is `blankTextBox` until `"endOfRound"` (Edison's Giant Robot's effect,
 * `wave1/msm/nemesis.ts`); "(except for Traits)" needs nothing more, since the engine never blanks traits
 * (`select.ts` `printedTraitsOf` reads no blank).
 */
export const IRONHEART_ALLIES = defineAbilities({
  "29014.cloud-9-action": heroAction(
    { cost: exhaustThis },
    choosePlayer(),
    modifyStatOf("thw", 1, query("character", { trait: AERIAL, controlledBy: chosenPlayer() }), "endOfPhase"),
  ),

  "29015.falcon-response": heroResponse(
    after.attacksOrThwarts("self"),
    { cost: spend({ energy: 1 }) },
    chooseTarget("character", { categories: ["identity", "ally"], trait: CHAMPION, controller: "you", self: false }),
    ready(chosen("character")),
  ),

  "29016.patriot-response": heroResponse(
    after.entersPlay("self"),
    chooseTarget("character", query(["identity", "ally"], { trait: CHAMPION })),
    modifyStat("thw", 1, chosen("character"), "endOfRound"),
    modifyStat("atk", 1, chosen("character"), "endOfRound"),
    modifyStat("def", 1, chosen("character"), "endOfRound"),
  ),

  // Agent 13 — a second printing of `sm` 27046 (module docblock): identical printed text, aliased rather than
  // re-scripted.
  "29022.agent-13-response": SPIDER_MAN_MORALES_PRECON_PLAYER_CARDS["27046.agent-13-response"]!,

  "29023.snowguard-response": response(
    on.entersPlay("self"),
    chooseOne(
      option("Place no shift counters"),
      option("Place 1 shift counter", addCounters("shift", 1)),
      option("Place 2 shift counters", addCounters("shift", 2)),
      option("Place 3 shift counters", addCounters("shift", 3)),
    ),
  ),
  "29023.snowguard-constant": constant(
    gets("atk", 3, query("ally", { self: true }), { while: valueEquals(countersOn(self, "shift"), 1) }),
    gainsKeyword({ name: "overkill" }, query("ally", { self: true }), {
      while: valueEquals(countersOn(self, "shift"), 1),
    }),
  ),
  "29023.snowguard-constant-2": constant(
    gets("thw", 3, query("ally", { self: true }), { while: valueEquals(countersOn(self, "shift"), 2) }),
    gainsTrait(AERIAL, query("ally", { self: true }), { while: valueEquals(countersOn(self, "shift"), 2) }),
  ),
  "29023.snowguard-constant-3": constant(
    gets("hp", 5, query("ally", { self: true }), { while: valueEquals(countersOn(self, "shift"), 3) }),
    gainsKeywordX("retaliate", 1, query("ally", { self: true }), {
      while: valueEquals(countersOn(self, "shift"), 3),
    }),
  ),

  "29024.vivian-response": heroResponse(
    after.entersPlay("self"),
    chooseTarget("card", {
      anyOf: [
        query("attachment"),
        query("minion", { withoutTrait: ELITE }),
        query("sideScheme", { withoutKeyword: "permanent" }),
      ],
    }),
    { kind: "blankTextBox", target: chosen("card"), until: "endOfRound" },
  ),
});
