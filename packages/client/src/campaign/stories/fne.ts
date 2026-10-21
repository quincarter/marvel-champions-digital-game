/**
 * Fear No Evil (MC60): the copy for the box. Everything here is original flavor for this app; no rule lives here (see
 * `../story.ts`).
 *
 * **Comic pages.** Art Museum Heist and The Getaway each open on five lettered pages the owner built from panels of
 * Black Cat (2019) #1 (2026-10-20), in `art/campaigns/fne/pages/<issue>-<n>.jpg` (1672x941 each), read panel by panel
 * with the reader's lettered mode (the captions and balloons are printed in). Panel rectangles were measured from each
 * page's white gutters. The other issues have no pages yet, so the reader skips them (no `comicBeats`). The five
 * underling issues are dealt from the box in no fixed order (a `choice` graph), so they carry no number in the copy;
 * Kingpin is always last.
 *
 * **Cast:** Daredevil (`60001a`) and Echo (`60037a`) ship in this box, so their lines are written for them; every
 * other hero shows the narrator `fallback` instead.
 */
import type { CampaignStory, ComicPage, HandledWords, IssueStory, SetupCallCopy, StorySpeaker } from "../story.js";

const DAREDEVIL: StorySpeaker = { kind: "hero", identityId: "60001a", name: "Daredevil" };
const ECHO: StorySpeaker = { kind: "hero", identityId: "60037a", name: "Echo" };

const issue = (
  nodeId: string,
  title: string,
  villain: string,
  blurb: string,
  recap: string,
  teaser: string,
  briefing: IssueStory["briefing"],
  aftermath: NonNullable<IssueStory["aftermath"]>,
  rewindTaunt: string,
): IssueStory => ({
  nodeId,
  title,
  villain,
  blurb,
  recap,
  teaser,
  opener: [],
  stageLines: {},
  briefing,
  aftermath,
  aftermathArt: { kind: "villain" },
  rewindTaunt,
});

const page = (file: string, panels: readonly { x: number; y: number; w: number; h: number }[]): ComicPage => ({
  file,
  width: 1672,
  height: 941,
  lettered: true,
  // `show`: just the panel, fit whole in the reading area, so a caption at its top edge is never cropped.
  beats: panels.map((panel) => ({ panel, show: panel, lines: [] })),
});

const PAGES: readonly ComicPage[] = [
  page("art-heist-1", [
    { x: 18, y: 32, w: 1054, h: 881 },
    { x: 1078, y: 32, w: 575, h: 881 },
  ]),
  page("art-heist-2", [
    { x: 31, y: 30, w: 796, h: 881 },
    { x: 845, y: 30, w: 796, h: 881 },
  ]),
  page("art-heist-3", [
    { x: 7, y: 7, w: 822, h: 926 },
    { x: 843, y: 7, w: 822, h: 926 },
  ]),
  page("art-heist-4", [
    { x: 51, y: 95, w: 777, h: 523 },
    { x: 844, y: 95, w: 779, h: 523 },
    { x: 51, y: 630, w: 1572, h: 216 },
  ]),
  page("art-heist-5", [{ x: 25, y: 58, w: 1622, h: 865 }]),
  page("getaway-1", [{ x: 14, y: 13, w: 1644, h: 914 }]),
  page("getaway-2", [
    { x: 19, y: 16, w: 584, h: 905 },
    { x: 619, y: 16, w: 1034, h: 905 },
  ]),
  page("getaway-3", [{ x: 22, y: 14, w: 1632, h: 908 }]),
  page("getaway-4", [
    { x: 18, y: 62, w: 1037, h: 798 },
    { x: 1068, y: 62, w: 588, h: 798 },
  ]),
  page("getaway-5", [{ x: 26, y: 63, w: 1620, h: 814 }]),
];

/** Every beat of each page, in order. */
const beatsOf = (...files: readonly string[]) =>
  files.flatMap((file) => PAGES.find((p) => p.file === file)!.beats.map((_, beatIndex) => ({ page: file, beatIndex })));

/** The five interchangeable scenarios (the finale, Kingpin, has no villain to choose). */
const UNDERLING_NODES = [
  "art-museum-heist",
  "the-getaway",
  "protection-racket",
  "the-raft-breakout",
  "stop-the-presses",
];

const VILLAIN_CALL: SetupCallCopy = {
  name: "Choose the villain",
  explain:
    'On a first playthrough, "The next villain on the recommended list" takes the rulebook\'s order (Hammerhead, Bullseye, Electro, then Purple Man or Typhoid Mary), and "A random unrecorded villain" draws one you have not faced. If only Purple Man and Typhoid Mary are left, pick which one you face.',
};

const NODE_TITLES: Readonly<Record<string, string>> = {
  "art-museum-heist": "Art Museum Heist",
  "the-getaway": "The Getaway",
  "protection-racket": "Protection Racket",
  "the-raft-breakout": "The Raft Breakout",
  "stop-the-presses": "Stop the Presses!",
  kingpin: "Kingpin",
};

