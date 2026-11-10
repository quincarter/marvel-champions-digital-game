/**
 * The team-up pairs with a trophy (#615): one row per pair in `art/teamups/`, so winning with the two of them seated
 * together earns the trophy (`achievements.ts`) and opens the pair's picture in Extras ▸ Artwork (`extras.ts`).
 *
 * A module of its own because those two import each other, and both read this table as they load.
 */
export interface TeamUpTrophy {
  /** The pair's folder under `art/teamups/` (`art/team-up-art.ts`), which names a hero's alter ego where the card does. */
  readonly slug: string;
  readonly heroes: readonly [string, string];
  readonly name: string;
}

export const TEAM_UP_TROPHIES: readonly TeamUpTrophy[] = [
  { slug: "angel-psylocke", heroes: ["Angel", "Psylocke"], name: "Wings and Blades" },
  { slug: "ant-man-wasp", heroes: ["Ant-Man", "Wasp"], name: "Small Talk" },
  {
    slug: "black-panther-shuri-black-panther-t-challa",
    heroes: ["Black Panther (T'Challa)", "Black Panther (Shuri)"],
    name: "Two Panthers, One Throne",
  },
  { slug: "black-widow-winter-soldier", heroes: ["Black Widow", "Winter Soldier"], name: "Cold War Sweethearts" },
  { slug: "cable-deadpool", heroes: ["Cable", "Deadpool"], name: "Worst Roommates in Any Timeline" },
  {
    slug: "captain-america-winter-soldier",
    heroes: ["Captain America", "Winter Soldier"],
    name: "Till the End of the Line",
  },
  { slug: "cindy-moon-peter-parker", heroes: ["Spider-Man (Peter Parker)", "Silk"], name: "Bitten by the Same Spider" },
  { slug: "colossus-shadowcat", heroes: ["Colossus", "Shadowcat"], name: "Through Walls, Two Ways" },
  { slug: "colossus-wolverine", heroes: ["Colossus", "Wolverine"], name: "Fastball Special" },
  { slug: "cyclops-phoenix", heroes: ["Cyclops", "Phoenix"], name: "Summers Vacation" },
  { slug: "daredevil-echo", heroes: ["Daredevil", "Echo"], name: "Hell's Kitchen Patrol" },
  { slug: "gambit-rogue", heroes: ["Gambit", "Rogue"], name: "Hands Off, Chère" },
  { slug: "gamora-nebula", heroes: ["Gamora", "Nebula"], name: "Sisters, Eventually" },
  { slug: "groot-rocket-raccoon", heroes: ["Groot", "Rocket Raccoon"], name: "We Are Groot" },
  {
    slug: "gwen-stacy-miles-morales",
    heroes: ["Ghost-Spider", "Spider-Man (Miles Morales)"],
    name: "Different Earths, Same Web",
  },
  { slug: "hercules-thor", heroes: ["Hercules", "Thor"], name: "Olympus Meets Asgard" },
  { slug: "iron-man-war-machine", heroes: ["Iron Man", "War Machine"], name: "Two Suits, One Tab" },
  { slug: "jubilee-wolverine", heroes: ["Jubilee", "Wolverine"], name: "Mall Rat and the Old Man" },
  { slug: "maria-hill-nick-fury", heroes: ["Maria Hill", "Nick Fury"], name: "Director's Cut" },
  { slug: "phoenix-storm", heroes: ["Phoenix", "Storm"], name: "Omega-Level Girls' Night" },
  { slug: "quicksilver-scarlet-witch", heroes: ["Quicksilver", "Scarlet Witch"], name: "Twin Trouble" },
];

/** The trophy's id, which its Extras picture opens with. */
export const teamUpTrophyId = (trophy: TeamUpTrophy): string => `teamup-${trophy.slug}`;

/** "Thor and She-Hulk". */
export const teamUpPairLabel = (trophy: TeamUpTrophy): string => trophy.heroes.join(" and ");
