# AGENTS.md

This file is the source of truth for AI agents working on this repository.
Follow it when designing, implementing, reviewing, or preparing handoff materials for the product.

## Product

Working name: Вектор.

Вектор is a Ukrainian mobile-first AI planner for people with ADHD or high cognitive load. The app turns chaotic thoughts into a realistic daily plan and shows how ideas, projects, and tasks connect to the user's main goal.

Core promise: "Вислови все, що в голові. AI сам структурує думки, складе реалістичний план і покаже шлях до твоєї мети."

Primary language: Ukrainian only. UI copy, AI messages, Telegram messages, errors, empty states, paywall, and settings must be in Ukrainian.

Primary platform: mobile web only. Build for 360-430 px wide screens. Do not create a desktop product experience. On desktop, show the mobile app in a centered container.

## Audience

Design and build for users who may struggle with:

- holding many thoughts in working memory;
- turning ideas into concrete next actions;
- estimating task duration realistically;
- recovering after a broken plan;
- staying connected to one important goal;
- tolerating noisy, dense, or shame-based productivity interfaces.

The interface must reduce cognitive load. Prefer clarity, calm hierarchy, and one obvious next action.

## Product Principles

- Automation with control: AI may create, classify, schedule, reschedule, and explain, but the user can edit or undo meaningful changes.
- Calm first: daily planning screens should feel quiet and grounded; the visual wow belongs mostly to Oracle and selected AI transitions.
- No shame: never blame the user for missed tasks. Use supportive language.
- Mobile ergonomics: important controls must be reachable and tappable with one hand.
- Real integrations for demo: Google OAuth/Calendar, Telegram Bot, AI API, and Stripe Test Mode should be functional in the MVP.
- Deterministic scheduling: AI structures and explains; a scheduler module decides time placement using explicit rules.
- Ideas are not tasks: an idea goes to backlog first, then the user can decompose it into a project/tasks.
- Goal alignment matters: show which tasks and ideas move the user toward the main goal, but do not hide necessary deadline work.

## Core Scope

Required product areas:

- Google login with Calendar access.
- Onboarding for work rhythm, quiet hours, energy, focus block length, daily workload cap, and goal selection.
- One free main goal.
- Optional AI goal test, once the user's goal-finding protocol is added as a versioned AI configuration.
- Brain Dump from web using text or voice.
- Brain Dump from Telegram using text or voice.
- AI classification into tasks, ideas, projects, goals, and context.
- Low-confidence AI clarification with at most 1-2 critical questions.
- Inbox, Today, Calendar, Task Detail, Idea Detail, Project Detail, Settings.
- Automatic scheduling around Google Calendar busy slots.
- Two-way sync for app-created Calendar blocks.
- Telegram reminders, morning plan, overdue/conflict notifications, rescheduling summaries, evening review.
- Automatic rescheduling of future flexible tasks only, with Undo.
- Oracle graph showing Goal, Project, Idea, Task, and Completed nodes.
- Balanced and Goal Focus modes.
- Stripe Test Mode paywall for $100 Lifetime Pro, unlocking unlimited goals.

Out of scope for this MVP:

- desktop-specific layouts;
- native iOS/Android apps;
- multilingual UI;
- teams/workspaces;
- recurring subscription plans;
- medical diagnosis or ADHD treatment claims;
- irreversible AI deletion or fully autonomous destructive decisions.

## Navigation

Use a five-item bottom navigation:

- Today;
- Inbox;
- central Brain Dump action;
- Calendar;
- Oracle.

Profile and Settings open from an avatar in the top app bar.

Use bottom sheets, drawers, and full-screen mobile flows instead of desktop-style modals.

## Entry Carousel

Before Google authorization, show a three-slide mobile intro carousel built from the approved landing concepts:

1. `Chaos to Plan` — the default first slide; shows scattered thoughts becoming a realistic schedule.
2. `Voice to Plan` — shows voice capture becoming structured tasks.
3. `Path to Goal` — previews the route from thoughts through the next task to the main goal.

