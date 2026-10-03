# Adaptive — design system

**Working name.** No product name, logo or brand assets were provided; "Adaptive" is a placeholder used in the thumbnail and docs. Replace it when a name exists.

## Product context
> Scope note: this README was written for the original design brief. Where it differs from [docs/product.md](../../docs/product.md) (for example calendar integration and "adapts from sleep"), the product docs win. Visual and content rules below still apply.

A general-purpose fitness app for people who want to stick with training. It generates a workout plan from the user's preferences (goal, equipment, time, best times of day) and **adapts the plan to the user** — calendar conflicts, sleep, previous sessions — instead of asking the user to edit the plan. Calendar integration is a core feature.

Design goals from the brief: minimal, modern, warm, natural; show only what matters right now; never feel like "another AI design"; the user should feel at ease. Light and dark themes are first-class.

**Sources:** none. Built from scratch from a written brief (no Figma, codebase, screenshots or decks). Every value here is an initial proposal.

Surfaces: the mobile app (Expo, `apps/mobile`); the web dashboard reuses the same tokens. Screen prototypes live in [`../prototype`](../prototype).

## Content fundamentals
- **Voice:** a calm coach who already did the thinking. Explains changes in one line: cause, then effect. "Moved to Friday — you have meetings until 6."
- **Person:** "you" for the user; "we" sparingly for the app ("We kept it short"). Never "I".
- **Casing:** sentence case everywhere, including kickers and section labels. No all-caps labels; they read as corporate.
- **Length:** buttons 1–2 words (Start, Adjust, Update plan). Headings under 4 words. Notes one sentence.
- **Numbers:** only when they explain something (20 min, 7:00). No scores, streak counters, percentages of "readiness". Use × for sets × reps and · as a separator: "3 × 10 · 16 kg". Minutes as "42 min" in text, "6′" in compact structure labels.
- **No guilt:** there is no "missed" state. Sessions get moved, not failed. Avoid "crush", "beast", exclamation marks, hype.
- **Emoji:** never.
- **Greeting:** follows the time of day: "Good morning, Ana" until noon, then "Good afternoon", then from 18:00 "Good evening". Warm, no exclamation marks.
- **Beginners first:** assume no gym knowledge. Name the exercise and describe it in one sentence (no demo videos in the MVP), reassure without hype: "Everyone starts somewhere." Explain terms the first time (RPE, superset) or avoid them.
- **Encouragement:** when a week is done, say so warmly and give one plain reason it matters ("Moving a little most weeks is good for your mood, your sleep and your heart."). No streaks, scores or hype.

