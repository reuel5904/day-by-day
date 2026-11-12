# Coding standards

Rules the review enforces on every diff. `npm run format:check`, `npm run lint` and `npm run check` already enforce what they can; these are the rest. Each rule names where it's explained.

## Training history

- A workout with saved results keeps its date, exercise IDs, set counts and units, since results are keyed by date and exercise ID (`CLAUDE.md`, Loading a new program).
- Synced history is append-only: a correction or deletion is a new event, never an update or delete of an existing one (ADR-0005).
- A recorded result stays separate from what the program prescribed, and a number counts as a result only when the owner entered it or ticking a fixed target recorded it (ADR-0001, ADR-0007).

## Programs

- A variation is spelled exactly as earlier programs spell it, since personal bests compare results by variation (`CLAUDE.md`, Loading a new program).

## Secrets

- The browser gets only Supabase's publishable key, never a secret or service-role key (`README.md`, Supabase setup).

## Glossary

- A diff that adds a domain thing, renames one, or changes what one is or does updates its `GLOSSARY.md` entry in the same diff.
