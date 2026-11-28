import type { PictureSource } from "@mc/ui";
import type { RoleBuildCardView } from "../../../view/campaign-role-build-model.js";

/** The confirm step card: "Add Drop Kick to Colossus deck?". */
export interface RoleBuildCardModel {
  readonly card: RoleBuildCardView;
  readonly picture: PictureSource;
  readonly heroName: string;
  readonly noun: "event" | "upgrade";
  readonly phone: boolean;
}
