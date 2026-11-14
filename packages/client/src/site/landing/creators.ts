/**
 * The people behind the store's packs, once each. A pack's `creator` is free text: one name ("Neptune"), a name with
 * a handle ("Neptune (Typhon00)"), or a team with roles ("DesignHacker & BlueHG (nemesis set)"). Each is split into
 * its people, a trailing parenthetical is dropped, and names that match ignoring case count once, spelled as first met.
 */
export function creatorsOf(credits: readonly string[]): string[] {
  const seen = new Map<string, string>();
  for (const credit of credits) {
    for (const part of credit.split(/\s*(?:&|,|\band\b|\by\b)\s*/i)) {
      const name = part.replace(/\s*\([^)]*\)\s*$/, "").trim();
      if (name === "") continue;
      const key = name.toLowerCase();
      if (!seen.has(key)) seen.set(key, name);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}
