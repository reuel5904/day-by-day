# day-by-day

Reuel is the only developer and the app's only user.

## Read first

1. `GLOSSARY.md`, the training vocabulary. Use its terms in conversation, code, and file names.
2. `docs/adr/`: each ADR for the area a task touches. Do not reopen a decided question without new information.
3. `CODING_STANDARDS.md`, the rules the review enforces on every diff.

## Workflow

- **Every change reaches `main` through a PR**, one issue per PR, squash merged. A ruleset on GitHub refuses a direct push.
- **Each branch gets its own worktree**, set up with `npm ci`. Branches are short-lived, and their names start `feat/` (refactors too), `fix/` or `chore/`. **PR titles** are Conventional Commits scoped to one of `today`, `schedule`, `progress`, `timer`, `sync`, `program`, `docs`, `ci` or `deps`, such as `feat(schedule): repeat a week`.
- A PR's CI runs the checks in `.github/workflows/deploy.yml`, and a merge deploys to GitHub Pages: **a merge is a release**.
- **Before a merge**, check that CI passed (`gh pr checks <pr>`), every box on the issue the PR closes is ticked, and nothing in the PR's title, body or commits credits Claude. Tell Reuel about any conflict first, and merge only once Reuel says to, with `gh pr merge <pr> --squash --delete-branch`.
- **Before grilling an issue**, read `docs/agents/grilling.md`.
- Every PR runs **the review** (`docs/agents/implement.md`, The review) before it merges, whether `/implement` made it or not. **Before staging for the review, making a fix commit, or running an after-merge step**, read `docs/agents/implement.md`.
- **Before writing a ticket wrap-up**, read `docs/agents/wrap-up.md`.
- **Before writing a PR body**, read `docs/agents/pr-bodies.md`.

## Loading a new program

Each program lives in `web/src/programs/<start date>/`: `roadmap.md` is the roadmap as written and `program.ts` its structured data (ADR-0006). `web/src/programs/2026-10-13/` is the worked example; copy its shapes. A new program is one PR, titled `feat(program): load the <start date> program`.

1. **Save the roadmap** as `web/src/programs/<date of its first workout, YYYY-MM-DD>/roadmap.md`.
2. **Convert it** to `program.ts`, a default-exported `ProgramData` (the type, with its optional fields, is in `web/src/training-model.ts`):
   - `id` is the start date and `note` the roadmap's program-wide note. Ask the owner for `title` and `summary` when the roadmap gives none.
   - Each week comes from its `## code · dates · title` heading, with the line under it as its `note`. Every calendar date the roadmap covers is a day, titled from its bold heading without remarks such as "(today)" or a holiday name, since a repeated week can move any workout to another date; a rest day has `sections: []`.
   - Each exercise or superset is one section, with its roadmap wording as `text` minus markdown; a line that lists several exercises becomes several sections. `kind` is `prep` for warm-up, cool-down and mobility (one `check` exercise, optional for completion), `run` (strides join the run's section), `superset` or `exercise`.
   - `rest` is in seconds. A line that gives no rest takes the rest the same exercise had most recently.
   - Section IDs run `b0`, `b1`, … in order, and exercise IDs `b1e0`, `b1e1`, … within their section. `count` is the number of sets. `unit` is `reps`, `sec`, `run` (miles) or `check`. `target` is one number (`'20'`), a range (`'8-15'`), or absent for a max test.
   - Set `sides` for per-side or per-leg work, `tempo` for a tempo instruction such as `'4s'` on a negative, `alternatives` for a choice such as "5×2-5 or 4×6-8", `progression` only where the roadmap gives a clear rule for advancing at the top of a range, and `test` on the best-effort sets the program summary reports.
3. **Map every exercise** to a name in `EXERCISES` (`web/src/exercises.ts`). An easier or harder version is a `variation` of an existing entry (see Exercise and Variation in `GLOSSARY.md`); add an entry only for a new movement. Spell a variation exactly as earlier programs do, since personal bests compare results by variation.
4. **Ask the owner** about anything ambiguous or undefined before writing it in: a set count that disagrees with itself, an undefined term, conflicting progression or deload rules, an unclear unit. Correct `roadmap.md` with the answer so both files agree.
5. **Register the program** in `web/src/programs/index.ts`, in date order. Programs never overlap.
6. **Add tests** to `scripts/test-pages.mjs` for the program's day count, first and last dates, and every conversion that needed a judgement call. Existing tests describe earlier programs: where one fails on the new program's days, scope it to its own program. Run the checks, then open `#/workout/<date>` on the dev server for a superset day, a run day and a test day.

Saved results are keyed by workout date and exercise ID (`set:<date>:<exercise id>:<set>`), so a workout that has results keeps its date, IDs, set counts and units. Correcting a program already in use changes only workouts without results. A repeated week follows the same rule, and is the owner's choice in the app, not a change to `program.ts` (ADR-0009).

The program is loaded when every exercise in the roadmap is in a section, every question has an answer, and the checks pass.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for reuel5904/day-by-day, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
