/**
 * The campaign builders compile to the engine's plain data and nothing else (docs/campaign-mode-design.md §6.1).
 *
 * They are thin on purpose: a campaign instruction is card text, so it is authored here and interpreted only by the
 * engine. No real box or card is named — the first one is `@mc/cards/src/campaigns/` (design §11 step 7).
 */

import { action, whenRevealed } from "./abilities.js";
import {
  campaignLogCards,
  discard,
  logCardList,
  logCardRef,
  logFlag,
  logNumber,
  logOption,
  logText,
  moveCards,
  recordInCampaignLog,
  removeFromCampaign,
} from "./effects.js";
import { validateDefinition } from "./validate.js";
import {
  campaignLogAtLeast,
  campaignLogHas,
  campaignLogIsSet,
  campaignLogValue,
  each,
  eachPlayer,
  inCampaignLogField,
  query,
  self,
  threatOn,
  theMainScheme,
} from "./values.js";

describe("reading the campaign log", () => {
  it("compiles a shared read, a per-seat read and a count", () => {
    expect(campaignLogValue("delayCounters")).toEqual({ kind: "campaignLog", field: "delayCounters" });
    expect(campaignLogValue("remainingHp", { seat: eachPlayer })).toEqual({
      kind: "campaignLog",
      field: "remainingHp",
      seat: { kind: "each" },
    });
    expect(campaignLogValue("rescued", { of: "count" })).toEqual({
      kind: "campaignLog",
      field: "rescued",
      of: "count",
    });
  });

  it("compiles the three predicate spellings", () => {
    expect(campaignLogHas("pool", "some-card")).toEqual({ kind: "campaignLog", field: "pool", has: "some-card" });
    expect(campaignLogIsSet("trust", false)).toEqual({ kind: "campaignLog", field: "trust", isSet: false });
    expect(campaignLogAtLeast("pool", 2, { of: "count" })).toEqual({
      kind: "campaignLog",
      field: "pool",
      atLeast: 2,
      of: "count",
    });
  });

  it("compiles the query clause and the card selector", () => {
    expect(query("ally", inCampaignLogField("rescued"))).toEqual({
      categories: ["ally"],
      inCampaignLogField: { field: "rescued" },
    });
    expect(campaignLogCards("pool", { filter: query("attachment") })).toEqual({
      kind: "campaignLog",
      field: "pool",
      filter: { categories: ["attachment"] },
    });
  });
});

describe("writing the campaign log", () => {
  it("defaults to `set`, and takes a mode and a seat", () => {
    expect(recordInCampaignLog("delayCounters", logNumber(threatOn(theMainScheme)))).toEqual({
      kind: "recordInCampaignLog",
      field: "delayCounters",
      mode: "set",
      value: { kind: "number", amount: { kind: "threat", of: { kind: "mainScheme" } } },
    });
    expect(
      recordInCampaignLog("rescued", logCardList(campaignLogCards("pool")), { mode: "append", seat: eachPlayer }),
    ).toEqual({
      kind: "recordInCampaignLog",
      field: "rescued",
      mode: "append",
      seat: { kind: "each" },
      value: { kind: "cardList", cards: { kind: "campaignLog", field: "pool" } },
    });
  });

  it("compiles every value shape an in-game sentence can write", () => {
    expect(logFlag()).toEqual({ kind: "flag" });
    expect(logFlag(campaignLogIsSet("trust"))).toEqual({
      kind: "flag",
      when: { kind: "campaignLog", field: "trust", isSet: true },
    });
    expect(logCardRef(campaignLogCards("upgrade"), true)).toEqual({
      kind: "cardRef",
      card: { kind: "campaignLog", field: "upgrade" },
      withFace: true,
    });
    expect(logOption("east")).toEqual({ kind: "choice", option: "east" });
    expect(logText("a note")).toEqual({ kind: "text", value: "a note" });
  });

  it("validates as an ordinary ability: plain JSON, nothing read before it is bound", () => {
    // The shape MC10's campaign upgrades print: "Discard this card and remove it from the campaign log → …".
    const upgrade = action([discard(self), removeFromCampaign({ kind: "ref", ref: self })]);
    expect(validateDefinition(upgrade)).toEqual([]);
    const setup = whenRevealed([
      moveCards(campaignLogCards("experimental"), "encounterDeckShuffle"),
      recordInCampaignLog("engaged", logFlag(), { seat: eachPlayer }),
    ]);
    expect(validateDefinition(setup)).toEqual([]);
  });

  it("keeps a campaign query usable wherever a query is", () => {
    const definition = whenRevealed([discard(each(query("ally", inCampaignLogField("rescued"))))]);
    expect(validateDefinition(definition)).toEqual([]);
  });
});
