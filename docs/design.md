# Day by Day improvement design

Status: accepted for implementation. The user accepted rounds one through three and authorized yes defaults for the remaining choices, asking to see a working result.

## Agreed requirements

- Support both phone and laptop use. Make workout information readable at a glance and reduce scrolling during a session.
- Give the redesign creative freedom over typography, colors, spacing, and visual polish.
- Increase text readability, keep timer controls easily accessible, and provide generous interaction targets.
- Show consistency and performance separately. Scheduled recovery should count appropriately when evaluating consistency.
- Support quick results logging after each set, with previous results alongside.
- Improve the timer with audible feedback, as detailed below.

## Agreed in round two

- End rest with a clear chime. Enable sound by default, with a visible mute control and a Test sound action.
- Keeping the workout open and the phone screen awake is acceptable for the first version. Locked-screen alerts are outside this first version's requirements.
- Finish workout is an explicit action. Preserve all logged results, record unfinished sets as skipped, and distinguish partial sessions from fully completed ones. Opening a workout earns no completion credit.
- Keep missed sessions on their planned dates unless deliberately rescheduled. Record actual training dates separately.
- Scheduled rest preserves the training streak without a check-in. An uncompleted scheduled training day breaks the streak.
- Suggest advancement only when recorded results satisfy the applicable progression rule. Show the evidence, require confirmation, and preserve the actual variation performed in history.
- Results should automatically appear on both phone and laptop. Personal sign-in is agreed; service and hosting implementation details remain open.

## Agreed in round three

- Keep the product a personal tracker with private sign-in and shared phone/laptop history. Social feeds, leaderboards, and coaching features are out of scope.
- Adapt logging to repetitions, hold seconds, separate left/right results, and exercise variation or assistance. Record actual distance and elapsed time for runs. Display technique instructions; require deliberate confirmation before saving a result.
- Start prescribed rest when a set is confirmed; for supersets, start rest after both exercises in the round. Provide pause, restart, and add-time controls and show the next exercise beside the countdown.
- The overview shows completed versus planned workouts this week, current and best training streak, and recent performance improvements.
- A Progress view contains exercise history, comparable personal bests, and running trends. Compare the same exercise variation; do not equate higher rep counts at easier variations with improvement.
- Preserve workout prescriptions. Offer progression suggestions only for clear rules, require confirmation that prescribed technique was met, and keep pull-ups and chin-ups separate. Flag conflicting instructions for clarification. Exclude the undefined "five numbers" instruction from calculations until defined.
- Partial sessions count as activity but not fully completed workouts, and do not preserve the completion streak.
- Preserve existing checkmarks and notes without inventing repetitions, actual performance dates, or personal bests. Show missing performance honestly and support manual entry of older results.

## Verified current behavior

Inspected repository main at commit `26f70e37298041822a502cbfb1082ff20a00ef63`.

- Exercise names are 13px, prescriptions 12px, and mobile day labels can shrink to 7px.
- On narrow screens, the timer appears below the session list.
- The timer has no audio and resets when the page is reopened.
- History stores date-keyed exercise checks, a completion flag, and free-text notes. It contains no structured set results or actual performance dates.
- A checkbox may represent an entire superset block.
- Sundays are scheduled rest days.
- The routine requires reaching the top of the repetition range on every set before advancing, but the app does not track the stage actually performed.

