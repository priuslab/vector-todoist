import { AuthStateScreen } from "../features/entry/AuthStateScreen";
import { EntryCarousel } from "../features/entry/EntryCarousel";
import { GoalSetup } from "../features/onboarding/GoalSetup";
import { OnboardingFlow } from "../features/onboarding/OnboardingFlow";
import { TelegramSetup } from "../features/onboarding/TelegramSetup";
import { CaptureFlow } from "../features/capture/CaptureFlow";
import { TodayScreens } from "../features/today/TodayScreens";
import { InboxScreens } from "../features/inbox/InboxScreens";
import { IdeaProjectScreens } from "../features/inbox/IdeaProjectScreens";
import { TaskScreens } from "../features/task/TaskScreens";
import { FocusScreens } from "../features/focus/FocusScreens";
import { CalendarScreens } from "../features/calendar/CalendarScreens";
import { OracleScreens } from "../features/oracle/OracleScreens";
import { GoalScreens } from "../features/goals/GoalScreens";
import { PaywallScreens } from "../features/goals/PaywallScreens";
import { SettingsScreens } from "../features/settings/SettingsScreens";
import { SystemScreens } from "../features/system/SystemScreens";
import { SCREEN_MAP } from "./screenRegistry";
import { AuthCallback } from "../auth/AuthCallback";

const ONBOARDING_NEXT = {
  "onboarding-welcome": "calendar-permission", "calendar-permission": "work-rhythm", "work-rhythm": "quiet-hours",
  "quiet-hours": "energy-peak", "energy-peak": "focus-settings", "focus-settings": "goal-choice",
};
const ONBOARDING_BACK = {
  "onboarding-welcome": "auth-loading", "calendar-permission": "onboarding-welcome", "work-rhythm": "calendar-permission",
  "quiet-hours": "work-rhythm", "energy-peak": "quiet-hours", "focus-settings": "energy-peak", "goal-choice": "focus-settings",
  "goal-manual": "goal-choice", "goal-test-start": "goal-choice", "goal-test-result": "goal-test-start", "goal-skip-warning": "goal-choice",
  "telegram-connect": "goal-choice", "telegram-success": "telegram-connect", "first-brain-dump": "telegram-success",
};

export function ScreenRouter({ route, onNavigate, onGoogleLogin, pocketBase }) {
  if (route === "auth-callback") return <AuthCallback pb={pocketBase} onComplete={() => onNavigate("today-normal")} />;
  const screen = SCREEN_MAP[route] ?? SCREEN_MAP["entry-chaos"];
  const back = () => onNavigate(ONBOARDING_BACK[route] ?? "today-normal");
  if (screen.group === "Entry") {
    if (route === "auth-loading") return <AuthStateScreen state="loading" onContinue={() => onNavigate("onboarding-welcome")} />;
    if (route === "auth-error") return <AuthStateScreen state="error" onRetry={() => onNavigate("auth-loading")} />;
    return <EntryCarousel initialIndex={{ "entry-chaos": 0, "entry-voice": 1, "entry-path": 2 }[route]} onContinue={onGoogleLogin ?? (() => onNavigate("auth-loading"))} />;
  }
  if (screen.group === "Onboarding") {
    if (route.startsWith("goal-")) return <GoalSetup screenId={route} onBack={back} onRoute={onNavigate} onNext={() => onNavigate("telegram-connect")} />;
    if (route.startsWith("telegram-") || route === "first-brain-dump") return <TelegramSetup screenId={route} onBack={back} onNext={() => onNavigate(route === "telegram-connect" ? "telegram-success" : route === "telegram-success" ? "first-brain-dump" : "capture-chooser")} />;
    return <OnboardingFlow screenId={route} onBack={back} onNext={() => onNavigate(ONBOARDING_NEXT[route] ?? "goal-choice")} />;
  }
  if (screen.group === "Capture") return <CaptureFlow key={route} screenId={route} onBack={() => onNavigate("today-normal")} onNavigate={onNavigate} />;
  if (screen.group === "Today") return <TodayScreens screenId={route} onNavigate={onNavigate} />;
  if (screen.group === "Inbox") return ["idea-detail", "idea-decomposition", "project-detail"].includes(route) ? <IdeaProjectScreens screenId={route} onNavigate={onNavigate} /> : <InboxScreens screenId={route} onNavigate={onNavigate} />;
  if (screen.group === "Task") return route.startsWith("focus-") ? <FocusScreens screenId={route} onNavigate={onNavigate} /> : <TaskScreens screenId={route} onNavigate={onNavigate} />;
  if (screen.group === "Calendar") return <CalendarScreens screenId={route} onNavigate={onNavigate} />;
  if (screen.group === "Oracle") return <OracleScreens screenId={route} onNavigate={onNavigate} />;
  if (screen.group === "Goals") return route.startsWith("paywall") || route.startsWith("payment") || route === "stripe-loading" ? <PaywallScreens screenId={route} onNavigate={onNavigate} /> : <GoalScreens screenId={route} onNavigate={onNavigate} />;
  if (screen.group === "Settings") return <SettingsScreens screenId={route} onNavigate={onNavigate} />;
  return <SystemScreens screenId={route} onNavigate={onNavigate} />;
}
