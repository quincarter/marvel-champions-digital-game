/**
 * Side stories: short comics apart from the campaign issues, each earned in the Trophy Room and read on the Extras
 * screen's Side Stories shelf (`progression/extras.ts`). The pages are `art/side-stories/<id>/` (`art/side-stories-art.ts`);
 * this table says what each story is called, what opens it and whose work it is. Marvel owns the comics; the lines are
 * the bibliography the Extras viewer shows beside the pages, and `content/credits.ts` carries the same credit.
 */
export interface SideStory {
  /** The folder under `art/side-stories/`. */
  readonly id: string;
  readonly title: string;
  /** The small line under the title on the shelf. */
  readonly subtitle: string;
  /** The Trophy Room achievement (`progression/achievements.ts`) that opens it. */
  readonly achievementId: string;
  /** The bibliography, shown beside the pages. */
  readonly lines: readonly string[];
}

export const SIDE_STORIES: readonly SideStory[] = [
  {
    id: "thor-she-hulk-badlands-date",
    title: "Worthy of a Second Date?",
    subtitle: "Thor and She-Hulk · Avengers (2018) #11",
    achievementId: "worthy-of-a-second-date",
    lines: [
      "Thor takes Jennifer Walters on a date to the Badlands. It goes horribly wrong.",
      "Pages 6, 11, 16 and 17 of Avengers (2018) #11, Marvel Comics, December 2018 (cover-dated January 2019).",
      "Written by Jason Aaron. Pencils by Cory Smith, Ed McGuinness and Karl Kesel. Cover by Ed McGuinness.",
      "© Marvel. marvel.com/comics/issue/67768/avengers_2018_11",
    ],
  },
];
