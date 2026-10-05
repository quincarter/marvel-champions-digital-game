/**
 * MojoMania's Dossier (QA wave 6): a real folded campaign after issues #1 and #2 never lists the campaign's own
 * working fields (the Log, Overview and Issues tabs), shows each recorded card once in plain words, shows the genre
 * sets checked off as a player-meaningful row, cites the box's own page on a rewind, and lists a hero's recorded cards
 * on the Heroes tab. No row carries a raw field id.
 */
import { MOJO_CAMPAIGN_DEFINITION } from "@mc/cards";
import {
  applyCampaignResult,
  createCampaignLog,
  resolveBetweenGames,
  type CampaignChoiceAnswer,
  type CampaignGameResult,
  type CampaignHistoryEntry,
  type CampaignLog,
  type CampaignPendingChoice,
  type CampaignRunnerResult,
  type LogWrite,
} from "@mc/engine";
import { describe, expect, test } from "vitest";
import { POOL_CARDS, POOL_VERSION } from "../content/pool.js";
import type { CardId } from "@mc/content";
import { preconDecks } from "./deck-list-model.js";
import {
  campaignDossierHero,
  campaignDossierLog,
  campaignDossierOverview,
  campaignDossierIssues,
} from "./campaign-dossier-model.js";
import { campaignIssueModel } from "./campaign-issue-model.js";

const DEF = MOJO_CAMPAIGN_DEFINITION;
const recordedOf = (seat: CampaignLog["seats"][number]): readonly CardId[] => {
  const value = seat.fields["recordedCards"];
  return value?.kind === "cardList" ? value.cardIds : [];
};
const POOL = Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card]));
const deckNamed = (id: string) => preconDecks(POOL_VERSION).find((deck) => (deck.id as string).includes(id))!;
const SEATS = [deckNamed("spider-man-justice"), deckNamed("captain-marvel")].map((deck, i) => ({
  seatNumber: i + 1,
  identityCardId: deck.identityCardId,
  deck,
}));
const cardName = (id: CardId): string => (POOL[id as string] as { name?: string } | undefined)?.name ?? (id as string);
const heroNameOf = (id: string): string => cardName(id as CardId);

function settle<T>(
  step: (answers: readonly CampaignChoiceAnswer[]) => CampaignRunnerResult<T>,
  pick: (choice: CampaignPendingChoice) => readonly string[],
): T {
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 64; guard++) {
    const result = step(answers);
    if (result.kind === "done") return result.value;
    const { instructionId, slot, seatNumber } = result.choice;
    answers.push({ instructionId, slot, seatNumber, picked: pick(result.choice) });
  }
  throw new Error("never settled");
}

const compose = (log: CampaignLog): CampaignLog =>
  settle(
    (answers) => resolveBetweenGames(DEF, log, { pool: POOL }, log.modes, answers),
    (choice) => (/^(set|checked)\d$/.test(choice.slot) ? [choice.options[0]!] : []),
  );

const eligible = POOL_CARDS.filter(
  (card) =>
    (card.type === "support" || card.type === "upgrade") &&
    typeof (card as { cost?: number }).cost === "number" &&
    (card as { cost: number }).cost <= 2,
).map((card) => card.id);

function win(composed: CampaignLog, nodeId: string, records: CampaignGameResult["records"]): CampaignLog {
  const result: CampaignGameResult = {
    nodeId,
    outcome: "won",
    records,
    removedFromCampaign: [],
    logWrites: [],
    expiringGrants: [],
  };
  // Each hero records the first card they are offered.
  const log = settle(
    (answers) =>
      applyCampaignResult(DEF, composed, result, { at: 1_700_000_000_000, gameId: "t" }, { pool: POOL }, answers),
    (choice) => (choice.slot === "recordedCard" && choice.options.length > 0 ? [choice.options[0]!] : []),
  );
  return log;
}

const write = (instructionId: string, w: LogWrite) => ({ instructionId, write: w });
const shared = (instructionId: string, field: string, value: LogWrite["value"]) =>
  write(instructionId, { field, seatNumber: null, mode: "set", value });
const perSeat = (instructionId: string, field: string, seatNumber: number, ids: readonly CardId[]) =>
  write(instructionId, { field, seatNumber, mode: "set", value: { kind: "cardList", cardIds: ids } });

function fold(): CampaignLog & { readonly name: string; readonly box: string } {
  let log = createCampaignLog(DEF, {
    id: "mojo-dossier",
    poolVersion: POOL_VERSION,
    modes: { campaign: { campaignId: DEF.campaignId } },
    seats: SEATS,
    seed: 7,
  });
  const [a, b, c] = eligible;
  log = compose(log);
  log = win(log, "magog", [
    shared("mojo.s1.victory.longshot", "longshotInPlay", { kind: "flag", value: false }),
    shared("mojo.s1.victory.candidates", "championBooing", { kind: "flag", value: false }),
    ...[1, 2].flatMap((seat) => [
      perSeat("mojo.s1.victory.candidates", "candidatesLow", seat, seat === 1 ? [a!] : [b!]),
      perSeat("mojo.s1.victory.candidates", "candidatesHigh", seat, seat === 1 ? [a!] : [b!]),
      perSeat("mojo.s1.victory.candidates", "dashCosts", seat, []),
    ]),
  ]);
  log = compose(log);
  log = win(log, "spiral", [
    shared("mojo.s2.victory.longshot", "longshotInPlay", { kind: "flag", value: false }),
    shared("mojo.s2.victory.candidates", "mainSchemeThreat", { kind: "number", value: 13 }),
    shared("mojo.s2.victory.candidates", "playersStarted", { kind: "number", value: 2 }),
    ...[1, 2].flatMap((seat) => [
      perSeat("mojo.s2.victory.candidates", "candidatesLow", seat, [c!]),
      perSeat("mojo.s2.victory.candidates", "candidatesHigh", seat, [c!]),
      perSeat("mojo.s2.victory.candidates", "dashCosts", seat, []),
    ]),
  ]);
  return { ...log, name: "MojoMania", box: "mojo" };
}