/** "typhoid_mary" -> "Typhoid Mary"; a scenario id reads as its printed title. */
const nameOf = (id: string): string =>
  NODE_TITLES[id] ??
  id.replace(/[-_]+/g, " ").replace(/(^|\s)([a-z])/g, (_m, lead: string, c: string) => lead + c.toUpperCase());

/** `issue(...)` with the comic read the opener plays before the Briefing. */
const withComic = (
  comicBeats: NonNullable<IssueStory["comicBeats"]>,
  ...args: Parameters<typeof issue>
): IssueStory => ({
  ...issue(...args),
  comicBeats,
});

const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

/**
 * The Briefing's "Handled for you" facts in plain sentences, not the log's own wording ("Recorded
 * Villain.art-museum-heist: hammerhead"). A question's own answer lines are the answer sentences, and the working
 * fields the setup only reads back (the playthrough answer, how the villain is chosen) are left out.
 */
const handledWords: HandledWords = (fact) => {
  if (fact.kind === "write") {
    if (fact.value.kind === "choice" && fact.field.startsWith("villain.")) {
      const villain = nameOf(fact.value.option);
      const node = nameOf(fact.field.slice("villain.".length));
      return `${villain} is the villain for ${node}.`;
    }
    if (fact.field === "unrecordedVillains" && fact.value.kind === "strikeList") {
      const struck = new Set(fact.value.struck);
      const left = (fact.options ?? []).filter((id) => !struck.has(id)).map(nameOf);
      return left.length === 0 ? "Every villain has now been faced." : `Villains not yet faced: ${left.join(", ")}.`;
    }
    if (fact.field === "playthrough" || fact.field === "villainMethod" || fact.field === "checks") return "";
    return undefined;
  }
  if (fact.kind === "choice") {
    const picked = fact.picked[0] ?? "";
    switch (fact.slot) {
      case "playthrough":
        return /^first/i.test(picked)
          ? "This is the group's first time through the campaign."
          : "This is not the group's first time through the campaign.";
      case "drawA":
      case "drawB":
        return `${nameOf(picked)} was drawn and gets a check mark.`;
      case "villainMethod":
        return `The group took ${lowerFirst(picked)}.`;
      case "villain":
        // The villain's own sentence ("X is the villain for Y") says it; a draw or a pick adds nothing more.
        return "";
      default:
        return undefined;
    }
  }
  if (fact.field === "checks" && fact.value.kind === "number") {
    const marks = fact.value.value;
    return `${nameOf(fact.nodeId)} has ${marks} check mark${marks === 1 ? "" : "s"} in the campaign log.`;
  }
  return undefined;
};

/** The question that picks the next scenario (the runner's own `campaign.nextNode`). */
const NEXT_SCENARIO_CALL: SetupCallCopy = {
  name: "Choose the next scenario",
  explain:
    "Pick which of the open scenarios to play next. The open ones are the five underling scenarios you have not beaten yet; each one's villain is chosen right after you pick. The Kingpin comes only after all five are done.",
};

