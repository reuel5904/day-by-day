# /implement

`/implement` reviews before it commits.

## Staging for the review

1. `git status` lists only this ticket's files, on this ticket's branch. Anything else means another session shares the folder: stop and tell Reuel.
2. Grep each term the change retires across `README.md`, `CLAUDE.md`, `CODING_STANDARDS.md`, `GLOSSARY.md` and `docs/`, and fix each hit: a ticket's Docs list often falls short.
3. `git add -A`.
4. `git fetch`, then give the reviews (below) `git diff --cached --merge-base origin/main`.

## The review

Every review runs in a fresh sub-agent that sees only the diff, never the implementing agent's reasoning, which a reviewer would tend to agree with. They run at once:

- **`/mattpocock-skills:code-review`** (Standards and Spec), on every PR. It starts its own two sub-agents.
- **Built-in `/code-review` at `medium`** (bugs), on every PR.
- **Built-in `/security-review`** (injection, auth holes, data exposure), on a PR that touches sign-in, sync (`web/src/auth-app.tsx`, `cloud-account.tsx`, `cloud-sync.ts`, `sync-store.ts`, `supabase.ts`), `supabase/migrations/` or row-level security.

The built-in two each get a general-purpose sub-agent that runs the command through the Skill tool, with the diff command in its brief. `/code-review` may ignore the level it's given: a run at another level stands, noted beside its findings.

Review results go in the chat before the merge question, never on the PR. The implementing agent lists every finding, one line each, as **fix**, **skip** (with a reason) or **Reuel's call**, with a finding two reviews share merged into one line. A finding that needs a rare chain of events is a skip unless getting it wrong loses saved results or history, or opens a security hole. Only the fix ones are fixed, without waiting: the list comes back with the merge question, where Reuel can overturn any line. Nothing is committed until Reuel answers, and a call Reuel says to fix counts as a fix.

When there are fixes, one more round, and no third: commit what the reviews saw, make the fixes, and before the fix commit give `git diff HEAD` (the fixes alone) to one general-purpose sub-agent, briefed in plain words to look for bugs, and for security holes if `/security-review` ran. Not the commands: they review the whole branch again, and a second full review mostly finds what the first could have.

## Fix commits

A fix commit after the first names where the fix came from: a review, Reuel or CI, such as "Reuel's calls on PR #14". Its body lists each finding with its review, as its line in chat reads (The review, above), with Reuel's answer to each call. Review results stay off the PR (The review, above), so these commits are the review's only trace on GitHub.

## After merge

Each after-merge step on a ticket (a check on the live site, a GitHub setting) gets a one-line comment on its issue: that it ran and what it found, or that it hasn't yet, naming the open ticket that will run it (with none, ask Reuel for one). Otherwise nothing records whether it ran, and a later ticket has to find out.
