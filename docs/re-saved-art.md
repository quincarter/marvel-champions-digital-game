# Re-saved art

Pictures re-encoded on 2026-10-24 because the Linux app drew them blank. Each was a WebP carrying a colour profile or
metadata chunks (ICCP, EXIF, XMP), which WebKitGTK's `createImageBitmap` in the card-face worker appears to fail on.
They were converted to sRGB and saved again as plain WebP at quality 90, so each has lost a little quality to a second
lossy encode. `packages/client/src/art/webp-chunks.test.ts` keeps new art from carrying those chunks.

Any of these can be replaced by a fresh scan or a better source: send it in the PR thread and it will be converted
(sRGB, no metadata) and dropped in at the same path.

## campaigns

- `art/campaigns/aos/cover.webp`
- `art/campaigns/gmw/artboards/badoon-squad.webp`
- `art/campaigns/gmw/artboards/knowhere-shop.webp`
- `art/campaigns/trors/artboards/heroes-drop-in.webp`
- `art/campaigns/trors/artboards/hydra-convoy.webp`
- `art/campaigns/trors/artboards/hydra-manhattan.webp`
- `art/campaigns/trors/artboards/mountain-facility.webp`
- `art/campaigns/trors/artboards/pegasus-wrecked.webp`
- `art/campaigns/trors/artboards/skull-citadel.webp`
- `art/campaigns/trors/artboards/zola-lab.webp`

## heroes

- `art/heroes/04031a-spider-woman/hero.webp`
- `art/heroes/06001a-thor/hero.webp`
- `art/heroes/10001a-hulk/hero.webp`
- `art/heroes/17001a-star-lord/hero.webp`
- `art/heroes/21031a-adam-warlock/hero.webp`
- `art/heroes/46001a-iceman/hero.webp`
- `art/heroes/49001a-magneto/hero.webp`
- `art/heroes/50001a-maria-hill/hero.webp`
- `art/heroes/50034a-nick-fury/hero.webp`

## scenarios

- `art/scenarios/apocalypse/villain.webp`
- `art/scenarios/baron-zemo/villain.webp`
- `art/scenarios/batroc/villain.webp`
- `art/scenarios/dark-beast/villain.webp`
- `art/scenarios/ebony-maw/villain.webp`
- `art/scenarios/enchantress/villain-wins.webp`
- `art/scenarios/enchantress/villain.webp`
- `art/scenarios/escape-the-museum/villain.webp`
- `art/scenarios/four-horsemen/villain.webp`
- `art/scenarios/hela/villain.webp`
- `art/scenarios/loki/villain.webp`
- `art/scenarios/nebula/villain.webp`
- `art/scenarios/sabretooth/villain-loses.webp`
- `art/scenarios/sandman/villain.webp`
- `art/scenarios/sinister-six/villain-loses.webp`
- `art/scenarios/sinister-six/villain-wins.webp`
- `art/scenarios/sinister-six/villain.webp`
- `art/scenarios/thanos/villain.webp`
- `art/scenarios/the-hood/villain.webp`
- `art/scenarios/thunderbolts/intro.webp`
- `art/scenarios/thunderbolts/villain.webp`
- `art/scenarios/tower-defense/villain.webp`
- `art/scenarios/venom/villain.webp`

## teamups

- `art/teamups/black-panther-shuri-black-panther-t-challa/splash.webp`
- `art/teamups/black-widow-winter-soldier/splash.webp`
- `art/teamups/cindy-moon-peter-parker/splash.webp`
- `art/teamups/colossus-wolverine/badge.webp`
- `art/teamups/cyclops-phoenix/badge.webp`
- `art/teamups/gambit-rogue/badge.webp`
- `art/teamups/groot-rocket-raccoon/badge.webp`
- `art/teamups/phoenix-storm/badge.webp`

## title

- `art/title/spider-verse-team.webp`
