/**
 * "Ask for a change" (issue #881): a seated guest's request to the host, with a short note (at most 140 characters).
 * The host decides; the answer shows on the board as a prompt.
 *
 * The box is one custom element, `mc-room-ask-dialog` (`components/room-dialogs/`), mounted as an overlay region; the scene
 * keeps the draft (accepted text, put back with `restoreValue` when an edit would pass the limit), the focus route and
 * the send (`scenes/room-dialog/room-dialog-scene.ts`).
 */
import "../components/room-dialogs/mc-room-ask-dialog/mc-room-ask-dialog.js";
import { MAX_ASK_NOTE } from "../components/room-dialogs/mc-room-ask-dialog/mc-room-ask-dialog.types.js";
import { t } from "../i18n/translate.js";
import { askHost } from "../platform/room.js";
import { SCENES } from "./keys.js";
import { RoomDialogScene } from "./room-dialog/room-dialog-scene.js";

export { MAX_ASK_NOTE };

export class RoomAskOverlay extends RoomDialogScene<"mc-room-ask-dialog"> {
  #value = "";

  constructor() {
    super(SCENES.roomAsk);
  }

  init(): void {
    this.#value = "";
  }

  create(): void {
    this.open("mc-room-ask-dialog", {
      press: (key) => {
        if (key === "send") this.#send();
        else if (key === "cancel") this.close();
      },
      field: () => this.dialog?.element.field ?? null,
      primary: "send",
      draw: () => this.#draw(),
    });
    this.dialog?.element.addEventListener("mc-input", (event) => {
      const { value } = (event as CustomEvent<{ value: string }>).detail;
      // A note past the limit is not taken: the field shows what was accepted.
      if (value.length > MAX_ASK_NOTE) this.dialog?.element.field?.restoreValue(this.#value);
      else this.#value = value;
    });
    this.#draw();
    void this.dialog?.element.updateComplete.then(() => this.dialog?.element.field?.focusInput());
  }

  #send(): void {
    askHost("adjust", this.#value.trim().slice(0, MAX_ASK_NOTE));
    this.close();
  }

  #draw(): void {
    const glyphs = this.glyphs;
    if (!glyphs) return;
    glyphs.reset();
    const cancel = glyphs.glyph("cancel", ["cancel"], "paper", 52);
    const send = glyphs.glyph("send", ["pause"], "ink", 52);
    this.show({
      heading: t("ask.title"),
      body: t("ask.body"),
      placeholder: t("ask.placeholder"),
      value: this.#value,
      cancel: { key: "cancel", label: t("ask.cancel"), kind: "secondary" },
      send: { key: "send", label: t("ask.send"), kind: "primary" },
      glyphs: { ...(cancel ? { cancel } : {}), ...(send ? { send } : {}) },
    });
    glyphs.settled();
  }
}
