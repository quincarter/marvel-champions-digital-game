/**
 * The Briefing's case file (Agents of S.H.I.E.L.D., MC50 pp. 5, 6 and 24): the evidence the players hold as pictures, how many
 * combinations are still open, the Executive Board's secrets and which members are attachments now, the numbers the next
 * Setups read, and in an expert campaign each seat's hit points. It is plain drawing over `ShieldBriefing`
 * (`view/campaign-shield-model.ts`) and never reads the sealed A.I.M. envelope.
 */
import { t } from "../../../../../i18n/translate.js";
import { accent, signal, surface, typeRole } from "../../../../../tokens.js";
import { drawRuleHeading } from "../../handled.js";
import { drawKicker, drawNote } from "../parts/kicker.js";
import { sectionTextIn } from "../section-text.js";
import { drawShieldPictures } from "./shield-pictures.js";
import {
  boardCaptionIn,
  boardHeadingIn,
  evidenceHeadingIn,
  evidenceKindIn,
  membersLineIn,
  openLineIn,
} from "./shield-text.js";
import type { ShieldEvents, ShieldInput } from "./shield.types.js";

/** Draws the case file from `top`; returns its bottom. */
export function drawShield(input: ShieldInput, events: ShieldEvents): number {
  const { b, col, shield } = input;
  const text = sectionTextIn();
  const red = accent.heroRed.hex;
  let y = drawRuleHeading(b, col.x, input.top, col.width, t("briefing.shield.heading"));

  // Evidence: the cards the players hold, then what they have narrowed.
  y += drawKicker(b, col.x, y, evidenceHeadingIn(shield.evidence.length), red) + 4;
  if (shield.evidence.length > 0) {
    const cards = shield.evidence.map((card) => ({ ...card, caption: evidenceKindIn(card.kind) }));
    y = drawShieldPictures({ ...input, top: y, cards, keyBase: "shield-evidence" }, events) + 6;
  }
  y = drawNote(b, col.x, y, col.width, openLineIn(shield));
  y = drawNote(b, col.x, y, col.width, membersLineIn(shield.members), { size: 11, full: true });

  // The Executive Board.
  y += 8;
  y += drawKicker(b, col.x, y, boardHeadingIn(shield.boardAfter), red) + 4;
  if (shield.board.length > 0) {
    const cards = shield.board.map((member) => ({
      cardId: member.cardId,
      name: member.name,
      caption: boardCaptionIn(member),
    }));
    y = drawShieldPictures({ ...input, top: y, cards, keyBase: "shield-board" }, events) + 6;
  }
  y = drawNote(b, col.x, y, col.width, text.flipNote(shield.flipNote), { size: 11, full: true });

  // What the next Setups read.
  if (shield.numbers.length > 0) {
    y += 8;
    y += drawKicker(b, col.x, y, t("briefing.shield.carried"), red) + 4;
    for (const row of shield.numbers) {
      y = drawNote(
        b,
        col.x,
        y,
        col.width,
        `${text.numberLabel(row.label)}: ${row.value}  (${text.numberUsedIn(row.usedIn)})`,
      );
    }
  }

  // Expert: who is hurt, and who has to pay to come back.
  if (shield.seats.length > 0) {
    y += 8;
    y += drawKicker(b, col.x, y, t("briefing.shield.expert"), red) + 4;
    for (const seat of shield.seats) {
      const line = b.text(col.x, y, `${seat.heroName}: ${text.seatStatus(seat.status)}`, typeRole.body, {
        size: 12,
        color: seat.sitsOut ? signal.caution.hex : surface.ink.hex,
        alpha: 0.9,
        wrapWidth: col.width,
      });
      y += line.height + 4;
    }
  }
  return y;
}
