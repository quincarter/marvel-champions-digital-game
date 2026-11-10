/**
 * Pack campaigns on the client (docs/custom-content-packs.md §11.10): what a loaded pack's `PackCampaign` becomes for
 * the screens that were written for the base game's boxes: the `@mc/content` `Campaign` record the service stores a
 * name from, the `CampaignStory` the openers and Briefing read, the Saga shelf's volume, and which pack a run keeps.
 *
 * Plain functions over a list of `PackRuntime`s, so every one is tested without Phaser. The base game always wins: a
 * pack campaign id that is a base campaign's is never looked up here (`validatePack` rejects it too).
 */
import { CAMPAIGNS as CONTENT_CAMPAIGNS, type Campaign, type CampaignId, type SetCode } from "@mc/content";
import { packCampaignRecords, packCampaignDefinitionOf } from "@mc/mod-sdk/game";
import type { PackCampaign } from "@mc/mod-sdk";
import { campaignDefinitionOf } from "@mc/cards";
import type { CampaignDefinition } from "@mc/engine";
import type { CampaignSummary, PackCampaignRef } from "../engine/campaign-storage.js";
import type { CustomSagaVolume } from "../view/campaign-saga-model.js";
import { loadedPacks } from "../packs/pack-registry.js";
import type { PackRuntime } from "../packs/pack-runtime.js";
import type { CampaignStory, IssueStory, SagaVolume, StoryLine, StorySpeaker } from "./story.js";

/** The first number a Custom campaigns volume gets on the shelf: past every base volume, so the two never collide. */
export const CUSTOM_VOLUME_BASE = 101;

const BASE_IDS: ReadonlySet<string> = new Set(CONTENT_CAMPAIGNS.map((campaign) => campaign.id as string));

/** One pack campaign with the pack it came from. */
export interface PackCampaignEntry {
  readonly campaign: PackCampaign;
  readonly pack: { readonly id: string; readonly name: string; readonly version: string };
}

/** Every campaign of `packs`, in pack then file order, leaving out one whose id is a base-game campaign's. */
export function packCampaignEntries(packs: readonly PackRuntime[]): readonly PackCampaignEntry[] {
  return packs.flatMap((pack) =>
    packCampaignRecords([pack])
      .filter((campaign) => !BASE_IDS.has(campaign.id))
      .map((campaign) => ({ campaign, pack: { id: pack.id, name: pack.name, version: pack.version } })),
  );
}

/** The pack campaign with this id among `packs`, or undefined (also for a base-game campaign's id). */
export function packCampaignEntryOf(packs: readonly PackRuntime[], campaignId: string): PackCampaignEntry | undefined {
  return packCampaignEntries(packs).find((entry) => entry.campaign.id === campaignId);
}

/** The pack campaign's definition from the loaded packs, or undefined: what the service uses before a run has its own copy. */
export function loadedPackCampaignDefinition(
  packs: readonly PackRuntime[],
  campaignId: string,
): CampaignDefinition | undefined {
  return BASE_IDS.has(campaignId) ? undefined : packCampaignDefinitionOf(packs, campaignId);
}

/** What a run of this pack campaign keeps (`CampaignRecord.pack`), or undefined when no loaded pack has the campaign. */
export function packRefOf(packs: readonly PackRuntime[], campaignId: string): PackCampaignRef | undefined {
  const entry = packCampaignEntryOf(packs, campaignId);
  return entry ? { id: entry.pack.id, version: entry.pack.version, definition: entry.campaign.definition } : undefined;
}

/**
 * The `@mc/content` `Campaign` a pack campaign stands in for: no box code (the screens print none), the pack's
 * display name and its content record. `packCode` is the pack's id, never a base set code.
 */
export function campaignOfPackRecord(entry: PackCampaignEntry): Campaign {
  const { campaign, pack } = entry;
  return {
    id: campaign.id as CampaignId,
    name: campaign.name,
    boxCode: "",
    packCode: pack.id as SetCode,
    scenarioIds: campaign.record.scenarioIds,
    campaignSetIds: campaign.record.campaignSetIds,
    ...(campaign.record.prohibited
      ? {
          prohibited: {
            ...(campaign.record.prohibited.cardIds ? { cardIds: campaign.record.prohibited.cardIds } : {}),
            ...(campaign.record.prohibited.encounterSetIds
              ? { encounterSetIds: campaign.record.prohibited.encounterSetIds }
              : {}),
          },
        }
      : {}),
    logSheetReference: "",
  } as unknown as Campaign;
}

/** The base game's record, or a loaded pack campaign's stand-in; undefined for neither. */
export function campaignRecordIn(packs: readonly PackRuntime[], campaignId: string): Campaign | undefined {
  const base = CONTENT_CAMPAIGNS.find((campaign) => (campaign.id as string) === campaignId);
  if (base) return base;
  const entry = packCampaignEntryOf(packs, campaignId);
  return entry ? campaignOfPackRecord(entry) : undefined;
}

const speakerOf = (speaker: unknown): StorySpeaker => speaker as StorySpeaker;

/**
 * The client's `CampaignStory` from a pack's story fields. Every field a screen needs and the pack left out gets the
 * client's plain wording, so a pack with no story at all still reads; the pack's own story is only ever words (no
 * art, no comic pages, no `comicFor`, no `handledWords`).
 */
