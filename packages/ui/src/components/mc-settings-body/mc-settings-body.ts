import { McSettingsBody } from "./McSettingsBody.js";

if (!customElements.get("mc-settings-body")) customElements.define("mc-settings-body", McSettingsBody);

declare global {
  interface HTMLElementTagNameMap {
    "mc-settings-body": McSettingsBody;
  }
}

export { McSettingsBody };
export type {
  BodyButton,
  BodyCell,
  BodyControl,
  BodyField,
  BodyHeading,
  BodyList,
  BodyRect,
  BodyRow,
  SettingsBodyModel,
} from "./McSettingsBody.js";
