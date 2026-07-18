import { FEATURES, isFeatureEnabled } from "../config/featureFlags";

const protectedPaths = {
  "/calendar": [FEATURES.calendar, "calendar-day"],
  "/telegram": [FEATURES.telegram, "settings-telegram"],
  "/oracle": [FEATURES.oracle, "oracle-balanced"],
  "/stripe": [FEATURES.stripe, "paywall-lifetime"],
  "/goalfocus": [FEATURES.goalFocus, "goal-focus-active"],
  "/pomodoro": [FEATURES.pomodoro, "pomodoro-setup"],
  "/adaptation": [FEATURES.adaptation, "settings-adaptation"],
};

export function resolveProductionRoute({ pathname = "/", auth, env = import.meta.env }) {
  if (pathname === "/auth/callback") return "auth-callback";
  if (auth.status === "loading") return "auth-loading";
  if (auth.status !== "authenticated") return "entry-chaos";
  if (!auth.record?.onboardingCompleted) return "onboarding-welcome";
  const access = protectedPaths[pathname.toLowerCase()];
  return access && isFeatureEnabled(access[0], env) ? access[1] : "today-normal";
}

export const isQaEnvironment = (env = import.meta.env) => Boolean(env?.DEV || env?.MODE === "test");
