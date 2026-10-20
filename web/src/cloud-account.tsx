import { useState, type FormEvent } from 'react';
import { Cloud, ShieldCheck } from 'lucide-react';
import { supabase } from './supabase';

export default function CloudAccount({ user, localCount, addLocal, pending }: {
  user: { id: string; email: string } | null;
  localCount: number;
  addLocal: () => void;
  pending: number;
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [sent, setSent] = useState(false);
  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setMessage(''); setFailed(false);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: new URL('/day-by-day/', window.location.origin).href } });
      if (error) throw error;
      setSent(true);
      setMessage('Check your email and open the sign-in link in this browser. Use the same email on every device.');
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : 'Could not send your sign-in link. Please try again.');
    } finally { setBusy(false); }
  };
  const signOut = async () => {
    setBusy(true); setFailed(false); setMessage('');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch { setFailed(true); setMessage('Could not sign out. Please try again.'); }
    finally { setBusy(false); }
  };
  return <section className="cloud-account" aria-label="Cloud account">
    <div className="account-box"><ShieldCheck size={22} /><div><strong>{user ? 'Private synced account' : 'Save across devices'}</strong><span>{user?.email || 'Sign in once on each browser to share your history.'}</span></div></div>
    {user ? <>
      {localCount > 0 && <div className="local-history-offer"><Cloud size={20} /><div><strong>Keep your existing progress</strong><p>{localCount} records are saved in this browser outside your account. Add them to {user.email} to sync them.</p><button className="secondary" onClick={addLocal}>Add browser history to my account</button></div></div>}
      <p className="settings-help">{pending ? `${pending} changes still need to sync. They remain saved on this browser if you sign out.` : 'Your history is private to your account. You can keep training offline.'}</p>
      <button className="text-link signout" disabled={busy} onClick={() => void signOut()}>{busy ? 'Signing out…' : 'Sign out on this browser'}</button>
    </> : <form className="cloud-signin" onSubmit={signIn}>
      <label className="field-label">Email address<input type="email" autoComplete="email" required value={email} onChange={event => { setEmail(event.target.value); setSent(false); }} placeholder="you@example.com" disabled={busy} /></label>
      <button className="primary" type="submit" disabled={busy}>{busy ? 'Sending…' : sent ? 'Send another sign-in link' : 'Email me a sign-in link'}</button>
      <p className="settings-help">No password needed. Your existing progress stays saved here until you choose to add it to your account.</p>
    </form>}
    {message && <p className={`cloud-message ${failed ? 'cloud-error' : ''}`} role={failed ? 'alert' : 'status'}>{message}</p>}
  </section>;
}
