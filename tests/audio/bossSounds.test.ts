import { describe, expect, it } from 'vitest';
import { bossSkillSound } from '../../src/audio/bossSounds';
import { content } from '../../src/data';

describe('보스별 사운드 연결', () => {
  const bosses = [...content.enemies.values()].filter((enemy) => enemy.bossSkill);
  it.each(bosses)('$name은 서로 다른 예고·발동음을 갖는다', (boss) => {
    expect(bossSkillSound(boss.id, 'windup')).toMatch(/windup$/);
    expect(bossSkillSound(boss.id, 'cast')).toMatch(/cast$/);
    expect(bossSkillSound(boss.id, 'cancel')).toBeUndefined();
  });
  it('7종 모두 소리로 구분하며 일반 적에게 보스음을 내지 않는다', () => {
    expect(new Set(bosses.map((boss) => bossSkillSound(boss.id, 'cast'))).size).toBe(7);
    expect(bossSkillSound('jelly', 'cast')).toBeUndefined();
  });
});
