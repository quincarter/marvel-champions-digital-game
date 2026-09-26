/**
 * Extras: the comics, artwork, hero and villain files and the soundtrack, opened by playing.
 *
 * **A reward shelf, not a rule.** Like the rest of `progression/`, nothing here changes how a game plays; the engine
 * never sees it. It answers one question for the Extras screen (`scenes/extras.ts`): what may the player read, look
 * at or listen to yet?
 *
 * **What opens what.** Each thing opens the moment the player has done the thing it belongs to:
 *
 * - **Stories:** a campaign issue opens once a run has reached it (signing a run opens issue #1; each issue won
 *   opens the next). Rereading one goes through the campaign's own opener, told to the box's own cast.
 * - **Heroes:** a hero's file (their artwork, both faces' names, traits and flavor) opens once a game played as that
 *   hero has ended, in a campaign or on its own.
 * - **Villains:** a villain's file opens once a game against that scenario has ended. Its "villain loses" scene
 *   opens on a win, its "villain wins" scene on a loss, so each picture is the one the player actually saw.
 * - **Music:** a track opens where it plays: a scenario's battle theme by playing it, its victory and defeat themes by
 *   winning and losing it, a campaign's finale by completing the campaign. The title theme and the default battle
 *   theme are always open.
 * - **Rulebooks:** always open. The Rules Reference, FFG's rulings since RRG 1.7 and every campaign box's rulebook,
 *   as plain text with links to the PDFs (`content/books.ts`). They are references, not rewards.
 * - **Artwork:** the title wallpapers are always open; the generic victory and defeat scenes open with a first win
 *   and a first loss, and a campaign box's cover with its first run.
 *
 * **Progress is derived, never stored twice**, the same as `unlocks.ts`: `extrasProgressOf` reads the rows the
 * results history and the Saga shelf already read (`mc-saves`, `mc-campaigns`). "Unlock everything" in Settings ▸
 * Unlocks opens every extra too, since it is the way out of progression altogether.
 *
 * Pure: no storage, no Phaser. The picture and track catalogs are the build-time globs every other screen reads.
 */
import type { Scenario } from "@mc/content";
import { ART_CATALOG } from "../art/scenario-art.js";
import { CAMPAIGN_ART } from "../art/campaign-art.js";
import { HERO_ART } from "../art/hero-art.js";
import { TITLE_ART } from "../art/title-art.js";
import type { Picture } from "../art/pictures.js";
import { MUSIC_CATALOG, type MusicCatalog, type Track } from "../audio/music-catalog.js";
import { SAGA_VOLUMES, storyFor } from "../campaign/story.js";
import { CARDS_BY_ID, POOL_PACKS, POOL_SCENARIOS, POOL_STARTER_DECKS } from "../content/pool.js";
import { BOOKS } from "../content/books.js";
import { CAMPAIGN_RECORDS } from "../campaign/campaign-service.js";
import { UNLOCK_HEROES, villainLabelOf } from "./unlocks.js";

/** What the player has done, as far as Extras cares, read from storage by `extrasProgressOf`. */
export interface ExtrasProgress {
  /** Identity card ids of heroes seated in a game that has ended. */
  readonly playedHeroIds: readonly string[];
  /** Scenarios of every game that has ended, won, lost or abandoned. */
  readonly playedScenarioIds: readonly string[];
  readonly wonScenarioIds: readonly string[];
  readonly lostScenarioIds: readonly string[];
  /** `<campaignId>/<nodeId>`: every campaign issue some run has reached. */
  readonly reachedIssues: readonly string[];
  readonly startedCampaignIds: readonly string[];
  readonly wonCampaignIds: readonly string[];
}

export const NO_EXTRAS_PROGRESS: ExtrasProgress = {
  playedHeroIds: [],
  playedScenarioIds: [],
  wonScenarioIds: [],
  lostScenarioIds: [],
  reachedIssues: [],
  startedCampaignIds: [],
  wonCampaignIds: [],
};

