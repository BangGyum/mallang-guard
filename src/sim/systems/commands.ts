import { assert } from '../../core/assert';
import type { ContentDb } from '../../data/types';
import { DP_MAX, RETREAT_REFUND_RATIO, secToTicks } from '../constants';
import { checkDeploy } from '../queries';
import type { BattleState, Command, SimEvent, StageRuntime } from '../types';
import { chargeSkill, skillHasTarget, startSkill } from './skills';

export function applyCommand(
  content: ContentDb,
  stage: StageRuntime,
  state: BattleState,
  cmd: Command,
  events: SimEvent[],
): void {
  if (state.phase !== 'running') {
    events.push({ type: 'commandRejected', cmd, reason: 'ended' });
    return;
  }
  if (cmd.type === 'deploy') {
    const check = checkDeploy(content, stage, state, cmd.unitId, cmd.tile);
    if (!check.ok) {
      events.push({ type: 'commandRejected', cmd, reason: check.reason });
      return;
    }
    const def = content.units.get(cmd.unitId);
    const slot = state.roster.find((entry) => entry.unitId === cmd.unitId);
    const skill = def && content.skills.get(def.skill);
    assert(def && slot && skill, 'battle.deploy: missing content');
    const uid = state.nextUid++;
    state.dp -= def.cost;
    state.units.push({
      uid,
      unitId: def.id,
      tile: { ...cmd.tile },
      dir: cmd.dir,
      atkCooldown: 0,
      sp: skill.spStart,
      skillState: 'charging',
      skillEndTick: -1,
      skillHitCount: 0,
      pulsesLeft: 0,
      nextPulseTick: 0,
      buffs: [],
    });
    slot.state = 'deployed';
    slot.uid = uid;
    events.push({ type: 'unitDeploy', uid, unitId: def.id, tile: { ...cmd.tile }, dir: cmd.dir });
    const unit = state.units.at(-1);
    assert(unit, 'battle.deploy: missing unit');
    chargeSkill(content, unit, 0, events);
    return;
  }
  const unit = state.units.find((entry) => entry.uid === cmd.uid);
  if (!unit) {
    events.push({ type: 'commandRejected', cmd, reason: 'notDeployed' });
    return;
  }
  const def = content.units.get(unit.unitId);
  assert(def, 'battle.units: missing definition');
  if (cmd.type === 'activateSkill') {
    const skill = content.skills.get(def.skill);
    assert(skill, 'battle.units: missing skill');
    const reason =
      skill.trigger === 'auto'
        ? 'autoSkill'
        : unit.skillState !== 'ready'
          ? 'skillNotReady'
          : !skillHasTarget(content, stage, state, unit)
            ? 'noTarget'
            : null;
    if (reason) events.push({ type: 'commandRejected', cmd, reason });
    else startSkill(content, stage, state, unit, events);
    return;
  }
  const slot = state.roster.find((entry) => entry.uid === unit.uid);
  assert(slot, 'battle.units: missing roster slot');
  slot.state = 'cooldown';
  slot.cooldownTicks = secToTicks(def.redeploySec);
  slot.uid = null;
  state.units = state.units.filter((entry) => entry.uid !== unit.uid);
  const refund = Math.min(DP_MAX - state.dp, Math.floor(def.cost * RETREAT_REFUND_RATIO));
  state.dp += refund;
  if (state.dp === DP_MAX) state.dpTicks = 0;
  events.push({ type: 'unitRetreat', uid: unit.uid, refund });
  if (refund > 0) events.push({ type: 'dpGain', amount: refund, source: 'refund' });
}
