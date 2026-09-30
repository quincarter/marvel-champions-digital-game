# iOS signing setup

The release workflow's `ios-build` job signs the IPA with an App Store Connect API key. Until the three secrets below
exist it only builds for the Simulator and attaches no IPA. All of this needs a paid Apple Developer Program
membership on team `UH7W7JKVGD` (the team in the Xcode project).

## 1. Create the App Store Connect API key

1. Open [App Store Connect → Users and Access → Integrations → App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api).
   The first time, the Account Holder has to click **Request Access** and accept the terms.
2. Under **Team Keys**, click **+** (Generate API Key). Name it (e.g. `GitHub Actions`) and set **Access** to
   **Admin**. Admin is what lets Xcode create cloud-managed signing certificates and provisioning profiles in CI.
3. Click **Download** next to the new key. You get `AuthKey_<KEYID>.p8`, and Apple only lets you download it
   once, so keep it somewhere safe (a password manager).
4. From the same page, copy:
   - the **Key ID** (the key's row in the table, also in the file name), and
   - the **Issuer ID** (the UUID shown above the keys table).

## 2. Add the repository secrets

In [Settings → Secrets and variables → Actions](https://github.com/quincarter/marvel-champions-digital-game/settings/secrets/actions),
click **New repository secret** for each:

| Secret              | Value                                                          |
| ------------------- | -------------------------------------------------------------- |
| `IOS_ASC_KEY_P8`    | the whole contents of the `.p8` file, BEGIN/END lines included |
| `IOS_ASC_KEY_ID`    | the Key ID                                                     |
| `IOS_ASC_ISSUER_ID` | the Issuer ID                                                  |

Or from a terminal in the repo:

```bash
gh secret set IOS_ASC_KEY_P8 < ~/Downloads/AuthKey_XXXXXXXXXX.p8
gh secret set IOS_ASC_KEY_ID --body XXXXXXXXXX
gh secret set IOS_ASC_ISSUER_ID --body xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

`IOS_TEAM_ID` is optional; the job uses the project's team when it's missing.

## 3. Register the bundle ID

In [Certificates, Identifiers & Profiles → Identifiers](https://developer.apple.com/account/resources/identifiers/list),
click **+** → **App IDs** → **App**, enter a description, choose **Explicit**, and enter
`com.quincarter.marvelchampions`. No capabilities are needed. (Automatic signing can register it on the first signed
build too, but doing it here avoids surprises.)

## 4. Pick how the IPA installs

The job's export method comes from the `IOS_EXPORT_METHOD` repository variable, set under
[Settings → Secrets and variables → Actions → Variables](https://github.com/quincarter/marvel-champions-digital-game/settings/variables/actions)
or with `gh variable set IOS_EXPORT_METHOD --body <method>`.

- **`release-testing`** (ad hoc): the IPA installs directly on devices registered to the team, up to 100 iPhones and
  100 iPads a year. Register each device in [Devices](https://developer.apple.com/account/resources/devices/list)
  with its UDID (connect it to a Mac, open Finder or Xcode → Window → Devices and Simulators, and copy the
  Identifier). Devices must be registered before the build that should include them. No App Store Connect app
  record is needed. This is the practical option for a fan-made game.
- **`app-store-connect`** (the default when the variable is unset): the IPA only installs through TestFlight or the
  App Store, and it needs an app record: [App Store Connect → Apps](https://appstoreconnect.apple.com/apps) → **+** →
  **New App**, platform iOS, bundle ID `com.quincarter.marvelchampions`, any unique SKU. The app name has to be
  unique on the App Store, and a Marvel-named fan game is likely to be rejected by App Review beyond internal
  TestFlight testing. Uploading to TestFlight isn't automated yet: the IPA is only attached to the GitHub release.

## 5. Check it locally

With Xcode signed in to the team (Xcode → Settings → Accounts):

```bash
pnpm ios:build --export-method release-testing
```

The IPA lands in `release/` and `dist/ios/`. The same API key works locally by putting `IOS_ASC_KEY_PATH`,
`IOS_ASC_KEY_ID` and `IOS_ASC_ISSUER_ID` in `.env` (see `.env-example`).
