import { startRuntime, expect } from '/home/user/oss-new/control/runtime/index.mjs';
import { PNG, clickMap, createCatch, createSpot } from './lib.mjs';

const runtime = await startRuntime();
try {
  // Anonymous and outsider are refused everywhere; members get in.
  await runtime.assertPrivateAccess(['/', '/spots', '/spots/new', '/paths', '/paths/new', '/catches', '/catches/new', '/forecast', '/export/gpx']);
  for (const path of ['/photos/00000000-0000-4000-8000-000000000000', '/export/gpx', '/spots']) {
    for (const role of [undefined, 'outsider']) {
      const response = await runtime.fetch(path, { role });
      expect([401, 403, 302, 303]).toContain(response.status);
    }
  }
  // No sign-in page of the app's own.
  for (const path of ['/login', '/signin', '/sign-in', '/signup', '/register', '/logout']) {
    expect((await runtime.fetch(path, { role: 'member' })).status).toBe(404);
  }

  // The owner (an org admin) keeps private data.
  const ownerPage = await (await runtime.context('owner')).newPage();
  const ownerSpot = await createSpot(ownerPage, { name: 'Secret Hump', lat: 44.1, lng: -76.3, notes: 'Owner only' });
  const ownerCatch = await createCatch(ownerPage, { species: 'Muskellunge', spotName: 'Secret Hump', lengthCm: 120 });
  const ownerPhoto = await ownerPage.getByTestId('catch-photo').first().getAttribute('src');
  await ownerPage.goto('/paths/new');
  await ownerPage.getByTestId('path-name').fill('Owner Line');
  await clickMap(ownerPage, 'path-map', 0.4, 0.5);
  await clickMap(ownerPage, 'path-map', 0.6, 0.5);
  await Promise.all([ownerPage.waitForURL(/\/paths\/[0-9a-f-]{36}$/), ownerPage.getByTestId('save-path').click()]);
  const ownerPath = ownerPage.url().split('/').pop();

  // Another member sees none of it.
  const memberPage = await (await runtime.context('member')).newPage();
  for (const path of [`/spots/${ownerSpot}`, `/catches/${ownerCatch}`, `/paths/${ownerPath}`]) {
    await memberPage.goto(path);
    await expect(memberPage.getByTestId('not-found')).toBeVisible();
    await expect(memberPage.getByText('Secret Hump')).toHaveCount(0);
    await expect(memberPage.getByText('Muskellunge')).toHaveCount(0);
  }
  await memberPage.goto(`/forecast?spot=${ownerSpot}`);
  await expect(memberPage.getByTestId('not-found')).toBeVisible();
  await expect(memberPage.getByText('Secret Hump')).toHaveCount(0);
  await memberPage.goto('/spots');
  await expect(memberPage.getByTestId('spot-row')).toHaveCount(0);
  await memberPage.goto('/catches');
  await expect(memberPage.getByTestId('catch-row')).toHaveCount(0);
  await memberPage.goto('/paths');
  await expect(memberPage.getByTestId('path-row')).toHaveCount(0);
  await memberPage.goto('/');
  await expect(memberPage.getByTestId('map-spot')).toHaveCount(0);
  await expect(memberPage.getByTestId('map-catch')).toHaveCount(0);
  await memberPage.goto('/catches/new');
  await memberPage.getByTestId('catch-spot').click();
  await expect(memberPage.getByRole('option', { name: 'Secret Hump' })).toHaveCount(0);
  await memberPage.keyboard.press('Escape');

  const memberGpx = await (await runtime.fetch('/export/gpx', { role: 'member' })).text();
  expect(memberGpx).toContain('<gpx');
  expect(memberGpx).not.toContain('Secret Hump');
  expect(memberGpx).not.toContain('Owner Line');
  expect((await runtime.fetch(ownerPhoto, { role: 'member' })).status).toBe(404);

  // A member cannot attach a photo to another member's catch.
  const form = new FormData();
  form.set('catchId', ownerCatch);
  form.set('file', new Blob([PNG], { type: 'image/png' }), 'x.png');
  const upload = await runtime.fetch('/photos', { role: 'member', method: 'POST', body: form, headers: { 'x-upload': '1' } });
  expect(upload.status).toBe(404);

  // A member's own edits and deletes, aimed at the owner's ids, change nothing.
  const memberSpot = await createSpot(memberPage, { name: 'Member Bay', lat: 44.2, lng: -76.4 });
  const memberCatch = await createCatch(memberPage, { species: 'Pike', photo: false });
  await memberPage.route('**/_serverFn/**', async (route) => {
    const body = route.request().postData() ?? '';
    await route.continue({ postData: body.replaceAll(memberSpot, ownerSpot).replaceAll(memberCatch, ownerCatch) });
  });
  await memberPage.goto(`/spots/${memberSpot}`);
  await memberPage.getByTestId('edit-spot').click();
  await memberPage.getByTestId('spot-name').fill('Hijacked');
  await memberPage.getByTestId('save-spot').click();
  await expect(memberPage.getByTestId('form-error')).toBeVisible();
  await memberPage.goto(`/spots/${memberSpot}`);
  await memberPage.getByTestId('delete-spot').click();
  await memberPage.getByTestId('confirm-delete').click();
  await expect(memberPage.getByTestId('form-error')).toBeVisible();
  await memberPage.goto(`/catches/${memberCatch}`);
  await memberPage.getByTestId('delete-catch').click();
  await memberPage.getByTestId('confirm-delete').click();
  await expect(memberPage.getByTestId('form-error')).toBeVisible();
  await memberPage.unrouteAll();

  const db = await runtime.database();
  const spotRow = await db.prepare('select name from spots where id = ?').bind(ownerSpot).first();
  expect(spotRow?.name).toBe('Secret Hump');
  const catchRow = await db.prepare('select species from catches where id = ?').bind(ownerCatch).first();
  expect(catchRow?.species).toBe('Muskellunge');
  expect((await runtime.fetch(ownerPhoto, { role: 'owner' })).status).toBe(200);

  // Admin status opens nobody else's data either.
  await ownerPage.goto(`/spots/${memberSpot}`);
  await expect(ownerPage.getByTestId('not-found')).toBeVisible();
  await ownerPage.goto(`/catches/${memberCatch}`);
  await expect(ownerPage.getByTestId('not-found')).toBeVisible();
  const ownerGpx = await (await runtime.fetch('/export/gpx', { role: 'owner' })).text();
  expect(ownerGpx).toContain('Secret Hump');
  expect(ownerGpx).not.toContain('Member Bay');

  // The app keys its own member records by the Gateway's user id.
  const users = await db.prepare('select count(*) as n from users').first();
  expect(users.n).toBeGreaterThanOrEqual(2);
} finally {
  await runtime.close();
}
