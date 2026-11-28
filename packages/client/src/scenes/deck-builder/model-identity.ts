/** The header, the hero picker, "Start from" and the chosen identity's row, as the elements take them. */
import type { HeroIdentityCard } from "@mc/content";
import { artLanguageNow } from "../../art/art-source.js";
import { cssOf } from "../../ui/theme.js";
import { aspectStampOf } from "../../view/aspect-stamp.js";
import { preconsFor } from "../../view/deck-builder-model.js";
import { qualifiedHeroName } from "../../view/hero-names.js";
import { currentStarterDecks } from "../../content/pool.js";
import { inputDevice } from "../../platform/input-device.js";
import { t } from "../../i18n/translate.js";
import type { BuilderHeaderModel } from "../../components/deck-builder/shared/builder-header.types.js";
import type { IdentityPickerModel } from "../../components/deck-builder/mc-identity-picker/mc-identity-picker.types.js";
import type { IdentityRowModel } from "../../components/deck-builder/mc-identity-row/mc-identity-row.types.js";
import type { StartFromModel } from "../../components/deck-builder/mc-start-from/mc-start-from.types.js";
import type { BuilderState } from "./builder-state.js";
import { identities } from "./pool-data.js";
import type { ModelEnv } from "./model-env.js";

/** The picker's hero tile least width in px at Standard card size (a bigger Card size setting makes bigger tiles). */
const TILE_MIN = 170;

/** The title (a campaign's own name plus the seat and its identity can run to two lines) and Back, which asks twice. */
export function headerModel(state: BuilderState, env: ModelEnv): BuilderHeaderModel {
  const title = state.campaign ? state.campaign.title.toUpperCase() : t("deckBuilder.title").toUpperCase();
  return {
    title,
    backLabel: state.isDirty() && state.leaveArmed ? t("deckBuilder.leave") : t("deckBuilder.back"),
    backGlyph: env.glyph("back", ["cancel"], "paper", 44),
  };
}

/** The heroes the picker lists: every one, or the ones the search ranked, best first. */
export function shownHeroes(state: BuilderState): readonly HeroIdentityCard[] {
  const ranking = state.identitySearch.trim() ? state.heroRanking : null;
  return ranking
    ? identities()
        .filter((identity) => ranking.has(identity.id as string))
        .sort((a, c) => ranking.get(c.id as string)! - ranking.get(a.id as string)!)
    : identities();
}

export function pickerModel(state: BuilderState, env: ModelEnv): IdentityPickerModel {
  const shown = shownHeroes(state);
  return {
    label: t("deckBuilder.pickHero"),
    search: {
      text: state.identitySearch,
      placeholder: t("deckBuilder.searchHeroes"),
      clearLabel: t("deckBuilder.clearSearch"),
    },
    tiles: shown.map((identity) => ({
      id: identity.id as string,
      name: qualifiedHeroName(identity),
      picture: env.heroPicture(identity),
    })),
    empty: shown.length === 0 ? t("deckBuilder.noHero", { text: state.identitySearch.trim() }) : null,
    tileMin: Math.round((TILE_MIN * env.cardScale) / 1),
  };
}

/** New deck's "Start from": an empty deck or the player's own copy of one of the hero's precons, each with its aspect. */
export function startModel(identity: HeroIdentityCard, env: ModelEnv): StartFromModel {
  const lang = artLanguageNow();
  return {
    label: t("deckBuilder.startFrom", { hero: qualifiedHeroName(identity) }),
    cardId: identity.id as string,
    picture: env.heroPicture(identity),
    options: [
      { id: null, label: t("deckBuilder.startEmpty") },
      ...preconsFor(identity, currentStarterDecks()).map((starter) => {
        const aspects = starter.aspects.map((aspect) => aspectStampOf(aspect, lang).label).join(" + ");
        const stamp = starter.aspects[0] ? aspectStampOf(starter.aspects[0], lang) : null;
        return {
          id: starter.id as string,
          label: t("deckBuilder.startPrecon", { aspects }),
          tint: stamp ? { fill: cssOf(stamp.fill), ink: cssOf(stamp.ink) } : undefined,
        };
      }),
    ],
    backLabel: t("deckBuilder.startBack"),
  };
}

/** The chosen identity above the builder: its picture, name and a "Read card" cue. */
export function identityRowModel(identity: HeroIdentityCard, env: ModelEnv): IdentityRowModel {
  return {
    cardId: identity.id as string,
    label: t("deckBuilder.identity"),
    name: qualifiedHeroName(identity),
    cue: t("deckBuilder.readCard"),
    picture: env.heroPicture(identity),
  };
}

/** Whether Back's second press should say it leaves (pad users get the pad wording). */
export const unsavedLeaveText = (): string =>
  t(inputDevice().mode === "pad" ? "deckBuilder.unsavedLeavePad" : "deckBuilder.unsavedLeave");
