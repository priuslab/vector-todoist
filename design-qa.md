# Design QA — Вектор mobile prototype

- Source visual truth: `/Users/vitaliidoroshenko/Desktop/AIPriusLab/Projects/ToDOist-AI/docs/design/previews/landing-chaos-to-plan-deep-pine.png`
- Implementation URL: `http://127.0.0.1:4173/?screen=entry-chaos`
- Implementation screenshot: `/Users/vitaliidoroshenko/Desktop/AIPriusLab/Projects/ToDOist-AI/prototype/screenshots/entry-chaos-pass-2.png`
- Side-by-side evidence: `/Users/vitaliidoroshenko/Desktop/AIPriusLab/Projects/ToDOist-AI/prototype/screenshots/qa-comparison-pass-2.png`
- Viewport: 390×844 (additional responsive check at 360×800)
- State: Entry / Chaos to Plan / first carousel slide

## Findings

No actionable P0, P1, or P2 findings remain.

- Fonts and typography: Manrope, weight hierarchy, headline scale, four-line wrap, body scale, and small-label treatment preserve the source hierarchy. The implementation has slightly tighter optical density, acceptable for the interactive mobile shell.
- Spacing and layout rhythm: the 20 px page margin, vertical grouping, card radii, surfaces, CTA placement, and 390×844 frame remain stable. The added carousel controls are an intentional approved interaction and occupy the space that the static source uses for larger mapping cards.
- Colors and tokens: deep-pine `#246B5E`, soft mint, warm sand, neutral surface, borders, and text colors map to the approved source. No gradients are used.
- Image quality and asset fidelity: the real cropped Вектор wordmark is sharp and correctly scaled. Phosphor icons are used consistently; no emoji or placeholder art appears. A faint rectangular crop background around the wordmark and the monochrome Google icon are P3-only fidelity refinements.
- Copy and content: Ukrainian product copy matches the approved direction and remains readable without external context.
- Responsiveness/accessibility: no horizontal overflow at 390×844 or 360×800; the persistent Google CTA remains fully visible; interactive controls use semantic buttons, accessible names, focus indicators, and practical tap targets.

## Full-view comparison evidence

`qa-comparison-pass-2.png` places the normalized source and rendered 390×844 implementation in one image. It confirms the same information order, headline hierarchy, deep-pine palette, chaos-to-plan transformation, and primary CTA treatment. The carousel arrows and pagination are the approved product-level deviation from the static source.

## Focused-region evidence

No separate crop was required: the side-by-side board renders both artifacts at native 390 CSS px, and the wordmark, headline, transformation cards, icons, CTA, and helper copy remain legible in one comparison input.

## Comparison history

### Pass 1 — blocked

- [P2] A floating prototype catalog control overlapped the source landing composition.
- [P2] The hero heading wrapped to three lines instead of the approved four-line hierarchy.
- [P2] Transformation rows lacked the per-item thought and time icons visible in the source.

Fixes made:

- Removed the floating catalog control from product screens; the catalog remains available at `?catalog=1`.
- Added intentional first-slide line breaks and tightened line height.
- Added Phosphor thought and clock icons to each transformation row.

Post-fix evidence: `qa-comparison-pass-2.png`.

### Core-flow browser QA — blocked, then fixed

- [P1] The AI Result Undo snackbar overlapped the “Переглянути день” CTA.
- Fix: moved the snackbar to the bottom of the relative result panel. Browser measurement after the fix reports `overlap: 0`.
- [P1] Brain Dump remained indefinitely on the AI processing state.
- Fix: added a timed transition to the first critical clarification, then verified the two-question path through “План готовий”.

## Primary interactions tested

- Entry carousel and Google continuation.
- Voice capture → AI processing → two low-confidence clarifications → AI Result.
- Today screen and bottom navigation structure.
- Oracle graph rendering, nodes, filters/list affordances, path CTA, and selectable graph model.
- Screen catalog search across all 82 states.
- Responsive landing at 360×800.
- Browser console errors checked: none.

## Follow-up polish

- [P3] Replace the monochrome Google mark with the official multicolor asset when production brand assets are added.
- [P3] Export the Вектор wordmark with a transparent background to remove the faint crop rectangle.
- [P3] Add richer source-like connector routing inside the landing transformation visual if the carousel controls are later removed or compressed.

final result: passed