## Visual foundations
- **Color:** warm paper (#F8F2E8) and warm ink (#1D1914) in light; warm charcoal (#141210) with cream text in dark. One accent, **friendly blue** (`--blue-500` with paper text in light, `--blue-300` with ink text in dark), used for the primary action, progress and "the plan changed" notes. Blue over gold: encouraging and trustworthy, pride without pressure. Supporting earth tones — sage (recovery), moss (success), brick (danger), dusk (info, a muted violet-grey kept clear of the accent) — are muted and rare. No pure white or black surfaces, no gradients as decoration.
- **Type:** Bricolage Grotesque (display + numerals, semibold, −0.035em at large sizes) gives warmth and a little character; Hanken Grotesk for all reading text. Bold (700) Bricolage for titles and SuggestionCard headlines — round, friendly, a little playful. Tabular numerals for times, weights, durations. Use the `--type-*` shorthands.
- **Friendly tints:** `--tint-blue`, `--tint-peach`, `--tint-sage` for soft section backgrounds; `--warm` (peach) for encouragement and celebrations, never for actions.
- **Contrast:** every text token passes 4.5:1 on every surface in both themes (`--text-tertiary` is `--ink-500` #6F6557 in light, #9C9182 in dark). Status colours as text use `--success-text`, `--danger-text`, `--info-text` and `--accent-text`; the plain status tokens and `--accent` are for icons, dots, borders and fills.
- **Spacing:** 4px base. Screen gutter 20, card padding 20, stack gap 12, section gap 24–32. Hit targets ≥ 44px.
- **Backgrounds & imagery:** screens stay flat paper. Warmth comes from **SuggestionCard** — a photo (or, until photos exist, a soft grain texture over blurred dusk/dawn/sage color fields) with a bottom protection gradient and a bold display headline. Photography: warm natural light, real non-athlete people in everyday places, motion blur and grain welcome; never glossy gym/stock shots. **Exercise media** (provider images/GIFs) are out of the MVP (review, 3 October): gym screens name and describe each exercise instead. `ExerciseMedia` stays in the kit for later and as the icon disc in `ExerciseRow`.
- **Cards:** `--surface-card` on `--bg-app`, 20px radius, 1px `--border-subtle` hairline, near-invisible warm shadow (`--shadow-1`). Dark mode drops shadows to a faint ring. Sunken cards (`--surface-sunken`, no border) for secondary grouped info. Never colored side borders; never nested default cards.
- **Corner radii:** controls 18, cards 24, sheets 32, buttons/chips/tabs pill. Round and soft for a friendly, approachable feel.
- **Borders:** 1px hairlines in `--border-subtle` for list dividers; `--border-strong` for input and secondary-button outlines.
- **Shadows:** brown-tinted, low opacity, 3 steps. Elevation communicates layering (sheet over screen), not importance.
- **Hover:** background shifts one step (card → sunken; accent 500 → 600). **Press:** scale 0.97 on buttons/chips, 0.99 on cards, plus darker accent. No opacity flashes.
- **Focus:** 3–4px soft blue ring (`--focus-ring`).
- **Motion:** `--ease-out` 120–200ms for UI feedback, `--ease-in-out` 320ms for sheets, `--ease-spring` only when an exercise is ticked off. Fades and short slides; no bouncing elsewhere, no confetti.
- **Transparency & blur:** only the floating pill tab bar (82% raised surface + backdrop blur) and the sheet overlay. Sticky bottom actions use a short fade to the background color.
- **Layout:** single column, generous whitespace. Fixed elements: status bar, floating pill tab bar or a bottom action bar (never both). One primary (blue) button per screen.
- **Data density:** each screen answers one question (What today? What this week? What do I prefer?). Secondary detail lives one tap deeper.

## Iconography
- **Lucide** (CDN, `lucide@0.460.0` UMD) rendered through the `Icon` component at 1.75 stroke, round caps/joins — a soft line that matches Hanken Grotesk. 16px inline, 20px default, 22px tab bar. Active tab icons go to stroke 2.
- No icon font, no PNG icons, no emoji, no unicode glyphs as icons (× and · are typographic, not icons).
- Icons sit beside text; icon-only buttons always carry a label (aria + tooltip).
- Frequently used: sun, calendar, calendar-clock, calendar-check, user-round, arrow-right, arrow-left, check, moon, footprints, timer, feather, dumbbell.
- **Substitution flag:** Lucide was chosen, not inherited. Swap freely if a brand icon set appears.

## Logo
None provided, none created. Wherever a mark would go, set the product name in Bricolage Grotesque 600 (see Brand → Name in type).

## Fonts
Bricolage Grotesque and Hanken Grotesk, woff2 (latin + latin-ext) self-hosted in `fonts`, downloaded from Google Fonts. Both are open-source picks, not brand fonts — replace if you have licensed ones.

## Index
- `styles.css` — entry point (imports every token file)
- `tokens/` — `fonts.css`, `colors.css` (base + semantic, dark via `[data-theme="dark"]`), `typography.css`, `spacing.css`, `effects.css`, `base.css`
- `fonts/` — woff2 files
- `components.js` — all components as one browser script (Babel-compiled JSX, readable). Registers `window.DS`. Needs React 18 UMD and Lucide UMD on the page. It is the reference implementation for porting components to `apps/mobile` and `apps/web`; it is not imported by the apps.

## Components
Only components the prototype screens use are kept in `components.js`:
- **core:** Icon, Button, IconButton, Badge, Tag, Card
- **forms:** Input, Radio
- **fitness:** SuggestionCard, ExerciseRow (with ExerciseMedia), ProgressRing

Screen-level pieces (floating nav bar in its two chat placements, the chat button, top/bottom bars) live in `../prototype/screens.jsx`. Chat pieces (Bubble, ChangeCard with ChangeRow and Diff, Reply, QuietOption, Options, LogCard, Working, Problem, Composer) live in `../prototype/chat.jsx`; coach bubbles use `--surface-bubble`, because `--surface-sunken` is darker than the page in dark mode. Home pieces (WeekNav, WeekStrip, HeroCard, SessionRow, StepCount) live in `../prototype/home.jsx`. Workout pieces (MetricField, FileImport, NumberStepper, SetList, Sheet) live in `../prototype/workout.jsx`; promote them here when the app needs them. Profile pieces (PrefRow, Statement, Evidence, ItemRow, LinkRow) live in `../prototype/profile.jsx`. Sheet and the onboarding choice pieces (Question, Segmented, Slider, RangeSlider, CheckRow) are already shared across scopes, so promote those first. Calendar pieces (Month, Agenda, Version) live in `../prototype/calendar.jsx`. `Input` takes `inputMode` for keypads and `autoComplete` for email and password; its hint or error is linked with `aria-describedby`, and an error is announced. `ExerciseMedia` and `ExerciseRow` take an `icon`/`mediaIcon` for the placeholder (footprints for walks). `SuggestionCard` takes `secondaryLabel`/`onSecondary` for one quiet text action beside the light button (Home's **Not today**), and renders `children` last, for example a progress bar.

Theming: put `data-theme="dark"` on any ancestor; every component reads semantic tokens only.
