/**
 * The `?screen=board&fixture=klaw-attachment` and `&fixture=player-side-scheme` dev jumps (`scenes/boot-dev-jump.ts`):
 * real games played forward on the engine's own commands for the table readability screenshots (#763, #765 to #769).
 * Nothing here edits a state, so each replays byte for byte from its seed and commands like any saved game.
 *
 * - klaw-attachment: four seats against Klaw (bomb_scare modular), everyone passing, until Solid-Sound Body (01119) is
 *   attached to Klaw and the next villain phase would empty the encounter deck. Klaw prints an ATK star and his main
 *   scheme accelerates, so the same board shows #766 and #765 as well.
 * - player-side-scheme: Angel with Render Medical Aid (42017) stacked into his opening hand and played from it.
 */
import { cardId } from "@mc/content";
import { activeEncounterDeck } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import type { SessionConfig } from "../engine/host.js";
import { encounterRunsOut } from "../view/pile-run-out.js";
import { appSession } from "../session.js";
import { codeOf, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

export const SOLID_SOUND_BODY = "01119";
export const RENDER_MEDICAL_AID = "42017";

export const KLAW_ATTACHMENT_CONFIG: SessionConfig = {
  scenarioId: "klaw",
  difficulty: "standard",
  modularSetIds: ["bomb_scare"],
  players: [
    { starterDeckId: "core-black-panther-protection" },
    { starterDeckId: "core-she-hulk-aggression" },
    { starterDeckId: "core-spider-man-justice" },
    { starterDeckId: "core-captain-marvel-leadership" },
  ],
  seed: 9,
};

/** Plays on, every seat ending its turn, until the attachment is on Klaw with the encounter deck about to run out. */
export async function playToKlawAttachment(store: SessionStore): Promise<boolean> {
  await store.start(KLAW_ATTACHMENT_CONFIG);
  for (let step = 0; step < 40; step++) {
    const turn = await nextTurn(store);
    const game = store.state.game;
    if (!turn || !game) return false;
    const onKlaw = Object.values(game.instances).some(
      (i) => i.cardId === SOLID_SOUND_BODY && i.attachedTo !== null && i.attachedTo !== undefined,
    );
    if (onKlaw && encounterRunsOut(game, POOL_DEPS) && activeEncounterDeck(game).deck.length > 0) return true;
    const end = turn.legal.find((entry) => entry.action.kind === "endTurn");
    if (!end) return false;
    await store.dispatch(end.example);
  }
  return false;
}

export const PLAYER_SIDE_SCHEME_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "angel-protection" }],
  seed: 3,
  stack: { players: { 0: [cardId(RENDER_MEDICAL_AID)] } },
};

/** Plays Render Medical Aid from the opening hand; true once it is in play. */
export async function playToPlayerSideScheme(store: SessionStore): Promise<boolean> {
  await store.start(PLAYER_SIDE_SCHEME_CONFIG);
  const turn = await nextTurn(store);
  const play = turn?.legal.find(
    (entry) =>
      entry.action.kind === "playCard" && codeOf(store.state.game!, entry.action.instanceId) === RENDER_MEDICAL_AID,
  );
  if (!play) return false;
  await store.dispatch(play.example);
  await nextTurn(store);
  return true;
}

export async function startDevKlawAttachmentGame(): Promise<boolean> {
  return playToKlawAttachment(appSession().store);
}

export async function startDevPlayerSideSchemeGame(): Promise<boolean> {
  return playToPlayerSideScheme(appSession().store);
}
