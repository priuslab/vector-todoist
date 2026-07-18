# Bottom Action Footer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the primary actions on every Onboarding and Settings detail screen in a dedicated bottom footer while the content scrolls independently and short explanatory content remains optically centered.

**Architecture:** Add a reusable `ActionFooterLayout` inside `AppFrame`. `AppFrame` keeps the top bar and optional bottom navigation unchanged, while `ActionFooterLayout` owns a scrollable content region plus a non-scrolling footer. Onboarding and Settings screens pass their existing callbacks into the new footer slot without changing route IDs or demo data.

**Tech Stack:** React 19, Vite 6, Vitest, Testing Library, Manrope, Phosphor Icons, plain CSS with existing Vector tokens.

## Global Constraints

- Mobile web only; verify 390×844 and 360×800.
- Ukrainian UI copy only.
- Preserve the existing deep-pine design system and component APIs unless this plan explicitly extends them.
- The footer must occupy layout space and must never overlay content.
- The content region scrolls independently from the footer.
- Short information states center their icon, heading, and explanatory text; forms, fields, choice cards, switches, and navigation rows remain left-aligned.
- Primary buttons remain 54 px high; every secondary action remains at least 44 px high.
- Footer padding includes `env(safe-area-inset-bottom)`.
- Undo snackbars render above the footer and never cover a CTA.
- `settings-home`, routes, demo data, and screens outside Onboarding and Settings remain unchanged.

---

### Task 1: Add the reusable action-footer layout

**Files:**
- Create: `prototype/src/components/ActionFooterLayout.jsx`
- Modify: `prototype/src/components/AppFrame.jsx`
- Modify: `prototype/src/components/components.test.jsx`
- Modify: `prototype/src/styles/components.css`

**Interfaces:**
- Produces: `ActionFooterLayout({ children, footer, contentAlign = "start", footerRows = 1 })`.
- Extends: `AppFrame({ footer, contentAlign = "start", footerRows = 1, ...existingProps })`.
- Preserves: existing `AppFrame` behavior when `footer` is absent.

- [ ] **Step 1: Write failing layout tests**

Add to `prototype/src/components/components.test.jsx`:

```jsx
import { AppFrame } from "./AppFrame";

it("separates scrollable content from the persistent action footer", () => {
  render(
    <AppFrame footer={<Button>Продовжити</Button>} noNav>
      <p>Контент екрана</p>
    </AppFrame>,
  );

  expect(screen.getByTestId("action-footer-content")).toHaveTextContent("Контент екрана");
  expect(screen.getByTestId("action-footer")).toHaveTextContent("Продовжити");
});

it("keeps the legacy scroll wrapper when no footer is provided", () => {
  render(<AppFrame noNav><p>Звичайний екран</p></AppFrame>);
  expect(screen.getByTestId("app-frame-scroll")).toHaveTextContent("Звичайний екран");
  expect(screen.queryByTestId("action-footer")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the component tests and confirm the red state**

Run:

```bash
cd prototype
npm test -- src/components/components.test.jsx
```

Expected: FAIL because `ActionFooterLayout`, the new `AppFrame` props, and test IDs do not exist.

- [ ] **Step 3: Implement `ActionFooterLayout`**

Create `prototype/src/components/ActionFooterLayout.jsx`:

```jsx
export function ActionFooterLayout({
  children,
  footer,
  contentAlign = "start",
  footerRows = 1,
}) {
  return (
    <div
      className={`action-footer-layout action-footer-layout--${contentAlign} action-footer-layout--rows-${footerRows}`}
    >
      <div className="action-footer-layout__content" data-testid="action-footer-content">
        {children}
      </div>
      <footer className="action-footer-layout__footer" data-testid="action-footer">
        {footer}
      </footer>
    </div>
  );
}
```

- [ ] **Step 4: Extend `AppFrame` without changing existing callers**

Update `prototype/src/components/AppFrame.jsx` so its body selection is:

```jsx
import { ActionFooterLayout } from "./ActionFooterLayout";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";

