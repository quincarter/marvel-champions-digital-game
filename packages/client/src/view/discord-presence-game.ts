/**
 * The game half of the Discord snapshot (`view/discord-presence.ts`): what the table says about itself, read from the
 * engine's own state with the same helpers the board and Game over use, never recomputed here. It runs in the engine
 * worker (`engine/engine.worker.ts`): nothing here may touch Phaser or the DOM, nor the campaign story text.
 */
import { activeVillain, cardOf, villainStageOf, type GameState, type InstanceId } from "@mc/engine";
import type { AnyCard } from "@mc/content";
import { artFor, packPictureCodes, type CardFace } from "../art/art-source.js";
import type { SessionConfig } from "../engine/host.js";
import { difficultyLabelOf } from "./difficulty-label.js";
import type { PresenceGame } from "./discord-presence.js";
import { cardName, playerName } from "./names.js";

/** A `blob:` URL (a pack picture, were the resolver ever set here) means nothing outside this app: drop it. */
const publicOnly = (url: string | null | undefined): string | null => (url && !url.startsWith("blob:") ? url : null);

const ROMAN = ["I", "II", "III", "IV", "V"] as const;

export { difficultyLabelOf };

/**
 * The picture face of the active villain and of a seated hero's identity: the two public cards presence shows. A
 * narrow twin of `board-model`'s `faceOf` for those cases (the villain's side and stage, the identity's form and
 * `heroFormIndex`), kept here so the engine worker does not pull in the whole board model.
 */
function villainFaceOf(state: GameState): CardFace {
  const villain = activeVillain(state);
  const card = cardOf(state, villain.instanceId);
  const sideIndex = card?.type === "villain" ? card.sides.findIndex((side) => side.side === villain.side) : 0;
  return { kind: "villainStage", sideIndex: Math.max(0, sideIndex), stageIndex: villain.stageIndex };
}

function identityFaceOf(state: GameState, identityId: InstanceId): CardFace {
  const seat = state.players.find((player) => player.identity.instanceId === identityId);
  if (!seat) return { kind: "hero" };
  if (seat.identity.form === "alterEgo") return { kind: "alterEgo" };
  const index = seat.identity.heroFormIndex ?? 0;
  return index > 0 ? { kind: "heroForm", index } : { kind: "hero" };
}

/** A custom card's picture codes for `face`, or null for a base-game card (its art has a public address already). */
function packArtCodesOf(card: AnyCard | undefined, face: CardFace): readonly string[] | null {
  return card && (card.id as string).startsWith("x.") ? packPictureCodes(card, face) : null;
}

export function presenceGameOf(state: GameState, config: SessionConfig | null): PresenceGame {
  const seats = state.players.filter((seat) => !seat.sittingOut);
  const villain = activeVillain(state);
  const stage = villainStageOf(state, villain.instanceId);
  const outcome = state.outcome;
  const lead = seats[0];
  const villainCard = cardOf(state, villain.instanceId);
  const villainFace = villainFaceOf(state);
  const leadCard = lead ? cardOf(state, lead.identity.instanceId) : undefined;
  const leadFace = lead ? identityFaceOf(state, lead.identity.instanceId) : undefined;
  const phase = state.step.phase === "villain" ? "villain" : state.step.phase === "setup" ? "setup" : "player";
  return {
    kind: config?.campaign ? "campaign" : "oneOff",
    campaignId: config?.campaign?.campaignId ?? null,
    heroes: seats.map((seat) => playerName(state, seat.playerId)),
    form: seats.length === 1 && lead ? (lead.identity.form === "hero" ? "hero" : "alterEgo") : null,
    villain: cardName(state, villain.instanceId),
    villainStage: stage.stageLabel
      ? `Side ${stage.stageLabel}`
      : `Stage ${ROMAN[villain.stageIndex] ?? villain.stageIndex + 1}`,
    round: state.round,
    phase,
    difficulty: difficultyLabelOf(config),
    result: outcome ? (outcome.result === "win" ? "win" : outcome.result === "conceded" ? "conceded" : "loss") : null,
    villainArt: publicOnly(artFor(villainCard, villainFace)?.url),
    heroArt: leadCard && leadFace ? publicOnly(artFor(leadCard, leadFace)?.url) : null,
    villainArtCodes: packArtCodesOf(villainCard, villainFace),
    heroArtCodes: leadCard && leadFace ? packArtCodesOf(leadCard, leadFace) : null,
  };
}
