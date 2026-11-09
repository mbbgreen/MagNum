import { EditSummary } from '../types';
export interface EditGroup { file: string; items: EditSummary[]; added: number; deleted: number; }
export function groupEditSummaries(edits: EditSummary[]): EditGroup[] {
  const map = new Map<string, EditGroup>();
  for (const e of edits || []) {
    if (!map.has(e.file)) map.set(e.file, { file: e.file, items: [], added: 0, deleted: 0 });
    const g = map.get(e.file)!;
    g.items.push(e);
    g.added += e.added || 0;
    g.deleted += e.deleted || 0;
  }
  return Array.from(map.values());
}
