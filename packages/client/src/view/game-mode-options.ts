/**
 * The game-mode choice of the Civil War scenario builder (docs/phase7-wave10-client.md §4): "Cooperative" and
 * "Competitive". Competitive mode does not ship in this wave, so it is shown, disabled, with its reason (the
 * "disabled, not omitted" convention) and can never be selected; the setup config always carries `"cooperative"`.
 * Enabling it later is flipping `enabled` on one row. The engine refuses `"competitive"` too
 * (`COMPETITIVE_MODE_UNAVAILABLE_MESSAGE`); the client never relies on that.
 */
import type { GameMode } from "@mc/engine";

export interface GameModeOption {
  readonly id: GameMode;
  readonly label: string;
  readonly enabled: boolean;
  /** A small tag beside the label ("Coming soon", "Co-op only for now"). */
  readonly note: string;
  /** Why a disabled option cannot be picked; announced when it is focused. Present only when disabled. */
  readonly reason?: string;
}

/** The same sentence as the engine's `mode_unavailable` refusal, for the status line when a disabled option is tapped. */
export const COMPETITIVE_TAPPED_MESSAGE =
  "Competitive mode is played in an online room. Play this scenario cooperatively here.";

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
  if (!option || !option.enabled) return { ok: false, draft, message: COMPETITIVE_TAPPED_MESSAGE };
  return { ok: true, draft };
}