export function storyOfPackCampaign(campaign: PackCampaign): CampaignStory {
  const story = campaign.story;
  const nodes = campaign.definition.graph.nodes;
  const line = (
    value: { readonly speaker: unknown; readonly text: string } | undefined,
    fallback: string,
  ): StoryLine =>
    value ? { speaker: speakerOf(value.speaker), text: value.text } : { speaker: { kind: "narrator" }, text: fallback };
  const issues: IssueStory[] = nodes.map((node) => {
    const own = story?.issues?.find((issue) => issue.nodeId === (node.id as string));
    const title = own?.title ?? node.label;
    const briefing = line(own?.briefing, own?.blurb ?? `${title}. The next issue of ${campaign.name}.`);
    return {
      nodeId: node.id as string,
      title,
      villain: own?.villain ?? node.label,
      blurb: own?.blurb ?? `The next issue of ${campaign.name}.`,
      recap: own?.aftermath?.text ?? `${title} is behind you.`,
      // One panel over the issue's villain picture (a pack's scenario has none; the opener draws its placeholder).
      opener: [{ art: { kind: "villain" }, caption: own?.blurb ?? title, lines: own?.briefing ? [briefing] : [] }],
      stageLines: {},
      briefing,
      ...(own?.aftermath ? { aftermath: line(own.aftermath, "") } : {}),
      rewindTaunt: own?.rewindTaunt ?? "Try again.",
      teaser: own?.blurb ?? "The next issue awaits.",
    };
  });
  return {
    campaignId: campaign.id,
    tagline: campaign.tagline ?? `A story in ${nodes.length} issue${nodes.length === 1 ? "" : "s"}`,
    blurb: story?.blurb ?? campaign.description,
    rosterBanner: story?.rosterBanner ?? "Sign the roster.",
    castIdentityIds: [],
    issues,
    campaignLost: { headline: "Campaign\nLost.", line: "The campaign ends here." },
    finale: {
      caption: story?.finale?.caption ?? `${campaign.name} is complete.`,
      headline: story?.finale?.headline ?? "The End",
      sfx: "",
      villainLine: story?.finale?.villainLine ?? "",
      heroLines: story?.finale?.heroLines ?? ["Well done."],
    },
  };
}

const STORY_CACHE = new WeakMap<object, ReadonlyMap<string, CampaignStory>>();

/** The story of a loaded pack's campaign, built once per loaded set; undefined for any other id. */
export function packStoryIn(packs: readonly PackRuntime[], campaignId: string): CampaignStory | undefined {
  if (packs.length === 0 || BASE_IDS.has(campaignId)) return undefined;
  let stories = STORY_CACHE.get(packs);
  if (!stories) {
    stories = new Map(
      packCampaignEntries(packs).map((entry) => [entry.campaign.id, storyOfPackCampaign(entry.campaign)] as const),
    );
    STORY_CACHE.set(packs, stories);
  }
  return stories.get(campaignId);
}

/** A Saga volume for a pack campaign: numbered past the base game's, named for the campaign, badged by its pack. */
export function sagaVolumeOf(entry: PackCampaignEntry, index: number): SagaVolume {
  return {
    number: CUSTOM_VOLUME_BASE + index,
    campaignId: entry.campaign.id,
    boxCode: "",
    name: entry.campaign.name,
    custom: { packId: entry.pack.id, packName: entry.pack.name },
  };
}

/**
 * The shelf's Custom campaigns section: every loaded pack campaign, then each campaign that only a stored run still
 * knows (its pack was removed: the run keeps its own definition and goes on from it). Orphans are named from the run.
 */
export function customSagaVolumes(
  packs: readonly PackRuntime[],
  summaries: readonly CampaignSummary[],
): readonly CustomSagaVolume[] {
  const entries = packCampaignEntries(packs);
  const out: CustomSagaVolume[] = entries.map((entry, index) => ({
    volume: sagaVolumeOf(entry, index),
    definition: entry.campaign.definition,
  }));
  const known = new Set([...BASE_IDS, ...entries.map((entry) => entry.campaign.id)]);
  for (const summary of summaries) {
    const campaignId = summary.campaignId as string;
    if (!summary.pack || known.has(campaignId)) continue;
    known.add(campaignId);
    out.push({
      volume: {
        number: CUSTOM_VOLUME_BASE + out.length,
        campaignId,
        boxCode: "",
        name: summary.name,
        custom: { packId: summary.pack.id, packName: summary.pack.id },
      },
      definition: summary.pack.definition,
    });
  }
  return out;
}

/**
 * The content record of any campaign the screens open: a base box, a loaded pack campaign or, for a run whose pack was
 * removed, a stand-in built from the definition the run kept (its scenarios in node order; no prohibitions are known).
 */
export function campaignRecordOf(
  campaignId: string,
  run?: { readonly name: string; readonly pack?: PackCampaignRef },
): Campaign | undefined {
  const found = campaignRecordIn(loadedPacks(), campaignId);
  if (found || !run?.pack) return found;
  return {
    id: campaignId as CampaignId,
    name: run.name,
    boxCode: "",
    packCode: run.pack.id as SetCode,
    scenarioIds: run.pack.definition.graph.nodes.flatMap((node) =>
      node.scenario?.kind === "fixed" ? [String(node.scenario.scenarioId)] : [],
    ),
    campaignSetIds: [],
    logSheetReference: "",
  } as unknown as Campaign;
}

/** The definition a screen reads for a campaign id: the run's own copy, a base box's, or a loaded pack campaign's. */
export function campaignDefinitionIn(
  campaignId: string,
  run?: { readonly pack?: PackCampaignRef },
): CampaignDefinition | undefined {
  return (
    run?.pack?.definition ?? campaignDefinitionOf(campaignId) ?? loadedPackCampaignDefinition(loadedPacks(), campaignId)
  );
}
