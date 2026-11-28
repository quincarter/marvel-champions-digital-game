/**
 * The speaker of the story briefing line: whoever the line speaks as (a hero, the villain, an NPC, or the first seat for narration),
 * as the `SpeakerModel` the speaker element shows. A hero whose portrait is not filed yet (a new box `art/heroes/_pending/`) speaks
 * over the box own cover; a voice with no picture gets its initial, never somebody else face.
 */
import { campaignCoverFor, CAMPAIGN_ART } from "../../../art/campaign-art.js";
import { artLanguageNow } from "../../../art/art-source.js";
import { briefingLineIn } from "../../../campaign/briefing-text.js";
import { villainIn } from "../../../campaign/campaign-text.js";
import { lineForRoster } from "../../../campaign/story.js";
import type { SpeakerModel } from "../../../components/briefing/mc-briefing-speaker/mc-briefing-speaker.types.js";
import type { PictureLeases } from "../../../dom/picture-leases.js";
import { villainPicture } from "../../../ui/campaign-chrome.js";
import { briefingSpeakerOf } from "../../../view/campaign-briefing-speaker.js";
import { localizedNameOf } from "../../../view/card-names.js";
import type { BriefingState } from "./context.js";
import { briefingTextIn } from "./copy.js";
import { cardOfName } from "./names.js";
import { coverOf, heroFace, sourcePicture } from "./pictures.js";

/** A speaker named in the story data, in the player language: the villain table, else a card of that name own Spanish name. */
function speakerNameIn(name: string): string {
  const lang = artLanguageNow();
  if (lang === "en") return name;
  const villain = villainIn(name, lang);
  if (villain !== name) return villain;
  const card = cardOfName(name);
  return (card && localizedNameOf(card.id as string, lang)) || name;
}

export function speakerModelOf(state: BriefingState, leases: PictureLeases): SpeakerModel | null {
  const { record, story } = state;
  if (!record || !story) return null;
  const nodeKey = record.attempt?.nodeId ?? record.position.nextNodeId ?? "";
  const resolved = lineForRoster(
    briefingLineIn(record.campaignId as string, nodeKey, story.briefing),
    record.seats.map((seat) => seat.identityCardId),
  );
  if (!resolved) return null;
  const speaker = briefingSpeakerOf(
    resolved.speaker,
    { scenarioId: nodeKey, villainName: story.villain },
    record.seats[0]?.identityCardId ?? null,
  );
  let picture = null;
  if (speaker.villainScenarioId) {
    picture = sourcePicture(leases, villainPicture(speaker.villainScenarioId));
  } else if (speaker.heroIdentityId) {
    const cover = campaignCoverFor(CAMPAIGN_ART, record.campaignId as string);
    picture = heroFace(leases, speaker.heroIdentityId) ?? sourcePicture(leases, cover, coverOf(cover?.focus));
  }
  return {
    portrait: { picture, initial: !speaker.heroIdentityId && speaker.initial ? speaker.initial : null },
    speaker: speaker.name ? speakerNameIn(speaker.name) : null,
    text: briefingTextIn().bubble(resolved.text),
  };
}
