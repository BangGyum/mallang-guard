export async function installCampaignAudit(page, moduleUrl) {
  await page.evaluate(async (url) => {
    const { Battle } = await import(url);
    window.campaign = {
      battle: null,
      rejected: [],
      seen: new Set(),
      heals: 0,
      shieldHits: 0,
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
        const period = id === 'stage-1' ? 91 : id === 'stage-2' ? 95 : 0;
        if (name === 'step' && period && this.state.tick >= period * 7 * 30) {
          window.campaign.latePressure[id] ??= { ticks: 0, empty: 0, peak: 0 };
          const sample = window.campaign.latePressure[id];
          sample.ticks++;
          if (this.state.enemies.length === 0) sample.empty++;
          sample.peak = Math.max(sample.peak, this.state.enemies.length);
        }
        window.campaign.rejected.push(...events.filter((event) => event.type === 'commandRejected'));
        for (const event of events) {
          if (event.type === 'enemySpawn') window.campaign.seen.add(event.enemyId);
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
