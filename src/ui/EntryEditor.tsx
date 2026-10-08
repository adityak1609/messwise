import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Camera, Check, ImagePlus, Info, Loader2, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { validRecord, type Photo, type WasteRecord, type WasteScope } from '../lib/domain';
import { localRepository } from '../lib/localRepository';
import type { Repository } from '../lib/repository';
import { scopeLabels, statuses, today } from '../lib/presentation';
import { Modal } from './Modal';

const coverages = ['All meals', 'Breakfast', 'Lunch', 'Dinner', 'Not confirmed'];
export function EntryEditor({ record, readOnly, repo, onClose, onSave, onDelete, onNew }: { record: WasteRecord | null; readOnly: boolean; repo: Repository; onClose: () => void; onSave: (record: WasteRecord) => Promise<void>; onDelete: (record: WasteRecord) => void; onNew: () => void }) {
  const [date, setDate] = useState(record?.date || today());
  const [weight, setWeight] = useState(record ? String(record.wasteKg) : '');
  const [scope, setScope] = useState<WasteScope>(record?.scope || 'unknown');
  const [coverage, setCoverage] = useState(record?.coverage || 'All meals');
  const [menu, setMenu] = useState(record?.menu || { breakfast: '', lunch: '', dinner: '' });
  const [attendance, setAttendance] = useState(record?.attendance ? String(record.attendance) : '');
  const [notes, setNotes] = useState(record?.notes || '');
  const [photos, setPhotos] = useState<Photo[]>(record?.photos || []);
  const [pending, setPending] = useState<{ id: string; file: File; kind: Photo['kind'] }[]>([]);
  const [photoKind, setPhotoKind] = useState<Photo['kind']>('board');
  const [action, setAction] = useState(record?.action?.text || '');
  const [actionStatus, setActionStatus] = useState<NonNullable<WasteRecord['action']>['status']>(record?.action?.status || 'planned');
  const [actionNotes, setActionNotes] = useState(record?.action?.notes || '');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  function addFiles(files: FileList | null) {
    if (!files) return;
    const added = Array.from(files);
    if (photos.length + pending.length + added.length > 6) { setError('Attach up to 6 photos per daily entry.'); return; }
    if (added.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024 || file.size === 0)) { setError('Use JPEG, PNG, or WebP photos up to 5 MB each.'); return; }
    setError(''); setPending([...pending, ...added.map(file => ({ id: crypto.randomUUID(), file, kind: photoKind }))]);
    if (fileRef.current) fileRef.current.value = '';
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (readOnly || busy) return; setError('');
    const now = new Date().toISOString();
    const value: WasteRecord = { id: record?.id || crypto.randomUUID(), date, wasteKg: Number(weight), scope, coverage: coverage.trim(), menu: { breakfast: menu.breakfast.trim(), lunch: menu.lunch.trim(), dinner: menu.dinner.trim() }, ...(attendance ? { attendance: Number(attendance) } : {}), notes: notes.trim(), photos, ...(action.trim() ? { action: { text: action.trim(), status: actionStatus, notes: actionNotes.trim() } } : {}), createdAt: record?.createdAt || now, updatedAt: now };
    const validation = validRecord(value); if (validation) { setError(validation); return; }
    setBusy(true);
    try {
      const attached = [...photos];
      for (const item of pending) { attached.push(await repo.putPhoto(item.file, item.kind)); setPhotos([...attached]); setPending(items => items.filter(i => i.id !== item.id)); }
      await onSave({ ...value, photos: attached });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this entry. Try again.'); }
    finally { setBusy(false); }
  }
  return <Modal wide title={readOnly ? 'Explore a sample entry' : record ? 'Edit daily entry' : 'Add a daily entry'} onClose={() => { if (!busy) onClose(); }}><form onSubmit={submit}><div className="editor-body">
    {readOnly ? <div className="info-strip"><Info size={17} /><p>This record is fictional. Start your own log with the number published by your mess.</p></div> : <p className="form-intro">Start with the published weight. Add only the context you know.</p>}
    <fieldset disabled={readOnly || busy}>
      <div className="form-section-title"><span>01</span><h3>The daily number</h3><small>Required</small></div>
      <div className="form-grid">
        <label>Date<input type="date" required value={date} onChange={e => setDate(e.target.value)} /></label>
        <label>Published waste weight <span className="label-hint">kg</span><input type="number" min="0" max="100000" step="0.001" required value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g. 24.5" /></label>
        <label>What does it include?<select value={scope} onChange={e => setScope(e.target.value as WasteScope)}>{Object.entries(scopeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Meals covered<select value={coverages.includes(coverage) ? coverage : 'custom'} onChange={e => setCoverage(e.target.value === 'custom' ? '' : e.target.value)}>{coverages.map(item => <option key={item}>{item}</option>)}<option value="custom">Other coverage</option></select></label>
      </div>
      {!coverages.includes(coverage) && <label className="full-label">Describe the covered meals<input required maxLength={100} value={coverage} onChange={e => setCoverage(e.target.value)} placeholder="e.g. Breakfast and lunch" /></label>}
      <div className="form-section-title"><span>02</span><h3>What was on the menu?</h3><small>Optional</small></div>
      <div className="menu-fields">{(['breakfast', 'lunch', 'dinner'] as const).map(meal => <label key={meal}><span className="meal-label">{meal[0].toUpperCase() + meal.slice(1)}</span><input maxLength={1000} placeholder={meal === 'breakfast' ? 'e.g. Poha, tea, banana' : meal === 'lunch' ? 'e.g. Rice, dal, mixed vegetables' : 'e.g. Roti, paneer, rice'} value={menu[meal]} onChange={e => setMenu({ ...menu, [meal]: e.target.value })} /></label>)}</div>
      <div className="form-section-title"><span>03</span><h3>A little context</h3><small>Optional</small></div>
      <label>Meals served across this record’s covered meals<input type="number" min="1" max="1000000" step="1" placeholder="Leave blank if unavailable" value={attendance} onChange={e => setAttendance(e.target.value)} /><span className="input-note">For a daily total, add breakfast + lunch + dinner attendance. Use actual meals served, not registered students.</span></label>
      <label className="full-label">Observation or measurement note<textarea rows={2} maxLength={3000} placeholder="e.g. The board includes all three meals; kitchen waste coverage is unconfirmed." value={notes} onChange={e => setNotes(e.target.value)} /></label>
      <div className="form-section-title"><span>04</span><h3>Photos with a purpose</h3><small>Optional</small></div>
      <div className="upload-controls"><select value={photoKind} aria-label="New photo type" onChange={e => setPhotoKind(e.target.value as Photo['kind'])}><option value="board">Waste-board photo</option><option value="plate">Plate observation</option></select><button type="button" className="button secondary" onClick={() => fileRef.current?.click()}><ImagePlus size={16} />Choose photos</button><input type="file" ref={fileRef} accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e => addFiles(e.target.files)} /></div>
      <p className="input-note">Up to 6 photos · JPEG, PNG, or WebP · 5 MB each. Photos support the record; weights come from measurements.</p>
      {(photos.length > 0 || pending.length > 0) && <div className="attachments">
        {photos.map(photo => <div className="attachment" key={photo.id}><Camera size={16} /><span>{photo.name}<small>{photo.kind === 'board' ? 'Waste board' : 'Plate observation'} · saved</small></span><button type="button" className="icon-button" aria-label={`Remove ${photo.name}`} onClick={() => setPhotos(photos.filter(p => p.id !== photo.id))}><X size={15} /></button></div>)}
        {pending.map(item => <div className="attachment" key={item.id}><Upload size={16} /><span>{item.file.name}<small>{item.kind === 'board' ? 'Waste board' : 'Plate observation'} · ready to save</small></span><button type="button" className="icon-button" aria-label={`Remove ${item.file.name}`} onClick={() => setPending(pending.filter(p => p.id !== item.id))}><X size={15} /></button></div>)}
      </div>}
      <div className="form-section-title"><span>05</span><h3>One small next step</h3><small>Optional</small></div>
      <label>Action agreed with the mess team<input maxLength={1000} placeholder="e.g. Ask students about a smaller initial rice portion." value={action} onChange={e => setAction(e.target.value)} /></label>
      {action && <div className="action-form-extra"><label>Status<select value={actionStatus} onChange={e => setActionStatus(e.target.value as NonNullable<WasteRecord['action']>['status'])}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Follow-up note<textarea rows={2} maxLength={2000} placeholder="What did the team try or observe?" value={actionNotes} onChange={e => setActionNotes(e.target.value)} /></label></div>}
    </fieldset>
    {error && <p className="field-error" role="alert"><Info size={16} />{error}</p>}
  </div><div className="editor-footer">
    {record && !readOnly ? <button type="button" className="text-button delete-link" disabled={busy} onClick={() => onDelete(record)}><Trash2 size={15} />Remove entry</button> : <span className="editor-footer-note"><ShieldCheck size={14} />{readOnly ? 'Clearly labelled sample data' : repo === localRepository ? 'Saved on this device' : 'Saved to your AWS workspace'}</span>}
    <div><button type="button" className="button secondary" disabled={busy} onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</button>{readOnly ? <button type="button" className="button primary" onClick={onNew}>Start my log <ArrowRight size={15} /></button> : <button type="submit" className="button primary" disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <Check size={16} />}{busy ? 'Saving…' : 'Save daily entry'}</button>}</div>
  </div></form></Modal>;
}
