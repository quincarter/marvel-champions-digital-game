/**
 * The one-game feats (#909, docs/multiplayer-achievements-plan.md, family `feats`). Definitions use `multiplayerDef`
 * from `room-seats.ts`; `achievements.ts` concatenates this list into `ACHIEVEMENTS`.
 *
 * Every feat reads the finished games that count (`facts.rows`), for the seats this device held: a game played alone
 * has every seat mine, a room game only its own. A counter missing from an older summary earns nothing.
 */
import { multiplayerDef, type GameRow, type MultiplayerDef } from "./room-seats.js";

type Summary = NonNullable<GameRow["summary"]>;
type SeatFeats = NonNullable<Summary["feats"]>[string];
type SeatBoosts = NonNullable<Summary["boosts"]>["seats"][string];

/** My seats' feat counters in a row; empty when the summary has none (an older save). */
const featsOf = (row: GameRow): readonly SeatFeats[] => {
  const feats = row.summary?.feats;
  if (!feats) return [];
  return row.mySeats.flatMap((seat) => {
    const found = feats[seat as string];
    return found ? [found] : [];
  });
};

const boostsOf = (row: GameRow): readonly SeatBoosts[] => {
  const seats = row.summary?.boosts?.seats;
  if (!seats) return [];
  return row.mySeats.flatMap((seat) => {
    const found = seats[seat as string];
    return found ? [found] : [];
  });
};

const mySeatIds = (row: GameRow): ReadonlySet<string> => new Set<string>(row.mySeats as readonly string[]);

const myWinners = (row: GameRow) =>
  (row.summary?.endState?.winners ?? []).filter((w) => mySeatIds(row).has(w.playerId));

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);
const best = (values: readonly number[]): number => values.reduce((a, b) => Math.max(a, b), 0);

/** A one-time feat: earned when any counted game passes `test`. */
const feat = (
  id: string,
  name: string,
  description: string,
  points: number,
  test: (row: GameRow) => boolean,
  extra: { readonly rewardPackId?: string; readonly family?: "funny" } = {},
): MultiplayerDef =>
  multiplayerDef({
    id,
    name,
    description,
    family: "feats",
    points,
    ...extra,
    measure: (facts) => ({ current: facts.rows.some(test) ? 1 : 0, target: 1 }),
  });

/** A feat that needs a win as well. */
const wonWith =
  (test: (row: GameRow) => boolean) =>
  (row: GameRow): boolean =>
    row.won && test(row);

