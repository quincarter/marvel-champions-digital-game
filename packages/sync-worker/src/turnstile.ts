/** The Turnstile server-side check, shared by transfer uploads and sync space creation. */

const TURNSTILE_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function turnstileOk(secret: string, token: string, ip: string, doFetch: typeof fetch): Promise<boolean> {
  const form = new URLSearchParams({ secret, response: token });
  if (ip !== "unknown") form.set("remoteip", ip);
  try {
    const answer = await doFetch(TURNSTILE_URL, { method: "POST", body: form });
    return answer.ok && ((await answer.json()) as { success?: boolean }).success === true;
  } catch {
    return false;
  }
}
