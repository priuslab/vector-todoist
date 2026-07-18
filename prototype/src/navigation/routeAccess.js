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

const featureByRoute = {
  "calendar-day": FEATURES.calendar,
  "calendar-week": FEATURES.calendar,
  "calendar-drag": FEATURES.calendar,
  "calendar-sheet": FEATURES.calendar,
  "calendar-conflict": FEATURES.calendar,
  "calendar-offline": FEATURES.calendar,
  "settings-calendar": FEATURES.calendar,
  "telegram-connect": FEATURES.telegram,
  "telegram-success": FEATURES.telegram,
  "settings-telegram": FEATURES.telegram,
  "oracle-balanced": FEATURES.oracle,
  "oracle-goal-selected": FEATURES.oracle,
  "oracle-idea-selected": FEATURES.oracle,
  "oracle-path": FEATURES.oracle,
  "oracle-filters": FEATURES.oracle,
  "oracle-suggested-edge": FEATURES.oracle,
  "oracle-path-list": FEATURES.oracle,
  "oracle-empty": FEATURES.oracle,
  "goal-focus-confirm": FEATURES.goalFocus,
  "goal-focus-active": FEATURES.goalFocus,
  "paywall-lifetime": FEATURES.stripe,
  "stripe-loading": FEATURES.stripe,
  "payment-success": FEATURES.stripe,
  "payment-failed": FEATURES.stripe,
  "pomodoro-setup": FEATURES.pomodoro,
  "settings-adaptation": FEATURES.adaptation,
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

export function isInternalRouteAllowed({ route, env = import.meta.env }) {
  const feature = featureByRoute[route];
  return !feature || isQaEnvironment(env) || isFeatureEnabled(feature, env);
}

export function resolveInternalRoute({ route, env = import.meta.env }) {
  return isInternalRouteAllowed({ route, env }) ? route : "today-normal";
}
