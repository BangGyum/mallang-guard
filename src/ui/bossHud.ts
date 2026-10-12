import type { Battle } from '../sim/battle';
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
  const announcement = element('span', 'boss-announcement');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  heading.append(caption, name, value);
  details.append(heading, hp, shield, shieldValue);
  panel.append(avatar, details);
  root.append(panel, announcement);
  let selectedUid: number | null = null;
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
      return true;
    },
    dispose() {
      panel.remove();
      announcement.remove();
    },
  };
}
