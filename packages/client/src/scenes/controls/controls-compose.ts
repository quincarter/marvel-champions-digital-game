/**
 * What Settings ▸ Controls' page shows, from the live settings, the connected pad and the input in use. The words are
 * `view/controls-rows.ts`'s, the drawing `view/controller-diagram.ts`'s; this only puts them in the page's shape. Nothing
 * is cached: the key and pad legend is read from the live bindings every time the scene composes.
 */
import type { HintGlyph } from "@mc/ui";
import type {
  ControlsListSection,
  ControlsPageModel,
  ControlsSettingRow,
  ControlsTabId,
} from "../../components/controls/controls.types.js";
import { t } from "../../i18n/translate.js";
import type { PadIdentity } from "../../view/pad-family.js";
import type { Settings } from "../../settings.js";
import { controllerDiagramOf } from "../../view/controller-diagram.js";
import {
  controllerCaptionOf,
  controllerStateOf,
  glyphSizeShare,
  glyphSourceRowInfoOf,
  hintSizeRowInfoOf,
  hintsToggleInfoOf,
  keyboardGroupsOf,
  keyboardHandRowInfoOf,
  nintendoToggleInfoOf,
  padFamilyRowInfoOf,
  padLayerSectionsOf,
  padRowsOf,
  padStatusOf,
  type ControlsListRow,
  type SegmentedRowInfo,
} from "../../view/controls-rows.js";
import { glyphHeightFor, scaledGlyphHeight } from "../../view/glyph-placement.js";
import { uiSpecOf } from "../../view/glyph-ui-spec.js";
import { padGlyphSpec, type GlyphSpec } from "../../view/input-glyph-model.js";
import { padInputTestLine } from "../../view/pad-input-test.js";

export const remapButtonsLabel = (): string => t("controls.remap.buttons");
export const remapKeysLabel = (): string => t("controls.remap.keys");

export interface ControlsInput {
  readonly settings: Settings;
  readonly tab: ControlsTabId;
  readonly phone: boolean;
  /** The pad the status line and the drawing speak of (the last used, else the first connected), or null. */
  readonly pad: PadIdentity | null;
  /** The connected pad's raw `Gamepad.id`, or null with none. */
  readonly connectedId: string | null;
  /** The connected pad's mapping, for the input test line; null with no pad connected. */
  readonly testMapping: string | null;
  /** The last input the test line saw. */
  readonly inputSeen: string | null;
  readonly backLabel: string;
  readonly backGlyph: HintGlyph | null;
}

const choiceRow = <V extends string>(
  id: "labels" | "source" | "hand",
  info: SegmentedRowInfo<V>,
): Extract<ControlsSettingRow, { kind: "choice" }> => ({
  kind: "choice",
  id,
  heading: info.title,
  detail: info.detail,
  dimmed: info.dimmed === true,
  options: info.options.map((option) => ({
    value: option.value,
    label: option.label,
    selected: option.value === info.selected,
  })),
});

const sectionOf = (id: string, title: string, rows: readonly ControlsListRow[]): ControlsListSection => ({
  id,
  title,
  rows: rows.map((row) => ({
    id: row.id,
    glyphs: row.glyphs.map((spec) => uiSpecOf(spec)),
    action: row.action,
    note: row.note,
  })),
});

export function composeControls(input: ControlsInput): ControlsPageModel {
  const { settings, tab, pad } = input;
  const state = controllerStateOf(settings, pad);
  const nintendo = nintendoToggleInfoOf(settings, pad);
  const hints = hintsToggleInfoOf(settings);
  const hintSize = hintSizeRowInfoOf(settings);
  const toggle = (info: typeof nintendo | typeof hints): ControlsSettingRow => ({
    kind: "toggle",
    id: info.id as "nintendo" | "hints",
    title: info.title,
    detail: info.detail,
    state: info.locked ? info.locked.chip : info.on ? t("settings.toggleOn") : t("settings.toggleOff"),
    on: info.on,
    locked: info.locked !== undefined,
  });
  // The preview: the same base height a button's hint has, scaled by the setting.
  const first = padGlyphSpec(0, state.family, state.swap);
  const specs: GlyphSpec[] = [...(first ? [first] : []), { kind: "key", label: "Space", name: "Space" }];
  const previewHeight = scaledGlyphHeight(glyphHeightFor(40), hintSize.percent);
  const slider: ControlsSettingRow = {
    kind: "slider",
    id: "hintSize",
    heading: hintSize.title,
    detail: hintSize.detail,
    value: glyphSizeShare(hintSize.percent) * 100,
    label: `${hintSize.percent}%`,
    dimmed: hintSize.dimmed,
    preview: specs.map((spec) => ({ spec: uiSpecOf(spec), height: previewHeight })),
  };
  const controller = tab === "controller";
  const settingRows: ControlsSettingRow[] = controller
    ? [
        choiceRow("labels", padFamilyRowInfoOf(settings)),
        toggle(nintendo),
        toggle(hints),
        choiceRow("source", glyphSourceRowInfoOf(settings)),
        slider,
      ]
    : [choiceRow("hand", keyboardHandRowInfoOf(settings)), toggle(hints), choiceRow("source", glyphSourceRowInfoOf(settings)), slider];
  const sections: ControlsListSection[] = controller
    ? [
        sectionOf("buttons", t("controls.section.buttons"), padRowsOf(state.family, state.swap)),
        ...padLayerSectionsOf(state.family, state.swap).map((layer) => sectionOf(layer.id, layer.title, layer.rows)),
      ]
    : keyboardGroupsOf(settings.keyboardHand).map((group) => sectionOf(group.id, group.title, group.rows));
  const status = padStatusOf(input.connectedId, pad);
  return {
    phone: input.phone,
    bar: { title: t("settings.controls.title"), backLabel: input.backLabel, backGlyph: input.backGlyph },
    tabs: [
      { id: "controller", label: t("controls.tab.controller") },
      { id: "keyboard", label: t("controls.tab.keyboard") },
    ],
    tab,
    status,
    diagram: controller
      ? {
          diagram: controllerDiagramOf(state.kind, state.family),
          caption: controllerCaptionOf(state.family, pad, state.swap),
          testLine: input.testMapping === null ? null : padInputTestLine(input.inputSeen, input.testMapping),
        }
      : null,
    settings: settingRows,
    sections,
    footer: {
      labels: controller ? [remapButtonsLabel(), t("controls.reset")] : [remapKeysLabel()],
      reason: t("controls.remap.reason"),
    },
  };
}
