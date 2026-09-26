/**
 * A synthetic fixture, not a real box: MC50 isn't scripted yet (`campaign-hidden-evidence-model.ts`'s own doc
 * comment). Exercises the generic contract — any campaign that declares a `hidden` `cardList` field, plus this
 * module's own `<id>Revealed` reveal convention — the same way `packages/engine/src/campaign.test.ts` exercises
 * shapes the first box doesn't use yet.
 */
import { describe, expect, it } from "vitest";
import type { CampaignLog, LogFieldDef } from "@mc/engine";
import { cardId } from "@mc/content";
import { hiddenEvidenceCount, hiddenEvidenceEnvelope } from "./campaign-hidden-evidence-model.js";

const SEALED_EVIDENCE_FIELD: LogFieldDef = {
  id: "sealedEvidence",
  label: "A.I.M.",
  scope: "shared",
  type: { kind: "cardList" },
  hidden: true,
  citation: "MC50 p. 5",
};

const REVEALED_FLAG_FIELD: LogFieldDef = {
  id: "sealedEvidenceRevealed",
  label: "A.I.M. unmasked",
  scope: "shared",
  type: { kind: "flag" },
  citation: "MC50 p. 19",
};

const DEFINITION = { logFields: [SEALED_EVIDENCE_FIELD, REVEALED_FLAG_FIELD] };
const NO_HIDDEN_FIELD_DEFINITION = { logFields: [REVEALED_FLAG_FIELD] };

const EVIDENCE_CARD_IDS = [cardId("50001"), cardId("50002"), cardId("50003")];
const cardName = (id: string): string =>
  ({ "50001": "Encrypted Pager", "50002": "Gambling Debt", "50003": "Forged Badge" })[id] ?? id;

function sealedLog(): Pick<CampaignLog, "hidden" | "shared"> {
  return { hidden: { sealedEvidence: { kind: "cardList", cardIds: EVIDENCE_CARD_IDS } }, shared: {} };
}

function revealedLog(): Pick<CampaignLog, "hidden" | "shared"> {
  return {
    hidden: { sealedEvidence: { kind: "cardList", cardIds: EVIDENCE_CARD_IDS } },
    shared: { sealedEvidenceRevealed: { kind: "flag", value: true } },
  };
}

describe("hiddenEvidenceCount", () => {
  it("reads only the count off CampaignLog.hidden — never the identities", () => {
    expect(hiddenEvidenceCount(sealedLog(), DEFINITION)).toBe(3);
  });

  it("null for a box with no hidden field at all (every box before MC50)", () => {
    expect(hiddenEvidenceCount(sealedLog(), NO_HIDDEN_FIELD_DEFINITION)).toBeNull();
  });
});

describe("hiddenEvidenceEnvelope", () => {
  it("sealed: the count and label, never the cards", () => {
    const envelope = hiddenEvidenceEnvelope(sealedLog(), DEFINITION, cardName);
    expect(envelope).toEqual({ label: "A.I.M.", citation: "MC50 p. 5", cardCount: 3, revealedCards: null });
  });

  it("revealed: the <id>Revealed flag being set shows the actual cards", () => {
    const envelope = hiddenEvidenceEnvelope(revealedLog(), DEFINITION, cardName);
    expect(envelope?.revealedCards).toEqual(["Encrypted Pager", "Gambling Debt", "Forged Badge"]);
    expect(envelope?.cardCount).toBe(3);
  });

  it("null for a box with no hidden field at all", () => {
    expect(hiddenEvidenceEnvelope(sealedLog(), NO_HIDDEN_FIELD_DEFINITION, cardName)).toBeNull();
  });

  it("stays sealed if the reveal field is declared but not yet set", () => {
    const midCampaign: Pick<CampaignLog, "hidden" | "shared"> = { ...sealedLog(), shared: {} };
    expect(hiddenEvidenceEnvelope(midCampaign, DEFINITION, cardName)?.revealedCards).toBeNull();
  });

  it("stays sealed if the reveal field is itself (incorrectly) declared hidden", () => {
    const hiddenRevealField: LogFieldDef = { ...REVEALED_FLAG_FIELD, hidden: true };
    const badDefinition = { logFields: [SEALED_EVIDENCE_FIELD, hiddenRevealField] };
    expect(hiddenEvidenceEnvelope(revealedLog(), badDefinition, cardName)?.revealedCards).toBeNull();
  });
});
