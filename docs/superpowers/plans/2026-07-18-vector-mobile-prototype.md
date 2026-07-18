# Vector Mobile Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, interactive 390 × 844 Ukrainian mobile prototype that exposes every specified Vector screen/state and makes the principal demo journeys clickable end to end.

**Architecture:** A self-contained React/Vite prototype lives in `prototype/`. A tiny in-memory router and shared `PrototypeState` drive the core journeys, while a screen registry exposes every required state through a developer screen catalog. Feature folders own focused screen groups; shared components and semantic CSS tokens keep all 80+ states visually consistent with the approved deep-pine landing reference.

**Tech Stack:** React 19, Vite 6, Vitest, Testing Library, Manrope via `@fontsource/manrope`, Phosphor Icons, plain CSS with semantic design tokens.

## Global Constraints

- Mobile web only; the app surface is exactly 390 × 844 for visual QA and supports 360–430 px widths without horizontal scrolling.
- Ukrainian UI copy only.
- Approved brand colors: primary `#246B5E`, pressed `#1B5148`, soft `#E5F1ED`, sand accent `#D19A52`.
- Default background `#F6F8F6`, primary text `#1F2926`, border `#DCE5E1`.
- Manrope is the primary font; UI text never drops below 12 px.
- One dominant CTA per screen; interactive targets are at least 44 × 44 px.
- Demo persona remains Олена with the podcast goal and calendar/task data defined in `AGENTS.md`.
- Automatic changes are visible and reversible with Undo.
- No shame-based copy, generic purple AI styling, gradients, glassmorphism, CSS drawings, emoji, or handcrafted SVG icons.
- Standard icons use `@phosphor-icons/react`; the approved Vector wordmark is a real image asset.
- The prototype mocks backend effects locally; it does not call real Google, Telegram, Stripe, or AI services.

---

### Task 1: Scaffold the isolated prototype and test harness

**Files:**
- Create: `prototype/` with the Product Design bootstrap script
- Modify: `prototype/package.json`
- Modify: `prototype/vite.config.mjs`
- Create: `prototype/src/test/setup.js`
- Create: `prototype/src/App.test.jsx`

**Interfaces:**
- Produces: `npm run dev`, `npm run build`, and `npm test` commands from `prototype/`.
- Produces: browser-safe alias-free Vite app mounted at `.mobile-prototype`.

- [ ] **Step 1: Bootstrap the prototype**

Run:

```bash
node /Users/vitaliidoroshenko/.codex/plugins/cache/openai-curated-remote/product-design/0.1.50/scripts/bootstrap-prototype.mjs \
  --dest /Users/vitaliidoroshenko/Desktop/AIPriusLab/Projects/ToDOist-AI/prototype
```

Expected: `prototype/package.json`, `prototype/src/App.jsx`, and `prototype/src/styles.css` exist.

- [ ] **Step 2: Add runtime and testing dependencies**

Set `prototype/package.json` scripts to:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Install:

```bash
npm install @fontsource/manrope @phosphor-icons/react
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 3: Write the failing shell test**

```jsx
import { render, screen } from "@testing-library/react";
import { App } from "./App";

it("renders the Vector mobile shell", () => {
  render(<App />);
  expect(screen.getByTestId("mobile-prototype")).toBeInTheDocument();
  expect(screen.getByText("Вектор")).toBeInTheDocument();
});
```

- [ ] **Step 4: Run the test and implement the minimal shell**

Run: `npm test`

Expected before implementation: FAIL because the shell and setup are absent.

Implement `App` with:

```jsx
export function App() {
  return <main className="mobile-prototype" data-testid="mobile-prototype">Вектор</main>;
}
```

Run: `npm test`

Expected: PASS.

---

### Task 2: Establish tokens, app state, demo data, and the screen registry

**Files:**
- Create: `prototype/src/styles/tokens.css`
- Create: `prototype/src/styles/global.css`
- Create: `prototype/src/data/demoData.js`
- Create: `prototype/src/state/prototypeState.jsx`
- Create: `prototype/src/navigation/routes.js`
- Create: `prototype/src/screens/screenRegistry.js`
- Create: `prototype/src/screens/screenRegistry.test.js`

**Interfaces:**
- Produces: `DEMO_USER`, `DEMO_GOAL`, `DEMO_TASKS`, `DEMO_EVENTS`, `DEMO_IDEAS`, `DEMO_PROJECTS`.
- Produces: `usePrototype()` returning `{ route, navigate, history, state, updateState, undo }`.
- Produces: `SCREEN_REGISTRY`, an ordered array of `{ id, group, title, component, props }` covering all required frames.

- [ ] **Step 1: Write the failing registry coverage test**

```js
import { SCREEN_REGISTRY } from "./screenRegistry";

