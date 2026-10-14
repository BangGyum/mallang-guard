import { assert } from '../core/assert';
import type { ContentDb, Effect, SkillDef, UnitDef } from '../data/types';
import { element } from './dom';

function number(value: number): string {
  return String(Number(value.toFixed(2)));
}

function rangeText(content: ContentDb, id: string): string {
  const range = content.ranges.get(id);
  assert(range, `skillDetails: missing range ${id}`);
  const tiles = range.tiles;
  const width = Math.max(...tiles.map(([x]) => x)) - Math.min(...tiles.map(([x]) => x)) + 1;
  const height = Math.max(...tiles.map(([, y]) => y)) - Math.min(...tiles.map(([, y]) => y)) + 1;
  return `${tiles.every(([x]) => x > 0) ? '정면' : '주변'} ${width}×${height}칸`;
}

function effectText(content: ContentDb, unit: UnitDef, effect: Effect): string {
  switch (effect.type) {
    case 'statMul':
      return effect.stat === 'atk'
        ? `공격력 ${number(Math.abs(effect.value - 1) * 100)}% ${effect.value >= 1 ? '증가' : '감소'} (${number(unit.atk)} → ${number(unit.atk * effect.value)})`
        : `공격 속도 ${number(1 / effect.value)}배 · 공격 간격 ${number(unit.atkIntervalSec)}초 → ${number(unit.atkIntervalSec * effect.value)}초`;
    case 'armorPenAdd':
      return `관통력 +${effect.value} (${unit.armorPen ?? 0} → ${(unit.armorPen ?? 0) + effect.value})`;
    case 'rangeOverride':
      return `사거리 ${rangeText(content, unit.range)} → ${rangeText(content, effect.range)}`;
    case 'multiTarget':
      return `서로 다른 적 최대 ${effect.count}명 동시 사격 · 적 한 명당 한 발`;
    case 'chain':
      return `최대 ${effect.damageMuls.length}명 연쇄 · 공격력 비율 ${effect.damageMuls.map((value) => `${number(value * 100)}%`).join(' → ')} · 사거리 안 이전 적의 ${effect.radius}칸 이내 · 중복 타격 없음`;
    case 'splash':
      return `명중 지점 반경 ${effect.radius}칸에 범위 피해`;
    case 'onHitSlow':
      return `맞은 적 이동 속도 ${number(effect.amount * 100)}% 감소 · ${effect.sec}초`;
    case 'stunEveryNthHit':
      return `${effect.n === 1 ? '공격마다' : `${effect.n}번째 공격마다`} 명중한 적 ${effect.sec}초 기절`;
    case 'killBounty':
      return `자신의 사거리 안에서 아군이 처치한 적의 도토리 보상 +${effect.value}`;
    case 'hasteAura':
      return `사거리 안 친구(자신 포함)의 공격 간격 ${number((1 - effect.value) * 100)}% 감소`;
    case 'pulseDamage':
      return `사거리 안 모든 공격 가능한 적에게 공격력 ${number(effect.atkMul * 100)}% ${effect.damageType === 'magic' ? '마법' : '물리'} 피해 · ${effect.count}회 · ${effect.intervalSec}초 간격`;
    case 'slowAura':
      return `사거리 안 적 이동 속도 ${number(effect.amount * 100)}% 감소`;
    case 'pushback':
      return `사거리 안 목표 적 1명을 경로 뒤로 ${effect.tiles}칸 밀어냄`;
  }
}

export function skillDetailsInfo(content: ContentDb, unit: UnitDef, skill: SkillDef) {
  const suffix = skill.charge === 'auto' ? '초' : '회 공격';
  const facts: [string, string][] = [
    ['발동', skill.trigger === 'manual' ? '수동 발동' : '조건 충족 시 자동 발동'],
    ['지속', skill.durationSec === 0 ? '즉시 처리' : `${skill.durationSec}초`],
    ['충전', skill.charge === 'auto' ? '전투 시간 1초마다 SP +1' : '공격할 때마다 SP +1'],
    ['SP', `필요 ${skill.spCost} · 배치 시 ${skill.spStart}`],
    ['준비', `최초 ${skill.spCost - skill.spStart}${suffix} · 재충전 ${skill.spCost}${suffix}`],
    ['조건', skill.condition === 'always' ? 'SP가 준비되면 사용 가능' : '사거리 안 공격 가능한 적 필요'],
  ];
  if (unit.targetPriority === 'boss') facts.push(['조준', '보스 우선 · 같은 우선순위에서는 골에 가까운 적']);
  const trait = unit.traits?.find((effect) => effect.type === 'chain' || effect.type === 'splash');
  if (trait) facts.push(['기본 공격', effectText(content, unit, trait)]);
  return { facts, effects: skill.effects.map((effect) => effectText(content, unit, effect)) };
}

export function createSkillDetails(
  content: ContentDb,
  summary: HTMLElement,
  description: HTMLParagraphElement,
  initiallyOpen = false,
) {
  const section = element('details', 'skill-details');
  section.open = initiallyOpen;
  summary.classList.add('skill-info-toggle');
  summary.append(element('span', 'skill-info-label', '상세'));
  summary.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.code === 'Space') event.stopPropagation();
  });
  const body = element('div', 'skill-details-body');
  const facts = element('dl', 'skill-facts');
  const effects = element('ul', 'skill-effects');
  const note = element(
    'p',
    'skill-info-note',
    '스킬 종료 후 SP 0부터 재충전합니다. 수치 예시는 기본 능력치 기준입니다.',
  );
  body.append(description, facts, effects, note);
  section.append(summary, body);
  let selected = '';
  return {
    element: section,
    update(unit: UnitDef, skill: SkillDef) {
      if (selected === unit.id) return;
      selected = unit.id;
      section.open = initiallyOpen;
      section.dataset.skillId = skill.id;
      summary.setAttribute('aria-label', `${unit.name} ${skill.name} 상세 정보`);
      description.textContent = skill.description;
      const info = skillDetailsInfo(content, unit, skill);
      facts.replaceChildren(
        ...info.facts.flatMap(([label, value]) => [element('dt', '', label), element('dd', '', value)]),
      );
      effects.replaceChildren(...info.effects.map((effect) => element('li', '', effect)));
    },
  };
}
