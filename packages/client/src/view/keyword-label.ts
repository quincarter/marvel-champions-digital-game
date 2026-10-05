import type { KeywordInstance } from "@mc/content";

/** A keyword with the value it was printed with: "Retaliate 1", never a bare "Retaliate". */
export function keywordLabel(keyword: KeywordInstance): string {
  // "teamUp" is printed "Team-Up"; the union's other names are single words.
  const pretty = keyword.name.replace(/([A-Z])/g, " $1");
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
