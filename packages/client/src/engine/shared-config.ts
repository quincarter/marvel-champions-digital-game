/**
 * A setup as it may leave this machine (a shared replay file, an issue report): without the seats' `deckName`, which
 * a player types and which is only for their own Past games and Decks screens. The `deckId` stays, as before.
 * Anything that is not a setup with a `players` list comes back unchanged.
 */
export function withoutDeckNames<T>(config: T): T {
  if (typeof config !== "object" || config === null) return config;
  const players = (config as { players?: unknown }).players;
  if (!Array.isArray(players)) return config;
  const cleaned = players.map((player: unknown) => {
    if (typeof player !== "object" || player === null || !("deckName" in player)) return player;
    const { deckName: _deckName, ...rest } = player as Record<string, unknown>;
    return rest;
  });
  return { ...config, players: cleaned };
}