/** The save statuses of a game that has ended. An `active` game is still being played; `incompatible` never loads. */
const ENDED = new Set(["won", "lost", "abandoned"]);

const unique = (ids: readonly string[]): string[] => [...new Set(ids)].sort();

const issueKey = (campaignId: string, nodeId: string): string => `${campaignId}/${nodeId}`;

/** A seat's hero: its identity card, or its precon's. Null for a precon this build doesn't know. */
export function identityOfSeat(seat: object): string | null {
  if ("identityCardId" in seat && typeof seat.identityCardId === "string") return seat.identityCardId;
  if ("starterDeckId" in seat && typeof seat.starterDeckId === "string") {
    const deck = POOL_STARTER_DECKS.find((candidate) => (candidate.id as string) === seat.starterDeckId);
    return deck ? (deck.identityCardId as string) : null;
  }
  return null;
}

/** Progress from the same two storage listings `progressOf` (`unlocks.ts`) reads. */
export function extrasProgressOf(
  saves: readonly {
    readonly status: string;
    readonly config: { readonly scenarioId: string; readonly players: readonly object[] };
  }[],
  campaigns: readonly {
    readonly status: string;
    readonly campaignId: string;
    readonly position: { readonly nextNodeId: string | null; readonly resolved: Readonly<Record<string, string>> };
  }[],
): ExtrasProgress {
  const ended = saves.filter((save) => ENDED.has(save.status));
  return {
    playedHeroIds: unique(
      ended.flatMap((save) => save.config.players.map(identityOfSeat).filter((id): id is string => id !== null)),
    ),
    playedScenarioIds: unique(ended.map((save) => save.config.scenarioId)),
    wonScenarioIds: unique(ended.filter((save) => save.status === "won").map((save) => save.config.scenarioId)),
    lostScenarioIds: unique(ended.filter((save) => save.status === "lost").map((save) => save.config.scenarioId)),
    reachedIssues: unique(
      campaigns.flatMap((run) => [
        ...Object.keys(run.position.resolved).map((nodeId) => issueKey(run.campaignId, nodeId)),
        ...(run.position.nextNodeId ? [issueKey(run.campaignId, run.position.nextNodeId)] : []),
      ]),
    ),
    startedCampaignIds: unique(campaigns.map((run) => run.campaignId)),
    wonCampaignIds: unique(campaigns.filter((run) => run.status === "won").map((run) => run.campaignId)),
  };
}

/**
 * `progress` with one more ended game, for Game over to say what it opened before storage has caught up. A
 * concession is stored as `abandoned`: played, but neither won nor lost.
 */
export function withEndedGame(
  progress: ExtrasProgress,
  game: {
    readonly scenarioId: string;
    readonly result: "win" | "loss" | "conceded";
    readonly heroIds: readonly string[];
  },
): ExtrasProgress {
  return {
    ...progress,
    playedHeroIds: unique([...progress.playedHeroIds, ...game.heroIds]),
    playedScenarioIds: unique([...progress.playedScenarioIds, game.scenarioId]),
    wonScenarioIds:
      game.result === "win" ? unique([...progress.wonScenarioIds, game.scenarioId]) : progress.wonScenarioIds,
    lostScenarioIds:
      game.result === "loss" ? unique([...progress.lostScenarioIds, game.scenarioId]) : progress.lostScenarioIds,
  };
}

/** How many entries, and pictures inside already-open entries, `after` opens that `before` hadn't. */
export function extrasNewsBetween(before: Extras, after: Extras): number {
  let count = 0;
  for (const entry of Object.values(EXTRAS_ENTRIES).flat()) {
    if (!after.isOpen(entry.unlock)) continue;
    if (!before.isOpen(entry.unlock)) {
      count += 1;
      continue;
    }
    count += after.openSlides(entry.content).length - before.openSlides(entry.content).length;
  }
  return count;
}