Sources: [styles.css](https://github.com/reuel5904/day-by-day/blob/main/styles.css), [app.js](https://github.com/reuel5904/day-by-day/blob/main/app.js), [README.md](https://github.com/reuel5904/day-by-day/blob/main/README.md), [routine.md](https://github.com/reuel5904/day-by-day/blob/main/routine.md).

## Additional verified constraints

- The routine needs repetitions, hold seconds, left/right results, exercise variation or assistance, tempo instructions, running distance/time, and individual exercise results within superset rounds.
- The phrase "all 5 numbers" is repeated but never defined.
- Progression instructions contain exceptions and ambiguities, including whether pull-up and chin-up results share a progression rule.
- Deload instructions differ between two below the top of the target range and two below personal best. Some test-week summary instructions and exercise set counts also differ.
- No October 16 baseline values are included in source. Missing historical performance must remain missing unless entered by the user; planned prescriptions and old checkboxes cannot establish achieved performance.

## Remaining defaults accepted

- Save workout entries locally immediately, support offline logging, and synchronize after reconnection. Show save/sync status and preserve conflicting edits until explicitly resolved.
- Move individual workouts only. Preserve original date, revised scheduled date, and actual training date. Moving an already missed workout does not erase its earlier missed deadline.
- Keep the existing October 13, 2026–January 10, 2027 program, with individual rescheduling. Reusable programs and a general plan builder remain outside this version.
- Proceed with the working design without additional interview or design approval questions.

## Implementation

- Build with the Sites Vinext starter, private ChatGPT sign-in, and a user-scoped D1 event history.
- Cache the app for offline reopening after an online visit. Use device-local storage as an immediate write buffer, and the authenticated database for cross-device durability.
- Each edit names its prior versions. Concurrent branches remain visible conflicts; a deliberate resolution references both parents. Retries are idempotent.
- Preserve original prescriptions verbatim above structured logging controls, including alternative set options, negative tempos, unilateral results, strides, and unmatched extra superset sets.
- Keep workout timers accessible on narrow layouts with a floating control. Audio requires a browser interaction; keeping the app visible is part of the accepted first-version requirement.
- No synthetic performance or completions are seeded in the delivered app. Unknown historical measurements remain unknown.

## Validation

- TypeScript checks and production builds.
- Thirteen domain/data-integrity checks covering dates, parsing exceptions, streaks, late and partial completion, legacy data, and conflicting edits.
- Local authenticated API checks for durable D1 read/write, retry idempotency, concurrent edits, malformed payload rejection, and cross-origin protection.
- Browser checks of the local signed-in app: set logging starts the prescribed timer, survives a reload, and appears in performance history.
- Real-device locked-screen audio is outside scope. Offline caching and authenticated cross-device use must still be exercised on the user's actual devices after publication.


## Review feedback: simpler completion, stronger alarm, denser desktop layout

The user requested quick completion at set, exercise/section, and whole-workout levels, questioned the visible Standard control and extra fields, and asked for a more insistent alarm, larger desktop type, and less spread-out content. These changes supersede the requirement that every completion must include a numerical result.

- Use simple set completion checkboxes by default. Keep numerical result logging optional and collapsed; place variation, assistance, side configuration, and technique confirmation inside it.
- Provide Check all for an exercise/section and the entire workout. Preserve existing numerical measurements, avoid inventing achieved targets, skip conflicted entries, and provide Undo. Whole-workout Check all opens the explicit finishing review.
- Retain numerical results independently of completion flags, including when an individual completion is unchecked. Completion-only activity counts toward consistency after finishing but never toward measured performance or progression suggestions.
- Use a repeating, attention-grabbing alarm with a persistent visual alert and a Stop alarm control. Test alarm uses the same repeated pattern until explicitly stopped. Muting remains available; testing can preview the alarm even when muted.
- Increase desktop exercise headings to 22px, prescriptions to 16px, and set labels to 15px. Tighten cards, vertical spacing, the week strip, and the hero. Use compact set checkbox tiles instead of always-visible input tables.
- Eighteen domain/data-integrity checks cover the original model and completion-only behavior. Browser checks verify section Check all, Undo, whole-workout finish review, optional logging disclosure, and starting/stopping the alarm test.


## Timer length options

- Offer 30, 45, 60, 90, and 120 seconds as presets.
- Provide Custom time on desktop and in the expanded phone timer, with separate minutes and seconds inputs. Require a positive whole-second duration and seconds between 0 and 59.
- Applying a new length resets the timer to that length, ready to start. Cancel preserves the existing timer. Custom durations use the same pause, reset, add-time, persistence, and alarm behavior as presets.
- Browser verification covered the 30-second selection, a custom 1:15 duration, and rejection of 0:00.

## GitHub Pages publication

The user explicitly selected the complete static interface on GitHub Pages with device-local history, retaining the private synced app separately. Pages saves in the current browser; Settings links to the private version for shared history. Original Pages history migrates automatically and its source storage key is retained. The published source includes a reproducible static build, checks, and migration tests.
