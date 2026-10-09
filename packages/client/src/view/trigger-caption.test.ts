import type { GameState, InstanceId } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { cardName } from "./names.js";
import { triggerCaption } from "./trigger-caption.js";
import { firstOfType, startedRhinoGame } from "./wave8-fixture.js";

let state: GameState;
let upgrade: InstanceId;
let host: InstanceId;

beforeAll(async () => {
  ({ state } = await startedRhinoGame());
  upgrade = firstOfType(state, "upgrade");
  host = firstOfType(state, "minion");
  state = {
    ...state,
    instances: { ...state.instances, [upgrade]: { ...state.instances[upgrade]!, attachedTo: host, faceup: true } },
  } as GameState;
}, 30_000);

describe("triggerCaption", () => {
  test("an unattached card keeps its short label, or 'trigger'", () => {
    const loose = firstOfType(state, "event");
    expect(triggerCaption(state, loose, "Discard")).toBe("Discard");
    expect(triggerCaption(state, loose, null)).toBe("trigger");
  });

  test("an attached card names its host, so identical copies can be told apart", () => {
    const on = `on ${cardName(state, host)}`;
    expect(triggerCaption(state, upgrade, null)).toBe(on);
    expect(triggerCaption(state, upgrade, "Discard")).toBe(`Discard ${on}`);
  });
});
