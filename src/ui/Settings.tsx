import { useState, type FormEvent } from 'react';
import { ArrowDownToLine, ArrowRight, Camera, CheckCircle2, Cloud, Database, Loader2, LogOut, Settings2, ShieldCheck, Users, Weight } from 'lucide-react';
import type { WasteRecord } from '../lib/domain';
import { checkAws, cloudConfigured, cloudDetails, completePassword, downloadRecords, isSignedIn, signIn, signOut } from '../lib/repository';
import type { Mode } from '../lib/presentation';

export function Settings({ mode, records, onMode, notify }: { mode: Mode; records: WasteRecord[]; onMode: (mode: Mode) => void; notify: (message: string) => void }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<{ session: string; username: string } | null>(null);
  const [busy, setBusy] = useState(false); const [authError, setAuthError] = useState('');
  const [health, setHealth] = useState<{ service: string; requestId: string } | null>(null);
  const [authRefresh, setAuthRefresh] = useState(0); void authRefresh;
  async function login(e: FormEvent) {
    e.preventDefault(); setBusy(true); setAuthError('');
    try {
      if (challenge) { await completePassword(challenge, password); setChallenge(null); }
      else { const next = await signIn(email.trim(), password); if (next) { setChallenge(next); setPassword(''); return; } }
      setPassword(''); setAuthRefresh(x => x + 1); onMode('aws'); notify('Signed in. Your private AWS workspace is ready.');
    } catch (e) { setAuthError(e instanceof Error ? e.message : 'Sign-in failed.'); }
    finally { setBusy(false); }
  }
  async function testConnection() { setBusy(true); setAuthError(''); try { setHealth(await checkAws()); notify('AWS Lambda responded successfully.'); } catch (e) { setAuthError(e instanceof Error ? e.message : 'Connection failed.'); setAuthRefresh(x => x + 1); } finally { setBusy(false); } }
  return <div className="settings-grid">
    <section className="card settings-card"><span className="settings-icon"><Database size={23} /></span><h2>Your workspace</h2><p>Sample, device, and AWS workspaces each have their own records. Choose where you want to work.</p>
      <div className="storage-option"><div><strong>This device</strong><small>Browser storage · photos stay on this device</small></div><button className="button secondary small" onClick={() => onMode('local')}>{mode === 'local' ? 'Selected' : 'Open'}</button></div>
      <div className="storage-option"><div><strong>Sample workspace</strong><small>Fictional entries · explore the interface</small></div><button className="button secondary small" onClick={() => onMode('demo')}>{mode === 'demo' ? 'Selected' : 'Explore'}</button></div>
      <div className="settings-divider" /><h3>Keep a copy</h3><p>Export entries and photo references as JSON. Photo files are stored separately and are not included in the export.</p><button className="button secondary" onClick={() => downloadRecords(records)} disabled={!records.length}><ArrowDownToLine size={16} />Export {mode === 'demo' ? 'sample ' : ''}records</button><p className="quiet-note">Clearing browser site data removes device-only records and photos.</p>
    </section>
    <section className="card settings-card"><span className="settings-icon"><Cloud size={23} /></span><div className="settings-title"><h2>AWS connection</h2><span className={`status-pill ${cloudConfigured ? '' : 'amber'}`}>{cloudConfigured ? isSignedIn() ? 'Signed in' : 'Ready to sign in' : 'Not configured'}</span></div><p>Private sign-in with Amazon Cognito. Records in DynamoDB and photos in S3, through a Lambda backend.</p>
      {!cloudConfigured ? <><div className="config-note"><Settings2 size={19} /><div><strong>The local app is ready to use.</strong><p>Your administrator can connect an AWS deployment using the included setup guide.</p></div></div><div className="service-tags"><span>Lambda</span><span>DynamoDB</span><span>S3</span><span>Cognito</span></div></> : isSignedIn() ? <>
        <div className="connection-detail"><span>Region</span><strong>{cloudDetails.region}</strong></div><div className="connection-detail"><span>API endpoint</span><code>{cloudDetails.apiUrl}</code></div>
        <div className="button-row"><button className="button primary" onClick={() => onMode('aws')}>Open AWS workspace <ArrowRight size={15} /></button><button className="button secondary" onClick={testConnection} disabled={busy}>{busy ? <Loader2 size={15} className="spin" /> : <ShieldCheck size={15} />}Test connection</button></div>
        {health && <div className="health-result"><CheckCircle2 size={18} /><div><strong>{health.service} responded</strong><small>Request ID: {health.requestId}</small></div></div>}
        <button className="text-button sign-out" onClick={() => { signOut(); setHealth(null); setAuthRefresh(x => x + 1); onMode('local'); notify('Signed out of AWS.'); }}><LogOut size={15} />Sign out</button>
      </> : <form onSubmit={login} className="login-form"><label>Email<input type="email" autoComplete="username" required value={email} disabled={Boolean(challenge)} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label><label>{challenge ? 'Choose a new password' : 'Password'}<input type="password" autoComplete={challenge ? 'new-password' : 'current-password'} required minLength={challenge ? 12 : undefined} value={password} onChange={e => setPassword(e.target.value)} /></label>{challenge && <p className="quiet-note">Use at least 12 characters, including upper and lower case letters and a number.</p>}<button className="button primary" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />}{challenge ? 'Set password & sign in' : 'Sign in to AWS workspace'}</button><p className="quiet-note">Use the account created by your workspace administrator.</p></form>}
      {authError && <p className="field-error" role="alert">{authError}</p>}
    </section>
    <section className="card principles-card"><h2>Good data, honest conclusions</h2><div><p><Weight size={18} /><span><strong>Keep the measurement’s scope.</strong> Record whether the number includes plate waste, kitchen waste, or both.</span></p><p><Users size={18} /><span><strong>Match your denominator.</strong> Attendance must cover the same meals as the waste weight.</span></p><p><Camera size={18} /><span><strong>Photos add context.</strong> A few plates are supporting observations of one meal.</span></p></div></section>
  </div>;
}
