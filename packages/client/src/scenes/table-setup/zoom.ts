/** Hold Y: the picture of the focused modular tile, enlarged beside it (the desktop hover, for a pad or the keyboard). */
import type { InstanceId } from "@mc/engine";
import type { McSetupSetTile } from "../../components/table-setup/mc-setup-set-tile/McSetupSetTile.js";
import { collectStops } from "../../dom/element-stops.js";
import type { PinnedHover } from "../../ui/card-hover-preview.js";
import type { Rect } from "../../view/layout.js";

/** What to enlarge for the focus stop `key` (null: a stop with no picture), read live from the page. */
export function zoomTargetOf(
  page: ParentNode,
  key: string | null | undefined,
  rectOf: (target: Element) => Rect,
  area: PinnedHover["area"] | null,
): PinnedHover | null {
  if (!key?.startsWith("modular:") || !area) return null;
  const stop = collectStops(page).find((s) => s.key === key);
  const host = (stop?.element.getRootNode() as ShadowRoot | undefined)?.host as McSetupSetTile | undefined;
  const picture = host?.tile?.picture;
  const pic = host?.shadowRoot?.querySelector(".pic");
  if (!picture || !pic) return null;
  return {
    id: picture.cardId as InstanceId,
    rect: rectOf(pic),
    area,
    plain: { ...(picture.face ? { face: picture.face } : {}) },
  };
}
