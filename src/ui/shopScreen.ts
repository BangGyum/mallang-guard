import { ROLE_COLORS, ROLE_NAMES } from '../art/palette';
import {
  type CollectionState,
  isRareUnit,
  rarityFor,
  recruitment,
  recruitRate,
  type ShopResult,
  unitPriceFor,
} from '../data/recruitment';
import type { ContentDb } from '../data/types';
import { button, element } from './dom';
import { moneyIcon } from './moneyIcon';
import { portrait } from './portrait';
import { createRecruitResult } from './recruitResult';
import { createSkillDetails } from './skillDetails';

const ERRORS = {
  noMoney: '머니가 부족해요. 전투를 마치고 보상을 받아주세요.',
  owned: '이미 보유한 친구예요.',
  unknownUnit: '이 친구는 현재 영입할 수 없어요.',
  saveFailed: '저장할 수 없어 구매하지 않았어요. 브라우저 저장 공간을 확인해주세요.',
};

export function createShopScreen(
  root: HTMLElement,
  content: ContentDb,
  state: () => Readonly<CollectionState>,
  actions: { back(): void; backLabel?: string; draw(count: 1 | 10): ShopResult; buy(id: string): ShopResult },
) {
  const screen = element('section', 'shop-screen');
  screen.setAttribute('aria-label', '상점과 친구 모집');
  const header = element('header', 'shop-header');
  const identity = element('div', 'shop-identity');
  identity.append(
    element('small', 'screen-eyebrow', '전투의 보상, 새로운 동료'),
    element('h1', '', '보급 상점'),
  );
  const wallet = element('div', 'shop-wallet');
  const balance = element('strong', 'shop-money');
  wallet.append(moneyIcon(), balance, element('span', '', '머니'));
  const back = button(actions.backLabel ?? '타이틀로', actions.back, 'shop-back');
  header.append(identity, wallet, back);
  const body = element('div', 'shop-body');
  const booth = element('section', 'recruit-booth');
  const art = element('div', 'recruit-booth-art');
  const pool = recruitment.pool.flatMap((id) => {
    const unit = content.units.get(id);
    return unit ? [unit] : [];
  });
  for (const unit of pool
    .filter((unit) => isRareUnit(unit.id))
    .reverse()
    .slice(0, 3))
    art.append(portrait(unit.art, ''));
  booth.append(
    art,
    element('small', 'screen-eyebrow', '친구 모집'),
    element('h2', '', '함께 푸딩을 지킬 동료'),
  );
  const description = element(
    'p',
    'shop-copy',
    `${recruitment.unlockAllForTesting ? '테스트 기간에는 모든 친구를 사용할 수 있어요. ' : ''}모집 1회 ${recruitment.pullCost}머니. 중복 친구는 ${recruitment.duplicateRefund}머니를 돌려받아요.`,
  );
  const guarantee = element('p', 'recruit-guarantee');
  const single = button(
    `1회 모집 · ${recruitment.pullCost}머니`,
    () => finish(actions.draw(1), single),
    'primary-button recruit-single',
  );
  const ten = button(
    `10회 모집 · ${(recruitment.pullCost * 10).toLocaleString()}머니`,
    () => finish(actions.draw(10), ten),
    'recruit-ten',
  );
  const rates = element('details', 'shop-rates');
  rates.append(element('summary', '', '모집 확률과 보장 규칙'));
  rates.append(
    element(
      'p',
      '',
      `일반 추첨의 등급 합산 확률: ${recruitment.rarities.map((r) => `${r.id} ${r.pullPercent}%`).join(' · ')}. 개별 표시값은 반올림합니다. 모집에서 신규 영입 시 보장 횟수를 초기화하고 ${recruitment.guaranteeAfter}회째에는 일반 추첨 확률과 별도로 미보유 친구 중 같은 확률로 한 명을 영입합니다. UR도 미보유 보장에 포함되며 모두 보유하면 중복 환급을 적용합니다.`,
    ),
  );
  const rateList = element('ul', 'shop-rate-list');
  for (const unit of pool)
    rateList.append(
      element(
        'li',
        '',
        `${unit.name} · ${rarityFor(unit.id).id} ${recruitRate(
          unit.id,
          pool.map((unit) => unit.id),
        ).toFixed(2)}%`,
      ),
    );
  rates.append(rateList);
  const earnings = element('details', 'shop-earnings');
  earnings.append(element('summary', '', '머니는 어떻게 얻나요?'));
  earnings.append(
    element(
      'p',
      '',
      `클리어 보상에 별 하나당 ${recruitment.starBonus}머니, 첫 클리어에는 ${recruitment.firstClearBonus}머니를 더 받아요. 패배해도 처치당 ${recruitment.defeatPerKill}머니를 최대 ${recruitment.defeatMax}까지 받아요. 나가기로 중단한 전투는 보상을 받지 않아요.`,
    ),
  );
  const rewardList = element('ul', 'shop-rate-list');
  for (const stage of content.stages.values())
    rewardList.append(element('li', '', `${stage.name} · ${recruitment.clearRewards[stage.id] ?? 0}머니`));
  earnings.append(rewardList);
  const status = element('p', 'shop-status');
  status.setAttribute('role', 'status');
  booth.append(description, guarantee, single, ten, status, rates, earnings);
  const collection = element('section', 'shop-collection');
  const collectionHeading = element('div', 'shop-collection-heading');
  const count = element('span', 'shop-owned-count');
  collectionHeading.append(element('h2', '', '동료 도감'), count);
  const cards = element('div', 'shop-unit-grid');
  collection.append(
    collectionHeading,
    element(
      'p',
      'shop-copy',
      `${recruitment.rarities.map((r) => `${r.id} ${r.unitPrice.toLocaleString()}머니`).join(' · ')}로 바로 영입할 수 있어요.`,
    ),
    cards,
  );
  body.append(booth, collection);
  screen.append(header, body);
  root.append(screen);
  let resultScreen: ReturnType<typeof createRecruitResult> | undefined;
  function finish(result: ShopResult, trigger: HTMLButtonElement) {
    if (!result.ok) {
      status.textContent = ERRORS[result.reason];
      return;
    }
    status.textContent = `사용 ${result.cost.toLocaleString()}머니 · 중복 환급 ${result.refund.toLocaleString()}머니`;
    const unitId = trigger.closest<HTMLElement>('.shop-unit')?.dataset.unitId;
    update();
    resultScreen?.dispose();
    resultScreen = createRecruitResult(root, content, result.results, result.cost, result.refund, () => {
      resultScreen?.dispose();
      resultScreen = undefined;
      const detail = unitId ? cards.querySelector<HTMLElement>(`[data-unit-id="${unitId}"] summary`) : null;
      const focus =
        trigger.isConnected && !trigger.disabled ? trigger : (detail ?? (!single.disabled ? single : back));
      focus.focus({ preventScroll: true });
      if (focus === detail) focus.scrollIntoView({ block: 'nearest' });
    });
  }
  function update() {
    const expanded = new Set(
      [...cards.querySelectorAll<HTMLElement>('.shop-unit:has(details[open])')].map(
        (card) => card.dataset.unitId,
      ),
    );
    const value = state();
    balance.textContent = value.money.toLocaleString();
    single.disabled = value.money < recruitment.pullCost;
    ten.disabled = value.money < recruitment.pullCost * 10;
    const owned = pool.filter((unit) => value.ownedUnits.includes(unit.id)).length;
    count.textContent = `보유 ${owned}/${pool.length}`;
    guarantee.textContent =
      owned === pool.length
        ? '모든 친구를 만났어요. 중복 모집은 머니로 환급해요.'
        : `미보유 친구 보장까지 ${recruitment.guaranteeAfter - value.pullsSinceNew}회`;
    cards.replaceChildren();
    const ordered = [...pool].sort(
      (a, b) => Number(value.ownedUnits.includes(a.id)) - Number(value.ownedUnits.includes(b.id)),
    );
    for (const unit of ordered) {
      const have = value.ownedUnits.includes(unit.id);
      const card = element('article', 'shop-unit');
      card.dataset.unitId = unit.id;
      card.dataset.owned = String(have);
      card.dataset.rarity = rarityFor(unit.id).id;
      card.style.setProperty('--role-color', ROLE_COLORS[unit.role]);
      const skill = content.skills.get(unit.skill);
      const details = createSkillDetails(
        content,
        element('summary', '', skill?.name ?? '스킬'),
        element('p', ''),
      );
      details.element.classList.add('shop-unit-detail');
      if (skill) details.update(unit, skill);
      details.element.open = expanded.has(unit.id);
      const price = unitPriceFor(unit.id);
      const buy = button(
        have ? '보유 중' : `${price.toLocaleString()}머니 · 영입`,
        () => finish(actions.buy(unit.id), buy),
        'shop-buy',
      );
      buy.disabled = have || value.money < price;
      buy.setAttribute('aria-label', have ? `${unit.name} 보유 중` : `${unit.name} 영입 ${price}머니`);
      card.append(
        portrait(unit.art, 'shop-unit-portrait'),
        element('strong', '', unit.name),
        element('small', 'unit-rarity', `${rarityFor(unit.id).id} · ${ROLE_NAMES[unit.role]}`),
        details.element,
        buy,
      );
      cards.append(card);
    }
  }
  update();
  back.focus({ preventScroll: true });
  return {
    dispose() {
      resultScreen?.dispose();
      screen.remove();
    },
  };
}
