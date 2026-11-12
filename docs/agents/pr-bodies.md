# PR bodies

Rules for a PR body written with `/mattpocock-skills:pr`, on top of the skill's own.

Each section opens in plain language, told the way someone using the app would see it. This opening comes before the skill's diagram or table and is part of the section, not a preamble to skip. A file, command, function or git term not in `GLOSSARY.md` gets a few plain words beside it. The technical detail follows for the reviewer.

- **Summary:** the story in one short paragraph: what happened (the bug, or what was missing) and what the change does about it.
- **Evidence:** one sentence on what was tested and what it proved. A check the PR didn't run names the ticket it moved to.
- **Merge Danger:** the lines under Door and Blast Radius say what could break and who would notice. A merge deploys, so say what the live app would show, and whether saved or synced history could be affected.
- **`Closes #N`** for the issue the PR finishes.
- **No Claude attribution** in the body or on a commit: PRs and commits are Reuel's. The `attribution` setting in `.claude/settings.json` turns it off.
