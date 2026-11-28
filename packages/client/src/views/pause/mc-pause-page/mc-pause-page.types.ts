import type { PausePageModel } from "../../../components/pause/pause.types.js";

export interface McPausePageProps {
  readonly model: PausePageModel | null;
  readonly mode: "wide" | "phone";
}