/** Every string a player can read on the Dossier's Log, Overview and Issues tabs. */
function allText(record: ReturnType<typeof fold>): string[] {
  const log = campaignDossierLog(record, DEF, cardName, heroNameOf);
  const overview = campaignDossierOverview(record, DEF, heroNameOf, cardName);
  const issues = campaignDossierIssues(record, DEF, undefined, cardName);
  const detail = ["magog", "spiral"].flatMap(
    (nodeId) =>
      campaignIssueModel(record, DEF, undefined, nodeId, cardName)?.writes.map(
        (row) => `${row.headline} ${row.detail}`,
      ) ?? [],
  );
  return [
    ...log.sections.flatMap((section) =>
      section.entries.map((entry) => `${entry.headline} | ${entry.detail} | ${entry.citation}`),
    ),
    ...log.inForce.map((row) => `${row.label} ${row.value} ${row.note}`),
    ...overview.world.map((row) => `${row.label} ${row.bigValue} ${row.when}`),
    ...overview.seats.flatMap((seat) => seat.rows.map((row) => `${row.label} ${row.value}`)),
    ...issues.map((row) => `${row.title} ${row.resultLine ?? ""}`),
    ...detail,
  ];
}

describe("MojoMania's Dossier after issues #1 and #2", () => {
  const record = fold();

  test("the fold really is two wins with recorded cards", () => {
    expect(record.history.filter((entry: CampaignHistoryEntry) => entry.outcome === "won")).toHaveLength(2);
    const recorded = record.seats.map(
      (seat) => (seat.fields["recordedCards"] as { cardIds?: unknown[] } | undefined)?.cardIds?.length ?? 0,
    );
    expect(recorded.every((count) => count >= 1)).toBe(true);
  });

  test("no tab lists a working field, a '(working)' label or a raw field id", () => {
    const text = allText(record).join("\n");
    expect(text).not.toMatch(/\(working\)/i);
    for (const id of [
      "mainSchemeThreat",
      "playersStarted",
      "candidatesLow",
      "candidatesHigh",
      "dashCosts",
      "modularPicked",
      "modularFresh",
      "championBooing",
    ]) {
      expect(text).not.toContain(id);
    }
    expect(text).not.toMatch(/threat on the main scheme/i);
    expect(text).not.toMatch(/who started the scenario/i);
    expect(text).not.toMatch(/Struck:/);
  });

  test("each recorded card is one plain row, and the genre sets checked off are a row of their own", () => {
    const log = campaignDossierLog(record, DEF, cardName, heroNameOf);
    const rows = log.sections.flatMap((section) => section.entries.map((entry) => entry.headline));
    for (const seat of record.seats) {
      const hero = heroNameOf(seat.identityCardId as string);
      const cards = recordedOf(seat);
      for (const id of cards) {
        expect(rows.filter((row) => row === `${hero} recorded ${cardName(id)}`)).toHaveLength(1);
      }
    }
    expect(rows.filter((row) => row.startsWith("Checked off: "))[0]).toMatch(/^Checked off: Crime/);
    expect(rows.join("\n")).not.toContain("+ ");
  });

  test("the Heroes tab shows each hero's recorded cards", () => {
    for (const seat of record.seats) {
      const hero = campaignDossierHero(record, DEF, seat.seatNumber, (id) => POOL[id] as never);
      const names = hero?.campaignCards.map((card) => card.name) ?? [];
      const cards = recordedOf(seat);
      expect(names).toEqual(expect.arrayContaining(cards.map((id) => cardName(id))));
    }
  });
});

describe("a rewind's citation", () => {
  test("is the box's own page, and none when the box prints none", () => {
    const base = fold();
    const lost: CampaignHistoryEntry = { ...base.history[0]!, outcome: "lost" };
    const withLoss = { ...base, history: [lost, ...base.history] };
    const row = campaignDossierLog(withLoss, DEF, cardName, heroNameOf).sections[0]!.entries.find((entry) =>
      entry.key.includes(":rewind:"),
    )!;
    expect(row.citation).toBe("MojoMania insert p. 4");
    const bare = campaignDossierLog(
      withLoss,
      { ...DEF, loss: { retry: "free", retryBaseline: "nodeStart" } },
      cardName,
      heroNameOf,
    );
    expect(bare.sections[0]!.entries.find((entry) => entry.key.includes(":rewind:"))!.citation).toBe("");
  });
});
