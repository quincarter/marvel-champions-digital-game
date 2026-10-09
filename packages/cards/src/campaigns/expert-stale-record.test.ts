/**
 * An expert campaign's remaining-hit-point record must not outlive a defeat. A seat that sits out a won scenario's
 * Victory steps (eliminated, "does not participate", e.g. MC40 p. 7 / MC32 p. 5 / MojoMania insert p. 5) gets no
 * `hpRecord` write, so an earlier scenario's record would read as a live identity at the next setup's heal and let the
 * defeated player decline it and start at the stale hit points. `defeatedSeatRecordsZero` sets that record to 0.
 * (Age of Apocalypse's own scenario is in `aoa.test.ts`.)
 */
import { describe, expect, it } from "vitest";
import {
  applyCampaignResult,
  type CampaignDefinition,
  type CampaignDeps,
  type CampaignGameResult,
  type CampaignLog,
} from "@mc/engine";
import { WAVE8_CARDS } from "../wave8/index.js";
import { MOJO_CAMPAIGN_DEFINITION } from "./mojo.js";
import { MUT_GEN_CAMPAIGN_DEFINITION } from "./mut_gen.js";
import { NEXT_EVOL_CAMPAIGN_DEFINITION } from "./next_evol.js";
import { SEATS, compose, newLog, settleBy, takeFirst } from "./aoa-testing.js";

const DEPS: CampaignDeps = { pool: WAVE8_CARDS };

describe.each([
  ["next_evol (MC40 p. 7)", NEXT_EVOL_CAMPAIGN_DEFINITION, "mc40.s1.victory.hp"],
  ["mut_gen (MC32 p. 5)", MUT_GEN_CAMPAIGN_DEFINITION, "mc32.s1.victory.hp"],
  ["mojo (insert p. 5)", MOJO_CAMPAIGN_DEFINITION, "mojo.s1.victory.hp"],
] as const)(
  "%s: a defeated seat's earlier hit point record is cleared",
  (_name, definition: CampaignDefinition, hpId: string) => {
    const expert = { campaign: { campaignId: definition.campaignId, expertCampaign: true as const } };

    const finish = (composed: CampaignLog, sittingOut: readonly number[]): CampaignLog => {
      const result: CampaignGameResult = {
        nodeId: composed.attempt!.nodeId,
        outcome: "won",
        records: [
          {
            instructionId: hpId,
            write: { field: "remainingHp", seatNumber: 1, mode: "set", value: { kind: "number", value: 4 } },
          },
          ...(sittingOut.length > 0
            ? []
            : [
                {
                  instructionId: hpId,
                  write: {
                    field: "remainingHp",
                    seatNumber: 2,
                    mode: "set" as const,
                    value: { kind: "number" as const, value: 7 },
                  },
                },
              ]),
        ],
        removedFromCampaign: [],
        logWrites: [],
        expiringGrants: [],
        ...(sittingOut.length > 0 ? { sittingOut } : {}),
      };
      return settleBy(
        (answers) =>
          applyCampaignResult(definition, composed, result, { at: 1_700_000_000_000, gameId: "qa" }, DEPS, answers),
        takeFirst,
      ).value;
    };

    it("seat 2 recorded 7, then is defeated in a won scenario: its record becomes 0", () => {
      const first = finish(compose(newLog(expert, 91, SEATS, definition), takeFirst, definition).log, []);
      expect(first.seats[1]!.fields.remainingHp).toEqual({ kind: "number", value: 7 });
      const second = finish(compose(first, takeFirst, definition).log, [2]);
      expect(second.seats[0]!.fields.remainingHp).toEqual({ kind: "number", value: 4 });
      expect(second.seats[1]!.fields.remainingHp).toEqual({ kind: "number", value: 0 });
    });

    it("nobody sat out: no seat's record is touched", () => {
      const first = finish(compose(newLog(expert, 92, SEATS, definition), takeFirst, definition).log, []);
      expect(first.seats.map((seat) => seat.fields.remainingHp)).toEqual([
        { kind: "number", value: 4 },
        { kind: "number", value: 7 },
      ]);
    });
  },
);
