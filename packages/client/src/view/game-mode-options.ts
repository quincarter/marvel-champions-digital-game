/**
 * The game-mode choice of the Civil War scenario builder (docs/phase7-wave10-client.md §4): "Cooperative" and
 * "Competitive". Competitive is played in online rooms (the lobby's Competitive mode), not from this offline builder, so
 * it is shown here disabled with its reason (the "disabled, not omitted" convention) and can never be selected; the
 * setup config always carries `"cooperative"`. Hot-seat competitive play is not built. The engine refuses
 * `"competitive"` without both teams' scenarios too; the client never relies on that.
 */
import type { GameMode } from "@mc/engine";
import { t } from "../i18n/translate.js";

export interface GameModeOption {
  readonly id: GameMode;
  readonly label: string;
  readonly enabled: boolean;
  /** A small tag beside the label ("Online rooms", "Co-op only for now"). */
  readonly note: string;
  /** Why a disabled option cannot be picked; announced when it is focused. Present only when disabled. */
  readonly reason?: string;
}

/** What the status line says when the disabled Competitive option is tapped: it is played in an online room. */
export const competitiveTappedMessage = (): string => t("comp.mode.tapped");

export const GAME_MODE_OPTIONS: readonly GameModeOption[] = [
  { id: "cooperative", label: "Cooperative", enabled: true, note: "Co-op only for now" },
  {
    id: "competitive",
    label: "Competitive",
    enabled: false,
    note: "Online rooms",
    reason:
      "Two teams, each against the other's leader. Pick Competitive when you host an online room; hot-seat play is coming soon.",
  },
];

export interface GameModeOptionRow extends GameModeOption {
  readonly selected: boolean;
}

export interface GameModeOptionsView {
  readonly rows: readonly GameModeOptionRow[];
  /** What the setup config carries: always cooperative. */
  readonly gameMode: "cooperative";
}

/** The rows with the current pick marked. Any pick that is not an enabled option falls back to cooperative. */
export function gameModeOptionsView(selected: GameMode = "cooperative"): GameModeOptionsView {
  const chosen = GAME_MODE_OPTIONS.find((o) => o.id === selected && o.enabled)?.id ?? "cooperative";
  return {
    rows: GAME_MODE_OPTIONS.map((o) => ({ ...o, selected: o.id === chosen })),
    gameMode: "cooperative",
  };
}

export type SelectModeResult<T> =
  | { readonly ok: true; readonly draft: T }
  | { readonly ok: false; readonly draft: T; readonly message: string };

/**
 * Picks a mode. A disabled option changes nothing: the draft comes back as the same object with the reason in `message`.
 * The draft carries no mode field (the config is always cooperative), so a successful pick returns it unchanged too.
 */
export function selectMode<T>(draft: T, mode: GameMode): SelectModeResult<T> {
  const option = GAME_MODE_OPTIONS.find((o) => o.id === mode);
  if (!option || !option.enabled) return { ok: false, draft, message: competitiveTappedMessage() };
  return { ok: true, draft };
}
