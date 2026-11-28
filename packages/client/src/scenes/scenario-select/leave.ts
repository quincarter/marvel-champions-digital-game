/** The ways Choose a scenario hands over to another screen (Take your seats, Table setup, the Civil War builder), and Inspect. */
import type Phaser from "phaser";
import type { CardId, Deck, Scenario } from "@mc/content";
import { currentCardsById } from "../../content/pool.js";
import { artLanguageNow } from "../../art/art-source.js";
import { t } from "../../i18n/translate.js";
import { enterBuilder, setBuilderOrigin } from "../../view/civil-war-entry.js";
import { foeWord } from "../../view/foe-words.js";
import { hasRandomChosenVillain } from "../../view/random-villain.js";
import { leaveRoomSetup, placeholderSeats, roomSeatCount, roomSetupActive } from "../../view/room-table-setup.js";
import type { SetupDraft } from "../../view/setup-draft.js";
import { goToScreen } from "../../ui/transitions.js";
import type { CivilWarBuilderData } from "../civil-war-builder.js";
import { SCENES } from "../keys.js";
import { reportRoomSetup } from "../room-setup-report.js";
import type { SeatsData } from "../seats.js";
import type { TableSetupData } from "../table-setup.js";
import { faceOfScenario } from "./tiles.js";

/** Back: to the room lobby in room mode (#880, the host set the table up from there), else to the Title menu. */
export function goBack(scene: Phaser.Scene): void {
  if (roomSetupActive()) {
    leaveRoomSetup();
    goToScreen(scene, SCENES.roomLobby);
    return;
  }
  goToScreen(scene, SCENES.title);
}

/** The builder scene on the draft: "Customize" (this scenario as printed) or "Build your own" (the last build, or the first leader). */
export function openBuilder(
  scene: Phaser.Scene,
  draft: SetupDraft,
  seedDecks: readonly Deck[],
  kind: "build" | "customize",
  scenarioId: string,
): void {
  const entry = enterBuilder(kind, draft, scenarioId);
  setBuilderOrigin("scenarioSelect");
  goToScreen(scene, SCENES.civilWarBuilder, {
    draft: entry.draft,
    step: entry.step,
    ...(seedDecks.length > 0 ? { seedDecks } : {}),
  } satisfies CivilWarBuilderData);
}

/** "Choose heroes ▸" on to the hero step: or, in a room (#880), straight to Table setup, one placeholder per seat. */
export function chooseHeroes(scene: Phaser.Scene, draft: SetupDraft, seedDecks: readonly Deck[]): void {
  if (roomSetupActive()) {
    reportRoomSetup("table", draft.scenarioId as string);
    goToScreen(scene, SCENES.setup, {
      draft: { ...draft, seats: placeholderSeats(roomSeatCount()) },
    } satisfies TableSetupData);
    return;
  }
  goToScreen(scene, SCENES.seats, {
    draft,
    ...(seedDecks.length > 0 ? { seedDecks } : {}),
  } satisfies SeatsData);
}

/** Opens Inspect on the scenario's villain: a villain drawn at random (Shadows in the Night) is not known yet, so it shows the main scheme. */
export function inspectScenario(scene: Phaser.Scene, s: Scenario): void {
  const shownId = hasRandomChosenVillain(s) ? s.mainSchemeCardId : s.villainCardId;
  scene.scene.launch(SCENES.inspect, {
    card: { cardId: shownId as CardId, face: faceOfScenario(s) },
    choice: {
      optionId: s.id as string,
      label: s.multipleVillains
        ? t("scenario.playThis")
        : t("scenario.playFoe", {
            foe: foeWord(s, { cardsById: currentCardsById(), lower: true, lang: artLanguageNow() }),
          }),
    },
  });
}
