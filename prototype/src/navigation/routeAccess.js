import { FEATURES, isFeatureEnabled } from "../config/featureFlags";

const protectedPaths = {
  "/telegram": [FEATURES.telegram, "settings-telegram"],
  "/stripe": [FEATURES.stripe, "paywall-lifetime"],
  "/goalfocus": [FEATURES.goalFocus, "goal-focus-active"],
  "/pomodoro": [FEATURES.pomodoro, "pomodoro-setup"],
  "/adaptation": [FEATURES.adaptation, "settings-adaptation"],
};

const DEMO_HIDDEN = new Set([
  "calendar-day",
  "calendar-week",
  "calendar-drag",
  "calendar-sheet",
  "calendar-conflict",
  "calendar-offline",
  "settings-calendar",
  "oracle-balanced",
  "oracle-goal-selected",
  "oracle-idea-selected",
  "oracle-path",
  "oracle-filters",
  "oracle-suggested-edge",
  "oracle-path-list",
  "oracle-empty",
  "goal-focus-confirm",
  "goal-focus-active",
]);

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
  const access = protectedPaths[pathname.toLowerCase()];
  return access && isFeatureEnabled(access[0], env) && (isQaEnvironment(env) || !DEMO_HIDDEN.has(access[1])) ? access[1] : "today-normal";
}

export const isQaEnvironment = (env = import.meta.env) => Boolean(env?.DEV || env?.MODE === "test");

export function isInternalRouteAllowed({ route, env = import.meta.env }) {
  if (!isQaEnvironment(env) && DEMO_HIDDEN.has(route)) return false;
  const feature = featureByRoute[route];
  return !feature || isQaEnvironment(env) || isFeatureEnabled(feature, env);
}

export function resolveInternalRoute({ route, env = import.meta.env }) {
  return isInternalRouteAllowed({ route, env }) ? route : "today-normal";
}
