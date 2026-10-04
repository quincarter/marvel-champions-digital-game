/**
 * Who the Briefing's round portrait shows for the story's briefing line (`scenes/campaign/briefing.ts`'s
 * `#drawSpeaker`). A hero speaks as that hero; narration borrows the first seat's portrait (the Briefing has always
 * worked that way); a villain speaks over this issue's own villain picture; an NPC with a `portraitScenarioId` borrows
 * that scenario's villain picture (Mojo briefing the MaGog issue) and any other NPC gets a lettered placeholder rather
 * than somebody else's face. A speaker that is not a hero is named on the bubble, so the portrait never has to say who.
 */
import type { StorySpeaker } from "../campaign/story.js";

export interface BriefingSpeakerView {
  /** A hero portrait to draw (identity card id), or null. */
  readonly heroIdentityId: string | null;
  /** A scenario whose villain picture to draw, or null. */
  readonly villainScenarioId: string | null;
  /** The name printed on the bubble. Null for a hero or the narrator, whose portrait already says it. */
  readonly name: string | null;
  /** The letter a portrait with no picture draws. */
  readonly initial: string;
}

export function briefingSpeakerOf(
  speaker: StorySpeaker,
  issue: { readonly scenarioId: string; readonly villainName: string },
  firstSeatIdentityId: string | null,
): BriefingSpeakerView {
  switch (speaker.kind) {
    case "hero":
      return {
        heroIdentityId: speaker.identityId,
        villainScenarioId: null,
        name: null,
        initial: speaker.name.charAt(0),
      };
    case "villain":
      return {
        heroIdentityId: null,
        villainScenarioId: issue.scenarioId,
        name: issue.villainName,
        initial: issue.villainName.charAt(0),
      };
    case "npc":
      return {
        heroIdentityId: null,
        villainScenarioId: speaker.portraitScenarioId ?? null,
        name: speaker.name,
        initial: speaker.name.charAt(0),
      };
    case "narrator":
      return { heroIdentityId: firstSeatIdentityId, villainScenarioId: null, name: null, initial: "" };
  }
}
