const VERIFIER_KEY = "google_pkce_verifier";
const STATE_KEY = "google_oauth_state";

function bytesToBase64Url(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

async function challengeFor(verifier) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return bytesToBase64Url(new Uint8Array(digest));
}

export async function startGoogleLogin({
  clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID,
  location = window.location,
  sessionStorage = window.sessionStorage,
  randomBytes: makeRandomBytes = randomBytes,
} = {}) {
  if (!clientId) throw new Error("Вхід через Google ще не налаштовано.");
  const verifier = bytesToBase64Url(makeRandomBytes(32));
  const state = bytesToBase64Url(makeRandomBytes(24));
  const redirectUrl = `${location.origin}/auth/callback`;
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUrl,
    scope: "openid email profile",
    code_challenge: await challengeFor(verifier),
    code_challenge_method: "S256",
    state,
  }).toString();
  location.assign(authUrl.toString());
}

export async function completeGoogleLogin({ pb, location = window.location, sessionStorage = window.sessionStorage } = {}) {
  const params = new URLSearchParams(location.search);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const expectedState = sessionStorage.getItem(STATE_KEY);
  try {
    const code = params.get("code");
    if (!code || !verifier || !expectedState || params.get("state") !== expectedState) {
      throw new Error("Стан входу не підтверджено. Спробуй увійти через Google ще раз.");
    }
    return await pb.collection("users").authWithOAuth2Code("google", code, verifier, `${location.origin}/auth/callback`);
  } finally {
    sessionStorage.removeItem(VERIFIER_KEY);
    sessionStorage.removeItem(STATE_KEY);
  }
}
