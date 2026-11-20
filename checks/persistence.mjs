import { startRuntime, expect } from '/home/user/oss-new/control/runtime/index.mjs';
import { clickMap, createCatch, createSpot } from './lib.mjs';

const runtime = await startRuntime();
try {
  let page = await (await runtime.context('owner')).newPage();
  const spotId = await createSpot(page, { name: 'Long Point Bar', lat: 42.55, lng: -80.1, icon: 'flag', color: 'red' });
  await page.goto('/paths/new');
  await page.getByTestId('path-name').fill('Bar Edge Run');
  await clickMap(page, 'path-map', 0.4, 0.5);
  await clickMap(page, 'path-map', 0.6, 0.5);
  await Promise.all([page.waitForURL(/\/paths\/[0-9a-f-]{36}$/), page.getByTestId('save-path').click()]);
  const pathId = page.url().split('/').pop();
  const catchId = await createCatch(page, { species: 'Smallmouth bass', spotName: 'Long Point Bar', weightKg: 1.8 });
  const photoSrc = await page.getByTestId('catch-photo').first().getAttribute('src');
  const score = await page.getByTestId('cond-score').textContent();

  await runtime.restart();

  page = await (await runtime.context('owner')).newPage();
  await page.goto(`/spots/${spotId}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Long Point Bar');
  await page.goto(`/paths/${pathId}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bar Edge Run');
  await expect(page.getByTestId('path-point')).toHaveCount(2);
  await page.goto(`/catches/${catchId}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Smallmouth bass');
  await expect(page.getByTestId('cond-score')).toHaveText(score);
  await expect(page.getByTestId('catch-photo')).toHaveCount(1);
  const photo = await runtime.fetch(photoSrc, { role: 'owner' });
  expect(photo.status).toBe(200);
  expect(Buffer.from(await photo.arrayBuffer()).length).toBeGreaterThan(50);
} finally {
  await runtime.close();
}
