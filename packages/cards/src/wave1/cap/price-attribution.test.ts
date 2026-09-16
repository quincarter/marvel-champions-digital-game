/**
 * `playCostOf`: what a card costs *right now* beside what it prints, and which card moved the price.
 *
 * Steve Rogers' Living Legend is the case that made this necessary. His alter-ego side reduces the cost of the
 * first ally played each round by 1, and it reaches the whole table — so a Spider-Man player holding Mockingbird
 * (printed 3) is charged 2, with nothing on their own side of the table saying why. The number a client draws on
 * a card face is only trustworthy if the client can also name the card that changed it.
 */
import { playCostOf, type InstanceId } from "@mc/engine";
import { moveToHand, P1, playerOf } from "../../testing/harness.js";
import { wave1Scenario } from "../setup.js";
import { startWave1Game, WAVE1_DEPS } from "../testing.js";

/** Spider-Man in seat 1, Captain America (so Steve Rogers, who starts in alter-ego) in seat 2. */
const spiderManBesideSteve = () =>
  startWave1Game(
    wave1Scenario("rhino", {
      players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "cap-leadership" }],
      seed: 11,
    }),
  );

const MOCKINGBIRD = "01083";
/** First Aid: a 1-cost event, so nothing about it is an ally and nothing discounts it. */
const FIRST_AID = "01086";

describe("playCostOf", () => {
  it("prices Mockingbird at 2 and names Steve Rogers, while her card still prints 3", () => {
    const given = moveToHand(spiderManBesideSteve(), P1, MOCKINGBIRD);
    const [mockingbird] = given.ids as [InstanceId];

    const price = playCostOf(given.state, P1, mockingbird, WAVE1_DEPS);
    expect(price).toMatchObject({ printed: 3, current: 2, reduction: 0 });
    expect(price?.contributions).toHaveLength(1);
    const [contribution] = price!.contributions as [{ sourceInstanceId: InstanceId; delta: number }];
    expect(contribution.delta).toBe(-1);
    // Attributed to the *other* seat's identity card. Which of its two faces to name is the client's call
    // (`@mc/client`'s `faceUpName` says "Steve Rogers", since Living Legend is printed on the alter-ego side);
    // the engine's job is only to say which card did it.
    expect(contribution.sourceInstanceId).toBe(playerOf(given.state, "p2" as never).identity.instanceId);
  });

  it("leaves a card nothing is modifying alone: no contributions, and current equals printed", () => {
    const given = moveToHand(spiderManBesideSteve(), P1, FIRST_AID);
    const [firstAid] = given.ids as [InstanceId];
    expect(playCostOf(given.state, P1, firstAid, WAVE1_DEPS)).toEqual({ printed: 1, current: 1, contributions: [], reduction: 0 });
  });

  it("is null for a card with no printed cost at all", () => {
    // Energy (01088), a resource card: it is spent, never played, so there is no price to quote.
    const given = moveToHand(spiderManBesideSteve(), P1, "01088");
    const [resource] = given.ids as [InstanceId];
    expect(playCostOf(given.state, P1, resource, WAVE1_DEPS)).toBeNull();
  });
});
