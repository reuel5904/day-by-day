import { ArrowRight, Dumbbell, Flag, Flame, Target } from 'lucide-react';
import { dateLabel, type Event, type Program } from './training-model';
import { programSummary } from './progress-model';

const amount = (result: { value: number; right?: number }) =>
  result.right === undefined ? `${result.value}` : `${result.value} / ${result.right}`;

export function PersonalBestRows({ bests }: { bests: any[] }) {
  if (!bests.length) return <p className="empty-line">No personal bests yet.</p>;
  return bests.map((r, i) => (
    <div className="pb-row" key={i}>
      <div>
        <strong>{r.name}</strong>
        <span>
          {r.variation} · {r.assistance || 'unassisted'}
          {r.tempo ? ' · ' + r.tempo : ''}
        </span>
      </div>
      <b>
        {r.score}
        <small>
          {r.unit}
          {r.sides ? ' / side' : ''}
        </small>
      </b>
    </div>
  ));
}

// Today after a program's last day: how it went, and its final test numbers.
export default function ProgramSummary({
  map,
  program,
  today,
  onOpen,
}: {
  map: Record<string, Event[]>;
  program: Program;
  today: string;
  onOpen: (view: 'schedule' | 'progress') => void;
}) {
  const summary = programSummary(map, program, today);
  return (
    <>
      <header className="today-header">
        <div>
          <h1>{program.title}</h1>
          <p>
            <span>
              {dateLabel(program.start)} – {dateLabel(program.end)}
            </span>
            <span>Program complete</span>
          </p>
        </div>
      </header>
      <div className="stats-grid summary-stats">
        <section className="stat-card">
          <div className="stat-top">
            <span>Workouts completed</span>
            <Dumbbell size={20} />
          </div>
          <strong>
            {summary.completed} / {summary.planned}
          </strong>
        </section>
        <section className="stat-card">
          <div className="stat-top">
            <span>Best streak</span>
            <Flame size={20} />
          </div>
          <strong>{summary.bestStreak}</strong>
        </section>
      </div>
      <div className="progress-grid">
        {summary.tests.length > 0 && (
          <section className="pb-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">TEST WEEK</span>
                <h2>Final numbers</h2>
              </div>
              <Flag size={20} />
            </div>
            {summary.tests.map((test) => (
              <div className="pb-row" key={test.name}>
                <div>
                  <strong>{test.name}</strong>
                  <span>
                    {[
                      test.best?.variation !== 'Standard' && test.best?.variation,
                      test.baseline &&
                        `${dateLabel(test.baseline.date)}: ${amount(test.baseline)} ${test.unit}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                <b>
                  {test.best && amount(test.best)}
                  <small>
                    {!test.best ? 'Not logged' : test.unit}
                    {test.best && test.sides ? ' / side' : ''}
                  </small>
                </b>
              </div>
            ))}
          </section>
        )}
        <section className="pb-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">THIS PROGRAM</span>
              <h2>Personal bests</h2>
            </div>
            <Target size={20} />
          </div>
          <PersonalBestRows bests={summary.personalBests} />
        </section>
      </div>
      <div className="summary-actions">
        <button className="secondary" onClick={() => onOpen('schedule')}>
          Schedule
          <ArrowRight size={16} />
        </button>
        <button className="secondary" onClick={() => onOpen('progress')}>
          Progress
          <ArrowRight size={16} />
        </button>
      </div>
    </>
  );
}
