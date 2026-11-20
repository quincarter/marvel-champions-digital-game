/**
 * A made-up Civil War Competitive result for the result sheet's dev preview (`?screen=competitive-over&kind=tie|win`,
 * issue #883): a tie on win conditions settled by the third tie-break, or a plain win. Run through the same
 * `competitiveOverOf` the live game uses, so the screenshot shows the real wording. Dev only.
 */
import type { GameState } from "@mc/engine";
import { competitiveOverOf, type CompetitiveOver } from "./competitive-over.js";

const teams = [
  { teamId: "t1", side: "registration", playerIds: ["p1"], areaId: "a1" },
  { teamId: "t2", side: "resistance", playerIds: ["p2"], areaId: "a2" },
] as unknown as GameState["teams"];

export function competitiveOverFixture(kind: "tie" | "win"): CompetitiveOver {
  const outcome =
    kind === "tie"
      ? {
          result: "teams",
          reason: "competitiveEnded",
          decision: "win",
          teams: [
            { teamId: "t1", side: "registration", result: "win", conditions: ["enemyLeaderDefeated"] },
            { teamId: "t2", side: "resistance", result: "loss", conditions: ["enemyLeaderDefeated"] },
          ],
          tieBreak: {
            applied: true,
            decidedBy: "mainSchemeThreat",
            measures: [
              { measure: "mainSchemeAdvanced", values: { t1: 0, t2: 0 } },
              { measure: "minionsAndSideSchemes", values: { t1: 2, t2: 2 } },
              { measure: "mainSchemeThreat", values: { t1: 3, t2: 5 } },
            ],
          },
        }
      : {
          result: "teams",
          reason: "competitiveEnded",
          decision: "win",
          teams: [
            { teamId: "t1", side: "registration", result: "win", conditions: ["enemyLeaderDefeated"] },
            { teamId: "t2", side: "resistance", result: "loss", conditions: [] },
          ],
        };
  return competitiveOverOf({ outcome, teams } as unknown as Pick<GameState, "outcome" | "teams">, ["p1"])!;
}
