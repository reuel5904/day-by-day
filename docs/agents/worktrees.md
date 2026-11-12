# Worktrees

Each branch gets its own worktree, so parallel sessions never share a folder.

## Starting one

1. A session outside `.claude/worktrees/` calls `EnterWorktree` first, unless it's in another worktree (The desktop app and T3 Code, below).
2. In the worktree, one command per call: `git fetch`, `git merge --ff-only origin/main`, `git branch -m feat/x` (the branch name), then `npm ci`.

Branch names start `feat/` (refactors too), `fix/` or `chore/`, and branches are short-lived.

Diff and review with `git diff --merge-base origin/main`: every worktree shares one `origin/main`, which any session's fetch moves, and local `main` goes stale.

## The desktop app and T3 Code

Both apps run Claude Code, and `EnterWorktree` and `ExitWorktree` are Claude Code tools, so these steps are the same in both: in T3 Code too, `EnterWorktree` makes the worktree under `.claude/worktrees/`.

- **Start worktrees with `EnterWorktree` in both apps,** not with T3 Code's own worktree thread mode. Its worktrees live in `~/.t3/worktrees/` and have no isolation guard. A session that finds itself in a worktree outside `.claude/worktrees/` tells Reuel before working, and doesn't call `EnterWorktree` from there.
- **The isolation guard is Claude Code's** [worktree isolation checks](https://code.claude.com/docs/en/worktrees), so it applies in both apps, to any session in a worktree under `.claude/worktrees/`, entered or started there. It refuses Edit and Write on the main checkout's files, commands run from the main checkout, git aimed at it (`git -C` included), and commands too complex to check: heredoc and script edits (`cat >> … <<'EOF'`, `python3 - <<'EOF'`, `xargs sed -i`), `$(…)` and loops. So write paths out, and write `gh` bodies to a file with Write, then pass `--body-file`.

## Removing a merged one

Once `git status` is clean and the merged-branch diff check (global `CLAUDE.md`) is empty, stop what the worktree still runs, since removing its folder stops nothing, and a leftover dev server keeps its port. First stop the background commands your session started. Then `pgrep -fl <worktree path>/`, with the path written out, finds the rest by command (no output, and exit code 1, means none). Read each one's command, then `kill <pid>` the ones this worktree started, never your own session's or another session's.

Then `ExitWorktree` with `remove` and `discard_changes: true`, since a squash merge leaves the branch's commits looking unmerged. It deletes only the branch it created (`worktree-<name>`), so `git branch -D` the renamed branch afterwards.

After that, if `ExitWorktree` put the session back in the main checkout, run `git pull --ff-only` there when `git status` is clean and the branch is `main`. Sessions there load `CLAUDE.md` and the docs from disk at start, so they'd otherwise read rules from before the merge. Otherwise (a dirty tree, another branch, or a session that started inside `.claude/worktrees/`, which the isolation guard keeps out of the main checkout), skip it and tell Reuel to pull.
