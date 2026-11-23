/** A fake page address for the address tests: `replaceState` rewrites `search` and `hash` the way a browser does. */
export function fakePage(url = "/play/") {
  const parsed = new URL(url, "https://game.example");
  const location = { hash: parsed.hash, pathname: parsed.pathname, search: parsed.search };
  const log: string[] = [];
  const history = {
    state: null as unknown,
    replaceState(_state: unknown, _unused: string, target?: string | URL | null) {
      const next = new URL(String(target), "https://game.example");
      log.push(`${next.pathname}${next.search}${next.hash}`);
      location.pathname = next.pathname;
      location.search = next.search;
      location.hash = next.hash;
    },
  };
  return { location, history, log, url: () => `${location.pathname}${location.search}${location.hash}` };
}
