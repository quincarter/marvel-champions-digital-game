/**
 * What my table may attack or thwart in other tables of its pod (The Mangog 55041, Door Between Worlds 55046; Trickster
 * Takeover Epic Multiplayer, issue #882), as plain data. The targets are the pod's own report (`RoomState.epic.
 * remoteTargets`); the characters that may use the power are the ones the engine already lists a basic attack or thwart
 * for (`LegalActions`), so the client never works out who can. The command the press sends is `remotePower`, which the
 * engine (and the owning table's engine) judge: a refusal comes back as the store's error and is shown as it is.
 */
import type { Command, InstanceId, LegalActions, PlayerId } from "@mc/engine";
import type { RemoteTarget } from "../live/room-state.js";

export type RemotePowerKind = "attack" | "thwart";

/** A character of mine that may use the basic power now. */
export interface ReachCharacter {
  readonly instanceId: string;
  readonly name: string;
  /** The engine's own example command for that basic power: its payment and cost picks ride along on the remote one. */
  readonly example: Command | null;
}

export interface ReachRow {
  readonly key: string;
  readonly table: string;
  readonly tableName: string;
  readonly cardId: string;
  readonly name: string;
  readonly power: RemotePowerKind;
  /** Hit points left (an attackable card) or threat on it (a thwartable one). */
  readonly left: number;
  readonly characters: readonly ReachCharacter[];
}

/** The characters the engine lists a basic `power` for, in its order. */
export function powerCharacters(
  legal: { readonly actions: LegalActions } | null,
  power: RemotePowerKind,
  nameOfInstance: (instanceId: string) => string,
): readonly ReachCharacter[] {
  const kind = power === "attack" ? "basicAttack" : "basicThwart";
  const found: ReachCharacter[] = [];
  const list = legal && "legal" in legal.actions ? legal.actions.legal : [];
  for (const entry of list) {
    const action = entry.action;
    if (action.kind !== kind) continue;
    if (found.some((c) => c.instanceId === action.instanceId)) continue;
    found.push({
      instanceId: action.instanceId,
      name: nameOfInstance(action.instanceId),
      example: entry.example ?? null,
    });
  }
  return found;
}

/** One row per card I may reach, with who may use the power on it. */
export function reachRows(
  targets: readonly RemoteTarget[],
  legal: { readonly actions: LegalActions } | null,
  nameOfCard: (cardId: string) => string,
  nameOfInstance: (instanceId: string) => string,
): readonly ReachRow[] {
  return targets.map((target) => {
    const card = target.card;
    return {
      key: `${target.table}:${card.instanceId}`,
      table: target.table,
      tableName: target.tableName,
      cardId: card.cardId as string,
      name: nameOfCard(card.cardId as string),
      power: card.by,
      left: card.by === "attack" ? (card.remainingHitPoints ?? 0) : (card.threat ?? 0),
      characters: powerCharacters(legal, card.by, nameOfInstance),
    };
  });
}

/** The `remotePower` command for `character` against `row`'s card (`playerId` is the player who must act). */
export function remotePowerCommand(
  playerId: string,
  row: ReachRow,
  target: RemoteTarget,
  character: ReachCharacter,
): Command {
  const example = character.example;
  const fromExample =
    example && (example.type === "basicAttack" || example.type === "basicThwart")
      ? {
          ...(example.payment ? { payment: example.payment } : {}),
          ...(example.costChoices ? { costChoices: example.costChoices } : {}),
        }
      : {};
  return {
    type: "remotePower",
    playerId: playerId as PlayerId,
    characterInstanceId: character.instanceId as InstanceId,
    power: row.power,
    toGroupId: row.table as never,
    targetInstanceId: target.card.instanceId,
    ...fromExample,
  };
}
