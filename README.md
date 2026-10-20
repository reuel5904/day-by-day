# Day by day

A simple, self-contained calisthenics and running planner. No dependencies, accounts, build step, or external requests.

## Open it

Double-click `index.html` to use it immediately. Keep the files in this folder together.

## Self-host it

Copy this folder to any static web host. For a local server, run this in the folder:

```sh
python3 -m http.server 8080
```

Then visit http://localhost:8080.

## Use it

- Select a week and day; “Jump to today” opens today's session (or the nearest plan date).
- Check off each exercise or mark the entire session complete.
- Use the rest presets, or click an exercise's rest shortcut to set the timer.
- Write reps, times, and other observations in session notes.
- Export progress for a backup; import to restore it. Import replaces matching dates and keeps other dates.

Progress and notes are saved in browser storage. They belong to the current browser and website address. Moving from a local file to a hosted website does not automatically transfer progress; export before moving and import afterward. Private browsing and browser settings may prevent persistence. Timer completion is visual and announced to screen readers; there is no audio alarm.

The routine is transcribed from `routine.md`, with combined core exercises separated into individual checklist steps. Supersets remain together. Dates are October 13, 2026–January 10, 2027, matching the source's weekdays. Training prescriptions, including abbreviated later-week references, are preserved as written. Update `routine.js` to change the structured plan.
