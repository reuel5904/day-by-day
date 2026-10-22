import { CalendarDays, Check, Dumbbell, Flame, Footprints, Leaf, ListChecks } from 'lucide-react';
import { addDays, dateLabel, programAt, type Event } from './training-model';
import { calendarDay, progressSummary } from './progress-model';

export default function ProgressOverview({
  map,
  today,
  streak,
  onChoose,
}: {
  map: Record<string, Event[]>;
  today: string;
  streak: { current: number; best: number };
  onChoose: (date: string) => void;
}) {
  const program = programAt(today);
  const summary = progressSummary(map, today, program);
  const stats = [
    {
      label: 'Completed workouts',
      value: summary.completed,
      detail: `${summary.partial} partial · ${summary.inProgress} in progress`,
      icon: <Dumbbell size={20} />,
    },
    {
      label: 'Sets completed',
      value: summary.sets,
      detail: 'Checked strength, core & hold sets',
      icon: <ListChecks size={20} />,
    },
    {
      label: 'Active training days',
      value: summary.activeDays,
      detail: 'Days with dated activity, including partials',
      icon: <CalendarDays size={20} />,
    },
    {
      label: 'This week',
      value: summary.thisWeek ? `${summary.thisWeek.completed} / ${summary.thisWeek.planned}` : '—',
      detail: 'Workouts completed / planned · rest excluded',
      icon: <Check size={20} />,
    },
  ];
  return (
    <>
      <div className="stats-grid progress-stats">
        {stats.map((stat) => (
          <section className="stat-card" key={stat.label}>
            <div className="stat-top">
              <span>{stat.label}</span>
              {stat.icon}
            </div>
            <strong>{stat.value}</strong>
            <p>{stat.detail}</p>
          </section>
        ))}
      </div>
      <div className="progress-summary-grid">
        <section className="weekly-history-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">ONE WEEK AT A TIME</span>
              <h2>Weekly completion</h2>
            </div>
            <span>Finished / planned</span>
          </div>
          <div className="weekly-history-scroll">
            <div className="weekly-history-chart">
              {summary.weeks.map((week) => (
                <div
                  className={`weekly-history-column ${week.start > today ? 'future-week' : ''} ${week === summary.thisWeek ? 'current-week' : ''}`}
                  key={week.start}
                  title={`${dateLabel(week.start)}: ${week.completed} of ${week.planned} workouts complete, ${week.partial} partial`}
                >
                  <span>
                    {week.completed}
                    <small>/{week.planned}</small>
                  </span>
                  <div className="weekly-history-track">
                    <span
                      style={{
                        height: `${week.planned ? (week.completed / week.planned) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="weekly-history-date">
                    {dateLabel(week.start, { month: 'short' })}
                    <b>{dateLabel(week.start, { day: 'numeric' })}</b>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="training-mix-card">
          <span className="eyebrow">YOUR WORK, SO FAR</span>
          <h2>Training mix</h2>
          <div className="training-mix-row">
            <span>
              <Dumbbell size={18} />
              Strength workouts
            </span>
            <strong>{summary.strength}</strong>
          </div>
          <div className="training-mix-row">
            <span>
              <Footprints size={18} />
              Running workouts
            </span>
            <strong>{summary.runs}</strong>
          </div>
          <div className="training-mix-row">
            <span>
              <Footprints size={18} />
              Distance logged
            </span>
            <strong>
              {summary.distance.toFixed(1)} <small>mi</small>
            </strong>
          </div>
          <div className="progress-streaks">
            <Flame size={19} />
            <span>
              <strong>{streak.current}</strong> current streak
            </span>
            <span>
              <strong>{streak.best}</strong> best
            </span>
          </div>
        </section>
      </div>
      <section className="activity-card rhythm-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">TRAINING AND RECOVERY</span>
            <h2>Your training rhythm</h2>
          </div>
          <span>
            {dateLabel(program.start)} — {dateLabel(program.end)}
          </span>
        </div>
        <div className="recovery-note">
          <Leaf size={20} />
          <div>
            <strong>Rest days are part of the program.</strong>
            <p>
              Marked automatically. No check-in needed, and your streak carries through.{' '}
              {summary.restDays} planned rest {summary.restDays === 1 ? 'day has' : 'days have'}{' '}
              elapsed.
            </p>
          </div>
        </div>
        <div className="rhythm-calendar">
          <div className="rhythm-labels">
            <span />
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          {summary.weeks.map((week) => (
            <div className="rhythm-week" key={week.start}>
              <span className="rhythm-week-label">{dateLabel(week.start)}</span>
              {Array.from({ length: 7 }, (_, i) => {
                const date = addDays(week.start, i);
                if (date < program.start || date > program.end)
                  return <span className="rhythm-placeholder" key={date} />;
                const { status, target, workoutCount } = calendarDay(date, map, today);
                return (
                  <button
                    key={date}
                    disabled={!target}
                    className={`rhythm-day ${status.id} ${date === today ? 'rhythm-today' : ''}`}
                    onClick={() => target && onChoose(target.date)}
                    title={`${dateLabel(date)} · ${status.label}${workoutCount > 1 ? ` · ${workoutCount} workouts` : ''}`}
                    aria-label={`${dateLabel(date, { weekday: 'long', month: 'short', day: 'numeric' })}, ${status.label}${workoutCount > 1 ? `, ${workoutCount} workouts` : ''}`}
                  >
                    <span>{dateLabel(date, { day: 'numeric' })}</span>
                    {status.id === 'rest' ? (
                      <span className="rhythm-rest">
                        <Leaf size={12} />
                        Rest
                      </span>
                    ) : status.id === 'complete' || status.id === 'legacy' ? (
                      <Check size={13} />
                    ) : status.id === 'started' || status.id === 'partial' ? (
                      <span className="rhythm-dot" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <p className="rhythm-help">Select a day to open its workout.</p>
        <div className="rhythm-legend">
          <span>
            <i className="complete" />
            Complete
          </span>
          <span>
            <i className="partial" />
            Partial
          </span>
          <span>
            <i className="started" />
            In progress
          </span>
          <span>
            <Leaf size={14} />
            Planned rest
          </span>
          <span>
            <i className="empty" />
            No record
          </span>
          <span>
            <i className="upcoming" />
            Upcoming
          </span>
          <span>
            <i className="legacy" />
            Imported
          </span>
        </div>
      </section>
      <div className="performance-intro">
        <div>
          <span className="eyebrow">MEASURE YOUR PERFORMANCE</span>
          <h2>Reps, holds & running</h2>
        </div>
        <span>
          {summary.measurements} measured {summary.measurements === 1 ? 'result' : 'results'}
        </span>
      </div>
    </>
  );
}
