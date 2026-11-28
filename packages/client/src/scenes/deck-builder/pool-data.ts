/**
 * What the deck builder builds against: the base pool plus every loaded custom pack's cards (`currentPool()`), and in a
 * campaign's deck edit the open run's own pack copies (`campaignPool`, #978). Each derived list is kept until the loaded
 * packs change, so a pack installed or removed shows on the next visit and nothing is rebuilt per frame.
 */
import type { AnyCard, HeroIdentityCard } from "@mc/content";
import {
  CUSTOM_SHELF_ID,
  POOL_HERO_SHELF_PACKS,
  POOL_PACKS,
  currentCardsById,
  currentPool,
  currentPoolKey,
} from "../../content/pool.js";
import { campaignCardsById, campaignPool } from "../../content/campaign-pool.js";
import { openRunPacksNow } from "../../campaign/run-packs.js";
import { artLanguageNow } from "../../art/art-source.js";
import { loadedPacks } from "../../packs/pack-registry.js";
import { isHouseRulePack } from "../../packs/pack-runtime.js";
import { qualifiedHeroName } from "../../view/hero-names.js";
import { identityOptions, type PackInfo } from "../../view/deck-builder-model.js";
import { createPoolDocumentCache, poolSearchDocuments } from "../../view/card-pool-search.js";
import type { SearchDocument } from "../../view/deck-search.js";

let campaignMode = false;

/** True while the screen is a campaign's deck edit: the pool is the open run's own. */
export const setCampaignMode = (on: boolean): void => {
  campaignMode = on;
};

export const poolNow = (): readonly AnyCard[] => (campaignMode ? campaignPool() : currentPool());

let identitiesOf: { readonly pool: readonly AnyCard[]; readonly list: readonly HeroIdentityCard[] } | null = null;
export const identities = (): readonly HeroIdentityCard[] => {
  const now = poolNow();
  if (identitiesOf?.pool !== now) identitiesOf = { pool: now, list: identityOptions(now) };
  return identitiesOf.list;
};

export const cardById = (): ReadonlyMap<string, AnyCard> => (campaignMode ? campaignCardsById() : currentCardsById());

/** What the search worker's documents are keyed by: the loaded packs, and in a campaign the open run's pack copies. */
export const poolKeyNow = (): string =>
  campaignMode
    ? `${currentPoolKey()}|run:${openRunPacksNow()
        .map((pack) => `${pack.id}@${pack.version}`)
        .join(",")}`
    : currentPoolKey();

/** Every base pack, in release order, with its cycle: what the Pack / Cycle filter and the "pack" sort read. */
const BASE_PACK_INFOS: readonly PackInfo[] = POOL_PACKS.map((pack) => ({
  code: pack.code as string,
  name: pack.name,
  cycleId: POOL_HERO_SHELF_PACKS.find((p) => p.code === (pack.code as string))?.cycleId ?? (pack.cycleId as string),
  cycleName: POOL_HERO_SHELF_PACKS.find((p) => p.code === (pack.code as string))?.cycleName ?? (pack.cycleId as string),
}));

/** The base packs, then one per loaded custom pack (all in the "Custom packs" cycle), so the Pack filter can name them. */
export const packInfos = (): readonly PackInfo[] => {
  const packs = loadedPacks();
  if (packs.length === 0) return BASE_PACK_INFOS;
  return [
    ...BASE_PACK_INFOS,
    // A house rule has no cards of its own to filter by.
    ...packs
      .filter((pack) => !isHouseRulePack(pack))
      .map((pack) => ({ code: pack.id, name: pack.name, cycleId: CUSTOM_SHELF_ID, cycleName: "Custom packs" })),
  ];
};

/** The documents the search worker ranks (every card), made again when a card changes or the names table arrives. */
const poolDocumentCache = createPoolDocumentCache();
export const poolDocuments = (): { readonly docs: readonly SearchDocument[]; readonly version: string } => {
  const lang = artLanguageNow();
  const infos = packInfos();
  return {
    docs: poolSearchDocuments(
      poolNow(),
      lang,
      (code) => infos.find((pack) => pack.code === code)?.name,
      poolDocumentCache,
    ),
    version: `${poolKeyNow()}:${lang}`,
  };
};

/** Every villain's name in the pool (what the Worker keys its villains by), for Everyone's Against stepper. */
let poolVillains: readonly string[] | null = null;
export const poolVillainNames = (): readonly string[] =>
  (poolVillains ??= [
    ...new Set([...currentCardsById().values()].filter((card) => card.type === "villain").map((c) => c.name)),
  ]);

let heroDocuments: { readonly list: readonly HeroIdentityCard[]; readonly docs: readonly SearchDocument[] } | null =
  null;
export const heroSearchDocuments = (): readonly SearchDocument[] => {
  const list = identities();
  if (heroDocuments?.list !== list) {
    heroDocuments = {
      list,
      docs: list.map((identity) => ({
        id: identity.id as string,
        primary: [qualifiedHeroName(identity), identity.name, identity.alterEgo.faceName],
        secondary: [...identity.hero.traits, ...identity.alterEgo.traits],
      })),
    };
  }
  return heroDocuments.docs;
};