/** What opens an extra. */
export type ExtrasUnlock =
  | { readonly kind: "always" }
  | { readonly kind: "heroPlayed"; readonly identityCardId: string }
  | { readonly kind: "scenarioPlayed"; readonly scenarioId: string }
  | { readonly kind: "scenarioWon"; readonly scenarioId: string }
  | { readonly kind: "scenarioLost"; readonly scenarioId: string }
  | { readonly kind: "packWon"; readonly packCode: string }
  | { readonly kind: "packLost"; readonly packCode: string }
  | { readonly kind: "anyWin" }
  | { readonly kind: "anyLoss" }
  | { readonly kind: "issueReached"; readonly campaignId: string; readonly nodeId: string; readonly issue: number }
  | { readonly kind: "campaignStarted"; readonly campaignId: string }
  | { readonly kind: "campaignWon"; readonly campaignId: string }
  /** One track filed in several slots (the same song as a campaign finale and a pack's victory theme). */
  | { readonly kind: "any"; readonly of: readonly ExtrasUnlock[] };

export type ExtrasTab = "stories" | "books" | "heroes" | "villains" | "art" | "music";

/** `short` is a phone's tab label, where six tabs share 390px. */
export const EXTRAS_TABS: readonly { readonly id: ExtrasTab; readonly label: string; readonly short: string }[] = [
  { id: "stories", label: "Stories", short: "Stories" },
  { id: "books", label: "Rulebooks", short: "Rules" },
  { id: "heroes", label: "Heroes", short: "Heroes" },
  { id: "villains", label: "Villains", short: "Villains" },
  { id: "art", label: "Artwork", short: "Art" },
  { id: "music", label: "Music", short: "Music" },
];

/** One picture of a gallery, opened on its own: a villain's defeat scene opens on a win, not on the first game. */
export interface ExtrasSlide {
  readonly picture: Picture;
  readonly caption: string;
  readonly unlock: ExtrasUnlock;
}

export type ExtrasContent =
  /** A campaign issue, read through the campaign opener. */
  | { readonly kind: "issue"; readonly campaignId: string; readonly nodeId: string }
  /** Pictures and a few lines of text (a hero's or villain's file, a piece of artwork). */
  | { readonly kind: "gallery"; readonly slides: readonly ExtrasSlide[]; readonly lines: readonly string[] }
  | { readonly kind: "track"; readonly track: Track }
  /** A rulebook, read in the Extras reader (`content/books.ts`). */
  | { readonly kind: "book"; readonly bookId: string };

export interface ExtrasEntry {
  readonly id: string;
  readonly tab: ExtrasTab;
  readonly title: string;
  /** The small line under the title: a box and issue number, an alter ego, a scenario, where a track plays. */
  readonly subtitle: string;
  /** The tile's picture, when there is one; a locked tile draws it hidden. */
  readonly thumb: Picture | null;
  readonly unlock: ExtrasUnlock;
  readonly content: ExtrasContent;
}

const cardName = (id: string): string => CARDS_BY_ID.get(id)?.name ?? id;
const packName = (code: string): string => POOL_PACKS.find((pack) => (pack.code as string) === code)?.name ?? code;
const campaignName = (campaignId: string): string =>
  SAGA_VOLUMES.find((volume) => volume.campaignId === campaignId)?.name ?? campaignId;

