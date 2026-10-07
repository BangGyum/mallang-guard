import assert from 'node:assert/strict';

export async function frame(page, ms = 120) {
  await page.clock.runFor(ms);
}

export async function enterBattle(page) {
  await page.getByRole('button', { name: '시작', exact: true }).click();
  await page.locator('.deploy-bar').waitFor();
  await frame(page);
}

export async function pause(page) {
  const button = page.locator('[data-action="pause"]');
  if ((await button.textContent()) === '일시정지') {
    await button.click();
    await frame(page);
    await page.getByRole('button', { name: '멈춘 채 배치' }).click();
    await frame(page);
  }
}

export async function resume(page) {
  const button = page.locator('[data-action="pause"]');
  if ((await button.textContent()) === '계속하기') {
    await button.click();
    await frame(page);
  }
}

export async function tilePoint(page, tile) {
  return page.evaluate(async (tile) => {
    const { fitCamera, boardBox } = await import('/src/view/camera.ts');
    const { tileScreen } = await import('/src/view/picking.ts');
    const { parseBoard } = await import('/src/sim/board.ts');
    const { content } = await import('/src/data/index.ts');
    const board = parseBoard(content.stages.get('stage-1').map);
    const canvas = document.querySelector('#board');
    const height = canvas.clientHeight;
    const camera = fitCamera(
      boardBox(board.width, board.height),
      canvas.clientWidth / height,
      height <= 500 ? { minX: -0.94, maxX: 0.94, minY: -0.45, maxY: 0.68 } : undefined,
    );
    return tileScreen(canvas, camera, board, tile);
  }, tile);
}

export async function drag(page, cdp, unitId, tile) {
  const card = page.locator(`.deploy-card[data-unit-id="${unitId}"]`);
  const box = await card.boundingBox();
  assert(box);
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const to = await tilePoint(page, tile);
  if (cdp) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
    await frame(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...to, id: 1 }] });
    await frame(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await frame(page);
    await page.mouse.move(to.x, to.y, { steps: 5 });
    await frame(page);
    await page.mouse.up();
  }
  await frame(page);
  return to;
}

export async function deploy(page, cdp, unitId, tile, dir) {
  await pause(page);
  await drag(page, cdp, unitId, tile);
  assert.equal(await page.locator('.aim-directions').isVisible(), true, `${unitId}: 방향 조준 진입`);
  const arrow = page.locator(`[data-dir="${dir}"]`);
  if (cdp) await arrow.tap();
  else await arrow.click();
  await frame(page);
  assert.equal(
    await page.locator(`.deploy-card[data-unit-id="${unitId}"]`).isVisible(),
    false,
    `${unitId}: 배치 성공`,
  );
}
