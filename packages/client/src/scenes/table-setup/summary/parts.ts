/**
 * The summary section's smaller parts: the seed field with Reroll, the watch toggle, the villain's picture and the red
 * "Deal it out" button with its status line.
 */
import type { Rect } from "../../../view/layout.js";
import { surface, typeRole } from "../../../tokens.js";
import { CARD_BACKS, artFor } from "../../../art/art-source.js";
import { ART_CATALOG, villainArtFor } from "../../../art/scenario-art.js";
import { currentCardsById } from "../../../content/pool.js";
import { hasRandomChosenVillain } from "../../../view/random-villain.js";
import { t } from "../../../i18n/translate.js";
import { button, inset, labelText, press, type Frame } from "../shared/frame.js";
import type { SheetGlyphs } from "../../../dom/sheet-glyphs.js";
import type { SummaryEvents, SummaryInput } from "./summary.types.js";

/** The seed field (digits only, nine at most, checked by the scene) and Reroll beside it. */
export function seedField(
  f: Frame,
  input: SummaryInput,
  on: SummaryEvents,
  field: Rect,
  reroll: Rect,
  scroll?: string,
): void {
  f.b.textField(field, { key: "seed", value: input.seedText, placeholder: t("tableSetup.seedPlaceholder") });
  press(f, "seed", field, on.focusSeed, { noTap: true, scroll });
  button(f, "reroll", reroll, t("tableSetup.reroll"), on.reroll, { look: "onInk", scroll });
}

/** The wide layout's watch toggle: a checkbox card (the check mark and the words, never colour alone). */
export function watchToggle(f: Frame, input: SummaryInput, on: SummaryEvents, rect: Rect): void {
  if (rect.height <= 0 || input.room) return;
  const size = 22;
  const bx = rect.x + 10;
  const by = rect.y + (rect.height - size) / 2;
  f.b.box({ x: bx, y: by, width: size, height: size }, { stroke: surface.paper.hex, strokeWidth: 2 });
  if (input.watchable)
    f.b.poly(
      [
        [bx + 4, by + size / 2],
        [bx + size / 2 - 1, by + size - 5],
        [bx + size - 4, by + 5],
      ],
      { stroke: surface.paper.hex, strokeWidth: 3 },
    );
  f.b.text(bx + size + 10, rect.y + rect.height / 2, t("live.setup.title"), typeRole.label, {
    color: surface.paper.hex,
    origin: [0, 0.5],
    fitWidth: rect.width - size - 30,
  });
  press(f, "watch", rect, on.toggleWatch);
}

/** The villain this table faces, in the sidebar's free space: its artwork, else its stage I card, under a caption. */
export function villainPicture(f: Frame, input: SummaryInput, space: Rect): void {
  if (!input.showVillain || space.height < 120 || space.width < 120) return;
  const scenario = input.scenario;
  labelText(f.b, space.x, space.y, t("tableSetup.villain", { name: input.villainName }), surface.paper.hex, {
    fitWidth: space.width,
  });
  const top = space.y + 18;
  const picture: Rect = {
    x: space.x,
    y: top,
    width: space.width,
    height: Math.min(space.width, space.y + space.height - top),
  };
  const villainId = scenario.villainCardId as string;
  // A villain drawn at random from a pool (Shadows in the Night) is not known yet: the card back, and no hover.
  const unknown = hasRandomChosenVillain(scenario);
  const bundled = unknown ? null : villainArtFor(ART_CATALOG, scenario.id as string, () => 0)?.url;
  const held: { src: string | null; retry?: string } = unknown
    ? { src: CARD_BACKS.encounter.url }
    : bundled
      ? { src: bundled }
      : f.leases.image(
          artFor(currentCardsById().get(villainId), { kind: "villainStage", sideIndex: 0, stageIndex: 0 }),
        );
  f.b.box(picture, { fill: surface.parchment.hex, fillAlpha: 0.15 });
  f.b.image(picture, {
    src: held.src,
    cover: { x: 0.5, y: 0.12 },
    key: "pic:villain",
    ...(unknown ? {} : { hover: villainId }),
    ...(held.retry !== undefined ? { retry: held.retry } : {}),
  });
  f.b.box(picture, { stroke: surface.paper.hex, strokeWidth: 2 });
  if (!unknown) f.reg.faces.push({ key: "pic:villain", cardId: villainId, scroll: null });
}

/** The red "Deal it out" (in a room "Back to the room"), its optional paper outline and the status line over it. */
export function dealButton(
  f: Frame,
  glyphs: SheetGlyphs,
  input: SummaryInput,
  on: SummaryEvents,
  rect: Rect,
  look: { readonly statusColor: number; readonly statusX: number; readonly outline: boolean },
): void {
  const label = input.starting ? t("tableSetup.dealing") : input.room ? t("room.setupDone") : t("tableSetup.deal");
  // The paper outline is drawn first, round the button: a part drawn over the button would take its press.
  if (look.outline) f.b.box(inset(rect, -1.5), { stroke: surface.paper.hex, strokeWidth: 3 });
  glyphs.button(f.b, {
    key: "deal-it-out",
    rect,
    label,
    look: "primary",
    type: typeRole.barTitle,
    ...(input.starting || input.dealBlocked !== null ? { disabled: input.dealBlocked ?? true } : {}),
    ids: ["pause"],
    idsNow: (set) => (set === "pad" ? ["pause"] : null),
    ground: "ink",
  });
  press(f, "deal-it-out", rect, on.deal, { noTap: true });
  if (input.status.length > 0)
    f.b.text(look.statusX, rect.y - 20, input.status, typeRole.body, {
      color: look.statusColor,
      fitWidth: rect.width * 2,
    });
}