export function AppFrame({
  children,
  title,
  eyebrow,
  onBack,
  activeRoute,
  onNavigate,
  noNav = false,
  avatar = false,
  className = "",
  footer,
  contentAlign = "start",
  footerRows = 1,
}) {
  return (
    <section className={`app-frame ${footer ? "app-frame--with-footer" : ""} ${className}`.trim()}>
      {title ? <TopBar title={title} eyebrow={eyebrow} onBack={onBack} avatar={avatar} /> : null}
      {footer ? (
        <ActionFooterLayout footer={footer} contentAlign={contentAlign} footerRows={footerRows}>
          {children}
        </ActionFooterLayout>
      ) : (
        <div className="app-frame__scroll" data-testid="app-frame-scroll">{children}</div>
      )}
      {!noNav ? <BottomNav active={activeRoute} onNavigate={onNavigate} /> : null}
    </section>
  );
}
```

- [ ] **Step 5: Add the layout CSS**

Append to `prototype/src/styles/components.css`:

```css
.action-footer-layout {
  --action-footer-offset: 92px;
  position: relative;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.action-footer-layout--rows-2 { --action-footer-offset: 154px; }

.action-footer-layout__content {
  min-height: 0;
  flex: 1;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 0 var(--screen-pad) 24px;
  scrollbar-width: none;
}

.action-footer-layout__content::-webkit-scrollbar { display: none; }

.action-footer-layout--center .action-footer-layout__content {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.action-footer-layout__footer {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px var(--screen-pad) max(14px, env(safe-area-inset-bottom));
  border-top: 1px solid var(--border-default);
  background: var(--bg-base);
}

.app-frame--with-footer .undo-snackbar {
  bottom: var(--action-footer-offset);
}
```

- [ ] **Step 6: Run the component tests and commit**

Run:

```bash
cd prototype
npm test -- src/components/components.test.jsx
```

Expected: PASS.

Commit:

```bash
git add prototype/src/components/ActionFooterLayout.jsx prototype/src/components/AppFrame.jsx prototype/src/components/components.test.jsx prototype/src/styles/components.css
git commit -m "feat: add persistent action footer layout"
```

---

### Task 2: Move every Onboarding action into the footer

**Files:**
- Modify: `prototype/src/features/onboarding/OnboardingFlow.jsx`
- Modify: `prototype/src/features/onboarding/GoalSetup.jsx`
- Modify: `prototype/src/features/onboarding/TelegramSetup.jsx`
- Create: `prototype/src/features/onboarding/onboarding-layout.test.jsx`
- Modify: `prototype/src/styles/entry.css`

**Interfaces:**
- Consumes: `AppFrame` props `footer`, `footerRows`, and `contentAlign` from Task 1.
- Preserves: all existing `onBack`, `onNext`, and `onRoute` callbacks and route transitions.
- Produces: a centered `.onboarding-main--center` for short states and a left-aligned `.onboarding-main--form` for form states.

- [ ] **Step 1: Write failing Onboarding footer tests**

Create `prototype/src/features/onboarding/onboarding-layout.test.jsx`:

```jsx
import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { OnboardingFlow } from "./OnboardingFlow";
import { GoalSetup } from "./GoalSetup";
import { TelegramSetup } from "./TelegramSetup";

it("places welcome actions in the persistent footer", () => {
  render(<OnboardingFlow screenId="onboarding-welcome" onNext={vi.fn()} />);
  const footer = screen.getByTestId("action-footer");
  expect(within(footer).getByRole("button", { name: "Продовжити" })).toBeInTheDocument();
  expect(within(footer).getByRole("button", { name: "Налаштувати пізніше" })).toBeInTheDocument();
  expect(screen.getByTestId("action-footer-content")).toHaveTextContent("Налаштуй Вектор під свій ритм");
});

it("keeps the manual goal form in content and its save action in the footer", () => {
  render(<GoalSetup screenId="goal-manual" onNext={vi.fn()} onRoute={vi.fn()} />);
  expect(screen.getByTestId("action-footer-content")).toHaveTextContent("Сформулюй свою мету");
  expect(within(screen.getByTestId("action-footer")).getByRole("button", { name: "Зберегти мету" })).toBeInTheDocument();
});

it("places Telegram setup actions in the footer", () => {
  render(<TelegramSetup screenId="telegram-connect" onNext={vi.fn()} />);
  const footer = screen.getByTestId("action-footer");
  expect(within(footer).getByRole("button", { name: "Відкрити Telegram" })).toBeInTheDocument();
  expect(within(footer).getByRole("button", { name: "Підключити пізніше" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
cd prototype
npm test -- src/features/onboarding/onboarding-layout.test.jsx
```

Expected: FAIL because actions still render inside the scroll content.

- [ ] **Step 3: Refactor `OnboardingFlow`**

Build the footer before the return:

```jsx
const footer = (
  <>
    <Button onClick={onNext}>
      {screenId === "calendar-permission" ? "Надати доступ" : "Продовжити"}
    </Button>
    <button className="text-action" onClick={onNext}>Налаштувати пізніше</button>
  </>
);
```

Pass it to `AppFrame`, remove the old `.onboarding-action`, and use this complete body structure:

```jsx
<AppFrame
  title="Коротке налаштування"
  eyebrow="Онбординг"
  onBack={onBack}
  noNav
  footer={footer}
  footerRows={2}
>
  <div className="onboarding-screen-body">
    <div className="onboarding-progress"><span className="is-active" /><span /><span /><span /></div>
    <div className={`onboarding-main ${screenId === "onboarding-welcome" || screenId === "calendar-permission" ? "onboarding-main--center" : "onboarding-main--form"}`}>
      <section className="onboarding-hero">
        <span><Icon size={34} weight="duotone" /></span>
        <h1>{item.title}</h1>
        <p>{item.text}</p>
      </section>
      {screenId === "work-rhythm" ? (
        <div className="form-stack">
          <SegmentedControl
            items={[{ value: "Будні", label: "Пн–Пт" }, { value: "Щодня", label: "Щодня" }, { value: "Власні", label: "Власні" }]}
            value={days}
            onChange={setDays}
          />
          <label>Початок<input value="09:00" readOnly /></label>
          <label>Завершення<input value="18:00" readOnly /></label>
        </div>
      ) : null}
      {screenId === "quiet-hours" ? (
        <div className="form-stack">
          <label>Не турбувати<input value="21:00–08:00" readOnly /></label>
          <label className="switch-row"><span><Bell size={20} />Ранковий план</span><input type="checkbox" defaultChecked /></label>
          <label className="switch-row"><span><Bell size={20} />Вечірній підсумок</span><input type="checkbox" defaultChecked /></label>
        </div>
      ) : null}
      {screenId === "energy-peak" ? (
        <div className="form-stack">
          <SegmentedControl
            items={[{ value: "Ранок", label: "Ранок" }, { value: "День", label: "День" }, { value: "Вечір", label: "Вечір" }]}
            value={energy}
            onChange={setEnergy}
          />
          <div className="energy-card"><strong>Твій пік</strong><span>09:30–12:30</span><small>Deep Work плануватиметься тут</small></div>
        </div>
      ) : null}
      {screenId === "focus-settings" ? (
        <div className="form-stack">
          <label>Фокус-блок<input value="50 хв" readOnly /></label>
          <label>Перерва<input value="10 хв" readOnly /></label>
          <label>Денний ліміт<input value="6 год" readOnly /></label>
        </div>
      ) : null}
    </div>
  </div>
</AppFrame>
```

- [ ] **Step 4: Refactor `GoalSetup` with explicit footer content per state**

Add these state-specific footer mappings:

```jsx
const footerByScreen = {
  "goal-manual": <Button onClick={onNext}>Зберегти мету</Button>,
  "goal-test-start": <Button onClick={() => onRoute("goal-test-result")}>Почати короткий діалог</Button>,
  "goal-test-result": <><Button onClick={onNext}>Підтвердити мету</Button><button className="text-action">Відредагувати</button></>,
  "goal-skip-warning": <><Button onClick={onNext}>Все одно продовжити</Button><button className="text-action" onClick={() => onRoute("goal-choice")}>Повернутися до вибору</button></>,
};

const centered = ["goal-test-start", "goal-test-result", "goal-skip-warning"].includes(screenId);
const footer = footerByScreen[screenId];
```

Pass `footer`, `footerRows={twoRows ? 2 : 1}`, and `contentAlign={centered ? "center" : "start"}` to `AppFrame`. Keep `goal-choice` without a footer because its three choice cards are the actions themselves. Remove the old `.onboarding-action` wrappers from each state. Define the row count explicitly:

```jsx
const twoRows = ["goal-test-result", "goal-skip-warning"].includes(screenId);
```

- [ ] **Step 5: Refactor `TelegramSetup`**

Define footer content:

```jsx
const footerByScreen = {
  "telegram-connect": <><Button onClick={onNext}>Відкрити Telegram</Button><button className="text-action" onClick={onNext}>Підключити пізніше</button></>,
  "telegram-success": <Button onClick={onNext}>Продовжити</Button>,
  "first-brain-dump": <Button onClick={onNext}>Спробувати зараз</Button>,
};
```

Pass the selected footer to `AppFrame`, use `footerRows={screenId === "telegram-connect" ? 2 : 1}`, and set `contentAlign="center"`. Remove buttons from `StateView.action` and old `.onboarding-action` blocks.

- [ ] **Step 6: Add Onboarding centering styles**

Append to `prototype/src/styles/entry.css`:

```css
.onboarding-screen-body {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.onboarding-main {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.onboarding-main--center {
  flex: 1;
  justify-content: center;
}

.onboarding-main--center .section-heading,
.onboarding-main--center .onboarding-hero {
  text-align: center;
  align-items: center;
}

.onboarding-main--form {
  padding-bottom: 12px;
}
```

Delete `.onboarding-action` if no remaining component uses it.

- [ ] **Step 7: Run Onboarding and smoke tests, then commit**

Run:

```bash
cd prototype
npm test -- src/features/onboarding/onboarding-layout.test.jsx src/screens/ScreenRouter.test.jsx src/App.test.jsx
```

Expected: PASS, including every registered Onboarding route rendering without crashing.

Commit:

```bash
git add prototype/src/features/onboarding prototype/src/styles/entry.css
git commit -m "feat: pin onboarding actions to bottom footer"
```

---

### Task 3: Move every Settings detail action into the footer

**Files:**
- Modify: `prototype/src/features/settings/SettingsScreens.jsx`
- Modify: `prototype/src/features/settings/settings.test.jsx`
- Modify: `prototype/src/styles/settings.css`

**Interfaces:**
- Consumes: `AppFrame` footer API from Task 1.
- Preserves: `SettingsForm`, integration navigation, save state, Undo callbacks, and all Settings route IDs.
- Produces: one persistent footer configuration for every Settings detail route except `settings-home`.

- [ ] **Step 1: Extend the Settings tests in the red state**

Change the first import in `prototype/src/features/settings/settings.test.jsx` to:

```jsx
import { render, screen, within } from "@testing-library/react";
```

Then add:

```jsx
it.each([
  ["settings-work", "Зберегти"],
  ["settings-energy", "Зберегти"],
  ["settings-notifications", "Зберегти"],
  ["settings-telegram", "Відключити Telegram"],
  ["settings-calendar", "Синхронізувати зараз"],
  ["settings-adaptation", "Прийняти зміну"],
  ["settings-pro", "Відновити покупку"],
])("renders %s primary action in the footer", (screenId, actionName) => {
  render(<SettingsScreens screenId={screenId} />);
  expect(within(screen.getByTestId("action-footer")).getByRole("button", { name: actionName })).toBeInTheDocument();
});

it("does not add an action footer to settings home", () => {
  render(<SettingsScreens screenId="settings-home" />);
  expect(screen.queryByTestId("action-footer")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the Settings test and confirm it fails**

Run:

```bash
cd prototype
npm test -- src/features/settings/settings.test.jsx
```

Expected: FAIL because Settings actions still live in the content region.

- [ ] **Step 3: Move form Save actions into the footer**

For `settings-work`, `settings-energy`, and `settings-notifications`, render:

```jsx
<AppFrame
  title={title}
  onBack={() => onNavigate("settings-home")}
  noNav
  footer={<Button onClick={() => setSaved(true)}>Зберегти</Button>}
>
  <SettingsForm screenId={screenId} />
  {saved ? <UndoSnackbar message="Налаштування збережено" onUndo={() => setSaved(false)} /> : null}
</AppFrame>
```

Remove the old `.detail-actions` wrapper around Save.

- [ ] **Step 4: Move integration actions into their footers**

Use these exact footer props:

```jsx
// settings-telegram
footer={<Button variant="danger">Відключити Telegram</Button>}

// settings-calendar
footer={<Button variant="secondary">Синхронізувати зараз</Button>}
```

Keep `IntegrationRow`, descriptions, switches, and sync metrics inside scrollable content.

- [ ] **Step 5: Move adaptation and Pro actions into their footers**

For adaptation:

```jsx
const adaptationFooter = (
  <>
    <Button onClick={() => setSaved(true)}>Прийняти зміну</Button>
    <Button variant="secondary">Залишити 50 хв</Button>
  </>
);
```

Pass `footer={adaptationFooter}`, `footerRows={2}`, and `contentAlign="center"`. Keep the Undo snackbar inside `AppFrame` so the footer-aware offset applies.

For Pro, remove the action from `StateView` and pass:

```jsx
footer={<Button variant="secondary">Відновити покупку</Button>}
contentAlign="center"
```

- [ ] **Step 6: Add Settings alignment styles**

Append to `prototype/src/styles/settings.css`:

```css
.app-frame--with-footer .adaptation,
.app-frame--with-footer .state-view {
  min-height: auto;
}

.app-frame--with-footer .adaptation {
  padding-block: 20px;
}
```

Do not center `.form-stack`, `.integration-row`, `.integration-detail`, switches, or settings menu rows.

- [ ] **Step 7: Run Settings tests and commit**

Run:

```bash
cd prototype
npm test -- src/features/settings/settings.test.jsx src/screens/ScreenRouter.test.jsx
```

Expected: PASS, including all Settings routes in the 82-state smoke test.

Commit:

```bash
git add prototype/src/features/settings/SettingsScreens.jsx prototype/src/features/settings/settings.test.jsx prototype/src/styles/settings.css
git commit -m "feat: pin settings actions to bottom footer"
```

---

### Task 4: Verify mobile layout, regressions, and visual quality

**Files:**
- Modify: `design-qa.md`
- Add screenshots under: `prototype/screenshots/`

**Interfaces:**
- Consumes: all implementation changes from Tasks 1–3.
- Produces: browser-rendered evidence for Onboarding and Settings at both target viewport sizes.

- [ ] **Step 1: Run the complete automated suite**

Run:

```bash
cd prototype
npm test
npm run build
```

Expected: all test files pass and Vite exits with code 0.

- [ ] **Step 2: Verify Onboarding in the in-app browser at 390×844**

Open each route:

```text
?screen=onboarding-welcome
?screen=calendar-permission
?screen=work-rhythm
?screen=quiet-hours
?screen=energy-peak
?screen=focus-settings
?screen=goal-choice
?screen=goal-manual
?screen=goal-test-start
?screen=goal-test-result
?screen=goal-skip-warning
?screen=telegram-connect
?screen=telegram-success
?screen=first-brain-dump
```

For every route, verify with browser measurements:

```js
const content = document.querySelector(".action-footer-layout__content")?.getBoundingClientRect();
const footer = document.querySelector(".action-footer-layout__footer")?.getBoundingClientRect();
({
  overlap: content && footer ? Math.max(0, Math.min(content.bottom, footer.bottom) - Math.max(content.top, footer.top)) : 0,
  footerVisible: footer ? footer.top >= 0 && footer.bottom <= window.innerHeight : true,
  horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
});
```

Expected: `overlap: 0`, `footerVisible: true`, and `horizontalOverflow: false` for every route that has a footer. `goal-choice` intentionally has no footer.

- [ ] **Step 3: Verify every Settings route at 390×844**

Open:

```text
?screen=settings-home
?screen=settings-work
?screen=settings-energy
?screen=settings-notifications
?screen=settings-telegram
?screen=settings-calendar
?screen=settings-adaptation
?screen=settings-pro
```

Expected: the seven detail routes have visible non-overlapping footers; `settings-home` has none. Trigger Save and adaptation acceptance and verify the Undo snackbar does not overlap the footer CTA.

- [ ] **Step 4: Repeat representative responsive checks at 360×800**

Capture:

- `onboarding-welcome` for centered short content;
- `goal-manual` for a scrollable long form;
- `settings-notifications` for a long form;
- `settings-adaptation` for a two-row footer and Undo snackbar.

Expected: no horizontal overflow, footer fully visible, content scrollable, and all tap targets usable.

- [ ] **Step 5: Update design QA evidence**

Add a dated follow-up section to `design-qa.md` containing:

- screenshot paths;
- viewport dimensions;
- the screenshot supplied by the user as the source issue;
- before/after findings;
- interaction checks;
- console error result;
- `final result: passed` only when no P0/P1/P2 issue remains.

- [ ] **Step 6: Final verification and commit**

Run:

```bash
cd prototype
npm test
npm run build
cd ..
git diff --check -- prototype design-qa.md
```

Expected: tests and build pass; `git diff --check` prints no output.

Commit:

```bash
git add prototype design-qa.md
git commit -m "test: verify bottom action footer layouts"
```
