/**
 * A change to cards that are not leaving play themselves but take their attachments out of play with them (a villain
 * removed or set aside, a main scheme stage removed or flipped, a card flipped to another type), run after it waited on
 * the stack for the attachments' "when this leaves play" interrupts (`HostStep`, `waitsForHostStep`; docs/phase7-wave5.md
 * §4.1 Q32). Each case calls the function that waited, which goes ahead this time, and then does what that function's
 * caller would have done with its result.
 */

import { type Ctx, pushFrames } from "../ctx.js";
import { setForm } from "../effects.js";
import { cardFlippedEvent, type HostStep } from "../trigger-events.js";
import { advanceMainScheme } from "./defeat.js";
import { eventFrame } from "./frames.js";
import {
  flipMainSchemeStage,
  joinGameArea,
  removeMainSchemeStage,
  removeVillains,
  setVillainsAside,
} from "./game-areas.js";
import { flipToOtherFace } from "./other-face.js";

export function runHostStep(ctx: Ctx, step: HostStep): void {
  switch (step.kind) {
    case "removeVillains":
      return removeVillains(ctx, step.ids);
    case "setVillainsAside":
      return setVillainsAside(ctx, step.ids);
    case "removeMainSchemeStage":
      return removeMainSchemeStage(ctx, step.schemeId);
    case "advanceMainScheme":
      return advanceMainScheme(ctx, step.schemeId, step.nextIndex, step.advancedBy);
    case "setForm": {
      // The caller that waited would have pushed its announcement (`changeForm`, `executeChangeForm`).
      const changed = setForm(ctx, step.playerId, step.to, step.voluntary, step.heroFormIndex);
      if (changed) pushFrames(ctx, [eventFrame(ctx, changed)]);
      return;
    }
    case "joinGameArea":
      // Its frames discard duplicate unique cards in the joined area (`executeJoinGameArea`).
      pushFrames(ctx, joinGameArea(ctx, step.fromId, step.intoId));
      return;
    case "flipMainSchemeStage": {
      const frames = flipMainSchemeStage(ctx, step.schemeId, step.reveal, step.playerId, step.flippedBy);
      if (frames === false || frames === "waiting") return;
      // On completion its frames resolve (`completeMainScheme`); a "flip this card" announces the flip (`flipCard`).
      pushFrames(ctx, step.reveal ? frames : [eventFrame(ctx, cardFlippedEvent(step.schemeId, step.flippedBy))]);
      return;
    }
    case "flipToOtherFace":
      // A revealing flip pushed its reveal and its `cardFlipped` itself.
      if (
        flipToOtherFace(ctx, step.id, step.playerId, ctx.deps, step.reveal === true, step.flippedBy) === true &&
        !step.reveal
      )
        pushFrames(ctx, [eventFrame(ctx, cardFlippedEvent(step.id, step.flippedBy))]);
      return;
  }
}
