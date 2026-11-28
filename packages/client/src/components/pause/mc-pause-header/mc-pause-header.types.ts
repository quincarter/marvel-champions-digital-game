import type { PauseHeaderInput, PauseMode } from "../pause.types.js";

export interface McPauseHeaderProps {
  readonly input: PauseHeaderInput | null;
  readonly mode: PauseMode;
}