/** How to open something, in the same "Beat Rhino" voice as the unlock path's own hints. */
export function unlockHint(unlock: ExtrasUnlock): string {
  switch (unlock.kind) {
    case "always":
      return "Open from the start";
    case "heroPlayed":
      return `Finish a game as ${cardName(unlock.identityCardId)}`;
    case "scenarioPlayed":
      return `Finish a game against ${villainLabelOf(unlock.scenarioId)}`;
    case "scenarioWon":
      return `Beat ${villainLabelOf(unlock.scenarioId)}`;
    case "scenarioLost":
      return `Lose to ${villainLabelOf(unlock.scenarioId)}`;
    case "packWon":
      return `Win a scenario from ${packName(unlock.packCode)}`;
    case "packLost":
      return `Lose a scenario from ${packName(unlock.packCode)}`;
    case "anyWin":
      return "Win any game";
    case "anyLoss":
      return "Lose any game";
    case "issueReached":
      return unlock.issue <= 1
        ? `Start ${campaignName(unlock.campaignId)}`
        : `Reach issue #${unlock.issue} of ${campaignName(unlock.campaignId)}`;
    case "campaignStarted":
      return `Start ${campaignName(unlock.campaignId)}`;
    case "campaignWon":
      return `Complete ${campaignName(unlock.campaignId)}`;
    case "any":
      return unlock.of.length > 0 ? unlockHint(unlock.of[0]!) : "Open from the start";
  }
}

/** The one answer to "is this open?" for the Extras screen. */
export class Extras {
  readonly progress: ExtrasProgress;
  /** Settings ▸ Unlocks' "Unlock everything", or `?unlock=all`: every extra is open. */
  readonly everything: boolean;
  readonly #sets: {
    readonly heroes: ReadonlySet<string>;
    readonly played: ReadonlySet<string>;
    readonly won: ReadonlySet<string>;
    readonly lost: ReadonlySet<string>;
    readonly issues: ReadonlySet<string>;
    readonly started: ReadonlySet<string>;
    readonly completed: ReadonlySet<string>;
  };

  constructor(progress: ExtrasProgress, options: { readonly everything?: boolean } = {}) {
    this.progress = progress;
    this.everything = options.everything ?? false;
    this.#sets = {
      heroes: new Set(progress.playedHeroIds),
      played: new Set(progress.playedScenarioIds),
      won: new Set(progress.wonScenarioIds),
      lost: new Set(progress.lostScenarioIds),
      issues: new Set(progress.reachedIssues),
      started: new Set(progress.startedCampaignIds),
      completed: new Set(progress.wonCampaignIds),
    };
  }

  isOpen(unlock: ExtrasUnlock): boolean {
    if (this.everything) return true;
    const s = this.#sets;
    switch (unlock.kind) {
      case "always":
        return true;
      case "heroPlayed":
        return s.heroes.has(unlock.identityCardId);
      case "scenarioPlayed":
        return s.played.has(unlock.scenarioId);
      case "scenarioWon":
        return s.won.has(unlock.scenarioId);
      case "scenarioLost":
        return s.lost.has(unlock.scenarioId);
      case "packWon":
        return scenariosOfPack(unlock.packCode).some((id) => s.won.has(id));
      case "packLost":
        return scenariosOfPack(unlock.packCode).some((id) => s.lost.has(id));
      case "anyWin":
        return s.won.size > 0;
      case "anyLoss":
        return s.lost.size > 0;
      case "issueReached":
        return s.issues.has(issueKey(unlock.campaignId, unlock.nodeId)) || s.completed.has(unlock.campaignId);
      case "campaignStarted":
        return s.started.has(unlock.campaignId);
      case "campaignWon":
        return s.completed.has(unlock.campaignId);
      case "any":
        return unlock.of.some((one) => this.isOpen(one));
    }
  }

  /** A gallery's slides the player has opened, in order. */
  openSlides(content: ExtrasContent): readonly ExtrasSlide[] {
    return content.kind === "gallery" ? content.slides.filter((slide) => this.isOpen(slide.unlock)) : [];
  }

  /** How many of a tab's entries are open, for the tab's "3/17" count. */
  countOf(entries: readonly ExtrasEntry[]): { readonly open: number; readonly total: number } {
    return { open: entries.filter((entry) => this.isOpen(entry.unlock)).length, total: entries.length };
  }
}