it("contains every required design state", () => {
  expect(SCREEN_REGISTRY.length).toBeGreaterThanOrEqual(82);
  expect(new Set(SCREEN_REGISTRY.map((item) => item.id)).size).toBe(SCREEN_REGISTRY.length);
  expect(SCREEN_REGISTRY.map((item) => item.group)).toEqual(
    expect.arrayContaining(["Entry", "Onboarding", "Capture", "Today", "Inbox", "Task", "Calendar", "Oracle", "Goals", "Settings", "System"]),
  );
});
```

- [ ] **Step 2: Define exact semantic tokens**

`tokens.css` must expose:

```css
:root {
  --bg-base: #f6f8f6;
  --bg-surface: #ffffff;
  --bg-subtle: #edf2ef;
  --text-primary: #1f2926;
  --text-secondary: #63716c;
  --text-tertiary: #87938e;
  --border-default: #dce5e1;
  --brand-primary: #246b5e;
  --brand-pressed: #1b5148;
  --brand-soft: #e5f1ed;
  --accent-sand: #d19a52;
  --accent-teal: #178f83;
  --success: #2e8b57;
  --warning: #b86e00;
  --danger: #c54848;
  --info: #2f6fd0;
  --radius-control: 12px;
  --radius-card: 16px;
  --radius-large: 20px;
  --radius-sheet: 24px;
  --screen-pad: 20px;
}
```

- [ ] **Step 3: Add the immutable demo persona**

```js
export const DEMO_USER = { name: "Олена", workStart: "09:00", workEnd: "18:00", energyPeak: "09:30–12:30" };
export const DEMO_GOAL = { id: "goal-podcast", title: "Запустити перший сезон подкасту про кар'єрні зміни до 30 вересня", progress: 42 };
export const DEMO_EVENTS = [{ id: "sync", title: "Командний синк", start: "11:00", end: "11:45", source: "google", locked: true }];
```

Add the remaining tasks, idea, project, neutral task, and low-alignment idea verbatim from `AGENTS.md`.

- [ ] **Step 4: Implement history-backed prototype state and registry**

The state provider must push snapshots before mutations and expose `undo()` so rescheduling, Goal Focus, and AI changes visibly reverse.

- [ ] **Step 5: Run registry tests**

Run: `npm test -- src/screens/screenRegistry.test.js`

Expected: PASS with at least 82 unique screen IDs.

---

### Task 3: Build the shared mobile component system

**Files:**
- Create: `prototype/src/components/AppFrame.jsx`
- Create: `prototype/src/components/Button.jsx`
- Create: `prototype/src/components/IconButton.jsx`
- Create: `prototype/src/components/TopBar.jsx`
- Create: `prototype/src/components/BottomNav.jsx`
- Create: `prototype/src/components/BottomSheet.jsx`
- Create: `prototype/src/components/TaskCard.jsx`
- Create: `prototype/src/components/EntityCard.jsx`
- Create: `prototype/src/components/InlineInsight.jsx`
- Create: `prototype/src/components/StateView.jsx`
- Create: `prototype/src/components/Progress.jsx`
- Create: `prototype/src/components/SegmentedControl.jsx`
- Create: `prototype/src/components/UndoSnackbar.jsx`
- Create: `prototype/src/components/components.test.jsx`
- Create: `prototype/src/styles/components.css`

**Interfaces:**
- Produces: shared components with `variant`, `state`, and accessible label props.
- Consumes: semantic CSS tokens and `@phosphor-icons/react` icons.

- [ ] **Step 1: Write accessibility-first component tests**

```jsx
it("gives the primary action an accessible name and large target", () => {
  render(<Button>Продовжити</Button>);
  const button = screen.getByRole("button", { name: "Продовжити" });
  expect(button).toHaveClass("button--primary");
});

