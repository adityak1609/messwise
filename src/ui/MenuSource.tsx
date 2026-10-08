import { WEEKLY_MENU } from '../lib/menu';
import '../menu.css';

export function MenuSource() {
  return <div className="menu-source"><strong>Published weekly menu · {WEEKLY_MENU.foodCourt}</strong>
    <span>5–11 October 2026 · <a href={WEEKLY_MENU.sourceUrl} target="_blank" rel="noopener noreferrer">View source</a></span>
    <p>Check against what was actually served. Edit any substitutions.</p>
  </div>;
}
