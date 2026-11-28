import type { PictureSource } from "@mc/ui";
import type { RoleBuildView } from "../../../view/campaign-role-build-model.js";

/** Role-building card list: the filtered view and each card picture by id. */
export interface RoleBuildListModel {
  readonly view: RoleBuildView;
  readonly pictures: ReadonlyMap<string, PictureSource>;
}
