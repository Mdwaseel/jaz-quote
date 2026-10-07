// Room size → recommended JAZ configuration, using the JAZ room guide served with the
// builder catalog (catalog/jaz.py ROOM_GUIDE). The salesperson can always override it.

const pos = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** "7.2.4" → [7, 2, 4] */
export const parseConfig = (code) => String(code || '').split('.').map((x) => Number(x) || 0);
const channels = (code) => parseConfig(code).reduce((s, x) => s + x, 0);
const maxSeats = (range) => Number(String(range || '').split(/[–-]/).pop()) || 0;

/** How far two configurations are apart — ear-level speakers weigh most. */
export const configDistance = (a, b) => {
  const [e1, s1, h1] = parseConfig(a);
  const [e2, s2, h2] = parseConfig(b);
  return Math.abs(e1 - e2) * 3 + Math.abs(s1 - s2) + Math.abs(h1 - h2);
};

/**
 * Recommend a configuration for the room.
 * Picks the guide room closest in area, then: two seating rows / a premium build / more seats
 * than the room suits → the guide's larger option; a 30 ft+ room → 9.2.6 rather than 9.2.4.
 * 9.1.2 is never chosen automatically.
 */
export function recommend(guide, project) {
  const a = pos(project.RoomLength);
  const b = pos(project.RoomWidth);
  if (!a || !b || !guide?.length) return null;
  const area = Math.round(a * b * 10) / 10;
  const areaOf = (r) => r.Length * r.Width;
  const row = guide.reduce((best, r) => (Math.abs(areaOf(r) - area) < Math.abs(areaOf(best) - area) ? r : best));
  const seats = pos(project.Seats);
  const rows = pos(project.Rows);
  const premium = project.Premium === 'yes';
  const reasons = [`${area} sq.ft — closest JAZ guide room is ${row.Length} × ${row.Width} ft (${areaOf(row)} sq.ft)`];
  if (row.Note) reasons.push(row.Note);

  let pick = row.Pick;
  const upgrade = row.Upgrade && channels(row.Upgrade) > channels(pick) ? row.Upgrade : null;
  if (upgrade && rows >= 2) {
    pick = upgrade;
    reasons.push(`${rows} seating rows → the larger option, ${upgrade}`);
  } else if (upgrade && premium) {
    pick = upgrade;
    reasons.push(`Premium build → the larger option, ${upgrade}`);
  } else if (upgrade && seats > maxSeats(row.Seats)) {
    pick = upgrade;
    reasons.push(`${seats} seats is more than the ${row.Seats} this room suits → ${upgrade}`);
  }
  if (Math.max(a, b) >= 30 && pick === '9.2.4') {
    pick = '9.2.6';
    reasons.push('30 ft+ room → 9.2.6 for even height coverage');
  }

  const notes = [];
  if (seats && seats > maxSeats(row.Seats)) notes.push(`${seats} seats is more than the ${row.Seats} seats this room size suits — check the seating layout.`);
  const h = pos(project.RoomHeight);
  if (h && h < 8) notes.push('Ceiling under 8 ft — confirm the ceiling-speaker placement during the site survey.');

  return { area, row, pick, reasons, notes };
}
