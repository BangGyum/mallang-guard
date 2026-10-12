import type { Battle } from '../sim/battle';
import { TICK_RATE } from '../sim/constants';
import { bossSkillTheme } from '../view/bossSkillTheme';
import { element } from './dom';
import { playFeedback } from './feedback';
import { portrait } from './portrait';

export function createBossHud(root: HTMLElement, battle: Battle) {
  const panel = element('div', 'boss-hud');
  panel.hidden = true;
  const avatar = element('span', 'boss-portrait');
  const details = element('div', 'boss-details');
  const heading = element('div', 'boss-heading');
  const caption = element('span', 'boss-caption', '보스');
  const name = element('strong', 'boss-name');
  const value = element('span', 'boss-hp-value');
  const hp = element('progress', 'boss-hp');
  const shield = element('progress', 'boss-shield');
  const shieldValue = element('span', 'boss-shield-value');
  const skill = element('span', 'boss-skill');
  const announcement = element('span', 'boss-announcement');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  heading.append(caption, name, value);
  details.append(heading, hp, shield, shieldValue, skill);
  panel.append(avatar, details);
  root.append(panel, announcement);
  let selectedUid: number | null = null;
  let announcedCast = 0;
  function place() {
    for (const property of ['left', 'width', 'transform']) panel.style.removeProperty(property);
    const popup = root.parentElement?.querySelector<HTMLElement>(
      '.unit-panel:not([hidden]), .roster-panel:not([hidden])',
    );
    if (!popup) return;
    const box = panel.getBoundingClientRect();
    let other = popup.getBoundingClientRect();
    const wave = root.querySelector<HTMLElement>('.wave-notice:not([hidden])');
    const waveBox = wave?.getBoundingClientRect();
    if (!overlaps(box, other) && (!waveBox || !overlaps(waveBox, other))) return;
    const parent = root.getBoundingClientRect();
    const rect = popup.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const gap = 8;
    const bar = root.parentElement?.querySelector('.deploy-bar')?.getBoundingClientRect();
    const bottom = bar ? bar.top - gap : innerHeight - gap;
    const marker = root.parentElement?.querySelector<HTMLElement>('.unit-popup-anchor:not([hidden])');
    const onRight = marker
      ? marker.offsetLeft + rect.left < parent.left + parent.width / 2
      : other.left + other.width / 2 >= parent.left + parent.width / 2;
    if (waveBox && overlaps(waveBox, other)) {
      const left = onRight ? waveBox.right + gap : waveBox.left - gap - other.width;
      if (left >= parent.left && left + other.width <= parent.right) {
        popup.style.left = `${left - rect.left}px`;
      } else if (bottom > waveBox.bottom + gap) {
        popup.style.top = `${waveBox.bottom + gap - rect.top}px`;
        popup.style.maxHeight = `${bottom - waveBox.bottom - gap}px`;
      }
      other = popup.getBoundingClientRect();
    }
    if (!overlaps(box, other)) return;
    const style = getComputedStyle(panel);
    const inset =
      Number.parseFloat(style.paddingLeft) +
      Number.parseFloat(style.paddingRight) +
      Number.parseFloat(style.borderLeftWidth) +
      Number.parseFloat(style.borderRightWidth);
    const labelWidth = [...heading.children].reduce(
      (width, child) => width + (child as HTMLElement).offsetWidth,
      0,
    );
    const minWidth = Math.ceil(
      labelWidth +
        Number.parseFloat(getComputedStyle(heading).gap) * (heading.children.length - 1) +
        avatar.offsetWidth +
        Number.parseFloat(style.gap) +
        inset,
    );
    let leftSpace = other.left - parent.left - gap;
    let rightSpace = parent.right - other.right - gap;
    if (Math.max(leftSpace, rightSpace) < minWidth && parent.width >= minWidth + other.width + gap) {
      popup.style.left = `${(onRight ? parent.right - other.width : parent.left) - rect.left}px`;
      other = popup.getBoundingClientRect();
      leftSpace = other.left - parent.left - gap;
      rightSpace = parent.right - other.right - gap;
    }
    const space = Math.max(leftSpace, rightSpace);
    if (space >= minWidth) {
      const width = Math.min(box.width, space);
      const left =
        leftSpace >= rightSpace
          ? Math.min(box.left, other.left - gap - width)
          : Math.max(box.left, other.right + gap);
      panel.style.width = `${width - inset}px`;
      panel.style.left = `${left - parent.left}px`;
      panel.style.transform = 'none';
    } else if (bottom > box.bottom + gap) {
      popup.style.top = `${box.bottom + gap - rect.top}px`;
      popup.style.maxHeight = `${bottom - box.bottom - gap}px`;
    }
  }
  return {
    update() {
      const bosses = battle.state.enemies.filter(
        (enemy) => enemy.hp > 0 && battle.content.enemies.get(enemy.enemyId)?.boss,
      );
      const enemy = bosses[0];
      const def = enemy && battle.content.enemies.get(enemy.enemyId);
      panel.hidden = !enemy || !def || battle.state.phase !== 'running';
      if (panel.hidden || !enemy || !def) {
        selectedUid = null;
        announcement.textContent = '';
        return false;
      }
      if (selectedUid !== enemy.uid) {
        announcedCast = 0;
        avatar.replaceChildren(portrait(def.art, ''));
        announcement.textContent = `보스 출현: ${def.name}. 놓치면 푸딩 ${def.lifeDamage}개를 잃어요.`;
        playFeedback(name, 'pulse');
        selectedUid = enemy.uid;
      }
      panel.dataset.enemyId = def.id;
      panel.setAttribute('aria-label', `${def.name} 보스 체력`);
      caption.textContent = bosses.length > 1 ? `보스 ×${bosses.length}` : '보스';
      name.textContent = def.name;
      value.textContent = `${Math.ceil(enemy.hp)} / ${def.hp}`;
      hp.max = def.hp;
      hp.value = enemy.hp;
      hp.setAttribute('aria-label', `${def.name} 체력`);
      shield.hidden = shieldValue.hidden = enemy.shield <= 0;
      shield.max = def.shieldHp ?? 1;
      shield.value = enemy.shield;
      shield.setAttribute('aria-label', `${def.name} 보호막`);
      shieldValue.textContent = `보호막 ${Math.ceil(enemy.shield)}`;
      const preparing = enemy.bossCastUntilTick > 0;
      if (preparing && def.bossSkill && announcedCast !== enemy.bossCastUntilTick) {
        announcement.textContent = `${def.name}, ${def.bossSkill.name} 준비. 기절로 중단할 수 있어요.`;
        announcedCast = enemy.bossCastUntilTick;
      }
      skill.hidden = !preparing || !def.bossSkill;
      skill.textContent = `${def.bossSkill?.name ?? ''} · 준비 ${Math.max(0, (enemy.bossCastUntilTick - battle.state.tick) / TICK_RATE).toFixed(1)}초`;
      panel.dataset.skillPhase = preparing
        ? 'windup'
        : enemy.stunUntilTick > battle.state.tick
          ? 'stunned'
          : 'charging';
      panel.style.setProperty('--boss-skill-color', bossSkillTheme(def).color);
      panel.title = def.bossSkill?.description ?? def.description ?? '';
      place();
      return true;
    },
    dispose() {
      panel.remove();
      announcement.remove();
    },
  };
}

function overlaps(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}
