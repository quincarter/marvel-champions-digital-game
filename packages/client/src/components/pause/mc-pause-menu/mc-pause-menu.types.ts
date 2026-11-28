import type { PauseMenuItem, PauseMode } from "../pause.types.js";

export interface McPauseMenuProps {
  readonly items: readonly PauseMenuItem[];
  readonly mode: PauseMode;
}