---

## Follow-up — persistent bottom action footer — 2026-07-18

- Implementation URL: `http://127.0.0.1:4173/?screen=onboarding-welcome`
- Source issue supplied by the user: `prototype/screenshots/bottom-action-footer-2026-07-18/source-issue-onboarding-buttons.png`
- Matching post-fix state: `prototype/screenshots/bottom-action-footer-2026-07-18/onboarding-welcome-390x844.jpg`
- Target viewports: 390×844 for the complete Onboarding and Settings route set; 360×800 for compact representative states.

### Before/after comparison

The source issue and the matching 390×844 post-fix render were inspected together in one comparison input. Before the change, the explanatory content and both actions occupied the upper half of the screen, leaving a large unused lower region and placing the actions outside the one-handed reach zone. After the change, the icon, heading, and explanation are optically centered in the available content region, while the primary and secondary actions sit in a dedicated bottom footer separated by a subtle top border. The footer uses layout space rather than covering the content.

No new visual mismatch was found in typography, deep-pine color use, radii, spacing, icon treatment, or Ukrainian copy.

### Complete 390×844 route check

Verified all 22 requested routes:

- Onboarding: `onboarding-welcome`, `calendar-permission`, `work-rhythm`, `quiet-hours`, `energy-peak`, `focus-settings`, `goal-choice`, `goal-manual`, `goal-test-start`, `goal-test-result`, `goal-skip-warning`, `telegram-connect`, `telegram-success`, `first-brain-dump`.
- Settings: `settings-home`, `settings-work`, `settings-energy`, `settings-notifications`, `settings-telegram`, `settings-calendar`, `settings-adaptation`, `settings-pro`.

For every one of the 20 routes with a footer, browser measurements returned `overlap: 0`, `footerVisible: true`, and `horizontalOverflow: false`. `goal-choice` and `settings-home` correctly render without a footer. All footer content regions use `overflow-y: auto`, so long content remains independently scrollable without moving the action area.

### Compact 360×800 evidence

- Centered short state: `prototype/screenshots/bottom-action-footer-2026-07-18/onboarding-welcome-360x800.jpg`
- Form state: `prototype/screenshots/bottom-action-footer-2026-07-18/goal-manual-360x800.jpg`
- Settings form: `prototype/screenshots/bottom-action-footer-2026-07-18/settings-notifications-360x800.jpg`
- Two-row footer: `prototype/screenshots/bottom-action-footer-2026-07-18/settings-adaptation-360x800.jpg`
- Two-row footer with Undo: `prototype/screenshots/bottom-action-footer-2026-07-18/settings-adaptation-undo-360x800.jpg`

All four representative routes returned `overlap: 0`, `footerVisible: true`, and `horizontalOverflow: false`. The compact adaptation Undo snackbar ends at y=646 while the footer begins at y=657, leaving an 11 px gap and never covering either CTA.

### Interaction and snackbar evidence

- Settings Save: `prototype/screenshots/bottom-action-footer-2026-07-18/settings-work-undo-390x844.jpg` — Undo snackbar bottom y=752, footer top y=763, overlap 0.
- AI adaptation: `prototype/screenshots/bottom-action-footer-2026-07-18/settings-adaptation-undo-390x844.jpg` — Undo snackbar bottom y=690, footer top y=701, overlap 0.
- Primary and secondary buttons remained usable in both footer configurations; Save and “Прийняти зміну” produced their expected Ukrainian confirmation snackbars.

### Regression and console result

- Automated suite: 11 test files, 28 tests passed.
- Production build: Vite build passed, 4,618 modules transformed.
- Clean in-app browser pass across the complete route set: 0 console errors, 0 warnings.
- No P0, P1, or P2 issue remains.

### Final-review regression evidence

- Safe-area-aware Undo placement now preserves the 92 px and 154 px base offsets and adds only the inset amount above the footer's existing 14 px baseline padding. The 390×844 zero-inset layout remains visually unchanged.
- Centered goal result: `prototype/screenshots/bottom-action-footer-2026-07-18/goal-test-result-390x844.jpg`.
- Computed result at 390×844: heading `text-align: center`, result card `text-align: left`, footer/content overlap 0, footer fully visible, and no horizontal overflow.
- Post-fix automated suite: 11 test files, 33 tests passed; production build passed.

final result: passed
