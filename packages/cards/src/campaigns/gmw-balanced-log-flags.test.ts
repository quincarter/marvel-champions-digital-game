/**
 * The Balanced toggles the client reads from a game's frozen log (issue #609): the scans a Balanced game shows depend on
 * them, so each must reach `CampaignGameInput.log.shared` at the node where its scan appears. A flag a node never reads
 * is left out of the log view (`logViewFor`), which would silently hide its scan.
 */
import { describe, expect, it } from "vitest";
import { resolveBetweenGames, startGameFromLog } from "@mc/engine";
import { DEPS, logAt, modesOf, settleCampaign, type RunChoice } from "./gmw-balanced-testing.js";
import { GMW_CAMPAIGN_DEFINITION } from "./gmw.js";
import { GMW_BALANCED_FIELD, GMW_BALANCED_TOGGLES, type GmwBalancedToggleId } from "./gmw-balanced.js";

const MUSEUM = "infiltrate-the-museum";
const RONAN = "ronan-the-accuser";

/** The toggles whose scans show at each node: Infiltrate the Museum's Grand Collection, Ronan's 1A and the Milano. */
const TOGGLES_AT: readonly (readonly [string, GmwBalancedToggleId])[] = [
  [MUSEUM, "spacePirates"],
  [RONAN, "milanoExhausted"],
  [RONAN, "kreeSupremacy"],
];

const fieldOf = (id: GmwBalancedToggleId): string => GMW_BALANCED_TOGGLES.find((toggle) => toggle.id === id)!.field;

const sharedAt = (nodeId: string, choice: RunChoice) => {
  const modes = modesOf(choice);
  const composed = settleCampaign(
    (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, logAt(nodeId, choice, 2), DEPS, modes, answers),
    [],
  );
  return startGameFromLog(GMW_CAMPAIGN_DEFINITION, composed.value).input.log.shared;
};

describe("the toggles a Balanced game's frozen log carries", () => {
  it.each(TOGGLES_AT)("%s hands the game %s when it is on, and not when it is off", (nodeId, id) => {
    const on = sharedAt(nodeId, { balanced: true, toggles: [id] });
    expect(on[fieldOf(id)], `${id} at ${nodeId}`).toEqual({ kind: "flag", value: true });
    expect(on[GMW_BALANCED_FIELD]).toEqual({ kind: "flag", value: true });
    expect(sharedAt(nodeId, { balanced: true })[fieldOf(id)]).toBeUndefined();
    expect(sharedAt(nodeId, { balanced: false })[fieldOf(id)]).toBeUndefined();
  });
});
