import type { RejectReason } from '../sim/types';

export const REJECTION_MESSAGES: Record<RejectReason, string> = {
  ended: '전투가 끝났어요',
  notReady: '아직 준비 중이에요',
  limit: '더 배치할 수 없어요',
  noDp: '도토리가 부족해요',
  badTile: '여기엔 놓을 수 없어요',
  occupied: '이미 친구가 있어요',
  notDeployed: '배치된 친구가 없어요',
  skillNotReady: '스킬이 아직 안 찼어요',
  noTarget: '범위 안에 대상이 없어요',
  autoSkill: '자동으로 발동하는 스킬이에요',
};
