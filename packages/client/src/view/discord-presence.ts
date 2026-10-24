/**
 * What the game tells Discord it is doing (Rich Presence, desktop app only): a pure model from a small snapshot of the
 * app's state to the activity the Rust side sets (`discord_set_activity`). The snapshot is gathered by
 * `platform/discord-presence.ts` from the scene manager and the session store; nothing here reads either, so the
 * wording is tested without a canvas or an engine.
 *
 * Text style: `details` is the headline ("One-off game · Spider-Man vs Rhino", "Campaign · The Mad Titan's Shadow ·
 * vs Thanos", "In the menus"), `state` the second line ("Round 3 · Hero form · Expert", "Villain phase", "Building a
 * deck"). Discord shows strings of 2 to 128 characters, so every string is clipped here, never cut by the Rust side.
 */

/** The shape `discord_set_activity` takes (camelCase), a mirror of the Rust `DiscordActivity`. */
export interface DiscordActivity {
  readonly details?: string;
  readonly state?: string;
  /** Unix seconds: Discord shows the time elapsed since. */
  readonly startTimestamp?: number;
  readonly largeImage?: string;
  readonly largeText?: string;
  readonly smallImage?: string;
  readonly smallText?: string;
  readonly buttons?: readonly { readonly label: string; readonly url: string }[];
}

/** Where the deployed site (which carries every card scan under `/card-art/`) lives. */
export const PRESENCE_SITE_URL = "https://marvel-champions-digital-game.netlify.app";
/** The page "Get the game" opens: the latest GitHub release carries every installer. */
export const PRESENCE_DOWNLOAD_URL = "https://github.com/quincarter/marvel-champions-digital-game/releases/latest";
/** The asset key of the game's logo in the Discord application's Rich Presence art. */
export const PRESENCE_LOGO_KEY = "logo";
export const PRESENCE_APP_NAME = "Marvel Champions Digital Edition";

const MAX_TEXT = 128;
const MAX_LABEL = 32;
const SEPARATOR = " · ";

/** Which screen family the app is on. */
export type PresenceScreen = "menus" | "deck" | "setup" | "campaign" | "game" | "gameOver";

export interface PresenceGame {
  /** "campaign" when the game is one scenario of a campaign run. */
  readonly kind: "oneOff" | "campaign";
  /** The campaign box ("The Mad Titan's Shadow"), for a campaign game. */
  readonly campaignName?: string | null;
  /** Every seat's name, the first seat leading: "Spider-Man", "Black Panther". */
  readonly heroes: readonly string[];
  /** The lead hero's form, for a one-hero table only (a multi-hero table has several). */
  readonly form?: "hero" | "alterEgo" | null;
  readonly villain: string | null;
  /** "Stage II" or "Side A": what follows the villain's name in the picture's caption. */
  readonly villainStage?: string | null;
  readonly round: number;
  /** "player" and "villain" are the two phases of a round; "setup" is everything before round 1's player phase. */
  readonly phase: "setup" | "player" | "villain";
  /** "Standard", "Expert", "Heroic 2". */
  readonly difficulty?: string | null;
  /** How it ended, on Game over. */
  readonly result?: "win" | "loss" | "conceded" | null;
  /** Card art by address in the app (`/card-art/...`) or an absolute URL. */
  readonly villainArt?: string | null;
  readonly heroArt?: string | null;
}

export interface PresenceSnapshot {
  readonly screen: PresenceScreen;
  /** Unix seconds the current game, or the current spell in the menus, began. */
  readonly startedAt: number;
  /** The campaign box the campaign screens are in, when known. */
  readonly campaignName?: string | null;
  readonly game?: PresenceGame | null;
}

/** `text` cut to `max` characters (whole code points) with an ellipsis. */
export function clipText(text: string, max = MAX_TEXT): string {
  const points = [...text.trim()];
  if (points.length <= max) return points.join("");
  return `${points
    .slice(0, max - 1)
    .join("")
    .trimEnd()}…`;
}

/** Discord rejects a string under 2 characters; absent is better than refused. */
const text = (value: string | null | undefined, max = MAX_TEXT): string | undefined => {
  const clipped = clipText(value ?? "", max);
  return [...clipped].length >= 2 ? clipped : undefined;
};

/** "Spider-Man", "Spider-Man +2": the lead hero and how many sit beside them. */
export function heroesLabel(heroes: readonly string[]): string {
  const [lead, ...rest] = heroes;
  if (lead === undefined) return "";
  return rest.length === 0 ? lead : `${lead} +${rest.length}`;
}

