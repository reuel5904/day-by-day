# Day by Day

A personal calisthenics and running planner, published at **https://reuel5904.github.io/day-by-day/**.

Follow the original October 13, 2026–January 10, 2027 program, check off individual sets or whole sections, use audible rest alarms, and track consistency and measured performance.

## GitHub Pages version

This is a static app. It saves history in your browser, works without an account, and does not send workout results to a server. Export JSON through Settings & backup to keep a backup or move history to another browser.

- Larger, compact workout cards and optional result logging.
- Individual completion checkboxes and Check all for exercises, sections, or the whole workout, with Undo.
- Rest presets of 30, 45, 60, 90, and 120 seconds, plus custom minutes and seconds, pause/reset/add-time, and a repeating alarm with Stop alarm.
- Schedule, session notes, rescheduling, weekly completion, rest-aware streaks, exercise history, comparable personal bests, and running time/distance/pace.
- Numerical results remain separate from completion: checking sets never invents reps, times, or personal bests.
- Offline reopening after an online visit. Keep the page open and interact once for timer audio; locked-screen alerts are not guaranteed.

Existing original-app checkmarks and notes are carried over automatically on the same browser and origin. The original `day-by-day-v1` storage is retained untouched. Imported completions have no assumed actual performance date and do not fabricate set measurements or streaks. Extra-long original notes are also retained in the imported legacy record and the untouched original storage key.

## Private synced version

The separately hosted **https://day-by-day-training.nice-star-0243.chatgpt.site/** uses private ChatGPT sign-in and shared history across devices. The Pages app links to it in Settings & backup. The two apps have separate browser storage; export/import your JSON to transfer existing history. GitHub Pages itself does not run the private sign-in or database backend.

## Development

Node.js 22.13+ is required.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5174/day-by-day/`. Authored client code is in `web/src/`; `web/index.html` is the Vite entry point. The original `routine.md` and `routine.js` are retained as reference; the deployed app reads `web/src/routine.ts`.

```sh
npm run check
npm test
npm run build
```

The build writes a static output to `dist/`, then updates the tracked root `index.html`, `assets/`, `favicon.svg`, and `sw.js`. These root files are the deployable artifacts for this repository's existing **main branch / root** Pages source. The `.nojekyll` file bypasses Jekyll. The `/day-by-day/` asset base and service worker scope are configured for this project site.

Commit the source and generated artifacts together, then push to `main`; GitHub Pages publishes them automatically. No Actions token or new hosting credentials are needed. Do not edit generated `assets/` or the root `index.html` directly.

The tests cover routine integrity, set completion, conflict preservation, streak rules, and original-history migration. See `GLOSSARY.md`, `docs/design.md`, and `docs/adr/` for product behavior and decisions.