export const FNE_STORY: CampaignStory = {
  campaignId: "fne",
  handledWords,
  tagline: "A story in six issues",
  blurb:
    "Hell's Kitchen is falling to the Kingpin's underlings, one job at a time. Daredevil and Echo have to take them down in whatever order the city deals them, then climb to the man who runs it all.",
  rosterBanner:
    "Each hero stays for the whole campaign. The underlings you beat are crossed off, and the Kingpin waits at the end.",
  setupCalls: {
    "campaign.nextNode": NEXT_SCENARIO_CALL,
    "mc60.choice.playthrough": {
      name: "First playthrough?",
      explain:
        "Answer once for the whole campaign. First playthrough lets you take the rulebook's villain order, scenario by scenario, or draw villains at random. Not the first playthrough draws every villain at random, with no further questions.",
    },
    ...Object.fromEntries(UNDERLING_NODES.map((id) => [`mc60.${id}.compose.villain`, VILLAIN_CALL])),
  },
  castIdentityIds: ["60001a", "60037a"],
  pages: PAGES,
  issues: [
    withComic(
      beatsOf("art-heist-1", "art-heist-2", "art-heist-3", "art-heist-4", "art-heist-5"),
      "art-museum-heist",
      "Art Museum Heist",
      "An underling",
      "A crew is cleaning out the museum after hours, and the cops are already on the scene.",
      "The museum is quiet again. The crew's boss has been named.",
      "Someone is robbing the museum. Get there before the police do something they will regret.",
      {
        speaker: DAREDEVIL,
        text: "I can hear the alarm and the crew. Same building, different floors. Let us split them up.",
        fallback: "The alarm is ringing and the crew is spread across the building. The team splits them up.",
      },
      {
        speaker: ECHO,
        text: "That was one of his. There are more, and they all answer to the same man.",
        fallback: "That was one of the Kingpin's. There are more, and they all answer to him.",
      },
      "The museum is mine now. Come and take it back.",
    ),
    withComic(
      beatsOf("getaway-1", "getaway-2", "getaway-3", "getaway-4", "getaway-5"),
      "the-getaway",
      "The Getaway",
      "An underling",
      "A job went wrong and the crew is running. Every car in the district is on the road.",
      "The getaway ends in a dead end, with the driver caught.",
      "The crew has wheels and a head start. Do not let them reach the bridge.",
      {
        speaker: ECHO,
        text: "They are fast, but the streets are mine. I know where every turn ends.",
        fallback: "They are fast, but the streets are the team's. The team knows where every turn ends.",
      },
      {
        speaker: DAREDEVIL,
        text: "Another one down. Every name we get is one step closer to the top.",
        fallback: "Another underling is down. Every name brings the team a step closer to the top.",
      },
      "You will never catch me. Try again, if you like losing.",
    ),
    issue(
      "protection-racket",
      "Protection Racket",
      "An underling",
      "Shopkeepers are paying for protection from the very people who threaten them.",
      "The shopkeepers stand a little taller. The racket is broken.",
      "The neighborhood is paying for safety it does not get. Show them somebody is watching.",
      {
        speaker: DAREDEVIL,
        text: "These people are afraid to talk. Let us give them a reason to stop being afraid.",
        fallback: "The shopkeepers are afraid to talk. The team gives them a reason to stop being afraid.",
      },
      {
        speaker: ECHO,
        text: "They will remember this. So will the man who sent his crew here.",
        fallback: "The neighborhood will remember this. So will the man who sent the crew.",
      },
      "Everyone pays. You are no different.",
    ),
    issue(
      "the-raft-breakout",
      "The Raft Breakout",
      "An underling",
      "The Raft's locks are failing and a very dangerous crowd is walking out.",
      "The Raft is sealed again, and the one who planned it is back inside.",
      "Someone opened the doors at the Raft. Lock them again before the city fills with them.",
      {
        speaker: DAREDEVIL,
        text: "Too many heartbeats, all heading for the gate. We hold the line here.",
        fallback: "Too many prisoners are heading for the gate. The team holds the line.",
      },
      {
        speaker: ECHO,
        text: "Whoever planned this wanted a distraction. It worked, but only for a night.",
        fallback: "Whoever planned the breakout wanted a distraction. It worked, but only for a night.",
      },
      "The cells are open. The city is next.",
    ),
    issue(
      "stop-the-presses",
      "Stop the Presses!",
      "An underling",
      "The Daily Bugle is about to print the truth, and somebody wants it pulped.",
      "The story runs. The paper's staff is safe, and the cover is true.",
      "The Bugle has a story the wrong people want buried. Get to the pressroom.",
      {
        speaker: DAREDEVIL,
        text: "The presses are running and so are the threats. Keep the staff safe and keep the story alive.",
        fallback: "The presses are running and so are the threats. The team keeps the staff safe and the story alive.",
      },
      {
        speaker: ECHO,
        text: "Print it. Let the whole city read what he has been hiding.",
        fallback: "The story is printed, and the whole city can read what the Kingpin has been hiding.",
      },
      "No headline survives me. Try again.",
    ),
    issue(
      "kingpin",
      "Kingpin",
      "Kingpin",
      "Every underling is down and the man behind them has nowhere left to send his threats.",
      "The Kingpin is beaten, and Hell's Kitchen can finally breathe.",
      "Wilson Fisk is waiting at the top of the city he built. End it.",
      {
        speaker: DAREDEVIL,
        text: "No more middlemen. It is him and us, and I am not afraid.",
        fallback: "No more middlemen. It is the Kingpin against the team, and the team is not afraid.",
      },
      {
        speaker: ECHO,
        text: "It is over. Now we make sure the next one never gets this far.",
        fallback: "It is over. Now the team makes sure the next one never gets this far.",
      },
      "I own this city. You never owned anything.",
    ),
  ],
  campaignLost: {
    headline: "The Kingpin\nStands.",
    line: "Wilson Fisk's grip on Hell's Kitchen holds. This run of the campaign is over.",
  },
  finale: {
    caption: "Dawn comes up over Hell's Kitchen, and for once the sirens are on the right side.",
    headline: "Fear no evil.",
    sfx: "WHAM!",
    villainLine: "This is not over. It is never over.",
    heroLines: ["Then we will be here. We always are.", "The city is ours to watch over."],
    stats: [{ kind: "rewinds", label: "Rewinds" }],
    crewLines: [
      {
        speaker: DAREDEVIL,
        text: "Then we will be here. We always are.",
        fallback: "Then the team will be here. They always are.",
      },
      {
        speaker: ECHO,
        text: "The city is ours to watch over.",
        fallback: "The city is theirs to watch over.",
      },
    ],
  },
};
