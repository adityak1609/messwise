import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDownToLine, Camera, CheckCircle2, FlaskConical, Info, Loader2, Plus, Trash2 } from 'lucide-react';
import { Empty, PhotoImage } from '../components';
import type { Repository } from '../lib/repository';
import { request } from '../lib/repository';
import { awsPilotRepository, exportPilot, localPilotRepository, type PilotRepository } from '../lib/pilotRepository';
import { BINS, evaluatePairs, scoreLabel, validPair, type PlatePair, type Rating, type Score } from '../lib/pilot';
import { prettyDate, today, type Mode } from '../lib/presentation';
import { Modal } from './Modal';
import { menuSuggestions, parseDishes, publishedMenu } from '../lib/menu';
import { MenuSource } from './MenuSource';

export function PlatePilot({ mode, photoRepo, onStart }: { mode: Mode; photoRepo: Repository; onStart: () => void }) {
  const repo = mode === 'aws' ? awsPilotRepository : localPilotRepository;
  const [pairs, setPairs] = useState<PlatePair[]>([]), [loading, setLoading] = useState(true);
  const [error, setError] = useState(''), [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<PlatePair | null>(null), [refresh, setRefresh] = useState(0);
  const [configError, setConfigError] = useState(false);
  const [config, setConfig] = useState<{ enabled: boolean; modelId: string; region: string } | null>(null);
  useEffect(() => {
    let current = true; setLoading(true); setError(''); setPairs([]); setSelected(null); setConfig(null); setConfigError(false);
    (mode === 'demo' ? Promise.resolve([]) : repo.list()).then(data => { if (current) setPairs(data); })
      .catch(e => { if (current) setError(e instanceof Error ? e.message : 'Could not load plate pairs.'); })
      .finally(() => { if (current) setLoading(false); });
    if (mode === 'aws') request<{ pilot?: typeof config }>('/health').then(data => { if (current) { setConfig(data.pilot ?? null); setConfigError(!data.pilot); } }).catch(() => { if (current) setConfigError(true); });
    return () => { current = false; };
  }, [mode, repo, refresh]);
  function update(pair: PlatePair) {
    setPairs(items => [pair, ...items.filter(p => p.id !== pair.id)]); setSelected(pair);
  }
  const evaluation = evaluatePairs(pairs);
  return <div className="pilot-page">
    <div className="info-strip"><FlaskConical size={20} /><p><strong>A small pilot, with visible limits.</strong> Compare the same plate before and after eating. Score the visual fraction remaining; daily kilograms come from the mess’s published measurement.</p></div>
    <div className="pilot-toolbar"><p className="muted">Start with five pairs. Two people review each pair independently before Bedrock runs.</p><div className="button-row"><button className="button secondary" disabled={!pairs.length} onClick={() => exportPilot(pairs)}><ArrowDownToLine size={16} />Export pilot</button><button className="button primary" onClick={() => mode === 'demo' ? onStart() : setCreating(true)}><Plus size={16} />{mode === 'demo' ? 'Start my plate pilot' : 'Add plate pair'}</button></div></div>
    {mode !== 'aws' && <p className="pilot-cloud-note"><Info size={16} />{mode === 'demo' ? 'This sample workspace contains no fabricated plate pairs.' : 'Paired photos and human reviews work on this device. Connect the AWS workspace to run Bedrock.'}</p>}
    {mode === 'aws' && <p className="pilot-cloud-note"><Info size={16} />{config ? `${config.enabled ? 'Bedrock ready to request scores' : 'Bedrock disabled in stack'} · ${config.modelId} · ${config.region}` : configError ? 'Bedrock configuration unavailable. Check Data & AWS or deploy the updated backend.' : 'Checking Bedrock configuration…'} · Results are experimental and require human comparison.</p>}
    {error && <div className="error-banner" role="alert">{error}<button onClick={() => setRefresh(x => x + 1)}>Retry</button></div>}
    <div className="pilot-metrics">{[
      [evaluation.plateCount, 'Plate pairs', 'Collected plate sample n'],
      [evaluation.dishCount, 'Dish observations', 'Dishes share a plate; counts differ'],
      [pairs.filter(p => p.reviews.a && p.reviews.b).length, 'Human reviews complete', 'Two ratings saved before the model'],
      [pairs.filter(p => p.runs.length === 2).length, 'Repeated pairs', 'Two runs with the same protocol'],
    ].map(([value, label, note]) => <article className="card pilot-metric" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>
    <Evaluation pairs={pairs} />
    <section className="card pilot-list"><div className="card-heading"><div><h2>Your plate pairs</h2><p>JPEG, PNG, or WebP · 3 MiB per photo · same plate and serving</p></div><Camera size={20} /></div>
      {loading ? <div className="loading-panel"><Loader2 className="spin" />Loading plate pairs…</div> : pairs.length ? <div className="table-scroll"><table><thead><tr><th>Plate</th><th>Meal & dishes</th><th>Progress</th><th>Review</th></tr></thead><tbody>{pairs.map(pair => <tr key={pair.id}><td><strong>{prettyDate(pair.date)}</strong><small>Plate {pair.id.slice(0, 8)}</small></td><td><strong className="capitalize">{pair.meal}</strong><small>{pair.dishes.map(d => d.name).join(', ')}</small></td><td><span className="status-pill">{!pair.reviews.a ? 'Reviewer A needed' : !pair.reviews.b ? 'Reviewer B needed' : pair.runs.length === 0 ? 'Ready for Bedrock' : pair.runs.length === 1 ? 'Repeat run available' : 'Comparison ready'}</span></td><td><button className="button secondary small" aria-label={`Review plate ${pair.id.slice(0, 8)}`} onClick={() => setSelected(pair)}>Open</button></td></tr>)}</tbody></table></div> : <Empty icon={<Camera />} title="A pair tells a clearer story" text="Photograph a volunteer’s plate when served and again when finished. Add only the dishes on that plate." />}
    </section>
    <SampleSignals pairs={pairs} />
    {creating && <PairForm photoRepo={photoRepo} repo={repo} onClose={() => setCreating(false)} onSaved={pair => { setCreating(false); update(pair); }} />}
    {selected && <PairReview key={selected.id} pair={selected} repo={repo} photoRepo={photoRepo} cloud={mode === 'aws'} enabled={!!config?.enabled} onClose={() => setSelected(null)} onSaved={update} onRemoved={() => { setPairs(items => items.filter(p => p.id !== selected.id)); setSelected(null); }} />}
  </div>;
}

function Evaluation({ pairs }: { pairs: PlatePair[] }) {
  const { rows } = evaluatePairs(pairs);
  const fraction = (n: number, total: number) => total ? `${n}/${total} (${Math.round(n / total * 100)}%)` : '—';
  return <section className="card"><div className="card-heading"><div><h2>Pilot comparison</h2><p>Run 1 is the fixed model comparison. Repeatability is reported separately.</p></div></div><div className="table-scroll"><table><thead><tr><th>Comparison</th><th>Plates n</th><th>Exact agreement</th><th>Within 25 points</th><th>Unassessable / eligible</th></tr></thead><tbody>{rows.map(({ label, plates, agreement: a }) => <tr key={label}><td>{label}</td><td>{plates}</td><td>{fraction(a.exact, a.compared)}</td><td>{fraction(a.withinStep, a.compared)}</td><td>{a.excluded}/{a.eligible}</td></tr>)}</tbody></table></div><p className="pilot-footnote">Agreement uses dish ratings with numeric scores on both sides. “Cannot assess” stays visible in the excluded count. Two “cannot assess” answers do not count as successful agreement. Dish ratings on one plate are related observations. A small volunteer sample demonstrates feasibility.</p></section>;
}

function SampleSignals({ pairs }: { pairs: PlatePair[] }) {
  const observations = new Map<string, { name: string; left: number; assessed: number; unclear: number }>();
  for (const pair of pairs) for (const dish of pair.dishes) {
    if (!pair.runs[0]) continue;
    const key = dish.name.trim().toLowerCase();
    const row = observations.get(key) ?? { name: dish.name, left: 0, assessed: 0, unclear: 0 };
    const score = pair.runs[0].ratings.find(r => r.dishId === dish.id)?.remainingPercent;
    if (typeof score === 'number') { row.assessed++; if (score > 0) row.left++; } else row.unclear++;
    observations.set(key, row);
  }
  if (!observations.size) return null;
  return <section className="card"><div className="card-heading"><div><h2>Early observations in this sample</h2><p>Based on model run 1; review the paired photos before proposing an action.</p></div></div><div className="table-scroll"><table><thead><tr><th>Dish</th><th>Some left on</th><th>Cannot assess</th></tr></thead><tbody>{[...observations.values()].sort((a, b) => a.name.localeCompare(b.name)).map(row => <tr key={row.name}><td>{row.name}</td><td>{row.left} of {row.assessed} assessable plates</td><td>{row.unclear}</td></tr>)}</tbody></table></div><p className="pilot-footnote">These counts describe the collected plates. Student feedback supplies possible reasons; the photos and scores do not establish why food was left.</p></section>;
}

function PairForm({ photoRepo, repo, onClose, onSaved }: { photoRepo: Repository; repo: PilotRepository; onClose: () => void; onSaved: (pair: PlatePair) => void }) {
  const [date, setDate] = useState(today()), [meal, setMeal] = useState<PlatePair['meal']>('lunch');
  const [dishes, setDishes] = useState(''), [feedback, setFeedback] = useState(''), [notes, setNotes] = useState('');
  const [before, setBefore] = useState<File | null>(null), [after, setAfter] = useState<File | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  // Preserve uploaded references across a failed save, rather than uploading twice.
  const [draft, setDraft] = useState<PlatePair | null>(null);
  const suggestions = menuSuggestions(date, meal);
  const selectedDishes = parseDishes(dishes);
  function toggleDish(name: string) {
    const selected = selectedDishes.some(dish => dish.toLowerCase() === name.toLowerCase());
    const next = selected ? selectedDishes.filter(dish => dish.toLowerCase() !== name.toLowerCase()) : [...selectedDishes, name];
    if (next.length > 8) { setError('Select up to 8 dishes actually on this plate.'); return; }
    setDishes(next.join(', ')); setError('');
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); if (busy) return; setError('');
    const names = parseDishes(dishes);
    if (!before || !after || [before, after].some(f => f.size === 0 || f.size > 3 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(f.type))) { setError('Choose two JPEG, PNG, or WebP photos, up to 3 MiB each.'); return; }
    if (before === after || (before.name === after.name && before.size === after.size && before.lastModified === after.lastModified)) { setError('Choose separate before and after photos of the same plate.'); return; }
    if (!names.length || names.length > 8 || names.some(n => n.length > 100) || new Set(names.map(n => n.toLowerCase())).size !== names.length) { setError('Enter 1–8 unique dishes, separated by commas or new lines.'); return; }
    setBusy(true);
    try {
      let pair = draft;
      if (!pair) {
        const stamp = new Date().toISOString();
        pair = { id: crypto.randomUUID(), date, meal, dishes: names.map(name => ({ id: crypto.randomUUID(), name })), before: await photoRepo.putPhoto(before, 'plate'), after: await photoRepo.putPhoto(after, 'plate'), feedback: feedback.trim(), notes: notes.trim(), reviews: {}, runs: [], attempts: 0, createdAt: stamp, updatedAt: stamp };
        setDraft(pair);
      }
      const problem = validPair(pair); if (problem) throw new Error(problem);
      onSaved(await repo.save(pair));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save the pair.'); }
    finally { setBusy(false); }
  }
  return <Modal wide title="Add a plate pair" onClose={() => { if (!busy) onClose(); }}><form onSubmit={submit}><div className="editor-body"><p className="form-intro">Use a consenting volunteer’s same plate, photographed before and after eating. Keep the angle and lighting similar. Note any seconds, spills, or food moved between plates.</p><fieldset disabled={busy || !!draft}><div className="form-grid"><label>Date<input type="date" required value={date} onChange={e => setDate(e.target.value)} /></label><label>Meal<select value={meal} onChange={e => setMeal(e.target.value as PlatePair['meal'])}><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option></select></label></div>{publishedMenu(date) ? <><MenuSource /><div className="menu-picker"><strong>Select dishes on this plate ({selectedDishes.length}/8)</strong><div className="menu-options">{suggestions.map(name => <button type="button" key={name} className="menu-dish" aria-label={'Select menu dish ' + name} aria-pressed={selectedDishes.some(dish => dish.toLowerCase() === name.toLowerCase())} onClick={() => toggleDish(name)}>{name}</button>)}</div><p className="input-note">Choose only what was served on this plate. Listed alternatives are separate choices. Confirm the dish list below after changing the date or meal.</p></div></> : <p className="input-note menu-missing">No published menu saved for this date. Enter the dishes on this plate below.</p>}<label className="full-label">Dishes on this plate<textarea required rows={2} maxLength={808} placeholder="Rice, dal, bhindi" value={dishes} onChange={e => setDishes(e.target.value)} /><span className="input-note">1–8 dish names, separated by commas or new lines. Include only what was served on this plate.</span></label><div className="form-grid"><label>Before eating photo<input type="file" required accept="image/jpeg,image/png,image/webp" onChange={e => setBefore(e.target.files?.[0] ?? null)} /></label><label>After eating photo<input type="file" required accept="image/jpeg,image/png,image/webp" onChange={e => setAfter(e.target.files?.[0] ?? null)} /></label></div><p className="input-note">Two photos · up to 3 MiB each. Convert HEIC to JPEG. Each pair counts as one plate.</p><label className="full-label">Student feedback (optional)<textarea rows={2} maxLength={1000} placeholder="What did the student say they left, and why?" value={feedback} onChange={e => setFeedback(e.target.value)} /></label><label className="full-label">Photo or serving note (optional)<textarea rows={2} maxLength={1000} placeholder="e.g. No seconds; the dal mixed with rice after eating." value={notes} onChange={e => setNotes(e.target.value)} /></label></fieldset>{draft && <p className="input-note">Photos are uploaded. Retry saving this same pair.</p>}{error && <p role="alert" className="field-error">{error}</p>}</div><div className="editor-footer"><span className="editor-footer-note">Human ratings come next</span><div><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}>{busy && <Loader2 size={16} className="spin" />}Save plate pair</button></div></div></form></Modal>;
}

function PairReview({ pair, repo, photoRepo, cloud, enabled, onClose, onSaved, onRemoved }: { pair: PlatePair; repo: PilotRepository; photoRepo: Repository; cloud: boolean; enabled: boolean; onClose: () => void; onSaved: (pair: PlatePair) => void; onRemoved: () => void }) {
  const slot = !pair.reviews.a ? 'a' : !pair.reviews.b ? 'b' : null;
  const [name, setName] = useState(''), [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [confirm, setConfirm] = useState(false);
  useEffect(() => { setName(''); setValues({}); }, [slot]);
  async function review(e: FormEvent) {
    e.preventDefault(); if (!slot || busy) return; setError('');
    if (pair.dishes.some(d => !values[d.id])) { setError('Rate every dish, using cannot assess when needed.'); return; }
    const ratings: Rating[] = pair.dishes.map(d => ({ dishId: d.id, remainingPercent: values[d.id] === 'unknown' ? null : Number(values[d.id]) as Score }));
    const stamp = new Date().toISOString();
    const next = { ...pair, reviews: { ...pair.reviews, [slot]: { name: name.trim(), ratings, scoredAt: stamp } }, updatedAt: stamp };
    const problem = validPair(next); if (problem) { setError(problem); return; }
    setBusy(true);
    try { onSaved(await repo.save(next)); } catch (e) { setError(e instanceof Error ? e.message : 'Review could not be saved.'); } finally { setBusy(false); }
  }
  async function score() {
    if (busy) return; setBusy(true); setError('');
    try { onSaved(await repo.score(pair.id)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Scoring failed.');
      try { const fresh = (await repo.list()).find(p => p.id === pair.id); if (fresh) onSaved(fresh); } catch { /* Keep the useful original error visible. */ }
    } finally { setBusy(false); }
  }
  async function remove() { setBusy(true); try { await repo.remove(pair.id); onRemoved(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not remove pair.'); } finally { setBusy(false); } }
  const ratingOf = (ratings: Rating[] | undefined, id: string) => scoreLabel(ratings?.find(r => r.dishId === id)?.remainingPercent);
  return <Modal wide title={`Plate ${pair.id.slice(0, 8)} · ${prettyDate(pair.date)}`} onClose={() => { if (!busy) onClose(); }}><div className="editor-body"><div className="pair-images"><figure><figcaption>Before eating</figcaption><PhotoImage photo={pair.before} repo={photoRepo} className="pair-image" /></figure><figure><figcaption>After eating</figcaption><PhotoImage photo={pair.after} repo={photoRepo} className="pair-image" /></figure></div>
    {pair.notes && <p className="pilot-cloud-note">Serving / photo note: {pair.notes}</p>}
    {slot ? <form onSubmit={review} className="pilot-review-form"><h3>Independent reviewer {slot.toUpperCase()}</h3><p className="muted">{slot === 'b' ? 'A’s ratings are saved and hidden. Ask your friend to score independently.' : 'Score each dish before seeing any model result.'} Choose the fraction of the original serving remaining. Use “cannot assess” for mixed, missing, obscured, or incomparable food.</p><fieldset disabled={busy}><label>Reviewer name or alias<input required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder={slot === 'a' ? 'e.g. Me' : 'e.g. Friend'} /></label><div className="pilot-rating-fields">{pair.dishes.map(d => <label key={d.id}>{d.name}<select required aria-label={`Human score for ${d.name}`} value={values[d.id] ?? ''} onChange={e => setValues({ ...values, [d.id]: e.target.value })}><option value="">Choose a score</option>{BINS.map(b => <option key={b} value={String(b)}>{b}% remaining</option>)}<option value="unknown">Cannot assess</option></select></label>)}</div><p className="input-note">Saving locks these ratings for the evaluation. Use two different people; aliases are fine.</p><button className="button primary" disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <CheckCircle2 size={16} />}Save reviewer {slot.toUpperCase()} ratings</button></fieldset></form> : <><div className="pilot-review-complete"><CheckCircle2 size={18} /><strong>Both human reviews saved before the model.</strong></div>{pair.feedback && <p className="pilot-feedback"><strong>Student feedback:</strong> {pair.feedback}</p>}<div className="table-scroll"><table><thead><tr><th>Dish</th><th>A: {pair.reviews.a?.name}</th><th>B: {pair.reviews.b?.name}</th><th>Model run 1</th><th>Model run 2</th></tr></thead><tbody>{pair.dishes.map(d => <tr key={d.id}><td><strong>{d.name}</strong>{pair.runs[0]?.ratings.find(r => r.dishId === d.id)?.note && <small>{pair.runs[0].ratings.find(r => r.dishId === d.id)?.note}</small>}</td><td>{ratingOf(pair.reviews.a?.ratings, d.id)}</td><td>{ratingOf(pair.reviews.b?.ratings, d.id)}</td><td>{ratingOf(pair.runs[0]?.ratings, d.id)}</td><td>{ratingOf(pair.runs[1]?.ratings, d.id)}</td></tr>)}</tbody></table></div><div className="pilot-score-controls"><button className="button primary" disabled={busy || !cloud || !enabled || pair.runs.length >= 2 || pair.attempts >= 4} onClick={score}>{busy ? <Loader2 className="spin" size={16} /> : <FlaskConical size={16} />}{pair.runs.length === 0 ? 'Run Bedrock scoring' : pair.runs.length === 1 ? 'Run again for repeatability' : 'Two runs complete'}</button><p className="input-note">{!cloud ? 'Open your AWS workspace to run the model. Device-only scores remain human ratings.' : !enabled ? 'Enable Bedrock scoring in the AWS stack first.' : 'Each click makes one Bedrock request. Up to two saved runs and four attempts per pair.'}</p></div>{pair.runs.length > 0 && <details className="pilot-provenance"><summary>Model and evaluation record</summary>{pair.runs.map((run, i) => <p key={run.id}><strong>Run {i + 1}:</strong> {run.modelId} · {run.promptVersion}<br />{new Date(run.scoredAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST · {run.inputTokens} input / {run.outputTokens} output tokens<br />Request: {run.requestId}</p>)}</details>}</>}
    {error && <p className="field-error" role="alert">{error}</p>}
    {confirm && <div className="info-strip"><Info size={17} /><div><p>Remove this pair and its evaluation ratings? Photo files remain in their storage.</p><div className="button-row"><button className="button secondary small" disabled={busy} onClick={() => setConfirm(false)}>Keep pair</button><button className="button danger small" disabled={busy} onClick={remove}>Remove pair permanently</button></div></div></div>}
    </div><div className="editor-footer"><button className="text-button delete-link" disabled={busy} onClick={() => setConfirm(true)}><Trash2 size={15} />Remove pair</button><button className="button secondary" disabled={busy} onClick={onClose}>Close</button></div></Modal>;
}
