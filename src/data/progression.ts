import type { StageDef } from './types';

export interface StageRecord {
  cleared: boolean;
  bestLife: number;
}

export function starCount(record: StageRecord | undefined): number {
  return record?.cleared ? Math.min(3, Math.max(0, record.bestLife)) : 0;
}

export function stageUnlocked(
  stages: readonly StageDef[],
  records: Readonly<Record<string, StageRecord>>,
  index: number,
): boolean {
  const stage = stages[index];
  const previous = stages[index - 1];
  return (
    !!stage && (index === 0 || !!records[stage.id]?.cleared || !!(previous && records[previous.id]?.cleared))
  );
}