export const FEATS_ACHIEVEMENTS: readonly MultiplayerDef[] = [
  feat(
    "feat-full-health",
    "Not a Scratch",
    "Win with one of your heroes at full hit points.",
    100,
    wonWith((row) => myWinners(row).some((w) => w.hitPoints !== null && w.hitPoints === w.maxHitPoints)),
  ),
  feat(
    "feat-over-printed-hp",
    "Plenty to Spare",
    "Win with one of your heroes above the hit points printed on its card.",
    100,
    wonWith((row) => myWinners(row).some((w) => w.hitPoints !== null && w.hitPoints > w.printedHitPoints)),
  ),
  feat(
    "feat-surrounded",
    "Surrounded",
    "Have 3 or more minions engaged with one of your heroes at once.",
    50,
    (row) => best(featsOf(row).map((f) => f.maxEngagedMinions)) >= 3,
  ),
  feat(
    "feat-clean-sweep",
    "Clean Sweep",
    "Win with no minions left in play.",
    50,
    wonWith((row) => row.summary?.endState?.minionsInPlayAtEnd === 0),
  ),
  feat(
    "feat-case-closed",
    "Case Closed",
    "Win with no side schemes left in play.",
    50,
    wonWith((row) => row.summary?.endState?.sideSchemesInPlayAtEnd === 0),
  ),
  feat(
    "feat-overkill-5",
    "Overkill",
    "Deal 5 or more damage beyond what an enemy had left in one hit.",
    100,
    (row) => best(featsOf(row).map((f) => f.maxExcess)) >= 5,
  ),
  feat(
    "feat-minions-8",
    "Bloodthirsty",
    "Defeat 8 or more minions in one game.",
    100,
    (row) => sum(featsOf(row).map((f) => f.minionsDefeated)) >= 8,
  ),
  feat(
    "feat-trophy-case",
    "Trophy Case",
    "Finish a game with 3 or more cards in the victory display.",
    100,
    (row) => (row.summary?.endState?.victoryDisplayCount ?? 0) >= 3,
  ),
  feat(
    "chain-reaction",
    "Chain Reaction",
    "Reveal 3 encounter cards in a row, each one surging into the next.",
    0,
    (row) => best(featsOf(row).map((f) => f.maxSurgeChain)) >= 3,
    { rewardPackId: "pack-chain-reaction", family: "funny" },
  ),
  feat(
    "feat-deck-reset-2",
    "Deck Goes Brrr",
    "Run your deck out and reset it twice in one game.",
    50,
    (row) => best(featsOf(row).map((f) => f.deckResets)) >= 2,
  ),
  feat(
    "feat-stun-defeat",
    "Stop, Drop and Punch",
    "Stun a minion and defeat it in the same turn.",
    50,
    (row) => sum(featsOf(row).map((f) => f.stunDefeats)) >= 1,
  ),
  feat(
    "feat-pacifist",
    "Pacifist",
    "Win without your heroes defeating a single minion.",
    150,
    wonWith((row) => {
      const feats = featsOf(row);
      return feats.length > 0 && sum(feats.map((f) => f.minionsDefeated)) === 0;
    }),
  ),
  feat(
    "feat-big-spender",
    "Big Spender",
    "Pay 6 or more resources for one card.",
    50,
    (row) => best(featsOf(row).map((f) => f.maxPaidForOneCard)) >= 6,
  ),
  feat(
    "feat-full-supports",
    "Saving It for Later",
    "Win with 2 or more of your supports still holding all their uses.",
    100,
    wonWith((row) => {
      const mine = mySeatIds(row);
      const seats = (row.summary?.endState?.seats ?? []).filter((s) => mine.has(s.playerId));
      return sum(seats.map((s) => s.fullUsesSupports)) >= 2;
    }),
  ),
  feat(
    "feat-ally-final-blow",
    "Giant Slayer",
    "Win with an ally dealing the villain's last damage.",
    100,
    wonWith((row) => {
      const summary = row.summary;
      const blow = summary?.finalBlowCardId;
      if (!summary || !blow) return false;
      // An ally's card id is a key of its seat's `allyDamage`: the ally dealt the blow, so it dealt damage.
      const seats = summary.seats ?? [];
      const mineBy = row.mySeatIndexes.some((i) => seats[i]?.identityCardId === summary.finalBlowBy);
      return mineBy && row.mySeatIndexes.some((i) => (seats[i]?.allyDamage?.[blow] ?? 0) > 0);
    }),
  ),
  feat(
    "feat-tough-as-nails",
    "Tough as Nails",
    "Win without any of your heroes dropping below half their hit points.",
    150,
    wonWith((row) => {
      const feats = featsOf(row);
      return feats.length > 0 && feats.every((f) => !f.fellBelowHalf);
    }),
  ),
  feat(
    "feat-villain-phase-win",
    "Come at Me, Bro",
    "Win during the villain phase.",
    100,
    wonWith((row) => row.summary?.endState?.endPhase === "villain"),
  ),
  feat(
    "feat-lucky-charm",
    "Lucky Charm",
    "Have 3 attacks in a row against you where every boost card is blank.",
    50,
    (row) => best(boostsOf(row).map((b) => b.luckyStreakMax)) >= 3,
  ),
  feat(
    "cursed-boosts",
    "Cursed",
    "Have 2 or more boost cards with 3 or more icons turn up against you in one game.",
    0,
    (row) => sum(boostsOf(row).map((b) => b.bigBoosts)) >= 2,
    { rewardPackId: "pack-cursed", family: "funny" },
  ),
  feat("feat-own-obligation", "Not Today, Life", "Remove your own hero's obligation from the game.", 50, (row) =>
    featsOf(row).some((f) => f.ownObligationRemoved),
  ),
];