/** An address in the app's card art as the public URL Discord can fetch, or null when there is none. */
export function publicArtUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${PRESENCE_SITE_URL}${url}`;
  return null;
}

const join = (...parts: readonly (string | null | undefined | false)[]): string =>
  parts.filter((part): part is string => typeof part === "string" && part !== "").join(SEPARATOR);

const PHASE_WORDS = { setup: "Setting up the table", player: null, villain: "Villain phase" } as const;

function gameDetails(game: PresenceGame): string {
  const hero = heroesLabel(game.heroes);
  const versus = game.villain ? `vs ${game.villain}` : "";
  if (game.kind === "campaign") return join("Campaign", game.campaignName, versus);
  return join("One-off game", hero && game.villain ? `${hero} vs ${game.villain}` : hero || versus);
}

function gameState(game: PresenceGame): string {
  const plural = (n: number): string => `${n} round${n === 1 ? "" : "s"}`;
  if (game.result === "win") return game.villain ? `Won against ${game.villain} in ${plural(game.round)}` : "Won";
  if (game.result === "loss") return game.villain ? `Lost to ${game.villain}` : "Lost";
  if (game.result === "conceded") return game.villain ? `Conceded against ${game.villain}` : "Conceded";
  if (game.phase === "setup") return join(PHASE_WORDS.setup, game.difficulty);
  const phase =
    game.phase === "villain"
      ? PHASE_WORDS.villain
      : game.heroes.length === 1 && game.form
        ? game.form === "hero"
          ? "Hero form"
          : "Alter-ego form"
        : null;
  return join(`Round ${Math.max(1, game.round)}`, phase, game.difficulty);
}

const MENU_STATES: Readonly<Record<Exclude<PresenceScreen, "game" | "gameOver" | "campaign">, string | undefined>> = {
  menus: undefined,
  deck: "Building a deck",
  setup: "Setting up a game",
};

/** The activity for a snapshot, or null when there is nothing to show. */
export function presenceOf(snapshot: PresenceSnapshot | null): DiscordActivity | null {
  if (snapshot === null) return null;
  const base = {
    startTimestamp: snapshot.startedAt,
    buttons: [{ label: clipText("Get the game", MAX_LABEL), url: PRESENCE_DOWNLOAD_URL }],
  };
  const logo = { largeImage: PRESENCE_LOGO_KEY, largeText: PRESENCE_APP_NAME };
  const { game } = snapshot;
  if ((snapshot.screen === "game" || snapshot.screen === "gameOver") && game) {
    const villainArt = publicArtUrl(game.villainArt);
    const heroArt = publicArtUrl(game.heroArt);
    const caption = join(game.villain, game.villainStage);
    const heroes = heroesLabel(game.heroes);
    return withoutUndefined({
      ...base,
      details: text(gameDetails(game)),
      state: text(gameState(game)),
      largeImage: villainArt ?? PRESENCE_LOGO_KEY,
      largeText: text(villainArt ? caption : PRESENCE_APP_NAME),
      // The hero's face rides in the corner only beside the villain's; alone it is the big picture.
      ...(heroArt && villainArt ? { smallImage: heroArt, smallText: text(heroes) } : {}),
      ...(heroArt && !villainArt ? { largeImage: heroArt, largeText: text(heroes) } : {}),
    });
  }
  if (snapshot.screen === "campaign") {
    return withoutUndefined({
      ...base,
      ...logo,
      details: text(join("Campaign", snapshot.campaignName)),
      state: "Between missions",
    });
  }
  const screen = snapshot.screen === "menus" || snapshot.screen === "deck" || snapshot.screen === "setup";
  return withoutUndefined({
    ...base,
    ...logo,
    details: "In the menus",
    state: screen ? MENU_STATES[snapshot.screen as keyof typeof MENU_STATES] : undefined,
  });
}

function withoutUndefined(activity: {
  readonly [K in keyof DiscordActivity]?: DiscordActivity[K] | undefined;
}): DiscordActivity {
  return Object.fromEntries(Object.entries(activity).filter(([, value]) => value !== undefined)) as DiscordActivity;
}

/** The activity as a comparison key: equal keys need no new `discord_set_activity`. A new game starts a new timestamp. */
export function presenceKey(activity: DiscordActivity | null): string {
  return activity === null ? "" : JSON.stringify(activity);
}
