# day-by-day

## Workflow

Commit straight to `main`, one issue at a time, and use a branch only when a change really needs one. This repo's rule replaces the usual feature-branch default. Before each commit, run the checks `.github/workflows/deploy.yml` runs; a push to `main` deploys only when they pass. End an issue's last commit with `Closes #N`.

## Loading a new program

Each program lives in `web/src/programs/<start date>/`: `roadmap.md` is the roadmap as written and `program.ts` its structured data (ADR-0006). `web/src/programs/2026-10-13/` is the worked example; copy its shapes.

1. **Save the roadmap** as `web/src/programs/<date of its first workout, YYYY-MM-DD>/roadmap.md`.
2. **Convert it** to `program.ts`, a default-exported `ProgramData` (the type, with its optional fields, is in `web/src/training-model.ts`):
   - `id` is the start date and `note` the roadmap's program-wide note. Ask the owner for `title` and `summary` when the roadmap gives none.
   - Each week comes from its `## code · dates · title` heading, with the line under it as its `note`. Every calendar date the roadmap covers is a day, titled from its bold heading without remarks such as "(today)"; a rest day has `sections: []`.
   - Each exercise or superset is one section, with its roadmap wording as `text` minus markdown; a line that lists several exercises becomes several sections. `kind` is `prep` for warm-up, cool-down and mobility (one `check` exercise, optional for completion), `run` (strides join the run's section), `superset` or `exercise`.
   - `rest` is in seconds. A line that gives no rest takes the rest the same exercise had most recently.
   - Section IDs run `b0`, `b1`, … in order, and exercise IDs `b1e0`, `b1e1`, … within their section. `count` is the number of sets. `unit` is `reps`, `sec`, `run` (miles) or `check`. `target` is one number (`'20'`), a range (`'8-15'`), or absent for a max test.
   - Set `sides` for per-side or per-leg work, `tempo` for a tempo instruction such as `'4s'` on a negative, `alternatives` for a choice such as "5×2-5 or 4×6-8", `progression` only where the roadmap gives a clear rule for advancing at the top of a range, and `test` on the best-effort sets the program summary reports.
3. **Map every exercise** to a name in `EXERCISES` (`web/src/exercises.ts`). An easier or harder version is a `variation` of an existing entry (see Exercise and Variation in `GLOSSARY.md`); add an entry only for a new movement. Spell a variation exactly as earlier programs do, since personal bests compare results by variation.
4. **Ask the owner** about anything ambiguous or undefined before writing it in: a set count that disagrees with itself, an undefined term, conflicting progression or deload rules, an unclear unit. Correct `roadmap.md` with the answer so both files agree.
5. **Register the program** in `web/src/programs/index.ts`, in date order. Programs never overlap.
6. **Add tests** to `scripts/test-pages.mjs` for the program's day count, first and last dates, and every conversion that needed a judgement call. Existing tests describe earlier programs: where one fails on the new program's days, scope it to its own program. Run the checks, then open `#/workout/<date>` on the dev server for a superset day, a run day and a test day.

Saved results are keyed by workout date and exercise ID (`set:<date>:<exercise id>:<set>`), so a workout that has results keeps its date, IDs, set counts and units. Correcting a program already in use changes only workouts without results.

The program is loaded when every exercise in the roadmap is in a section, every question has an answer, and the checks pass.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for reuel5904/day-by-day, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
