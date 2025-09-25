import { ManufacturedItem } from './types';

export function computeMonthlyCounts(items: ManufacturedItem[]) {
  const map = new Map<string, { month: string; generated: number; engraved: number; scanned: number }>();
  for (const it of items) {
    const d = it.created_at ? new Date(it.created_at) : undefined;
    const key = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : 'Unknown';
    const label = d ? d.toLocaleString('en-US', { month: 'short' }) : 'Unknown';
    const rec = map.get(key) || { month: label, generated: 0, engraved: 0, scanned: 0 };
    rec.generated += 1;
    // We don’t have per-item engraved/scanned timestamps here; approximate using generated for now.
    rec.engraved += 0; // could be updated if detailed status timeline available
    rec.scanned += 0;
    map.set(key, rec);
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => v);
}

export function statusBreakdownToPieData(statusBreakdown: Record<string, number>) {
  const palette = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#1976d2', '#4caf50', '#ff9800'];
  return Object.entries(statusBreakdown).map(([name, value], i) => ({ name, value, color: palette[i % palette.length] }));
}
