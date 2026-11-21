import type { KeywordInstance } from "@mc/content";

/**
 * The keyword's name, or null when the data is not a keyword. A pack's ability once granted the bare string `"guard"`
 * where a `KeywordInstance` belongs (#943), and reading `.name` of it threw in the middle of drawing a decision; a
 * string is read as the name it spells, anything else as no keyword.
 */
export function keywordNameOf(keyword: unknown): string | null {
  if (typeof keyword === "string") return keyword === "" ? null : keyword;
  if (typeof keyword !== "object" || keyword === null) return null;
  const name = (keyword as { name?: unknown }).name;
  return typeof name === "string" && name !== "" ? name : null;
}

/** A keyword with the value it was printed with: "Retaliate 1", never a bare "Retaliate". */
export function keywordLabel(keyword: KeywordInstance): string {
  const name = keywordNameOf(keyword);
  if (name === null) return "Keyword";
  // "teamUp" is printed "Team-Up"; the union's other names are single words.
  const pretty = name.replace(/([A-Z])/g, " $1");
  // A bare name (bad pack data) has no value to print.
  if (typeof keyword !== "object") return pretty;
  switch (keyword.name) {
    case "retaliate":
    case "incite":
    case "hinder":
    case "victory":
      return `${pretty} ${keyword.value}`;
    case "uses":
      return `${pretty} ${keyword.count} ${keyword.counterType}`;
    case "find":
      return keyword.count === undefined ? pretty : `${pretty} ${keyword.count}`;
    case "requirement":
      return `${pretty} ${keyword.icon}`;
    case "teamwork":
      return `${pretty} ${keyword.sharedTrait as string}`;
    case "discount":
      return keyword.value === undefined ? pretty : `${pretty} ${keyword.value}`;
    default:
      return pretty;
  }
}