it("announces undo changes", () => {
  render(<UndoSnackbar message="План змінено" onUndo={() => {}} />);
  expect(screen.getByRole("status")).toHaveTextContent("План змінено");
});
```

- [ ] **Step 2: Implement component APIs and variants**

Use Phosphor icons such as `House`, `Tray`, `Microphone`, `CalendarBlank`, `Graph`, `ArrowLeft`, `SlidersHorizontal`, `Check`, `Clock`, `Sparkle`, and `WarningCircle`. Do not draw icons in CSS.

- [ ] **Step 3: Implement component styling**

Primary buttons are 54 px high, controls are at least 44 px, cards use 16 px radii, sheets use 24 px top radii, and the app has at most two shadow levels.

- [ ] **Step 4: Run component tests**

Run: `npm test -- src/components/components.test.jsx`

Expected: PASS.

---

### Task 4: Recreate the approved Entry carousel and onboarding flow

**Files:**
- Add: `prototype/public/assets/vector-wordmark.png`
- Create: `prototype/src/features/entry/EntryCarousel.jsx`
- Create: `prototype/src/features/entry/AuthStateScreen.jsx`
- Create: `prototype/src/features/onboarding/OnboardingFlow.jsx`
- Create: `prototype/src/features/onboarding/GoalSetup.jsx`
- Create: `prototype/src/features/onboarding/TelegramSetup.jsx`
- Create: `prototype/src/features/entry/entry.test.jsx`
- Create: `prototype/src/styles/entry.css`

**Interfaces:**
- Produces routes: `entry`, `auth-loading`, `auth-error`, `onboarding-welcome`, `calendar-permission`, `work-rhythm`, `quiet-hours`, `energy`, `focus-settings`, `goal-choice`, `goal-manual`, `goal-test-start`, `goal-test-result`, `goal-skip-warning`, `telegram-connect`, `telegram-success`, `first-brain-dump`.
- `EntryCarousel` accepts `{ autoAdvanceMs = 6000, reducedMotion, onContinue }`.

- [ ] **Step 1: Create the wordmark asset from the approved visual**

Use the approved source `docs/design/previews/landing-chaos-to-plan-deep-pine.png` to generate or extract a clean standalone wordmark. Save a real PNG asset to `prototype/public/assets/vector-wordmark.png`; do not recreate the mark with CSS or SVG.

- [ ] **Step 2: Write carousel behavior tests**

```jsx
it("starts on Chaos to Plan and stops autoplay after manual interaction", async () => {
  const user = userEvent.setup();
  render(<EntryCarousel autoAdvanceMs={50} />);
  expect(screen.getByText("Вислови все, що в голові. Отримай реалістичний план.")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Наступний слайд" }));
  expect(screen.getByText("Не тримай усе в голові.")).toBeInTheDocument();
});
```

- [ ] **Step 3: Implement three entry slides faithfully**

Slide copy and visual hierarchy:

```js
export const ENTRY_SLIDES = [
  { id: "chaos", title: "Вислови все, що в голові. Отримай реалістичний план." },
  { id: "voice", title: "Не тримай усе в голові." },
  { id: "path", title: "Побач шлях від думки до мети." },
];
```

Keep `Продовжити з Google` fixed. Support swipe, arrow controls, progress dots, 6-second autoplay before interaction, and `prefers-reduced-motion`.

- [ ] **Step 4: Implement auth and all onboarding states**

Every step must have Back where safe, one primary CTA, saved selections, and a visible progress indicator. The manual goal form uses the approved goal copy. The AI goal test screen states clearly that the final protocol is not yet attached.

- [ ] **Step 5: Verify entry/onboarding tests**

Run: `npm test -- src/features/entry/entry.test.jsx`

Expected: PASS.

---

### Task 5: Build Brain Dump, recording, AI clarification, and AI Result

**Files:**
- Create: `prototype/src/features/capture/CaptureFlow.jsx`
- Create: `prototype/src/features/capture/VoiceRecorder.jsx`
- Create: `prototype/src/features/capture/Transcript.jsx`
- Create: `prototype/src/features/capture/AIProcessing.jsx`
- Create: `prototype/src/features/capture/Clarification.jsx`
- Create: `prototype/src/features/capture/AIResult.jsx`
- Create: `prototype/src/features/capture/capture.test.jsx`
- Create: `prototype/src/styles/capture.css`

**Interfaces:**
- Produces screen IDs `capture-chooser`, `recording`, `live-transcript`, `ai-processing`, `clarification-1`, `clarification-2`, `ai-result`, `transcript-review`, `ai-failure`.
- Consumes `DEMO_BRAIN_DUMP`; produces tasks/ideas/project in prototype state.

- [ ] **Step 1: Write the capture flow test**

```jsx
it("moves from voice capture through clarification to AI result", async () => {
  const user = userEvent.setup();
  render(<CaptureFlow />);
  await user.click(screen.getByRole("button", { name: "Диктувати" }));
  await user.click(screen.getByRole("button", { name: "Завершити запис" }));
  expect(await screen.findByText("Розпізнаю думки")).toBeInTheDocument();
});
```

- [ ] **Step 2: Implement interactive recording and transcript states**

Use Phosphor microphone/audio icons and DOM waveform bars only as data visualization, not decorative illustration. Recording controls support cancel and finish; transcript can be edited.

- [ ] **Step 3: Implement deterministic processing steps and low-confidence questions**

Show exactly: `Розпізнаю думки`, `Знаходжу задачі`, `Перевіряю календар`, `Складаю план`. Ask no more than two sequential critical questions.

- [ ] **Step 4: Implement AI Result and failure recovery**

The result shows created tasks, idea, project, schedule, `Переглянути день`, and Undo. Failure saves the draft in Inbox and offers retry.

- [ ] **Step 5: Run capture tests**

Run: `npm test -- src/features/capture/capture.test.jsx`

Expected: PASS.

---

### Task 6: Build Today, Inbox, task details, and Focus Mode

**Files:**
- Create: `prototype/src/features/today/TodayScreens.jsx`
- Create: `prototype/src/features/today/EveningReview.jsx`
- Create: `prototype/src/features/inbox/InboxScreens.jsx`
- Create: `prototype/src/features/inbox/IdeaProjectScreens.jsx`
- Create: `prototype/src/features/task/TaskScreens.jsx`
- Create: `prototype/src/features/focus/FocusScreens.jsx`
- Create: `prototype/src/features/today/today.test.jsx`
- Create: `prototype/src/styles/planning.css`

**Interfaces:**
- Produces Today IDs 27–33, Inbox/Idea/Project IDs 34–39, and Task/Focus IDs 40–45 from the handoff specification.
- Consumes shared task/entity cards and prototype history; produces completion/reschedule/focus-session updates.

- [ ] **Step 1: Write the automatic reschedule Undo test**

```jsx
it("shows what moved and restores the previous plan with Undo", async () => {
  const user = userEvent.setup();
  render(<TodayScreens state="rescheduled" />);
  expect(screen.getByText("План змінився — я знайшов новий час.")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Скасувати зміни" }));
  expect(screen.queryByText("План змінився — я знайшов новий час.")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Implement all Today states**

Include empty, normal plan, active Deep Work, overload recommendation, rescheduled with Undo, all-complete, and evening review.

- [ ] **Step 3: Implement Inbox, idea decomposition, and project screens**

Ideas remain in backlog until the user confirms decomposition. Provide tasks/ideas/drafts tabs, search/filter, failed draft, idea detail, decomposition preview, and project detail.

- [ ] **Step 4: Implement Task and Focus screens**

Task edit supports deadline, time, duration, priority, energy, flexible/locked, project, goal, and subtasks. Pomodoro setup opens Focus Mode and completion reflection.

- [ ] **Step 5: Run planning tests**

Run: `npm test -- src/features/today/today.test.jsx`

Expected: PASS.

---

### Task 7: Build Calendar and synchronization states

**Files:**
- Create: `prototype/src/features/calendar/CalendarScreens.jsx`
- Create: `prototype/src/features/calendar/CalendarTimeline.jsx`
- Create: `prototype/src/features/calendar/EventSheet.jsx`
- Create: `prototype/src/features/calendar/calendar.test.jsx`
- Create: `prototype/src/styles/calendar.css`

**Interfaces:**
- Produces screen IDs 46–51.
- Consumes `DEMO_EVENTS` and scheduled tasks.
- Produces local reschedule actions while keeping Google events locked.

- [ ] **Step 1: Write locked-event and drag tests**

```jsx
it("does not expose drag affordances on Google events", () => {
  render(<CalendarScreens state="day" />);
  expect(screen.getByText("Командний синк").closest("[data-locked]")).toHaveAttribute("data-locked", "true");
});
```

- [ ] **Step 2: Implement day and compact week views**

Render horizontal dates, vertical hours, Google events, AI tasks, current-time marker, and a readable mobile week overview.

- [ ] **Step 3: Implement move, sheet, conflict, and offline states**

Drag can be simulated with a tap-select/tap-slot accessible fallback. Event/task sheet distinguishes locked Google events from flexible tasks. Add conflict and pending-sync banners.

- [ ] **Step 4: Run Calendar tests**

Run: `npm test -- src/features/calendar/calendar.test.jsx`

Expected: PASS.

---

### Task 8: Build Oracle, goals, Goal Focus, and Lifetime Pro

**Files:**
- Create: `prototype/src/features/oracle/OracleScreens.jsx`
- Create: `prototype/src/features/oracle/OracleGraph.jsx`
- Create: `prototype/src/features/oracle/OracleFilters.jsx`
- Create: `prototype/src/features/goals/GoalScreens.jsx`
- Create: `prototype/src/features/goals/PaywallScreens.jsx`
- Create: `prototype/src/features/oracle/oracle.test.jsx`
- Create: `prototype/src/styles/oracle.css`

**Interfaces:**
- Produces Oracle IDs 52–61 and Goal/payment IDs 62–67.
- `OracleGraph` accepts `{ nodes, edges, selectedNodeId, focusMode, filters, onSelect }`.
- Goal Focus stores a reversible visibility filter; it never deletes entities.

- [ ] **Step 1: Write graph selection and Goal Focus tests**

```jsx
it("dims unrelated nodes and highlights the selected path", async () => {
  const user = userEvent.setup();
  render(<OracleScreens state="balanced" />);
  await user.click(screen.getByRole("button", { name: /Зробити епізод про синдром самозванця/ }));
  expect(screen.getByTestId("oracle-graph")).toHaveAttribute("data-selection", "idea-impostor");
});
```

- [ ] **Step 2: Implement the semantic graph with accessible controls**

Use positioned DOM buttons for nodes and CSS borders only for containers; edges are rendered with a canvas layer because they are data visualization, not decorative CSS art. Support pan, zoom buttons, drag nodes, select, center, filters, dimming, and path highlight. Provide a vertical path-list fallback.

- [ ] **Step 3: Implement Balanced, selection, path, filter, Goal Focus, suggested-edge, and empty states**

Use goal `#246B5E`, project `#3B74D8`, idea `#D88916`, task `#168F83`, completed `#9AA0AE` with text/icon/shape cues.

- [ ] **Step 4: Implement one-free-goal and Stripe test-mode screens**

Second goal opens a $100 one-time Lifetime Pro paywall. Build checkout-loading, success, and cancelled/failed states without making real network calls.

- [ ] **Step 5: Run Oracle tests**

Run: `npm test -- src/features/oracle/oracle.test.jsx`

Expected: PASS.

---

### Task 9: Build Settings, integration, adaptation, and global states

**Files:**
- Create: `prototype/src/features/settings/SettingsScreens.jsx`
- Create: `prototype/src/features/settings/IntegrationRows.jsx`
- Create: `prototype/src/features/system/SystemScreens.jsx`
- Create: `prototype/src/features/settings/settings.test.jsx`
- Create: `prototype/src/styles/settings.css`

**Interfaces:**
- Produces IDs 68–80.
- Consumes onboarding preferences and exposes editable work rhythm, energy, quiet hours, Telegram, Calendar, adaptation, and Pro state.

- [ ] **Step 1: Write adaptation approval tests**

```jsx
it("applies or rejects an AI adaptation suggestion explicitly", async () => {
  const user = userEvent.setup();
  render(<SettingsScreens state="adaptation" />);
  await user.click(screen.getByRole("button", { name: "Прийняти зміну" }));
  expect(screen.getByRole("status")).toHaveTextContent("Налаштування оновлено");
});
```

- [ ] **Step 2: Implement Settings and integration states**

Include profile home, work rhythm, energy/focus, notifications/quiet hours, Telegram connected/disconnected, Calendar connected/syncing/error, adaptation accept/reject, and Pro/restore.

- [ ] **Step 3: Implement global states**

Add offline, generic error, skeletons for Today/Inbox/Calendar/Oracle, Undo snackbar, and irreversible manual-action confirmation.

- [ ] **Step 4: Run Settings tests**

Run: `npm test -- src/features/settings/settings.test.jsx`

Expected: PASS.

---

### Task 10: Wire navigation, expose the screen catalog, and verify the complete prototype

**Files:**
- Modify: `prototype/src/App.jsx`
- Create: `prototype/src/screens/ScreenCatalog.jsx`
- Create: `prototype/src/navigation/flowDefinitions.js`
- Create: `prototype/src/App.integration.test.jsx`
- Create: `prototype/src/styles/catalog.css`
- Create: `design-qa.md`

**Interfaces:**
- Produces core flows from the designer handoff plus `?catalog=1` for grouped access to every screen.
- Produces a locally running preview and a passing `design-qa.md`.

- [ ] **Step 1: Write an end-to-end in-memory flow test**

```jsx
it("completes the demo path from entry to Today and Oracle", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Продовжити з Google" }));
  expect(screen.getByText("Підключаємо Google Calendar…")).toBeInTheDocument();
});
```

- [ ] **Step 2: Wire all prototype flows and the bottom navigation**

Link the nine specified journeys: entry/onboarding, voice-to-plan, Today focus, Telegram-originated task, missed-task reschedule with Undo, idea decomposition, Oracle path/Goal Focus, second-goal paywall, and settings adaptation.

- [ ] **Step 3: Build the grouped screen catalog**

The catalog lists all registry entries by group, supports search, and opens each state in the 390 × 844 app frame. It is a QA utility, not part of user-facing bottom navigation.

- [ ] **Step 4: Run automated verification**

Run:

```bash
npm test
npm run build
```

Expected: all tests pass and Vite production build exits 0.

- [ ] **Step 5: Run browser verification at 390 × 844**

Start the app, open the local URL in the in-app browser, test the primary flows, inspect console errors, and capture the approved landing state plus representative Today, Calendar, Oracle, and catalog states.

- [ ] **Step 6: Run blocking design QA**

Compare the approved landing reference and browser capture in one visual comparison input. Record typography, spacing, colors, image fidelity, and copy in `design-qa.md`. Fix every P0/P1/P2 issue, recapture, and repeat until `final result: passed`.

