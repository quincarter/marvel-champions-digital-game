/**
 * Issue #873, the game half: a seat's `grantFaces` puts that copy into play already on its other face at RRG v1.8
 * Appendix II step 11 (MC10 p. 12, a permanent swap). A face reached by a campaign Setup flip each game (MC27 p. 22;
 * `CampaignGrant.faceAtSetup`, left out of `grantFaces`) enters on its front, and the campaign's own instruction turns
 * it at step 13, the `afterScenarioSetup` window. `flipCard` turns a card whichever face is up, so that instruction
 * names only a copy still on its front (`TargetQuery.flipped: false`): a copy an older log already put on its other
 * face stays there instead of being turned back.
 *
 * Synthetic cards only: the engine never names a card.
 */
import { describe, expect, it } from "vitest";
import { cardId, flat, type AnyCard } from "@mc/content";
import { DEFAULT_DEPS } from "./abilities.js";
import type { CampaignGameInput, CampaignGrantFace } from "./campaign.js";
import type { EffectSpec } from "./spec.js";
import { createGame } from "./setup.js";
import type { GameState } from "./state.js";
import { syntheticCampaignInput, syntheticInstruction } from "./testing/campaign.js";
import { runCommands } from "./testing/drive.js";
import { stubMainScheme, stubUpgrade } from "./testing/fixtures.js";
import { DEFAULT_CARDS, HERO, seatIdentities, VILLAIN } from "./testing/scenario.js";

/** A Setup upgrade whose other face prints the same title, so only the instance's `flipped` tells them apart. */
const GEAR = {
  ...stubUpgrade({ id: "syn-gear-a", cost: 0, keywords: [{ name: "setup" }] }),
  name: "Gear",
  flipSide: { name: "Gear", traits: [], keywords: [], text: { printed: "", current: "" }, abilities: [] },
} satisfies AnyCard;
const SCHEME = stubMainScheme({
  id: "syn-gear-scheme",
  stages: [{ startingThreat: flat(2), targetThreat: flat(40), acceleration: flat(0) }],
});

/** The campaign Setup flip: "Each player flips their Gear upgrade", restricted to a copy still on its front. */
const SETUP_FLIP: EffectSpec = {
  kind: "flipCard",
  target: { kind: "each", query: { categories: ["upgrade"], printedId: GEAR.id, flipped: false } },
};

function play(grantFaces: readonly CampaignGrantFace[], effects: readonly EffectSpec[]): GameState {
  const [identity] = seatIdentities(HERO, 1);
  const input: CampaignGameInput = syntheticCampaignInput({
    seats: [
      {
        seatNumber: 1,
        identityCardId: identity!.id,
        deck: [],
        aspects: [],
        grantedCardIds: [GEAR.id],
        ...(grantFaces.length > 0 ? { grantFaces } : {}),
      },
    ],
    instructions: effects.length > 0 ? [syntheticInstruction("syn.gear.flip", "afterScenarioSetup", effects)] : [],
  });
  const created = createGame(
    {
      seed: 99,
      cards: [...DEFAULT_CARDS, SCHEME, GEAR, identity!],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: SCHEME.id,
      encounterDeck: [],
      players: [{ identityCardId: identity!.id, deck: [GEAR.id] }],
      campaign: input,
    },
    DEFAULT_DEPS,
  );
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return runCommands(created.state, DEFAULT_DEPS).state;
}

const gearOf = (state: GameState) => {
  const gear = Object.values(state.instances).find((instance) => instance.cardId === cardId(GEAR.id));
  if (!gear) throw new Error("no Gear instance");
  return gear;
};
const attachedToIdentity = (state: GameState): boolean =>
  gearOf(state).attachedTo === state.players[0]!.identity.instanceId;

describe("a granted copy's face at setup", () => {
  it("with no face, it enters play on its front", () => {
    const state = play([], []);
    expect(attachedToIdentity(state)).toBe(true);
    expect(gearOf(state).flipped).toBe(false);
  });

  it("a face in grantFaces (a permanent swap) enters play already turned", () => {
    const state = play([{ cardId: GEAR.id, face: "Gear" }], []);
    expect(attachedToIdentity(state)).toBe(true);
    expect(gearOf(state).flipped).toBe(true);
  });

  it("a face left out of grantFaces enters on its front, and the afterScenarioSetup flip turns it", () => {
    const state = play([], [SETUP_FLIP]);
    expect(attachedToIdentity(state)).toBe(true);
    expect(gearOf(state).flipped).toBe(true);
  });

  it("the Setup flip names only a copy on its front: one already turned stays turned", () => {
    const state = play([{ cardId: GEAR.id, face: "Gear" }], [SETUP_FLIP]);
    expect(gearOf(state).flipped).toBe(true);
  });

  it("without the filter, flipCard toggles: an already turned copy goes back to its front", () => {
    const toggle: EffectSpec = { kind: "flipCard", target: { kind: "each", query: { printedId: GEAR.id } } };
    const state = play([{ cardId: GEAR.id, face: "Gear" }], [toggle]);
    expect(gearOf(state).flipped).toBe(false);
  });
});
