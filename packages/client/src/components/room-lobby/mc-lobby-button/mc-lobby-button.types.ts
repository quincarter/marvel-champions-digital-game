import type { LobbyButtonKind, LobbyButtonModel, LobbyEvent } from "../room-lobby.types.js";

export type { LobbyButtonKind, LobbyButtonModel };

/** The lobby button's properties (all words already translated). */
export interface McLobbyButtonProps {
  command: LobbyEvent | null;
  label: string;
  kind: LobbyButtonKind;
  selected: boolean;
  enabled: boolean;
  reason: string;
  stop: string;
  aria: string;
  display: boolean;
}

/** What a press on a button names: the event it raises, with every field in a fixed order ("seat|action:remove|participant:p2|seat:s1"). */
export function commandKeyOf(command: LobbyEvent | null): string {
  if (command === null) return "";
  const { type, ...rest } = command as { type: string } & Record<string, unknown>;
  const fields = Object.keys(rest)
    .sort()
    .map((name) => `${name}:${String(rest[name])}`);
  return [type, ...fields].join("|");
}

/**
 * What a button means right now (`data-meaning`): its command and target, then how it looks. A press armed for one meaning is
 * dropped when the same stop becomes another (Ask became Leave once the host granted the seat). Same shape as
 * `dom/stale-presses.ts`'s `commandMeaning`.
 */
export function meaningOf(
  command: LobbyEvent | null,
  kind: string,
  label: string,
  enabled: boolean,
  reason: string,
): string {
  return `${commandKeyOf(command)}#${kind}|${label}|${enabled}|${reason}`;
}
