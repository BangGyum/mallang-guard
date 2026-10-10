export async function skillRetryMs(page, unitId) {
  return page.evaluate((unitId) => {
    const { state, content } = window.campaign.battle;
    const unit = state.units.find((unit) => unit.unitId === unitId);
    const skill = content.skills.get(content.units.get(unitId).skill);
    return skill.charge === 'auto' && unit.skillState === 'charging' && skill.spCost - unit.sp < 1 ? 34 : 300;
  }, unitId);
}

export async function installCampaignAudit(page, moduleUrl) {
  await page.evaluate(async (url) => {
    const { Battle } = await import(url);
    window.campaign = {
      battle: null,
      rejected: [],
      seen: new Set(),
      heals: 0,
      shieldHits: 0,
      disruptions: 0,
      children: 0,
      rewards: 0,
      invalidRewards: [],
      rewarded: new Set(),
      latePressure: {},
    };
    for (const name of ['step', 'flush']) {
      const original = Battle.prototype[name];
      Battle.prototype[name] = function (...args) {
        const events = original.apply(this, args);
        window.campaign.battle = this;
        const id = this.stage.definition.id;
        const spawns = this.stage.definition.spawns;
        const lateSec =
          Math.max(...spawns.map((group) => group.atSec + (group.count - 1) * group.intervalSec)) * 0.7;
        if (name === 'step' && this.state.tick >= lateSec * 30) {
          window.campaign.latePressure[id] ??= { ticks: 0, empty: 0, peak: 0 };
          const sample = window.campaign.latePressure[id];
          sample.ticks++;
          if (this.state.enemies.length === 0) sample.empty++;
          sample.peak = Math.max(sample.peak, this.state.enemies.length);
        }
        window.campaign.rejected.push(...events.filter((event) => event.type === 'commandRejected'));
        for (const event of events) {
          if (event.type === 'enemySpawn') window.campaign.seen.add(event.enemyId);
          if (event.type === 'enemySpawn' && event.parentUid !== undefined) window.campaign.children++;
          if (event.type === 'unitDisrupt') window.campaign.disruptions++;
          if (event.type === 'enemyHeal') window.campaign.heals++;
          if (event.type === 'damage' && event.shieldDamage > 0) window.campaign.shieldHits++;
          if (event.type === 'dpGain') {
            const key = `${this.stage.definition.id}:${event.uid}`;
            if (
              event.source !== 'kill' ||
              event.amount <= 0 ||
              window.campaign.rewarded.has(key) ||
              !events.some((entry) => entry.type === 'enemyDie' && entry.uid === event.uid)
            )
              window.campaign.invalidRewards.push(event);
            window.campaign.rewarded.add(key);
            window.campaign.rewards++;
          }
          if (event.type === 'unitRetreat' && event.refund !== 0) window.campaign.invalidRewards.push(event);
        }
        return events;
      };
    }
  }, moduleUrl);
}