const scenariosOfPack = (packCode: string): readonly string[] =>
  POOL_SCENARIOS.filter((scenario) => (scenario.packCode as string) === packCode).map((s) => s.id as string);

/** The soundtrack's song titles, by the track's path under `music/` (the names in `music/soundtrack/`). */
export const TRACK_TITLES: Readonly<Record<string, string>> = {
  "title/main-title.mp3": "Main Title",
  "gameplay/default-in-battle.mp3": "To Battle We Assemble",
  "outcomes/victory.mp3": "Victory Fanfare",
  "outcomes/defeat.mp3": "Sorrowful Defeat",
  "scenarios/rhino/battle.mp3": "Battle with a Rhino",
  "scenarios/rhino/villain-loses.mp3": "The Rhino Has Fallen",
  "scenarios/rhino/villain-wins.mp3": "The Rhino Prevails",
  "scenarios/ultron/battle.mp3": "Battle with a Machine",
  "scenarios/ultron/villain-loses.mp3": "The Machines Fall",
  "scenarios/ultron/villain-wins.mp3": "The Machines Take Over",
  "scenarios/crossbones/battle.mp3": "Concrete Engagement",
  "scenarios/crossbones/villain-loses.mp3": "When the Siege Breaks",
  "scenarios/crossbones/villain-wins.mp3": "Calculated Finality",
  "scenarios/brotherhood-of-badoon/battle.mp3": "Under the Colossus",
  "scenarios/infiltrate-the-museum/battle.mp3": "Rows of Silent Glass",
  "scenarios/escape-the-museum/battle.mp3": "The Keeper's Iron Maze",
  "scenarios/nebula/battle.mp3": "Hardened Perimeter",
  "scenarios/ronan-the-accuser/battle.mp3": "Crown of Black Marble",
  "scenarios/ebony-maw/battle.mp3": "Mortis Kreal",
  "scenarios/ebony-maw/villain-loses.mp3": "After the Final Stand",
  "scenarios/ebony-maw/villain-wins.mp3": "Throne of Cold Iron",
  "scenarios/tower-defense/battle.mp3": "Zero Margin Hunt",
  "scenarios/tower-defense/villain-loses.mp3": "The Last Banner",
  "scenarios/tower-defense/villain-wins.mp3": "Under Their Heel",
  "scenarios/thanos/battle.mp3": "The Unyielding Decree",
  "scenarios/thanos/villain-loses.mp3": "A Realm Restored",
  "scenarios/thanos/villain-wins.mp3": "After the Last Empire",
  "scenarios/hela/battle.mp3": "Cathedral of Frozen Steel",
  "scenarios/hela/villain-loses.mp3": "The Sun Claims the Valley",
  "scenarios/hela/villain-wins.mp3": "Crown of Cold",
  "scenarios/loki/battle.mp3": "The False King's March",
  "scenarios/loki/villain-loses.mp3": "The Trickster Unmasked",
  "scenarios/loki/villain-wins.mp3": "The Architect's Last Toll",
  "campaigns/trors/finale.mp3": "Anthem of the Returning Sun",
  "campaigns/gmw/finale.mp3": "The Longest Watch Ends",
  "packs/gmw/villain-loses.mp3": "The Longest Watch Ends",
  "packs/gmw/villain-wins.mp3": "The Unending Reign",
};

/** "music:scenarios/rhino/battle.mp3" → "scenarios/rhino/battle.mp3". */
const trackPath = (track: Track): string => track.key.replace(/^music:/, "");

/** A title for a track the table above doesn't name yet: "Rhino — Battle". */
function fallbackTitle(path: string): string {
  const parts = path.split("/");
  const stem = (parts.at(-1) ?? path).replace(/\.[^.]+$/, "");
  const words = stem.replace(/-/g, " ");
  const slot = words.charAt(0).toUpperCase() + words.slice(1);
  if (parts.length < 3) return slot;
  const owner = parts[0] === "scenarios" ? villainLabelOf(parts[1]!) : parts[1]!.toUpperCase();
  return `${owner} — ${slot}`;
}

