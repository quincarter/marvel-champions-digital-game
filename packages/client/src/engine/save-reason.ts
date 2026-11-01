/**
 * What a command's save means to device sync: "round" when it ended a round or the game, so the other devices should
 * hear soon, and "game" for any other command, which waits for one of those.
 */
export function saveReason(snapshot: {
  readonly state: { readonly outcome?: unknown };
  readonly events: readonly { readonly type: string }[];
}): "game" | "round" {
  const over = Boolean(snapshot.state.outcome) || snapshot.events.some((event) => event.type === "roundStarted");
  return over ? "round" : "game";
}
