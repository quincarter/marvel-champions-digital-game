/**
 * The Rules reference's page model (`views/rules/mc-rules-page`), as plain data from the live game (or the pool), the scope,
 * the search and the tab. It also returns what a card tile's key does (open Inspect on that card), so the scene needs no
 * second walk over the entries to answer a tap. No Phaser here.
 */
import type { AnyCard } from "@mc/content";
import { getInstance, type GameState, type InstanceId } from "@mc/engine";
import type { HintGlyph, PictureSource } from "@mc/ui";
import type { RulesEntryModel } from "../../components/rules/mc-rules-entry/mc-rules-entry.types.js";
import type { RulesStepModel } from "../../components/rules/mc-rules-step/mc-rules-step.types.js";
import type { RulesCardListItem } from "../../components/rules/mc-rules-card-list/mc-rules-card-list.types.js";
import type { RulesTile } from "../../components/rules/shared/rules-tile.js";
import { CARDS_BY_ID, POOL_CARDS, POOL_DEPS, POOL_ENCOUNTER_SETS } from "../../content/pool.js";
import { artFor, defaultFaceFor, CARD_BACKS, type ArtSource, type CardFace } from "../../art/art-source.js";
import { faceOf } from "../../view/board-model.js";
import { t, tPlural, type MessageKey } from "../../i18n/translate.js";
import { rulesCardListOf, type RulesCardListCard } from "../../view/rules-card-list.js";
import {
  rulesGlossaryOf,
  rulesGlossaryPoolOf,
  villainPhaseOrder,
  type RulesCardRef,
  type RulesEntry,
  type VillainPhaseStep,
} from "../../view/rules-reference.js";
import type { RulesPageModel, RulesTabId } from "../../views/rules/mc-rules-page/mc-rules-page.types.js";
import type { RulesScope } from "../../components/rules/shared/rules-events.types.js";

export const RULES_TABS: readonly RulesTabId[] = ["glossary", "villainPhase", "cardList"];
const TAB_KEYS: Readonly<Record<RulesTabId, MessageKey>> = {
  glossary: "rules.tab.glossary",
  villainPhase: "rules.tab.villainPhase",
  cardList: "rules.tab.cardList",
};

/** At most this many cards on a glossary entry's strip. */
const MAX_THUMBS = 6;

export interface RulesModelInput {
  readonly game: GameState | null;
  readonly scope: RulesScope;
  readonly tab: RulesTabId;
  readonly query: string;
  readonly backGlyph: HintGlyph | null;
  /** How far the title drops, and where it must end, to clear the dark mode tab. */
  readonly clearance: { readonly drop: number; readonly maxRight: number };
  readonly cardScale: number;
  readonly caption: number;
  /** A picture's URL (held while shown) and the key to re-resolve it by. */
  readonly image: (source: ArtSource | null) => { readonly src: string | null; readonly retry?: string };
  /** Opens Inspect on a live instance, or on a card by id and face. */
  readonly inspectRef: (ref: RulesCardRef) => void;
  readonly inspectPool: (cardId: string) => void;
}

export interface RulesModelResult {
  readonly model: RulesPageModel;
  /** What a tile's key does, and what a hold on a card id does (the card list and the strips). */
  readonly byKey: ReadonlyMap<string, () => void>;
  readonly byCard: ReadonlyMap<string, () => void>;
}

const STATUSES = new Set(["stunned", "confused", "tough"]);