interface SlottedTrack {
  readonly track: Track;
  readonly where: string;
  readonly unlock: ExtrasUnlock;
}

/** Every track the game plays, where it plays and what opens it, in the catalog's own order. */
function slottedTracks(catalog: MusicCatalog): SlottedTrack[] {
  const out: SlottedTrack[] = [];
  for (const track of catalog.title) out.push({ track, where: "Title screen", unlock: { kind: "always" } });
  for (const track of catalog.gameplay) out.push({ track, where: "Any battle", unlock: { kind: "always" } });
  for (const [scenarioId, slots] of catalog.scenarios) {
    const villain = villainLabelOf(scenarioId);
    for (const track of slots.battle)
      out.push({ track, where: `Battle · ${villain}`, unlock: { kind: "scenarioPlayed", scenarioId } });
    for (const track of slots["villain-loses"])
      out.push({ track, where: `Victory · ${villain}`, unlock: { kind: "scenarioWon", scenarioId } });
    for (const track of slots["villain-wins"])
      out.push({ track, where: `Defeat · ${villain}`, unlock: { kind: "scenarioLost", scenarioId } });
  }
  for (const [campaignId, slots] of catalog.campaigns) {
    const name = campaignName(campaignId);
    for (const track of slots.battle)
      out.push({ track, where: `Battle · ${name}`, unlock: { kind: "campaignStarted", campaignId } });
    for (const track of slots.interlude)
      out.push({ track, where: `Interlude · ${name}`, unlock: { kind: "campaignStarted", campaignId } });
    for (const track of slots.finale)
      out.push({ track, where: `Finale · ${name}`, unlock: { kind: "campaignWon", campaignId } });
  }
  for (const [packCode, slots] of catalog.packs) {
    const name = packName(packCode);
    const packScenarios = scenariosOfPack(packCode);
    const played: ExtrasUnlock = {
      kind: "any",
      of: packScenarios.map((scenarioId) => ({ kind: "scenarioPlayed", scenarioId })),
    };
    for (const track of slots.battle) out.push({ track, where: `Battle · ${name}`, unlock: played });
    for (const track of slots["villain-loses"])
      out.push({ track, where: `Victory · ${name}`, unlock: { kind: "packWon", packCode } });
    for (const track of slots["villain-wins"])
      out.push({ track, where: `Defeat · ${name}`, unlock: { kind: "packLost", packCode } });
  }
  for (const track of catalog.outcomes.victory) out.push({ track, where: "Any victory", unlock: { kind: "anyWin" } });
  for (const track of catalog.outcomes.defeat) out.push({ track, where: "Any defeat", unlock: { kind: "anyLoss" } });
  return out;
}

/**
 * The jukebox: one entry per song. A song filed in several slots (the same file as a campaign's finale and a pack's
 * victory theme) is listed once, open when any of its slots is, and names every place it plays.
 */
export function musicEntriesOf(catalog: MusicCatalog = MUSIC_CATALOG): ExtrasEntry[] {
  const bySong = new Map<string, SlottedTrack[]>();
  for (const slotted of slottedTracks(catalog)) {
    const path = trackPath(slotted.track);
    const title = TRACK_TITLES[path] ?? fallbackTitle(path);
    bySong.set(title, [...(bySong.get(title) ?? []), slotted]);
  }
  return [...bySong].map(([title, slots]) => ({
    id: `music:${title}`,
    tab: "music",
    title,
    subtitle: slots.map((slot) => slot.where).join(" · "),
    thumb: null,
    unlock: slots.length === 1 ? slots[0]!.unlock : { kind: "any", of: slots.map((slot) => slot.unlock) },
    content: { kind: "track", track: slots[0]!.track },
  }));
}

