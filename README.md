# Day by Day

A personal calisthenics and running planner, published at **https://reuel5904.github.io/day-by-day/**.

Follow a dated training program (the current one runs October 13, 2026–January 10, 2027), tick off sets as you go, rest with an audible timer, and track consistency and measured performance.

## GitHub Pages version

The interface is a static app on GitHub Pages. It saves history immediately in your browser and works without an account. Optional Supabase sign-in shares private training history across browsers and devices.

### Sync your progress

1. Open **Settings & backup** and enter your email address.
2. Open the emailed sign-in link in the browser you want to use.
3. Open Settings again and choose **Add browser history to my account** to include any existing device-only progress. The original browser copy stays intact.
4. Sign in with the same email on your other browsers and devices.

Changes sync shortly after editing, on focus/reconnection, and every 45 seconds while the app is open. **Sync now** refreshes immediately. Offline edits remain queued until an upload succeeds. Concurrent edits remain available for explicit resolution, and retrying an upload never rewrites an existing event. A history download reads all pages rather than stopping at the Data API's 1,000-row default.

Signed-out history and each account's cached history use separate browser storage. Signing out on one browser leaves other devices signed in; any queued changes remain available when that account signs back in. Timer state and sound preferences stay local to each browser. Export JSON through Settings & backup to keep an independent backup.

- Today opens with one row for the workout (title, date, week, sets done and reschedule), then its sets, so the first set is on a phone's first screen.
- On phones, Today, Schedule and Progress tabs sit at the bottom with the rest timer floating above them.
- Light and dark themes follow the device setting.
- The screen and day live in the URL (`#/workout/2026-10-22`, `#/schedule`, `#/progress`), so a refresh keeps your place, the back button works, and a link opens a specific day.
- After a program's last day, until the next one starts, Today shows its summary: workouts completed out of planned, best streak, personal bests, and the test-week results, with the final dead hang compared with Oct 16.
- Individual completion checkboxes and Check all for exercises, sections, or the whole workout, with Undo. Sections with a single box have no Check all.
- Choose Classic beep, Soft chime, Bell, or Digital pulse in the timer or Settings & backup; test the selected alarm and keep your choice in this browser.
- Rest presets of 30, 45, 60, 90, and 120 seconds, plus custom minutes and seconds, pause/reset/add-time, and a repeating alarm with Stop alarm.
- Progress shows completed workouts, checked sets, active training days, weekly completed/planned workouts, strength/running totals and rest days. A workout is complete as soon as every exercise set is ticked; warm-ups and cool-downs are optional, and Finish early saves a partial workout.
- Schedule, session notes, rescheduling, weekly completion, rest-aware streaks, exercise history, comparable personal bests, and running time/distance/pace.
- Ticking a fixed-target set records its number (3×20s records 20 seconds per set; a run records its planned distance). Ranges and max tests ask for the number when ticked, and unticking removes only numbers that ticking recorded (ADR-0007).
- Offline reopening after an online visit. Keep the page open and interact once for timer audio; locked-screen alerts are not guaranteed.

Workouts imported from the original app keep their checkmarks and notes as imported completions, with no assumed training date, set results or streak credit.

## Supabase setup

The **Day by Day** project (`tkuybjpgfmjzsbcpuaol`, US East) is in Reuel Enterprises. The publishable key in `web/src/supabase.ts` is intended for browser use. Never add a secret or service-role key to the app.

`supabase/migrations/` records the deployed schema. `training_events` is append-only, with `(user_id, id)` as its primary key. Authenticated users may select and insert only rows owned by their verified Supabase identity. Anonymous access, direct updates, and deletes are not granted. Corrections and deletions use resolving events in the existing history model.

Authentication uses Supabase's default email magic link and persistent browser sessions. The Site URL is `https://reuel5904.github.io/day-by-day/`; the exact local testing return URL `http://127.0.0.1:5175/day-by-day/` is also allowed. No wildcard redirects are configured.

Supabase's built-in email service is limited to organization-member email addresses and a low sending rate. This setup is for the owner's personal use. Configure custom SMTP in Supabase before inviting other people. No paid email service or Supabase plan was enabled.

## Development

Node.js 22.13+ is required. Use `npm run dev -- --port 5175 --strictPort` when testing email sign-in locally, matching the allowed redirect URL.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5174/day-by-day/`. Authored client code is in `web/src/`; `web/index.html` is the Vite entry point. Each program lives in `web/src/programs/<start date>/`: `program.ts` is its structured data and `roadmap.md` the roadmap it was converted from (ADR-0006). `web/src/exercises.ts` lists the exercise names every program uses, so an exercise keeps one history across programs. `CLAUDE.md` has the steps for loading a new program from a roadmap.

```sh
npm run format:check   # npm run format fixes it
npm run lint
npm run check
npm test
npm run build
```

The build writes the site to `dist/`, which is not committed. Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): it runs the checks above, builds, and deploys `dist/` to GitHub Pages, and nothing deploys if a check fails. The Pages source is set to **GitHub Actions**. The `/day-by-day/` asset base and service worker scope are configured for this project site.

The tests cover program data integrity, set completion, the program summary, URLs, conflict preservation, streak rules, imported-history validation, account isolation, retry behavior, concurrent edits, malformed responses, and paginated downloads. `supabase/tests/training_history.sql` verifies real database role access inside a rolled-back transaction, including anonymous denial, cross-account isolation, and immutable retry semantics. See `GLOSSARY.md`, `docs/design.md`, and `docs/adr/` for product behavior and decisions.