export function rulesPageModelOf(input: RulesModelInput): RulesModelResult {
  const { game, tab } = input;
  const byKey = new Map<string, () => void>();
  const byCard = new Map<string, () => void>();
  const picture = (source: ArtSource | null): PictureSource => input.image(source);
  const cardOf = (ref: RulesCardRef): AnyCard | undefined =>
    game && ref.instanceId ? game.cardPool[ref.cardId] : CARDS_BY_ID.get(ref.cardId);
  const faceOfRef = (ref: RulesCardRef): CardFace =>
    game && ref.instanceId ? faceOf(game, ref.instanceId as InstanceId) : defaultFaceFor(cardOf(ref));

  const tileOf = (ref: RulesCardRef, key: string): RulesTile => {
    const open = (): void => input.inspectRef(ref);
    byKey.set(key, open);
    byCard.set(ref.cardId, open);
    return {
      key,
      name: ref.name,
      cardId: ref.cardId,
      ...(game && ref.instanceId ? { face: faceOfRef(ref) } : {}),
      picture: picture(artFor(cardOf(ref), faceOfRef(ref))),
    };
  };

  const entryOf = (entry: RulesEntry): RulesEntryModel => {
    const shown = entry.cardRefs.slice(0, MAX_THUMBS);
    return {
      id: entry.id,
      name: entry.displayName,
      definition: entry.definition,
      cite: entry.playerCiteLabel,
      ...(entry.playerNote ? { note: entry.playerNote } : {}),
      // Where the entry was added, linking to that box's page in How to play: only with no game running, since opening a
      // How to play page would leave a game in progress.
      ...(entry.originNote
        ? { origin: { text: entry.originNote, boxId: game === null ? (entry.originBoxId ?? null) : null } }
        : {}),
      ...(STATUSES.has(entry.id) ? { status: entry.id as "stunned" | "confused" | "tough" } : {}),
      tiles: shown.map((ref) => tileOf(ref, `row:entry:${entry.id}:card:${ref.cardId}`)),
      more: entry.cardRefs.length - shown.length,
    };
  };

  const stepArt = (step: VillainPhaseStep): { picture: PictureSource | null; cardId?: string; face?: CardFace } => {
    if (!step.art) return { picture: null };
    if (step.art === "encounterBack") return { picture: picture(CARD_BACKS.encounter) };
    // No game means no live scheme or villain to point at: the bundled encounter card back stands in, a real illustration
    // rather than a gray "no scan" box.
    if (!game) return { picture: picture(CARD_BACKS.encounter) };
    const instanceId = step.art === "mainScheme" ? game.mainScheme.instanceId : game.activeVillainId;
    const cardId = instanceId ? getInstance(game, instanceId)?.cardId : undefined;
    if (!instanceId || !cardId) return { picture: picture(null) };
    const face = faceOf(game, instanceId);
    return { picture: picture(artFor(game.cardPool[cardId], face)), cardId: cardId as string, face };
  };

  let glossary: RulesPageModel["glossary"] = null;
  let villain: RulesPageModel["villain"] = null;
  let cards: RulesPageModel["cards"] = null;
  if (tab === "glossary") {
    const entries =
      input.scope === "table" && game
        ? rulesGlossaryOf(game, POOL_DEPS, input.query, { includeConcepts: true })
        : rulesGlossaryPoolOf(POOL_CARDS, input.query);
    glossary = { entries: entries.map(entryOf), empty: t("rules.glossary.empty") };
  } else if (tab === "villainPhase") {
    villain = {
      steps: villainPhaseOrder(game ?? undefined).map((step, index): RulesStepModel => {
        const art = stepArt(step);
        return {
          index,
          label: step.label,
          detail: step.detail,
          current: step.current,
          picture: art.picture,
          ...(art.cardId ? { cardId: art.cardId, face: art.face } : {}),
        };
      }),
      citation: t("rules.villain.citation"),
    };
  } else {
    const groups = rulesCardListOf(game, POOL_CARDS, POOL_ENCOUNTER_SETS);
    const visible = input.scope === "table" ? groups.filter((group) => group.inGame) : groups;
    const items: RulesCardListItem[] = [];
    let sawInGame = false;
    let sawNotInGame = false;
    const poolCard = (card: RulesCardListCard): AnyCard | undefined =>
      game?.cardPool[card.cardId] ?? CARDS_BY_ID.get(card.cardId);
    for (const group of visible) {
      if (group.inGame && !sawInGame) {
        items.push({ kind: "label", text: t("rules.cardList.inGame") });
        sawInGame = true;
      } else if (!group.inGame && !sawNotInGame && input.scope === "all") {
        items.push({ kind: "label", text: t("rules.cardList.notInGame") });
        sawNotInGame = true;
      }
      items.push({
        kind: "set",
        set: {
          setId: group.setId,
          heading: tPlural("rules.cardList.setHeader", group.cards.length, { name: group.setName }).toUpperCase(),
          tiles: group.cards.map((card) => {
            const key = `row:card:${group.setId}:${card.cardId}`;
            const open = (): void => input.inspectPool(card.cardId);
            byKey.set(key, open);
            byCard.set(card.cardId, open);
            const source = artFor(poolCard(card), defaultFaceFor(poolCard(card)));
            return { key, name: card.name, cardId: card.cardId, picture: picture(source) };
          }),
        },
      });
    }
    cards = {
      items,
      empty: game ? t("rules.cardList.emptyGame") : t("rules.cardList.emptyPool"),
      cardScale: input.cardScale,
      caption: input.caption,
    };
  }

  const model: RulesPageModel = {
    header: {
      backLabel: t("rules.back"),
      heading: t("rules.title"),
      backGlyph: input.backGlyph,
      titleDrop: input.clearance.drop,
      titleMax: input.clearance.maxRight,
      caption: game
        ? input.scope === "table"
          ? t("rules.scope.captionTable")
          : t("rules.scope.captionAll")
        : t("rules.scope.captionPool"),
      toggle: game ? { scope: input.scope, allLabel: t("rules.scope.all"), tableLabel: t("rules.scope.table") } : null,
    },
    tabs: RULES_TABS.map((id) => ({ id, label: t(TAB_KEYS[id]) })),
    tab,
    search: tab === "glossary" ? { query: input.query, placeholder: t("rules.search.placeholder") } : null,
    glossary,
    villain,
    cards,
  };
  return { model, byKey, byCard };
}
