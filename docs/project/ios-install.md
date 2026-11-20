# Install the game on an iPhone or iPad

[README](../../README.md) · [Downloads](downloads.md) · [En español](ios-install.es.md)

The game isn't on the App Store. Every release has an iPhone and iPad app you install yourself, which Apple calls
**sideloading**: a free app signs it with your own Apple ID, and your iPhone then runs it like any other app. It is
free, it needs no jailbreak, and it takes about 15 minutes the first time.

If you'd rather not, the game also plays in Safari: open the game's site and add it to your Home Screen from the Share
menu.

## Before you start

- **The download.** On the [latest release](https://github.com/quincarter/marvel-champions-digital-game/releases/latest),
  the iPhone and iPad app is `MarvelChampions-<version>-EN-iOS-unsigned.ipa` (Spanish cards: `-ES-`). It is about
  1.3 GB, so use Wi-Fi, and keep about 4 GB free on the device while it installs.
- **An Apple ID.** Your normal one works. Some players make a second, free Apple ID just for sideloading; either is
  fine. Your password goes only to Apple, through the tool you pick below.
- **iOS 16 or later** needs Developer Mode turned on once (step-by-step below). iOS 15 doesn't have it.

### What a free Apple ID allows

Apple limits apps signed with a free Apple ID:

- **They stop opening after 7 days** unless you refresh them. Refreshing takes a tap (or happens on its own) and
  **keeps your saves**. If one expires, refresh it and it opens again with everything as you left it. Don't delete the
  app: deleting it deletes its saves.
- **Three apps at a time.** At most three sideloaded apps can be active on a device, and SideStore or AltStore counts
  as one of the three.

A paid Apple Developer account removes both limits; see [With a paid developer account](#with-a-paid-developer-account).

## Which way should I pick?

| Way                             | What you need                         | Refreshing every 7 days                                                 |
| ------------------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| [SideStore](#sidestore)         | A computer once, for setup            | On the iPhone itself, no computer                                       |
| [AltStore](#altstore)           | A Windows PC or Mac on the same Wi-Fi | Automatic while the computer is on, or a tap with it on                 |
| [Sideloadly](#sideloadly)       | A Windows PC or Mac and a cable       | Install again from the computer (or its auto-refresh)                   |
| [Scarlet](#scarlet-no-computer) | Only the iPhone                       | None, but it can stop working for a while ([why](#scarlet-no-computer)) |

**Most players: SideStore.** After a one-time setup on a computer, everything happens on the iPhone. If the setup
gives you trouble, AltStore or Sideloadly are simpler but need your computer every week.

**No computer at all?** [Scarlet](#scarlet-no-computer) installs the game from Safari on the iPhone, with a catch: read
its section before you pick it.

## Turn on Developer Mode (iOS 16 and later)

Do this right after you install your first sideloaded app (SideStore, AltStore, or the game through Sideloadly). The
switch only appears once one is on the device.

1. Open **Settings → Privacy & Security**, scroll to the bottom and tap **Developer Mode**.
2. Turn it on and tap **Restart**.
3. After the restart, tap **Turn On** when asked, and enter your passcode.

## Trust your Apple ID's apps

The first time an app signed with your Apple ID opens, iOS says "Untrusted Developer". Once:

1. Open **Settings → General → VPN & Device Management**.
2. Under **Developer App**, tap your Apple ID's email address.
3. Tap **Trust "<your email>"**, then **Trust** again.

## SideStore

SideStore installs and refreshes apps on the iPhone itself. Its one-time setup needs a computer; after that, you
don't.

### One-time setup

1. Follow SideStore's own install guide at [docs.sidestore.io](https://docs.sidestore.io), which walks you through it
   on Windows, macOS or Linux. It installs SideStore on your iPhone with your Apple ID and makes the "pairing file"
   SideStore needs, and has you install SideStore's companion VPN app from the App Store (SideStore uses it to talk to
   the iPhone from the iPhone; it sends nothing off the device). The guide changes now and then, so follow theirs
   rather than an old copy.
2. [Turn on Developer Mode](#turn-on-developer-mode-ios-16-and-later) and
   [trust your Apple ID's apps](#trust-your-apple-ids-apps).
3. Open SideStore and sign in with the same Apple ID.

### Install the game

1. On the iPhone, open the [latest release](https://github.com/quincarter/marvel-champions-digital-game/releases/latest)
   in Safari and tap the `-iOS-unsigned.ipa` file. Safari saves it to **Files → Downloads**. Wait until it finishes.
2. Turn on SideStore's VPN app (if SideStore's guide has you use one).
3. In SideStore, open **My Apps**, tap **+** at the top, and choose the `.ipa` in Downloads.
4. Wait while SideStore signs and installs it; with a file this size that takes a few minutes. The game appears on
   your Home Screen.
5. You can delete the `.ipa` from Files afterwards to free the space.

### Every 7 days

Open SideStore, turn on the VPN app if you use one, and tap **Refresh All** in **My Apps**. SideStore shows how many
days each app has left. Its own expiry counts too: refresh it before it runs out, or you'll need a computer to set it
up again.

## AltStore

AltStore installs apps on the iPhone, and AltServer, on your computer, signs them. The computer refreshes them in the
background whenever both are on the same Wi-Fi.

### One-time setup

1. On your computer, install AltServer from [altstore.io](https://altstore.io) (AltStore Classic):
   - **Windows:** first install **iTunes** and **iCloud** from Apple's website (apple.com), _not_ the Microsoft
     Store versions, which AltServer can't use. Then run the AltServer installer. AltServer lives in the system tray
     (the arrow by the clock).
   - **Mac:** download AltServer, move it to Applications, and open it. It lives in the menu bar. Give it the Mail
     plug-in if it asks (macOS will walk you through it).
2. Plug the iPhone into the computer with a cable, unlock it, and tap **Trust** if it asks. On Windows, open iTunes,
   select the iPhone and tick **Sync with this iPhone over Wi-Fi**, then **Apply**. (On a Mac, the same box is in
   Finder when you select the iPhone.)
3. Click the AltServer icon → **Install AltStore** → your iPhone, and enter your Apple ID.
4. [Turn on Developer Mode](#turn-on-developer-mode-ios-16-and-later) and
   [trust your Apple ID's apps](#trust-your-apple-ids-apps).

### Install the game

1. Download the `-iOS-unsigned.ipa` from the
   [latest release](https://github.com/quincarter/marvel-champions-digital-game/releases/latest), on the iPhone with
   Safari (it goes to Files → Downloads) or on the computer.
2. **From the iPhone:** with AltServer running on the computer and both on the same Wi-Fi, open AltStore, go to
   **My Apps**, tap **+**, and pick the `.ipa`.
   **From the computer:** hold Shift (Windows) or Option (Mac) while you click the AltServer icon, choose
   **Sideload .ipa** → your iPhone, and pick the `.ipa`.
3. Wait a few minutes while it signs and installs.

### Every 7 days

Leave AltServer running on the computer (it starts with the computer if you let it). While the iPhone and computer
are on the same Wi-Fi, AltStore refreshes in the background. To do it by hand, open AltStore → **My Apps** →
**Refresh All**.

## Sideloadly

Sideloadly is a computer app: you plug the iPhone in, drop the `.ipa` on it and it installs. It is the simplest to
start with, but the weekly refresh is on the computer.

### Install the game

1. On your computer, install Sideloadly from [sideloadly.io](https://sideloadly.io). On Windows, first install
   **iTunes** and **iCloud** from Apple's website (apple.com), not the Microsoft Store versions.
2. Download the `-iOS-unsigned.ipa` from the
   [latest release](https://github.com/quincarter/marvel-champions-digital-game/releases/latest) on the computer.
3. Plug the iPhone in with a cable, unlock it, and tap **Trust** if it asks.
4. Open Sideloadly. Your iPhone shows in **iDevice**. Drag the `.ipa` onto the IPA box, type your Apple ID, and click
   **Start**. Enter your Apple ID's password when it asks (and the code Apple sends, if you use two-factor
   authentication).
5. When it says **Done**, [turn on Developer Mode](#turn-on-developer-mode-ios-16-and-later) and
   [trust your Apple ID's apps](#trust-your-apple-ids-apps), then open the game.

### Every 7 days

Do the install again with the same `.ipa` and Apple ID: it replaces the app and keeps your saves. Sideloadly can also
do this for you: turn on its auto-refresh option (under **Advanced options**) before you click Start, and leave
Sideloadly's helper running on the computer, on the same Wi-Fi as the iPhone.

## Scarlet (no computer)

Scarlet installs apps with nothing but the iPhone: no computer, no Apple ID, no 7-day refresh and no three-app limit.
The catch is how it does it. Scarlet signs every app with one certificate shared by all its users, not with your own
Apple ID, and Apple revokes certificates like that when it notices them. When that happens, **Scarlet and every app it
installed stop opening at once**, the game included, until Scarlet puts out a newly signed version. That can take
hours or a few days. Your saves stay on the iPhone while you wait.

Scarlet isn't made by this project. If you can borrow a computer once, [SideStore](#sidestore) is steadier.

### Install Scarlet and the game

1. On the iPhone, open [usescarlet.com](https://usescarlet.com), Scarlet's own site, in Safari and tap **Install**.
   Other sites with "Scarlet" in their name aren't Scarlet's; don't install from them, and skip any that ask you to
   share a link or "verify you're human" first.
2. Follow its steps: iOS asks to allow a profile, which you then install in **Settings → General → VPN & Device
   Management**. Trust Scarlet's certificate on the same screen if iOS asks, then open Scarlet.
3. In Safari, open the [latest release](https://github.com/quincarter/marvel-champions-digital-game/releases/latest)
   and tap the `-iOS-unsigned.ipa` file. Safari saves it to **Files → Downloads**. Wait until it finishes.
4. In Scarlet, choose its option to install an IPA from Files and pick the `.ipa`. (Or, in Files, touch and hold the
   `.ipa`, tap **Share** and choose Scarlet.) The button names change between Scarlet versions.
5. Wait while it installs; the game appears on your Home Screen. Trust its certificate if iOS asks, as in step 2.

### If the game stops opening

When the game and Scarlet's other apps all stop opening together, Apple revoked Scarlet's certificate.

- **Don't delete the game:** deleting it deletes its saves.
- Wait for Scarlet's newly signed version, install Scarlet again from [usescarlet.com](https://usescarlet.com), then
  install the same `.ipa` again in Scarlet. Installing over the game normally keeps your saves.

## Updating to a new version

When a new version is out, the game's Title screen says so and links the release page. Download the new
`-iOS-unsigned.ipa` and install it the same way, **with the same tool and the same Apple ID** (in Scarlet, just
install it again). It replaces the old one and keeps your saves. Installing a new version also restarts its 7 days.

## With a paid developer account

A paid [Apple Developer Program](https://developer.apple.com/programs/) membership (US$99 a year) changes the limits:

- Apps signed with it last **a year** instead of 7 days, and there is no three-app limit. You can sign the `.ipa`
  with your account in Sideloadly or AltStore exactly as above (they use whatever Apple ID you give them), or with
  Xcode.
- The account could also put the game on **TestFlight**, Apple's test app, so players install it from a link with no
  sideloading at all. That needs the account to be the game's own, signing every release; the game doesn't have one
  yet, so for now everyone sideloads.

## If something goes wrong

- **"Unable to Install" or "Integrity could not be verified":** the `.ipa` didn't finish downloading. Delete it and
  download it again on Wi-Fi.
- **"Untrusted Developer":** [trust your Apple ID's apps](#trust-your-apple-ids-apps).
- **"Developer Mode Required":** [turn on Developer Mode](#turn-on-developer-mode-ios-16-and-later).
- **The game won't open after a week:** it expired. Refresh it (SideStore, AltStore) or install it again (Sideloadly);
  your saves are still there.
- **The game and Scarlet both stop opening:** Scarlet's certificate was revoked; see
  [If the game stops opening](#if-the-game-stops-opening).
- **"Maximum number of apps" or "App ID limit":** a free Apple ID has three active apps and can register ten new apps
  a week. Remove a sideloaded app you no longer use (in SideStore or AltStore, from **My Apps**), or wait a few days.
- **Still stuck?** Ask on the [community Discord](https://discord.gg/tCy5tqu46j) or
  [open an issue](https://github.com/quincarter/marvel-champions-digital-game/issues/new/choose).
