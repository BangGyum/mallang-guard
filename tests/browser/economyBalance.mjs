import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.30';
const scenarios = await Promise.all(
  Array.from({ length: 7 }, async (_, i) =>
    JSON.parse(await readFile(`tests/scenarios/stage-${i + 1}-clear.json`, 'utf8')),
  ),
);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  await page.route('**/economy-balance', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<title>도토리 경제 검사</title>',
    }),
  );
  await page.goto('http://127.0.0.1:43195/economy-balance');
  const results = await page.evaluate(async (scenarios) => {
    const { rawContent } = await import('/src/data/index.ts');
    const { validateContent } = await import('/src/data/validate.ts');
    const { createBattle } = await import('/src/sim/battle.ts');
    const { DP_MAX } = await import('/src/sim/constants.ts');
    const reports = [];
    const content = validateContent(rawContent);
    for (const scenario of scenarios) {
      const battle = createBattle(content, scenario.stage);
      const queue = scenario.commands
        .map((command, index) => ({
          ...command,
          index,
          tick: Math.round(command.atSec * 30),
        }))
        .sort((a, b) => a.tick - b.tick || a.index - b.index);
      const lastSpawn = Math.max(
        ...battle.stage.definition.spawns.map((s) => s.atSec + (s.count - 1) * s.intervalSec),
      );
      const rejected = [],
        checkpoints = [];
      let cursor = 0,
        gained = 0,
        spent = 0,
        capTicks = 0,
        firstCapSec = null,
        completedDeploySec = null;
      const collect = (events) => {
        for (const event of events) {
          if (event.type === 'commandRejected') rejected.push({ tick: battle.state.tick, ...event });
          if (event.type === 'dpGain') gained += event.amount;
        }
      };
      while (
        battle.state.phase === 'running' &&
        battle.state.tick < (lastSpawn + 300) * 30 &&
        !rejected.length
      ) {
        while (queue[cursor]?.tick === battle.state.tick) {
          const command = queue[cursor++];
          const unit = battle.state.units.find((unit) => unit.unitId === command.unitId);
          if (command.type === 'deploy') {
            battle.enqueue({
              type: 'deploy',
              unitId: command.unitId,
              tile: { x: command.tile[0], y: command.tile[1] },
              dir: command.dir,
            });
          } else if (unit)
            battle.enqueue({
              type: command.type === 'skill' ? 'activateSkill' : 'retreat',
              uid: unit.uid,
            });
          else rejected.push({ reason: 'notDeployed', command });
          const events = battle.flush();
          collect(events);
          if (events.some((event) => event.type === 'unitDeploy'))
            spent += content.units.get(command.unitId).cost;
          if (
            completedDeploySec === null &&
            battle.state.units.length === battle.stage.definition.deployLimit
          )
            completedDeploySec = battle.state.tick / 30;
        }
        collect(battle.step());
        if (battle.state.dp >= DP_MAX) {
          capTicks++;
          firstCapSec ??= battle.state.tick / 30;
        }
        if ([30, 60, 120, 180, 300].includes(battle.state.tick / 30))
          checkpoints.push({
            second: battle.state.tick / 30,
            dp: battle.state.dp,
            units: battle.state.units.length,
          });
      }
      reports.push({
        stage: scenario.stage,
        cap: DP_MAX,
        phase: battle.state.phase,
        life: battle.state.life,
        killed: battle.state.killed,
        seconds: battle.state.tick / 30,
        gained,
        spent,
        remaining: battle.state.dp,
        firstCapSec,
        capPercent: (capTicks / battle.state.tick) * 100,
        completedDeploySec,
        checkpoints,
        rejected,
        pending: queue.length - cursor,
      });
    }
    return reports;
  }, scenarios);
  await writeFile(`docs/verification/${prefix}-economy-final.json`, `${JSON.stringify(results, null, 2)}\n`);
  console.log(JSON.stringify(results, null, 2));
  for (const result of results) {
    assert.equal(result.phase, 'won', result.stage);
    assert.equal(result.life, 3, result.stage);
    assert.deepEqual(result.rejected, [], result.stage);
    assert.equal(result.pending, 0, result.stage);
  }
} finally {
  await browser.close();
}
