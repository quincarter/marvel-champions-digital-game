/**
 * "Give <hero> to…" (issue #881): the host's picker, over the board, for an away or vacated seat. It lists the people in
 * the room who could take the hero (`assignCandidates`) and hands the seat to the one pressed. Nothing is decided here;
 * the room refuses what it will not allow.
 *
 * The box is one custom element, `mc-room-give-dialog` (`components/room-dialogs/`), mounted as an overlay region.
 */
import "../components/room-dialogs/mc-room-give-dialog/mc-room-give-dialog.js";
import type { RoomGiveModel } from "../components/room-dialogs/room-dialogs.types.js";
import { t } from "../i18n/translate.js";
import { assignSeat, roomState } from "../platform/room.js";
import { assignCandidates } from "../view/room-lobby-model.js";
import { SCENES } from "./keys.js";
import { RoomDialogScene } from "./room-dialog/room-dialog-scene.js";

export interface RoomGiveData {
  readonly seat: string;
  readonly hero: string;
}

export class RoomGiveOverlay extends RoomDialogScene<"mc-room-give-dialog"> {
  #data: RoomGiveData = { seat: "", hero: "" };

  constructor() {
    super(SCENES.roomGive);
  }

  init(data: RoomGiveData): void {
    this.#data = data;
  }

  create(): void {
    this.open("mc-room-give-dialog", {
      press: (key) => {
        if (key === "cancel") this.close();
        else if (key.startsWith("give:")) {
          assignSeat(this.#data.seat, key.slice("give:".length));
          this.close();
        }
      },
      primary: "cancel",
      draw: () => this.#draw(),
    });
    this.#draw();
  }

  #draw(): void {
    const glyphs = this.glyphs;
    if (!glyphs) return;
    glyphs.reset();
    const people = assignCandidates(roomState());
    const cancel = glyphs.glyph("cancel", ["cancel"], "paper", 44);
    const model: RoomGiveModel = {
      heading: t("give.title", { hero: this.#data.hero }),
      empty: people.length === 0 ? t("room.seat.giveNobody") : null,
      people: people.map((person) => ({
        id: person.id,
        button: { key: `give:${person.id}`, label: person.name, kind: "primary" },
      })),
      cancel: { key: "cancel", label: t("give.cancel"), kind: "secondary" },
      glyphs: cancel ? { cancel } : {},
    };
    this.show(model);
    glyphs.settled();
  }
}
