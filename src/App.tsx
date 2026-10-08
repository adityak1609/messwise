import { useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowRight, CalendarDays, Camera, Check, ChevronDown, ChevronRight, ClipboardList, Cloud, Database, Info, LayoutDashboard, Leaf, Loader2, Menu, Plus, ShieldCheck, Sparkles, Sprout, Target, Utensils, X } from 'lucide-react';
import { calculateSummary, dailyWastePoints, DEMO_RECORDS, type WasteRecord } from './lib/domain';
import { localRepository } from './lib/localRepository';
import { awsRepository, cloudConfigured, downloadRecords, isSignedIn } from './lib/repository';
import { Actions, DailyLog, EntryEditor, Modal, PhotoJournal, RecordTable, Settings, Empty, Metric, BowlArt } from './components';
import { number, prettyDate, type Mode, type View } from './lib/presentation';

const names: Record<View, string> = { overview: 'Overview', log: 'Daily log', photos: 'Photo journal', actions: 'Action plan', settings: 'Data & AWS' };
const icons = { overview: LayoutDashboard, log: ClipboardList, photos: Camera, actions: Target, settings: Database };

export default function App() {
  const [view, setView] = useState<View>('overview');
  const [mode, setMode] = useState<Mode>(() => {
    try { const saved = localStorage.getItem('messwise.mode.v1'); return saved === 'local' || (saved === 'aws' && cloudConfigured && isSignedIn()) ? saved : 'demo'; }
    catch { return 'demo'; }
  });
  const [records, setRecords] = useState<WasteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [editor, setEditor] = useState<WasteRecord | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WasteRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [range, setRange] = useState('7');
  const [mobileNav, setMobileNav] = useState(false);
  const [sourceMenu, setSourceMenu] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const repo = mode === 'aws' ? awsRepository : localRepository;

  useEffect(() => {
    let current = true; setLoading(true); setError(''); setRecords([]);
    const promise = mode === 'demo' ? Promise.resolve(DEMO_RECORDS) : repo.list();
    promise.then(data => { if (current) setRecords([...data].sort((a, b) => b.date.localeCompare(a.date))); })
      .catch(e => { if (current) setError(e instanceof Error ? e.message : 'Could not load your records.'); })
      .finally(() => { if (current) setLoading(false); });
    try { localStorage.setItem('messwise.mode.v1', mode); } catch { /* Records repository reports storage errors. */ }
    return () => { current = false; };
  }, [mode, repo, refresh]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 7000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { const callback = () => setRefresh(x => x + 1); window.addEventListener('storage', callback); return () => window.removeEventListener('storage', callback); }, []);

  function navigate(next: View) { setView(next); setMobileNav(false); setSourceMenu(false); }
  function newEntry() { if (mode === 'demo') setMode('local'); setEditor('new'); }
  function switchMode(next: Mode) {
    setSourceMenu(false);
    if (next === 'aws' && (!cloudConfigured || !isSignedIn())) { navigate('settings'); return; }
    setMode(next);
  }
  async function save(record: WasteRecord) {
    await repo.save(record); setEditor(null); setRefresh(x => x + 1); setToast('Daily entry saved. One more step towards less waste.');
  }
  async function updateAction(record: WasteRecord, status: NonNullable<WasteRecord['action']>['status']) {
    try { await repo.save({ ...record, action: { ...record.action!, status }, updatedAt: new Date().toISOString() }); setRefresh(x => x + 1); }
    catch (e) { setToast(e instanceof Error ? e.message : 'Could not update this action.'); }
  }
  async function removeEntry() {
    if (!confirmDelete) return; setDeleting(true);
    try { await repo.remove(confirmDelete.id); setConfirmDelete(null); setEditor(null); setRefresh(x => x + 1); setToast('Entry removed.'); }
    catch (e) { setToast(e instanceof Error ? e.message : 'Could not remove this entry.'); }
    finally { setDeleting(false); }
  }
  const cutoff = new Date(`${records[0]?.date || '2026-10-08'}T12:00:00`);
  cutoff.setDate(cutoff.getDate() - Number(range) + 1);
  const filtered = range === 'all' ? records : records.filter(r => new Date(`${r.date}T12:00:00`) >= cutoff);
  const dateLabel = filtered.length ? `${prettyDate(filtered[filtered.length - 1].date)} – ${prettyDate(filtered[0].date, { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Your first chapter starts here';
  const openCount = records.filter(r => r.action && r.action.status !== 'completed').length;

  return <div className="app-shell">
    {mobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <aside className={`sidebar ${mobileNav ? 'is-open' : ''}`}>
      <a className="brand" href="#" onClick={e => { e.preventDefault(); navigate('overview'); }}><span className="brand-mark"><Leaf size={24} strokeWidth={1.8} /></span><span>Mess<span className="brand-light">Wise</span><small>MAKE EVERY MEAL COUNT</small></span></a>
      <div className="workspace-label"><span className="workspace-avatar"><Utensils size={17} /></span><div>My mess workspace<small>Food waste, thoughtfully tracked</small></div></div>
      <span className="nav-label">WORKSPACE</span>
      <nav aria-label="Main navigation">{(['overview', 'log', 'photos', 'actions'] as View[]).map(item => { const Icon = icons[item]; return <button key={item} className={`nav-item ${view === item ? 'active' : ''}`} onClick={() => navigate(item)} aria-current={view === item ? 'page' : undefined}><Icon size={19} strokeWidth={1.7} /><span>{names[item]}</span>{item === 'actions' && openCount > 0 && <span className="nav-count">{openCount}</span>}</button>; })}</nav>
      <div className="sidebar-bottom"><div className="little-note"><Sprout size={24} strokeWidth={1.5} /><strong>Small steps. Real change.</strong><p>A daily number is the start of a better conversation.</p></div><button className={`nav-item ${view === 'settings' ? 'active' : ''}`} onClick={() => navigate('settings')}><Database size={18} /><span>Data & AWS</span></button><div className="source-control"><button className="source-button" aria-expanded={sourceMenu} onClick={() => setSourceMenu(!sourceMenu)}><span className={`status-dot ${mode === 'aws' ? 'cloud-dot' : ''}`} /><div>{mode === 'demo' ? 'Sample workspace' : mode === 'aws' ? 'AWS workspace' : 'My workspace'}<small>{mode === 'demo' ? 'Explore with example data' : mode === 'aws' ? 'Private cloud storage' : 'Saved on this device'}</small></div><ChevronDown size={15} /></button>{sourceMenu && <div className="source-popover">{([['demo', 'Sample workspace'], ['local', 'My workspace · this device'], ['aws', 'AWS workspace']] as const).map(([value, label]) => <button key={value} onClick={() => switchMode(value)}>{label}{mode === value && <Check size={14} />}</button>)}</div>}</div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20} /></button><span>Workspace</span><ChevronRight size={13} /><strong>{names[view]}</strong></div><div className="topbar-right"><span className="purpose-tag"><span className="status-dot" /> A little less, every day</span><button className="profile" aria-label="Open data and settings" onClick={() => navigate('settings')}>MW</button></div></header>
      <main>
        {mode === 'demo' && <div className="demo-banner"><span><Sparkles size={15} /><strong>A little inspiration to get started.</strong> You’re viewing fictional sample data.</span><button onClick={() => setMode('local')}>Use my own data <ArrowRight size={14} /></button></div>}
        {mode === 'local' && <div className="local-banner"><span><ShieldCheck size={14} /> Your records are saved in this browser on this device.</span><button onClick={() => navigate('settings')}>AWS connection <ArrowRight size={13} /></button></div>}
        {mode === 'aws' && <div className="local-banner"><span><Cloud size={14} /> Connected to your private AWS workspace.</span><button onClick={() => navigate('settings')}>Connection details <ArrowRight size={13} /></button></div>}
        <div className="page-heading"><div><span className="eyebrow">{view === 'overview' ? 'THE BIG PICTURE' : view === 'log' ? 'ONE DAY AT A TIME' : view === 'photos' ? 'A CLOSER LOOK' : view === 'actions' ? 'FROM INSIGHT TO ACTION' : 'YOUR DATA, YOUR WORKSPACE'}</span><h1>{view === 'overview' ? 'Every meal is a chance to do better.' : names[view]}</h1><p>{view === 'overview' ? 'Know what’s left. Learn from it. Make the next meal count.' : view === 'log' ? 'A simple record of what your mess reports each day.' : view === 'photos' ? 'Source photos and small observations, with the context that matters.' : view === 'actions' ? 'Turn a conversation into a small, measurable experiment.' : 'Understand where your records live and connect your AWS backend.'}</p></div>{view !== 'settings' && <button className="button primary" onClick={newEntry}><Plus size={17} /> Add daily entry</button>}</div>
        {error && <div role="alert" className="error-banner"><Info size={18} /><span>{error}</span><button onClick={() => setRefresh(x => x + 1)}>Retry</button></div>}
        {loading && view !== 'settings' ? <div className="loading-panel"><Loader2 className="spin" /> Loading your workspace…</div> : <>
          {view === 'overview' && <Overview records={filtered} allRecords={records} mode={mode} range={range} setRange={setRange} dateLabel={dateLabel} onNew={newEntry} onView={navigate} onEdit={setEditor} />}
          {view === 'log' && <DailyLog records={records} onNew={newEntry} onEdit={setEditor} />}
          {view === 'photos' && <PhotoJournal records={records} repo={repo} onNew={newEntry} />}
          {view === 'actions' && <Actions records={records} demo={mode === 'demo'} onNew={newEntry} onEdit={setEditor} onStatus={updateAction} />}
          {view === 'settings' && <Settings mode={mode} records={records} onMode={setMode} notify={setToast} />}
        </>}
        <footer className="page-footer"><span><Leaf size={13} /> Built for better meals, one day at a time.</span><span>MessWise <span className="footer-dot">·</span> A food waste pilot</span></footer>
      </main>
    </div>
    {editor && <EntryEditor key={editor === 'new' ? 'new' : editor.id} record={editor === 'new' ? null : editor} readOnly={mode === 'demo' && editor !== 'new'} repo={repo} onClose={() => setEditor(null)} onSave={save} onDelete={setConfirmDelete} onNew={() => { setEditor(null); newEntry(); }} />}
    {confirmDelete && <Modal title="Remove this daily entry?" onClose={() => !deleting && setConfirmDelete(null)}><p className="muted">The record for {prettyDate(confirmDelete.date)} will be removed. Export your records first if you need a backup.</p><div className="modal-actions"><button className="button secondary" onClick={() => setConfirmDelete(null)} disabled={deleting}>Keep entry</button><button className="button danger" onClick={removeEntry} disabled={deleting}>{deleting && <Loader2 size={16} className="spin" />} Remove entry</button></div></Modal>}
    {toast && <div className="toast" role="status"><Info size={18} /><span>{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={16} /></button></div>}
  </div>;
}

function Overview({ records, allRecords, mode, range, setRange, dateLabel, onNew, onView, onEdit }: { records: WasteRecord[]; allRecords: WasteRecord[]; mode: Mode; range: string; setRange: (value: string) => void; dateLabel: string; onNew: () => void; onView: (view: View) => void; onEdit: (record: WasteRecord) => void }) {
  const summary = calculateSummary(records);
  const points = dailyWastePoints(records);
  const chartMax = Math.ceil(Math.max(10, ...points.map(p => p.wasteKg)) / 10) * 10;
  const totalActions = records.filter(r => r.action).length;
  const openActions = records.filter(r => r.action && r.action.status !== 'completed');
  return <>
    <div className="overview-tools"><div className="period"><CalendarDays size={15} /><span>{dateLabel}</span></div><div className="tool-buttons"><select className="compact-select" value={range} aria-label="Time period" onChange={e => setRange(e.target.value)}><option value="7">Latest 7 days</option><option value="30">Latest 30 days</option><option value="all">All records</option></select><button className="button small secondary" disabled={!records.length} onClick={() => downloadRecords(records)}><ArrowDownToLine size={15} />{mode === 'demo' ? 'Export sample' : 'Export'}</button></div></div>
    <div className="metrics">
      <Metric label="Reported food waste" value={number(summary.totalKg)} unit="kg" icon="weight" detail={`${summary.recordCount} daily ${summary.recordCount === 1 ? 'record' : 'records'} in this view`} />
      <Metric label="Daily average" value={records.length ? number(summary.averageKg) : '—'} unit={records.length ? 'kg / day' : ''} icon="calendar" detail="Across recorded days only" />
      <Metric label="Waste per meal served" value={summary.gramsPerMeal === null ? '—' : number(summary.gramsPerMeal, 0)} unit={summary.gramsPerMeal === null ? '' : 'g / meal'} icon="users" detail={summary.gramsPerMeal === null ? 'Matching attendance needed' : 'Same coverage and waste scope'} />
      <Metric label="Small steps underway" value={String(openActions.length)} unit={openActions.length === 1 ? 'action' : 'actions'} icon="sprout" detail={totalActions ? `${totalActions - openActions.length} completed · ${totalActions} recorded` : 'A good conversation starts here'} />
    </div>
    <div className="overview-middle">
      <section className="card chart-card"><div className="card-heading"><div><h2>The daily picture</h2><p>Reported waste, one day at a time</p></div><span className="legend"><span />Food waste (kg)</span></div>
        {points.length ? <><div className="chart" role="img" aria-label={`Daily food waste: ${points.map(p => `${prettyDate(p.date)}: ${p.wasteKg} kilograms`).join('; ')}`}><div className="y-axis">{[1, .75, .5, .25, 0].map(n => <span key={n}>{number(chartMax * n, 0)}</span>)}</div><div className="plot"><div className="grid-lines">{[1, 2, 3, 4, 5].map(n => <i key={n} />)}</div><div className="bars">{points.map((point, i) => <div className="bar-column" key={point.date}><div className="bar-space"><div className={`bar ${i === points.length - 1 ? 'last' : ''}`} title={`${prettyDate(point.date)}: ${number(point.wasteKg)} kg`} style={{ height: `${point.wasteKg / chartMax * 100}%`, minHeight: point.wasteKg ? 3 : 0 }}><span className="bar-value">{number(point.wasteKg)} kg</span></div></div><span className="bar-label">{prettyDate(point.date)}</span></div>)}</div></div></div><div className="chart-footnote"><Info size={14} /><span>Daily totals describe the recorded period. They don’t identify which dish caused the waste.</span></div></> : <Empty icon={<ClipboardList />} title="Your first number tells a story" text="Record the waste weight published by your mess. Your daily picture will grow from there." action="Add your first entry" onAction={onNew} />}
      </section>
      <section className="insight-card"><div className="insight-badge"><Leaf size={13} /> THE MESSWISE APPROACH</div><h2>Small changes.<br />Less on the plate.</h2><p>You don’t need a perfect dataset.<br />Just a daily number, a little context,<br />and the curiosity to do better.</p><BowlArt /><button onClick={() => onView('actions')}>Make a small action plan <ArrowRight size={17} /></button></section>
    </div>
    <div className="overview-lower"><section className="card recent-card"><div className="card-heading"><div><h2>Fresh from the daily log</h2><p>Your latest meals and measurements</p></div><button className="text-button" onClick={() => onView('log')}>View all <ArrowRight size={15} /></button></div>{allRecords.length ? <RecordTable records={allRecords.slice(0, 3)} onEdit={onEdit} compact /> : <Empty icon={<ClipboardList />} title="A fresh start" text="Daily records will appear here once you add them." />}</section><section className="card next-card"><div className="card-heading"><h2>Your next small step</h2><span className="soft-icon"><Target size={18} /></span></div>{openActions[0] ? <><span className="status-pill amber">{openActions[0].action!.status === 'planned' ? 'Planned' : 'In progress'}</span><h3>{openActions[0].action!.text}</h3><p>Recorded with the {prettyDate(openActions[0].date)} entry. Follow up with your mess team and log what happens.</p><button className="text-button" onClick={() => onView('actions')}>Open action plan <ArrowRight size={15} /></button></> : <><span className="status-pill">START SIMPLE</span><h3>Ask what the daily number includes.</h3><p>Plate leftovers, kitchen waste, or both? A little context makes every measurement more useful.</p><button className="text-button" onClick={onNew}>Record what you know <ArrowRight size={15} /></button></>}</section></div>
  </>;
}
