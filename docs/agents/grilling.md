# Grilling an issue

Rules for a grill that plans a GitHub issue, on top of the `/mattpocock-skills:grilling` skill.

- **Facts are checked.** The issue states facts about existing code (what a file already does, what a test already covers) only after checking the code. A rule over a whole set (every program, screen or event type) is checked against the full list. A fact copied from an older issue is checked too, since those go stale.
- **A rare case is asked about only when getting it wrong does real harm:** lost results or history, or a security hole. Any other rare case gets the simplest answer, listed under "Assumed" in the posted decisions, where Reuel can overturn it. A question about a rare case says it's rare before the options.
- **Each acceptance criterion can be checked within its own ticket.** A check that needs a later ticket goes in that ticket.
- **Every box is one the PR can tick before it merges.** A check on the live site is an after-merge step, written as a plain line (`docs/agents/implement.md`, After merge).
- **A grill that rescopes another ticket edits it.** When a decision changes the scope of another unstarted ticket, edit that ticket's title and body and post a one-line comment pointing at the edit, so its body never says what a later comment takes back.
- **The grill ends with its decisions posted as a comment on the issue,** including the test seams for `/tdd`, so `/implement` sees them. For UI-only work with no testable logic, the seams line says "none: verify in the browser".
