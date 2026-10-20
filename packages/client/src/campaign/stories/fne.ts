/**
 * Fear No Evil (MC60): the copy for the box, with no comic pages of its own yet (the reader skips an issue with no
 * `comicBeats`). Everything here is original flavor for this app; no rule lives here (see `../story.ts`). The five
 * underling issues are dealt from the box in no fixed order (a `choice` graph), so they carry no number in the copy;
 * Kingpin is always last.
 *
 * **Cast:** Daredevil (`60001a`) and Echo (`60037a`) ship in this box, so their lines are written for them; every
 * other hero shows the narrator `fallback` instead.
 */
import type { CampaignStory, IssueStory, SetupCallCopy, StorySpeaker } from "../story.js";

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

export const FNE_STORY: CampaignStory = {
  campaignId: "fne",
  tagline: "A story in six issues",
  blurb:
    "Hell's Kitchen is falling to the Kingpin's underlings, one job at a time. Daredevil and Echo have to take them down in whatever order the city deals them, then climb to the man who runs it all.",
  rosterBanner:
    "Each hero stays for the whole campaign. The underlings you beat are crossed off, and the Kingpin waits at the end.",
  setupCalls: {
    "mc60.choice.playthrough": {
      name: "First playthrough?",
      explain:
        "Answer once for the whole campaign. First playthrough lets you take the rulebook's villain order, scenario by scenario, or draw villains at random. Not the first playthrough draws every villain at random, with no further questions.",
    },
    ...Object.fromEntries(UNDERLING_NODES.map((id) => [`mc60.${id}.compose.villain`, VILLAIN_CALL])),
  },
  castIdentityIds: ["60001a", "60037a"],
  issues: [
    issue(
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
    issue(
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