/** Every campaign issue with a story, box by box in Saga order, issue by issue. */
export function storyEntriesOf(): ExtrasEntry[] {
  return SAGA_VOLUMES.flatMap((volume) => {
    const story = storyFor(volume.campaignId);
    if (!story) return [];
    return story.issues.map((issue, index): ExtrasEntry => {
      const number = index + 1;
      const thumb =
        ART_CATALOG.scenarios.get(issue.nodeId)?.villain[0] ?? CAMPAIGN_ART.covers.get(volume.campaignId) ?? null;
      return {
        id: `story:${volume.campaignId}/${issue.nodeId}`,
        tab: "stories",
        title: issue.title,
        subtitle: `${volume.name} · Issue #${number} · ${issue.villain}`,
        thumb,
        unlock: { kind: "issueReached", campaignId: volume.campaignId, nodeId: issue.nodeId, issue: number },
        content: { kind: "issue", campaignId: volume.campaignId, nodeId: issue.nodeId },
      };
    });
  });
}

/** A card's traits and flavor as a hero or villain file's lines, skipping whatever the card doesn't print. */
function faceLines(face: {
  readonly faceName?: string;
  readonly traits?: readonly string[];
  readonly flavor?: string;
}): string[] {
  const lines: string[] = [];
  const traits = (face.traits ?? []).map((t) => `${t}`).join(" · ");
  if (face.faceName) lines.push(traits ? `${face.faceName} — ${traits}` : face.faceName);
  if (face.flavor) lines.push(face.flavor);
  return lines;
}

/** Every hero in the pool, in pool order: their artwork, and both faces' names, traits and flavor. */
export function heroEntriesOf(): ExtrasEntry[] {
  return UNLOCK_HEROES.map((hero): ExtrasEntry => {
    const found = CARDS_BY_ID.get(hero.identityCardId);
    const card = found?.type === "hero_identity" ? found : undefined;
    const unlock: ExtrasUnlock = { kind: "heroPlayed", identityCardId: hero.identityCardId };
    const pictures = HERO_ART.heroes.get(hero.identityCardId) ?? [];
    return {
      id: `hero:${hero.identityCardId}`,
      tab: "heroes",
      title: hero.name,
      subtitle: card?.alterEgo?.faceName ?? "",
      thumb: pictures[0] ?? null,
      unlock,
      content: {
        kind: "gallery",
        slides: pictures.map((picture) => ({ picture, caption: hero.name, unlock })),
        lines: [...(card?.hero ? faceLines(card.hero) : []), ...(card?.alterEgo ? faceLines(card.alterEgo) : [])],
      },
    };
  });
}

/** Every scenario in the pool, in pool order: the villain's artwork and its victory and defeat scenes. */
export function villainEntriesOf(): ExtrasEntry[] {
  return POOL_SCENARIOS.map((scenario: Scenario): ExtrasEntry => {
    const scenarioId = scenario.id as string;
    const villain = CARDS_BY_ID.get(scenario.villainCardId as string);
    const name = villain?.name ?? scenario.name;
    const art = ART_CATALOG.scenarios.get(scenarioId);
    const played: ExtrasUnlock = { kind: "scenarioPlayed", scenarioId };
    const slides: ExtrasSlide[] = [
      ...(art?.villain ?? []).map((picture) => ({ picture, caption: name, unlock: played })),
      ...(art?.["villain-loses"] ?? []).map((picture) => ({
        picture,
        caption: `${name} falls`,
        unlock: { kind: "scenarioWon", scenarioId } as const,
      })),
      ...(art?.["villain-wins"] ?? []).map((picture) => ({
        picture,
        caption: `${name} wins`,
        unlock: { kind: "scenarioLost", scenarioId } as const,
      })),
    ];
    const stage = villain?.type === "villain" ? villain.sides[0]?.stages[0] : undefined;
    const traits = (stage?.traits ?? []).join(" · ");
    return {
      id: `villain:${scenarioId}`,
      tab: "villains",
      title: name,
      subtitle: name === scenario.name ? packName(scenario.packCode as string) : scenario.name,
      thumb: art?.villain[0] ?? null,
      unlock: played,
      content: {
        kind: "gallery",
        slides,
        lines: [...(traits ? [traits] : []), `Scenario: ${scenario.name} (${packName(scenario.packCode as string)})`],
      },
    };
  });
}