Keep `Продовжити з Google` fixed in the bottom action area on every slide. Users can swipe left or right. Show a clear three-step progress indicator. Auto-advance every 6 seconds only until the user interacts; pause auto-advance on touch, focus, manual swipe, or while assistive reading is active. Disable automatic motion when the user prefers reduced motion. Never auto-submit or start Google authorization.

## UX Rules

- Use one primary CTA per screen.
- Secondary actions must be visually quieter.
- Minimum touch target: 44 x 44 px.
- Main buttons: 52-56 px high.
- Account for iOS/Android safe areas and mobile keyboard states.
- Do not show more than three AI insights or warnings at once.
- Empty states must offer one clear next action.
- Loading, empty, error, offline, syncing, disabled, pressed, success, and Undo states must be designed where relevant.
- AI recommendations must be labeled as recommendations.
- Any automatic reschedule must show what changed and provide Undo.
- Locked Google events must not look draggable.
- Goal Focus must defer or hide unrelated flexible items; it must not delete data.
- Balanced is the default mode.
- A task that is late should be framed as needing a new place in the plan.

Good copy:

- "План змінився - я знайшов новий час."
- "5 задач потребують нового місця в плані."
- "Хочеш розбити цю ідею на задачі чи залишити в backlog?"

Avoid:

- "Ти знову не виконав задачу."
- "Прострочено 5 задач."
- guilt, pressure, moral judgment, or fake cheerfulness.

## Design System

Style: calm ADHD-friendly mobile productivity UI. The product should feel empathetic, clear, modern, reliable, and lightly intelligent. It should not feel like a medical app, a corporate task manager clone, or neon sci-fi.

Use Manrope as the primary typeface with Ukrainian Cyrillic support. Fallback: Inter, system sans-serif.

Typography:

- Display: 32/38, 700;
- H1: 28/34, 700;
- H2: 22/28, 700;
- H3: 18/24, 650;
- Body Large: 17/25, 500;
- Body: 15/22, 500;
- Label: 13/18, 600;
- Caption: 12/16, 500;
- Button: 15/20, 650.

Do not use UI text smaller than 12 px. Do not scale fonts directly with viewport width. Letter spacing should be 0 unless a specific component requires a tiny adjustment.

Spacing:

- Base grid: 4 px.
- Common spacing: 8, 12, 16, 20, 24, 32, 40.
- Screen horizontal padding: 20 px.
- For 360 px width, 16 px horizontal padding is acceptable.

Radius:

- Small controls: 12 px.
- Cards: 16 px.
- Large cards: 20 px.
- Bottom sheets: 24 px.
- Chips/capsules: 999 px.

Elevation:

- Card shadow: 0 4px 16px rgba(32, 35, 48, 0.06).
- Floating action shadow: 0 8px 24px rgba(36, 107, 94, 0.20).
- Do not use more than two elevation levels on one screen.

Borders:

- Default border: 1 px solid #E2E5EC.

## Colors

Use semantic tokens. Do not scatter raw color values through implementation unless defining tokens.

Core colors:

- bg/base: #F6F8F6
- bg/surface: #FFFFFF
- bg/subtle: #EDF2EF
- text/primary: #1F2926
- text/secondary: #63716C
- text/tertiary: #87938E
- border/default: #DCE5E1
- brand/primary: #246B5E
- brand/pressed: #1B5148
- brand/soft: #E5F1ED
- accent/sand: #D19A52
- accent/teal: #178F83
- success: #2E8B57
- success/soft: #E8F5ED
- warning: #B86E00
- warning/soft: #FFF3D6
- danger: #C54848
- danger/soft: #FCEBEC
- info: #2F6FD0
- focus/ring: #3F8C7C

Oracle node colors:

- Goal: #246B5E
- Project: #3B74D8
- Idea: #D88916
- Task: #168F83
- Completed: #9AA0AE
- Recommended edge: #246B5E
- Regular edge: #CDD1DB

Accessibility:

- Meet WCAG AA for core text, controls, and states.
- Do not communicate meaning by color alone. Add icon, label, shape, or text.
- Do not use Oracle node colors as small text on white.
- Use accent/sand for supportive illustration and idea/chaos cues, not for small text or primary actions.

Avoid:

- aggressive red as a primary color;
- heavy gradients;
- glassmorphism;
- glow-heavy UI;
- decorative orbs/blobs;
- purple or violet as the primary brand color;
- generic purple "AI product" styling;
- overly dense badges/chips;
- childish gamification;
- direct Todoist copying.

## Iconography And Illustration

Use simple rounded outline icons, visually compatible with Lucide, with 1.75-2 px stroke.

Do not mix icon families.

Illustrations, when needed, should use soft abstract routes, nodes, and organic connection patterns. Avoid mascots and character illustrations.

Prefer icons for compact commands when a familiar icon exists. Add accessible labels and tooltips where appropriate.

## Motion

Motion should support understanding, not decorate the app.

- Microinteraction: 160 ms.
- Screen/bottom-sheet transition: 240 ms.
- Easing: ease-out.
- Voice recording: soft pulse, not bright strobe.
- Rescheduling: cards move smoothly and show Undo.
- Oracle: natural force-directed movement without constant chaos.
- Support reduced-motion.

## Components

Build reusable components with variants and states. Do not draw one-off UI where a component should exist.

Required components:

- buttons: primary, secondary, tertiary, destructive, icon, Google; default, pressed, disabled, loading;
- floating Brain Dump button: idle, recording, processing;
- inputs: text, search, textarea, voice transcript; default, focus, error, disabled;
- checkbox/task completion control;
- task card: scheduled, current, completed, needs-reschedule, locked, syncing;
- idea card, project card, goal card;
- priority, energy, alignment, and source chips;
- status badge;
- date/time/duration picker rows;
- segmented control;
- switch;
- energy and workload selector;
- progress ring and linear progress;
- overload indicator;
- calendar event block: Google event, flexible task, locked task, focus block;
- day strip and week strip;
- bottom navigation;
- top app bar;
- bottom sheet;
- toast/snackbar with Undo;
- inline AI insight;
- empty state;
- skeleton/loading state;
- error banner and pending-sync banner;
- paywall feature row;
- Oracle node: Goal, Project, Idea, Task, Completed, selected, dimmed;
- Oracle edge: default, recommended, AI-suggested, selected;
- filter chip and filters sheet;
- Telegram connection status;
- audio recorder with waveform, timer, stop, cancel;
- AI processing steps;
- Pomodoro timer controls.

## Oracle Graph

Oracle is a mobile force-directed semantic graph inspired by Obsidian. It is not a tree, org chart, or static mind map.

Node types:

- Goal: largest central node;
- Project: large structural node;
- Idea: medium node;
- Task: compact node;
- Completed: muted state.

Interactions:

- pan;
- pinch-to-zoom;
- drag nodes;
- tap node to open bottom sheet;
- double-tap to center node;
- select node to dim unrelated nodes;
- Show Path to highlight the route;
- filters by type, goal/project, status, period, alignment, energy, and recommended path only.

Path examples:

- idea -> possible project -> needed tasks -> main goal;
- goal -> recommended projects -> next steps.

Modes:

- Balanced: default; shows the whole graph, alignment score, and soft suggestions.
- Goal Focus: keeps focus on the selected goal and deadline-critical work; defers unrelated flexible items with Undo.

## Data And AI Behavior

Main entities:

- User;
- Task;
- Idea;
- Project;
- Goal;
- Graph Edge;
- AI Session / Change Set.

AI workflow:

- transcribe voice when needed;
- classify input;
- estimate confidence;
- ask at most 1-2 critical questions only when confidence is low;
- return structured JSON;
- suggest semantic links;
- pass tasks to the deterministic scheduler.

AI must not write directly to persistent data. Server-side code validates shape, enum values, ownership, and permissions before applying changes.

Store a change snapshot before meaningful automatic changes so Undo can restore both app state and Calendar state where applicable.

