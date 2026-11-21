## Smash the Crash

The Windows app opens again: once Windows updated WebView2 to version 158, v0.51.0 crashed on start with "Can't open this page" (STATUS_BREAKPOINT), and this release fixes it, with a safety net that skips a background painter if it ever takes the page down (#932, #936), and if the page does crash, the app reloads it by itself and then tries a safe mode (#945). Install for Steam no longer stops on PCs whose registry keeps the game's folder in quotes (#933, #934), both reported by Dreadheart on Discord. Your stats has a new Overview that stands your favorite hero's art tall on a wide screen, with a faded wallpaper behind every tab (#926, #929). From @bluefireF5ran's play notes in #911: stats records open the game they came from, Past games has a search box and aspect chips, Take your seats has a Random hero, the aspect info tip waits for the mouse to rest, and eleven cards that choose a player to hit their engaged minions now offer only players who have one, with Hunting Down Heroes and Maria Hill's Reassignment asking clearer questions (#914, #916, #917). Cards tucked under Falcon's Resource Reserve can now be spent when you pay, also from @bluefireF5ran's report (#922, #927). On iPhone and iPad, tapping a text field no longer zooms the page in, thanks to GarethMagis (#939, #940). The website's download stats now count iPhone and iPad downloads (#941, #942). Thank you for playing!

**[Read the full v0.52.0 report on the site ↗](https://champions-digital-game.com/releases/v0.52.0/)**: the Windows crash and its fix, the new stats Overview, records that open their game, Past games search, the Random hero, the choose-a-player cards, Hunting Down Heroes, Maria Hill, Install for Steam and the thank-you wall.

**[Lee el informe completo en español ↗](https://champions-digital-game.com/releases/v0.52.0/index.es.html)**

![The numbers: 11 cards that choose smarter, 9 changes from one report and 2 Windows fixes](https://raw.githubusercontent.com/quincarter/marvel-champions-digital-game/c32b8f11487ae1ec0c141c93f940979676d6b036/docs/screenshots/releases/v0.52.0/v0-52-0-release-01-the-numbers.jpg)

![The Windows app opens again: what caused the WebView2 158 crash, the safety net, reloading a crashed page and safe mode, and how to update](https://raw.githubusercontent.com/quincarter/marvel-champions-digital-game/c32b8f11487ae1ec0c141c93f940979676d6b036/docs/screenshots/releases/v0.52.0/v0-52-0-release-02-the-windows-app-opens-again.jpg)

![Your stats, with a hero: the new Overview on desktop and iPhone SE, records with View game, and Past games search and aspect chips](https://raw.githubusercontent.com/quincarter/marvel-champions-digital-game/c32b8f11487ae1ec0c141c93f940979676d6b036/docs/screenshots/releases/v0.52.0/v0-52-0-release-03-your-stats-with-a-hero.jpg)

![A Random hero: Take your seats' Random button and the deck builder's aspect tip delay](https://raw.githubusercontent.com/quincarter/marvel-champions-digital-game/c32b8f11487ae1ec0c141c93f940979676d6b036/docs/screenshots/releases/v0.52.0/v0-52-0-release-04-a-random-hero.jpg)

![You asked, we fixed: the choose-a-player cards with each player's engaged minions, Hunting Down Heroes, Maria Hill's Reassignment, Install for Steam, tucked cards that pay, no more zoom on iPhone and Symbiotic Bond](https://raw.githubusercontent.com/quincarter/marvel-champions-digital-game/c32b8f11487ae1ec0c141c93f940979676d6b036/docs/screenshots/releases/v0.52.0/v0-52-0-release-05-you-asked-we-fixed.jpg)

![Also in v0.52.0: the Mod SDK's hand-discard Response, iOS on the download stats page, the README and this report](https://raw.githubusercontent.com/quincarter/marvel-champions-digital-game/c32b8f11487ae1ec0c141c93f940979676d6b036/docs/screenshots/releases/v0.52.0/v0-52-0-release-06-also-in-v0-52-0.jpg)

![Thank you to @bluefireF5ran, Dreadheart and GarethMagis](https://raw.githubusercontent.com/quincarter/marvel-champions-digital-game/c32b8f11487ae1ec0c141c93f940979676d6b036/docs/screenshots/releases/v0.52.0/v0-52-0-release-07-thank-you.jpg)

![Code shipped since v0.51.0: 13 pull requests, 169 files, 6,283 lines added and 238 removed](https://raw.githubusercontent.com/quincarter/marvel-champions-digital-game/c32b8f11487ae1ec0c141c93f940979676d6b036/docs/screenshots/releases/v0.52.0/v0-52-0-release-08-code-shipped.jpg)