/** One picture as its own gallery entry. */
function pictureEntry(
  id: string,
  title: string,
  subtitle: string,
  picture: Picture,
  unlock: ExtrasUnlock,
): ExtrasEntry {
  return {
    id,
    tab: "art",
    title,
    subtitle,
    thumb: picture,
    unlock,
    content: { kind: "gallery", slides: [{ picture, caption: title, unlock }], lines: [] },
  };
}

/** "wallpaper-4-wide.webp" → "Wallpaper 4 wide". */
function pictureTitle(key: string): string {
  const stem = (key.split(/[/:]/).at(-1) ?? key).replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
  return stem.charAt(0).toUpperCase() + stem.slice(1);
}

/** The title wallpapers, the generic victory and defeat scenes, and each campaign box's cover. */
export function artEntriesOf(): ExtrasEntry[] {
  return [
    ...TITLE_ART.map((picture) =>
      pictureEntry(`art:${picture.key}`, pictureTitle(picture.key), "Title screen", picture, { kind: "always" }),
    ),
    ...ART_CATALOG.outcomes.victory.map((picture) =>
      pictureEntry(`art:${picture.key}`, "Victory", "Any victory", picture, { kind: "anyWin" }),
    ),
    ...ART_CATALOG.outcomes.defeat.map((picture) =>
      pictureEntry(`art:${picture.key}`, "Defeat", "Any defeat", picture, { kind: "anyLoss" }),
    ),
    ...SAGA_VOLUMES.flatMap((volume) => {
      const cover = CAMPAIGN_ART.covers.get(volume.campaignId);
      return cover
        ? [
            pictureEntry(`art:${cover.key}`, volume.name, `Campaign cover · ${volume.boxCode}`, cover, {
              kind: "campaignStarted",
              campaignId: volume.campaignId,
            }),
          ]
        : [];
    }),
  ];
}

/**
 * The rulebooks, always open. A campaign rulebook wears its box's cover, or its final villain until the box ships a
 * cover; the Rules Reference wears the Core Set box.
 */
export function bookEntriesOf(): ExtrasEntry[] {
  const coreBox = TITLE_ART.find((picture) => picture.key.includes("box-core-set")) ?? null;
  return BOOKS.map((book): ExtrasEntry => {
    const finalScenario = book.campaignId
      ? (CAMPAIGN_RECORDS[book.campaignId]?.scenarioIds.at(-1) as string | undefined)
      : undefined;
    const thumb = book.campaignId
      ? (CAMPAIGN_ART.covers.get(book.campaignId) ??
        (finalScenario ? ART_CATALOG.scenarios.get(finalScenario)?.villain[0] : undefined) ??
        null)
      : book.id === "book:rrg"
        ? coreBox
        : null;
    return {
      id: book.id,
      tab: "books",
      title: book.title,
      subtitle: book.subtitle,
      thumb,
      unlock: { kind: "always" },
      content: { kind: "book", bookId: book.id },
    };
  });
}

/** Every extra, by tab. Built once: the catalogs are build-time globs and the pool never changes at runtime. */
export const EXTRAS_ENTRIES: Readonly<Record<ExtrasTab, readonly ExtrasEntry[]>> = {
  stories: storyEntriesOf(),
  books: bookEntriesOf(),
  heroes: heroEntriesOf(),
  villains: villainEntriesOf(),
  art: artEntriesOf(),
  music: musicEntriesOf(),
};
