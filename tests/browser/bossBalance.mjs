import assert from 'node:assert/strict';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.23';
const files = (await readdir('tests/scenarios')).filter((file) => file.endsWith('.json'));
const scenarios = await Promise.all(
  files.map(async (file) => ({ file, ...JSON.parse(await readFile(`tests/scenarios/${file}`, 'utf8')) })),
);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext();
  await context.grantPermissions(['local-network-access']);
  const page = await context.newPage();
  await page.route('**/boss-balance-check', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>보스 공략 검사</title>' }),
  );
  await page.goto('http://127.0.0.1:43195/boss-balance-check');
  const result = await page.evaluate(
    async ({ scenarios, adaptive }) => {
      const { content } = await import('/src/data/index.ts');
      const { createBattle } = await import('/src/sim/battle.ts');
      const { skillHasTarget } = await import('/src/sim/systems/skills.ts');
      const report = [];
      for (const scenario of scenarios) {
        const battle = createBattle(content, scenario.stage);
        const queue = scenario.commands.map((command, index) => ({
          command,
          index,
          tick: Math.round(command.atSec * 30),
        }));
        const lastSpawn = Math.max(
          ...battle.stage.spawns.map(
            (group) => (group.atTick + (group.count - 1) * group.intervalTicks) / 30,
          ),
        );
        const executed = [];
        const rejected = [];
        const leaks = [];
        const enemies = new Map();
        const casts = {};
        const collect = (events) => {
          for (const event of events) {
            if (event.type === 'commandRejected') rejected.push({ tick: battle.state.tick, ...event });
            if (event.type === 'enemySpawn') enemies.set(event.uid, event.enemyId);
            if (event.type === 'enemyLeak')
              leaks.push({ sec: battle.state.tick / 30, enemy: enemies.get(event.uid) });
            if (event.type === 'bossSkill') {
              const key = `${event.enemyId}/${event.phase}`;
              casts[key] = (casts[key] ?? 0) + 1;
            }
          }
        };
        while (battle.state.phase === 'running' && battle.state.tick < (lastSpawn + 300) * 30) {
          for (let i = 0; i < queue.length; ) {
            const entry = queue[i];
            if (entry.tick > battle.state.tick) {
              i++;
              continue;
            }
            const command = entry.command;
            const unit = battle.state.units.find((unit) => unit.unitId === command.unitId);
            if (
              adaptive &&
              command.type === 'skill' &&
              unit &&
              (unit.skillState !== 'ready' || !skillHasTarget(content, battle.stage, battle.state, unit))
            ) {
              i++;
              continue;
            }
            if (command.type === 'deploy')
              battle.enqueue({
                type: 'deploy',
                unitId: command.unitId,
                tile: { x: command.tile[0], y: command.tile[1] },
                dir: command.dir,
              });
            else if (unit)
              battle.enqueue({ type: command.type === 'skill' ? 'activateSkill' : 'retreat', uid: unit.uid });
            else {
              rejected.push({ tick: battle.state.tick, reason: 'notDeployed', command });
              queue.splice(i, 1);
              continue;
            }
            const events = battle.flush();
            collect(events);
            if (!events.some((event) => event.type === 'commandRejected'))
              executed.push({
                index: entry.index,
                requested: command.atSec,
                actual: battle.state.tick / 30,
                command: { ...command, atSec: Math.round((battle.state.tick / 30) * 1000) / 1000 },
              });
            queue.splice(i, 1);
          }
          collect(battle.step());
        }
        report.push({
          file: scenario.file,
          expect: scenario.expect,
          phase: battle.state.phase,
          life: battle.state.life,
          killed: battle.state.killed,
          total: battle.state.totalEnemies,
          seconds: battle.state.tick / 30,
          rejected,
          leaks,
          casts,
          executedCommands: executed.length,
          shifts: executed.filter((entry) => Math.abs(entry.requested - entry.actual) > 0.02),
          pending: queue.map((entry) => entry.command),
          commands: adaptive
            ? executed.sort((a, b) => a.index - b.index).map((entry) => entry.command)
            : undefined,
        });
      }
      return report;
    },
    { scenarios, adaptive: process.argv.includes('--adaptive') },
  );
  const mode = process.argv.includes('--adaptive') ? 'adaptive' : 'strict';
  await writeFile(`docs/verification/${prefix}-balance-${mode}.json`, `${JSON.stringify(result, null, 2)}\n`);
  if (mode === 'strict')
    for (const row of result) {
      assert.equal(row.phase, row.expect.result, row.file);
      if (row.expect.minLife !== undefined) assert(row.life >= row.expect.minLife, row.file);
      assert.deepEqual(row.rejected, [], `${row.file}: 거부 입력`);
      assert.deepEqual(row.pending, [], `${row.file}: 미실행 입력`);
    }
  console.log(
    JSON.stringify(
      result.map(({ file, phase, life, rejected, leaks, shifts, pending }) => ({
        file,
        phase,
        life,
        rejected: rejected.length,
        leaks,
        shifts: shifts.length,
        pending: pending.length,
      })),
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
