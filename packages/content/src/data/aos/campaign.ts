// Hand-authored: there is no MarvelCDB equivalent of a campaign record (docs/campaign-mode-design.md section 3), the
// same gap `aoa`'s own `campaign.ts` fills. Built from the primary rulebook conversion,
// docs/campaign-modes/markdown/mc50_agents_of_shield.md ("MC50"), per docs/phase7-wave9.md section 1.16 item 1, and
// cross-checked against the ingested AOS_SCENARIOS this record names (see packages/content/src/data/aos-campaign.test.ts).

import { campaignId, cardId, scenarioId, setCode } from "../../schema/index.js";
import type { Campaign, CardId } from "../../schema/index.js";

/**
 * Agents of S.H.I.E.L.D.'s five scenarios in the fixed order MC50 p. 4 prints ("the players must win all five
 * scenarios in numerical order, starting with scenario #1 - Black Widow"): Black Widow p. 9, Batroc p. 11, M.O.D.O.K.
 * p. 13, Thunderbolts p. 15, Baron Zemo p. 19.
 *
 * **`campaignSetIds` is empty on purpose.** A set listed there is barred from standalone play, and neither
 * `s.h.i.e.l.d._executive_board` (a modular set, MC50 p. 6) nor `executive_board_evidence` (dealt in a standalone Baron
 * Zemo game, MC50 p. 18) may be. No record of the box is a campaign-specific card. No `perSeatSetIds`, no `roles`, no
 * `prohibited` (docs/phase7-wave9.md section 1.16 item 1).
 *
 * Not included here: the log's fields, the per-scenario setup / victory / defeat instructions and the expert-campaign
 * bullets are `@mc/cards`' `CampaignDefinition`, not this plain-data record (the schema models membership only). What the
 * campaign adds to a scenario (the Executive Board set in scenarios 1 to 4; Adaptoids, their environments and the
 * Thunderbolt sets in scenario 5) is composed by that definition, not written into `AOS_SCENARIOS`.
 */
export const AOS_CAMPAIGN: Campaign = {
  id: campaignId("aos"),
  name: "Agents of S.H.I.E.L.D.",
  boxCode: "MC50",
  packCode: setCode("aos"),
  scenarioIds: [
    scenarioId("black-widow"),
    scenarioId("batroc"),
    scenarioId("modok"),
    scenarioId("thunderbolts"),
    scenarioId("baron-zemo"),
  ],
  campaignSetIds: [],
  logSheetReference: "docs/campaign-modes/log-sheets/mc50_agents_of_shield_campaign_log.pdf",
};

/**
 * What the campaign log keeps about the three Board Members between scenarios, and the ONE place the owner's choices on
 * docs/phase7-wave9.md section 4.1 Q1 and Q11 live (both reopened with the owner; the research recommends 1A and 11A).
 * Not a field of `Campaign`: the schema holds membership only, so this is a sibling hand-authored fact the box's
 * `CampaignDefinition` (`@mc/cards`) reads, once engine tasks 51 and 52 (spec section 8.2) exist.
 *
 * - `boardMemberIds`: the front faces 50181a Chief Medical Officer, 50182a Chief Surveillance Officer, 50183a Chief
 *   Tactical Officer (the log's three rows of "Remaining Secret Counters by Scenario", MC50 p. 24). The counter key is
 *   `secret` (`definedCounterTypes`).
 * - `recordFace` (Q11): with `true` (11A, the owner's answer of 2026-10-10) the log records the face with the number (task 51's `cardStateOf` `withFace`)
 *   and a Board Member recorded as an attachment is flipped back to its attachment at the next Setup, "once a board
 *   member flips to its attachment side, it remains an attachment for the rest of the campaign" (MC50 p. 6). With
 *   `false` (11B) only the number is recorded and the Setup bullet is read as printed: "Place secret counters on
 *   each Board Member environment equal to the number of secret counters recorded" (MC50 p. 11).
 * - `secretsStayOnFlip` (Q1): `true` (1A, the owner's answer of 2026-10-10) the flipped attachment holds its secret counters; `false` (1B) the flip
 *   discards them, so the number recorded for an attachment is 0.
 *
 * The owner chose 1A and 11A on 2026-10-10 (docs/phase7-wave9.md section 4.1): the scenario's campaign instructions win
 * over the general flip rule. These two booleans carry that; the engine tasks read them.
 */
export const AOS_BOARD_MEMBER_LOG = {
  boardMemberIds: [cardId("50181a"), cardId("50182a"), cardId("50183a")] as readonly CardId[],
  counter: "secret",
  recordFace: true,
  secretsStayOnFlip: true,
} as const;
