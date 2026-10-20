import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import TrainingApp from './training-app';
import { supabase } from './supabase';

export default function AuthApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let observed = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) { observed = true; setSession(next); setReady(true); }
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (!observed) setSession(data.session);
      if (error) setError('Sign-in could not be restored. Your saved history is still on this browser.');
      setReady(true);
    }).catch(() => { if (active) { setError('Could not restore sign-in. Please try again in Settings.'); setReady(true); } });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  if (!ready) return <div className="auth-loading" role="status">Opening your training…</div>;
  const user = session ? { id: session.user.id, name: 'Your training', email: session.user.email || '' } : null;
  // A new component instance also discards in-flight work from the previous account.
  return <><TrainingApp key={user?.id || 'local'} user={user} />{error && <div className="toast" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss sign-in message">×</button></div>}</>;
}
