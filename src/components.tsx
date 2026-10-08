import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, CalendarDays, Camera, ClipboardList, CloudOff, Info, Loader2, Plus, Search, Sprout, Target, Users, Weight } from 'lucide-react';
import type { Photo, WasteRecord } from './lib/domain';
import type { Repository } from './lib/repository';
import { number, prettyDate, scopeLabels, statuses } from './lib/presentation';
import { Modal } from './ui/Modal';
export { Modal } from './ui/Modal';
export { EntryEditor } from './ui/EntryEditor';
export { Settings } from './ui/Settings';

export function BowlArt() {
  return <svg className="bowl-art" viewBox="0 0 290 205" fill="none" aria-hidden="true">
    <ellipse cx="157" cy="170" rx="91" ry="14" fill="#173a2d" opacity=".17" />
    <path d="M55 92h194c-7 60-39 88-96 88-58 0-86-35-98-88Z" fill="#edeacf" />
    <path d="M65 106h174c-10 46-35 63-83 63-49 0-77-26-91-63Z" fill="#d6d9b4" />
    <ellipse cx="152" cy="94" rx="98" ry="31" fill="#faf8e9" /><ellipse cx="152" cy="93" rx="81" ry="23" fill="#a5b27b" />
    <path d="M86 94c19-29 47-19 59-8-21 15-40 20-59 8Z" fill="#517d48" /><path d="M123 104c9-41 43-39 54-22-9 28-24 34-54 22Z" fill="#6f9453" /><path d="M166 98c14-29 39-26 57-8-11 23-39 27-57 8Z" fill="#456e3e" />
    <path d="m116 78 26 18m-3 7 25-25m14 23 24-15" stroke="#c4d39c" strokeWidth="2" strokeLinecap="round" />
    <circle cx="108" cy="99" r="8" fill="#dfa66a" /><circle cx="159" cy="103" r="7" fill="#e3b578" /><circle cx="185" cy="82" r="8" fill="#c9815a" />
    <path d="M82 47c8-22 27-23 32-18-5 19-17 26-32 18Z" fill="#c2d58e" /><path d="m80 54 23-22" stroke="#e0e9b2" strokeWidth="2" /><path d="M218 43c-4-14 3-25 13-28 7 16 5 26-13 28Z" fill="#a0bd73" /><path d="M225 51c14-13 25-8 28-2-8 13-20 15-28 2Z" fill="#c2d58e" />
    <path d="M56 137h-9m5-5v10M184 33h-9m5-5v10" stroke="#b3c892" strokeWidth="2" strokeLinecap="round" /><circle cx="258" cy="122" r="3" fill="#b3c892" /><circle cx="141" cy="50" r="2" fill="#b3c892" />
  </svg>;
}
export function Metric({ label, value, unit, icon, detail }: { label: string; value: string; unit: string; icon: 'weight' | 'calendar' | 'users' | 'sprout'; detail: string }) {
  const Icon = { weight: Weight, calendar: CalendarDays, users: Users, sprout: Sprout }[icon];
  return <article className="metric card"><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={18} /></span></div><div className="metric-value">{value}<span>{unit}</span></div><div className="metric-detail">{detail}</div></article>;
}
export function Empty({ icon, title, text, action, onAction }: { icon: ReactNode; title: string; text: string; action?: string; onAction?: () => void }) {
  return <div className="empty"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{text}</p>{action && <button className="button secondary small" onClick={onAction}><Plus size={15} />{action}</button>}</div>;
}
export function RecordTable({ records, onEdit, compact = false }: { records: WasteRecord[]; onEdit: (record: WasteRecord) => void; compact?: boolean }) {
  return <div className="table-scroll"><table><thead><tr><th>Date</th><th>Reported waste</th><th>{compact ? 'Menu snapshot' : 'Menu & coverage'}</th>{!compact && <th>Scope</th>}<th><span className="sr-only">Open record</span></th></tr></thead><tbody>{records.map(record => <tr key={record.id}><td><strong className="date-cell">{prettyDate(record.date)}</strong><small>{prettyDate(record.date, { weekday: 'long' })}</small></td><td><span className="weight-cell">{number(record.wasteKg)} <span>kg</span></span></td><td><span className="menu-cell">{record.menu.lunch || record.menu.dinner || record.menu.breakfast || record.menu.snacks || 'Menu not recorded'}</span><small>{record.coverage}</small></td>{!compact && <td><span className={`status-pill ${record.scope === 'unknown' ? 'amber' : ''}`}>{scopeLabels[record.scope]}</span></td>}<td><button className="icon-button table-open" aria-label={`Open entry for ${prettyDate(record.date)}`} onClick={() => onEdit(record)}><ArrowUpRight size={17} /></button></td></tr>)}</tbody></table></div>;
}
export function DailyLog({ records, onNew, onEdit }: { records: WasteRecord[]; onNew: () => void; onEdit: (record: WasteRecord) => void }) {
  const [query, setQuery] = useState(''); const [scope, setScope] = useState('all');
  const filtered = records.filter(r => (scope === 'all' || r.scope === scope) && [r.date, r.menu.breakfast, r.menu.lunch, r.menu.dinner, r.menu.snacks, r.notes].join(' ').toLowerCase().includes(query.toLowerCase()));
  return <section className="card log-card"><div className="log-toolbar"><div className="search-field"><Search size={17} /><input aria-label="Search daily entries" placeholder="Search by date, meal, or note…" value={query} onChange={e => setQuery(e.target.value)} /></div><select className="compact-select" aria-label="Filter by waste scope" value={scope} onChange={e => setScope(e.target.value)}><option value="all">All waste scopes</option>{Object.entries(scopeLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></div>{filtered.length ? <RecordTable records={filtered} onEdit={onEdit} /> : <Empty icon={<ClipboardList />} title={records.length ? 'No matching entries' : 'Start with today’s published number'} text={records.length ? 'Try another search or waste scope.' : 'You only need a date and waste weight. Add the menu and context you already know.'} action={records.length ? undefined : 'Add daily entry'} onAction={onNew} />}<div className="table-footer">{filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}<span>One record per date · weights in kilograms</span></div></section>;
}
export function PhotoImage({ photo, repo, className = '' }: { photo: Photo; repo: Repository; className?: string }) {
  const [url, setUrl] = useState<string | null>(null); const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true; let current: string | null = null; setFailed(false); setUrl(null);
    repo.getPhotoUrl(photo).then(value => { current = value; if (active) { setUrl(value); if (!value) setFailed(true); } else if (value?.startsWith('blob:')) URL.revokeObjectURL(value); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; if (current?.startsWith('blob:')) URL.revokeObjectURL(current); };
  }, [photo, repo]);
  return url ? <img className={className} src={url} alt={photo.name} loading="lazy" onError={() => { setUrl(null); setFailed(true); }} /> : <div className={`photo-placeholder ${className}`}>{failed ? <><CloudOff size={22} /><span>Photo unavailable</span></> : <Loader2 className="spin" size={20} />}</div>;
}
export function PhotoJournal({ records, repo, onNew }: { records: WasteRecord[]; repo: Repository; onNew: () => void }) {
  const [filter, setFilter] = useState('all'); const [selected, setSelected] = useState<{ photo: Photo; record: WasteRecord } | null>(null);
  const photos = records.flatMap(record => record.photos.map(photo => ({ photo, record }))).filter(item => filter === 'all' || item.photo.kind === filter);
  return <><div className="info-strip"><Info size={18} /><p>Photos add context. Published measurements supply the kilograms. A few friends’ plates are a small sample of a meal.</p></div><div className="photo-toolbar"><div className="segmented">{[['all', 'All photos'], ['board', 'Waste board'], ['plate', 'Plate observations']].map(([value, label]) => <button key={value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div><span className="muted">{photos.length} photos</span></div>{photos.length ? <div className="photo-grid">{photos.map(({ photo, record }) => <button className="card photo-card" key={photo.id} onClick={() => setSelected({ photo, record })}><PhotoImage photo={photo} repo={repo} /><div className="photo-caption"><span className="status-pill">{photo.kind === 'board' ? 'SOURCE PHOTO' : 'PLATE OBSERVATION'}</span><strong>{prettyDate(record.date, { day: 'numeric', month: 'long', year: 'numeric' })}</strong><small>{photo.name}</small></div></button>)}</div> : <section className="card"><Empty icon={<Camera />} title="Give your numbers a little context" text="Attach a photo of the published waste board, or a friend’s plate, when you add a daily entry." action="Add an entry with photos" onAction={onNew} /></section>}{selected && <Modal title={selected.photo.kind === 'board' ? 'Published measurement' : 'Plate observation'} onClose={() => setSelected(null)}><PhotoImage photo={selected.photo} repo={repo} className="large-photo" /><p className="muted">{prettyDate(selected.record.date)} · {selected.photo.name}</p></Modal>}</>;
}
export function Actions({ records, demo, onNew, onEdit, onStatus }: { records: WasteRecord[]; demo: boolean; onNew: () => void; onEdit: (record: WasteRecord) => void; onStatus: (record: WasteRecord, status: NonNullable<WasteRecord['action']>['status']) => Promise<void> }) {
  const actions = records.filter(record => record.action); const [busy, setBusy] = useState<string | null>(null);
  return <><div className="info-strip"><Sprout size={19} /><p>Agree on one small experiment with your mess team. Record the change and follow up with later measurements.</p></div>{actions.length ? <div className="action-grid">{actions.map(record => <article className="card action-card" key={record.id}><div className="action-card-top"><span className={`status-pill ${record.action!.status === 'completed' ? '' : 'amber'}`}>{statuses[record.action!.status]}</span><span className="muted">{prettyDate(record.date)}</span></div><h2>{record.action!.text}</h2><p>{record.action!.notes || 'No follow-up note yet. Use the daily entry to record what the team observes.'}</p><div className="action-card-bottom"><button className="text-button" onClick={() => onEdit(record)}>View entry <ArrowRight size={15} /></button><select className="compact-select" aria-label={`Status of ${record.action!.text}`} value={record.action!.status} disabled={demo || busy === record.id} onChange={async e => { const status = e.target.value as NonNullable<WasteRecord['action']>['status']; setBusy(record.id); try { await onStatus(record, status); } finally { setBusy(null); } }}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></article>)}</div> : <section className="card"><Empty icon={<Target />} title="One small change is a good start" text="Add a proposed action to a daily entry. Try a portion-choice conversation or confirm what the waste measurement includes." action="Add a daily entry" onAction={onNew} /></section>}<p className="quiet-note"><Info size={14} /> Changes between days are observations. Attendance, menus, and measurement coverage can affect the totals.</p></>;
}
