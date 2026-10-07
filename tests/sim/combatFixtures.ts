import { spawnEnemies } from '../../src/sim/systems/spawn';
import type { EnemyEntity } from '../../src/sim/types';
import { makeFixture, unitFixture } from './battleFixtures';

export function combatFixture() {
  const fixture = makeFixture();
  spawnEnemies(fixture.stage, fixture.state, []);
  fixture.state.units.push(unitFixture({ uid: fixture.state.nextUid++, dir: 'left' }));
  return fixture;
}

export function placeEnemy(
  fixture: ReturnType<typeof combatFixture>,
  distance: number,
  patch: Partial<EnemyEntity> = {},
): EnemyEntity {
  const original = fixture.state.enemies[0];
  if (!original) throw new Error('적 fixture가 없습니다');
  const position = fixture.stage.routes.get('ground')?.positionAt(distance);
  if (!position) throw new Error('경로 fixture가 없습니다');
  return {
    ...original,
    uid: fixture.state.nextUid++,
    dist: distance,
    ...position,
    px: position.x,
    py: position.y,
    ...patch,
  };
}
