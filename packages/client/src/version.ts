/**
 * The client's release version. `.changie.yaml` rewrites this line when a release PR is cut, so it always names the
 * last release on `main` (`view/app-version.ts` adds the build's commit on the web, which runs ahead of it).
 */
export const CLIENT_VERSION = "0.7.0";