## Scheduling Rules

- Google Calendar events block time.
- Meetings and locked tasks do not move automatically.
- Hard deadlines are scheduled first.
- Then consider priority and goal alignment.
- Deep Work goes into high-energy periods.
- Routine work goes into lower-energy periods.
- Add breaks between large blocks.
- Do not exceed the daily workload cap without warning.
- Split large tasks into focus blocks.
- If there is no realistic slot, leave the item in Inbox or move it to the next available day.
- When a task is missed or a new Calendar event appears, recalculate only the future flexible part of the plan.

## Integrations

Google:

- Google is the primary login.
- Calendar permission is requested during login/onboarding.
- Existing Calendar events are busy slots.
- App-created tasks are Calendar blocks.
- Changes to app-created blocks should sync both ways.
- If an app-created Calendar block is deleted in Google Calendar, the task becomes unscheduled and returns to scheduling; the task itself is not deleted.

Telegram:

- Link Telegram to the Google profile with a one-time deep link.
- Accept Ukrainian text and voice.
- Run the same AI workflow as web Brain Dump.
- Send morning plan, reminders, overdue/conflict notifications, auto-reschedule results, evening review.
- Respect quiet hours and notification frequency.
- Include actions where useful: "Відкрити план", "Розбити ідею", "Перепланувати", "Undo".

Stripe:

- Use Stripe Test Mode.
- Product: Lifetime Pro.
- Price: one-time $100.
- Unlocks unlimited goals.
- Activate Pro only after verified Stripe webhook.

## Demo Persona

Use one consistent demo profile across screens, mocks, seed data, and demos:

- User: Олена.
- Main goal: "Запустити перший сезон подкасту про кар'єрні зміни до 30 вересня".
- Work hours: 09:00-18:00.
- Energy peak: 09:30-12:30.
- Google event: "Командний синк", 11:00-11:45.
- Deep Work task: "Підготувати структуру першого епізоду", 60 хв.
- Routine task: "Написати лист потенційному гостю", 20 хв.
- Idea: "Зробити епізод про синдром самозванця".
- Project: "Пілотний епізод".
- Neutral task: "Замовити корм коту".
- Low-alignment idea: "Почати паралельно YouTube-канал".

Example brain dump:

"Мені треба підготувати перший випуск подкасту, написати Марії про запис, ще не забути замовити корм коту. Думаю зробити окремий епізод про синдром самозванця, але не знаю, чи варто зараз ще запускати YouTube. У четвер об 11 у мене командний синк".

Do not change this persona casually. Today, Calendar, Oracle, and task details should remain logically consistent.

## Engineering Notes

Recommended architecture:

- Next.js mobile-first web app deployed to Vercel.
- Supabase/PostgreSQL for data.
- Server-side APIs for users, tasks, ideas, projects, goals, AI, integrations, webhooks, and scheduled jobs.
- PWA-friendly frontend.
- Secrets must stay server-side and out of git.
- Use idempotency keys for Telegram and Stripe webhooks.
- Store user data isolated by user ID.
- Delete voice files after transcription by default; store text transcript.

Do not implement AI scheduling as a pure LLM prompt. Keep scheduling deterministic and testable.

## Quality Bar

Before claiming design or implementation is ready, verify:

- Ukrainian UI copy is consistent and natural.
- Mobile widths 360, 390, and 430 px work.
- Touch targets are at least 44 px.
- Text does not overlap or overflow.
- Main flows have loading, empty, error, offline/syncing, and Undo states where needed.
- Google, Telegram, AI, and Stripe demo paths are real or clearly marked as mocked if not yet implemented.
- Oracle works as a semantic force-directed graph with mobile gestures.
- Automatic changes are visible and reversible.
- The interface remains calm and understandable for users with ADHD.

## Reference Documents

- Product specification: `docs/superpowers/specs/2026-07-18-ai-planner-design.md`
- Designer handoff prompt: `docs/handoffs/ai-designer-master-prompt.md`
