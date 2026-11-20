import { startRuntime, expect } from '/home/user/oss-new/control/runtime/index.mjs';
import { clickMap, createCatch, createSpot } from './lib.mjs';

const runtime = await startRuntime();
try {
  const page = await (await runtime.context('owner')).newPage();

  // F001: spots by typed coordinates, listed, searched, sorted, edited, deleted.
  const reefId = await createSpot(page, {
    name: 'Kelly Reef Ledge', lat: 41.6195, lng: -82.6602,
    notes: 'Rock ledge at 6 m, best on a west wind.', icon: 'anchor', color: 'blue',
  });
  await expect(page.getByTestId('spot-coordinates')).toContainText('41.61950');
  await expect(page.getByTestId('spot-notes-view')).toHaveText('Rock ledge at 6 m, best on a west wind.');
  await runtime.assertBackLink(page);

  await createSpot(page, { name: 'Bass Island Weedline', lat: 41.6552, lng: -82.8204, icon: 'fish', color: 'green' });
  const tempId = await createSpot(page, { name: 'Marina Fuel Dock', lat: 41.5123, lng: -82.9377 });

  await page.goto('/spots');
  await expect(page.getByTestId('spot-row')).toHaveCount(3);
  await page.getByTestId('sort-name').click();
  await expect(page.getByTestId('spot-row').first()).toContainText('Bass Island Weedline');
  await page.getByTestId('spot-search').fill('reef');
  await expect(page.getByTestId('spot-row')).toHaveCount(1);
  await expect(page.getByTestId('spot-row')).toContainText('Kelly Reef Ledge');
  await page.getByTestId('spot-search').fill('');

  await page.goto(`/spots/${tempId}`);
  await page.getByTestId('edit-spot').click();
  await page.getByTestId('spot-name').fill('Marina Launch Ramp');
  await page.getByTestId('save-spot').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Marina Launch Ramp');
  await page.getByTestId('delete-spot').click();
  await Promise.all([page.waitForURL(/\/spots$/), page.getByTestId('confirm-delete').click()]);
  await expect(page.getByTestId('spot-row')).toHaveCount(2);
  await expect(page.getByText('Marina Launch Ramp')).toHaveCount(0);

  // F001: a spot from the browser's position.
  const geo = await runtime.context('owner', { geolocation: { latitude: 41.5, longitude: -82.7 }, permissions: ['geolocation'] });
  const geoPage = await geo.newPage();
  await geoPage.goto('/spots/new');
  await geoPage.getByTestId('use-my-position').click();
  await expect(geoPage.getByTestId('spot-lat')).toHaveValue('41.50000');
  await expect(geoPage.getByTestId('spot-lng')).toHaveValue('-82.70000');
  await geo.close();

  // F001/F003: picking a point on the map fills the coordinates.
  await page.goto('/spots/new');
  await expect(page.getByTestId('spot-map-land')).toBeAttached();
  await clickMap(page, 'spot-map', 0.5, 0.5);
  await expect(page.getByTestId('spot-lat')).not.toHaveValue('');
  await expect(page.getByTestId('spot-lng')).not.toHaveValue('');

  // F002: a path drawn by clicking the map.
  await page.goto('/paths/new');
  await page.getByTestId('path-name').fill('North Shore Troll');
  await page.getByTestId('kind-trolling').click();
  await page.getByTestId('path-notes').fill('Spoons at 2.5 km/h along the 8 m contour.');
  await page.getByTestId('color-option-orange').click();
  await clickMap(page, 'path-map', 0.3, 0.4);
  await clickMap(page, 'path-map', 0.5, 0.5);
  await clickMap(page, 'path-map', 0.7, 0.45);
  await expect(page.getByTestId('path-point')).toHaveCount(3);
  await expect(page.getByTestId('path-length')).toContainText('km');
  await Promise.all([page.waitForURL(/\/paths\/[0-9a-f-]{36}$/), page.getByTestId('save-path').click()]);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('North Shore Troll');
  await expect(page.getByTestId('path-kind')).toHaveText('Trolling path');
  await expect(page.getByTestId('path-length')).toContainText('km');
  await expect(page.getByTestId('path-point')).toHaveCount(3);
  // Rename and replace the points.
  await page.getByTestId('edit-path').click();
  await page.getByTestId('path-name').fill('North Shore Trotline');
  await page.getByTestId('kind-trotline').click();
  await page.getByTestId('clear-points').click();
  await clickMap(page, 'path-map', 0.4, 0.5);
  await clickMap(page, 'path-map', 0.6, 0.5);
  await page.getByTestId('save-path').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('North Shore Trotline');
  await expect(page.getByTestId('path-kind')).toHaveText('Trotline');
  await expect(page.getByTestId('path-point')).toHaveCount(2);
  const pathId = page.url().split('/').pop();
  await page.goto('/paths');
  await expect(page.getByTestId('path-row')).toHaveCount(1);
  await expect(page.getByTestId('path-row')).toContainText('North Shore Trotline');

  // F004: a catch at a saved spot, with a photo and recorded conditions.
  await createCatch(page, {
    species: 'Walleye', spotName: 'Kelly Reef Ledge', lengthCm: 61, weightKg: 2.4,
    gear: 'Purple crankbait', notes: 'Took it on the drop at sunset.',
  });
  await expect(page.getByTestId('catch-spot-link')).toHaveText('Kelly Reef Ledge');
  await expect(page.getByTestId('cond-moon-phase')).not.toBeEmpty();
  await expect(page.getByTestId('cond-illumination')).toContainText('%');
  await expect(page.getByTestId('cond-score')).toHaveText(/^\d{1,3}$/);
  await expect(page.getByTestId('cond-period')).toHaveText(/Major|Minor|None/);
  await expect(page.getByTestId('cond-daylight')).toHaveText(/Daylight|Twilight|Night/);
  const photoSrc = await page.getByTestId('catch-photo').first().getAttribute('src');
  const photo = await runtime.fetch(photoSrc, { role: 'owner' });
  expect(photo.status).toBe(200);
  expect(photo.headers.get('content-type')).toBe('image/png');

  // Editing the time recomputes the conditions.
  const before = await page.getByTestId('cond-recorded-for').textContent();
  await page.getByTestId('edit-catch').click();
  await page.getByTestId('catch-time').fill('2026-03-14T06:30');
  await page.getByTestId('save-catch').click();
  await expect(page.getByTestId('cond-recorded-for')).not.toHaveText(before);

  await createCatch(page, { species: 'Yellow perch', lengthCm: 27, photo: false });
  await page.goto('/catches');
  await expect(page.getByTestId('catch-row')).toHaveCount(2);
  await expect(page.getByTestId('catch-row').first()).toContainText('Yellow perch');
  await page.getByTestId('filter-species').fill('walleye');
  await expect(page.getByTestId('catch-row')).toHaveCount(1);
  await expect(page.getByTestId('catch-row')).toContainText('Walleye');

  // F003: the map shows spots, paths and catches, measures and picks.
  await page.goto('/');
  await expect(page.getByTestId('map-spot')).toHaveCount(2);
  await expect(page.getByTestId('map-path')).toHaveCount(1);
  await expect(page.getByTestId('map-catch')).toHaveCount(2);
  await page.getByTestId('mode-measure').click();
  await clickMap(page, 'main-map', 0.2, 0.2);
  await clickMap(page, 'main-map', 0.8, 0.8);
  await expect(page.getByTestId('measure-result')).toContainText('km');
  await expect(page.getByTestId('measure-result')).toContainText('NM');
  await page.getByTestId('mode-pick').click();
  await clickMap(page, 'main-map', 0.5, 0.5);
  await Promise.all([page.waitForURL(/\/spots\/new\?/), page.getByTestId('pick-new-spot').click()]);
  await expect(page.getByTestId('spot-lat')).not.toHaveValue('');
  await page.goto('/');
  await page.getByTestId('mode-browse').click();
  await Promise.all([page.waitForURL(/\/paths\//), page.getByTestId('map-path').first().click({ force: true })]);
  expect(page.url()).toContain(pathId);
  await page.goto('/');
  await Promise.all([page.waitForURL(/\/catches\/[0-9a-f-]{36}$/), page.getByTestId('map-catch').first().click({ force: true })]);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^(Walleye|Yellow perch)$/);

  // F007: GPX of the member's own spots and paths.
  const gpx = await runtime.fetch('/export/gpx', { role: 'owner' });
  expect(gpx.status).toBe(200);
  expect(gpx.headers.get('content-type')).toContain('application/gpx+xml');
  expect(gpx.headers.get('content-disposition')).toContain('attachment');
  const gpxText = await gpx.text();
  expect(gpxText).toContain('<gpx');
  expect(gpxText).toContain('<wpt lat="41.6195" lon="-82.6602">');
  expect(gpxText).toContain('<name>Kelly Reef Ledge</name>');
  expect(gpxText).toContain('<name>North Shore Trotline</name>');
  expect((gpxText.match(/<trkpt /g) || []).length).toBe(2);
  await page.goto('/spots');
  await expect(page.getByTestId('export-gpx')).toHaveAttribute('href', '/export/gpx');

  // F005/F006: forecast for coordinates and a date.
  await page.goto('/forecast?lat=41.62&lng=-82.66&date=2026-06-15&tz=-4');
  await expect(page.getByTestId('day-score')).toHaveText(/^\d{1,3}$/);
  const score = Number(await page.getByTestId('day-score').textContent());
  expect(score).toBeGreaterThanOrEqual(0);
  expect(score).toBeLessThanOrEqual(100);
  await expect(page.getByTestId('hour-bar')).toHaveCount(24);
  await expect(page.getByTestId('calendar-day')).toHaveCount(30);
  await expect(page.getByTestId('major-period').first()).toBeVisible();
  await expect(page.getByTestId('minor-period').first()).toBeVisible();
  await expect(page.getByTestId('timezone')).toContainText('UTC−4');
  // Sunrise near Lake Erie in mid-June is about 05:5x at UTC-4.
  await expect(page.getByTestId('sunrise')).toHaveText(/^05:\d\d$/);
  await expect(page.getByTestId('sunset')).toHaveText(/^21:\d\d$/);
  for (const id of ['moonrise', 'moonset', 'moon-overhead', 'moon-underfoot']) {
    await expect(page.getByTestId(id)).toHaveText(/^(\d\d:\d\d|None)$/);
  }
  await expect(page.getByTestId('moon-phase')).toHaveText(/Moon|Crescent|Gibbous|Quarter/);
  await expect(page.getByTestId('illumination')).toHaveText(/^\d{1,3}%$/);
  // Choosing a calendar day opens it.
  await Promise.all([page.waitForURL(/date=2026-06-20/), page.getByTestId('calendar-day').nth(19).click()]);
  await expect(page.getByTestId('forecast-date')).toContainText('20');

  // F005: forecast for a saved spot, the journey's result.
  await page.goto(`/forecast?spot=${reefId}&date=2026-06-15`);
  await expect(page.getByTestId('forecast-place')).toContainText('Kelly Reef Ledge');
  await expect(page.getByTestId('hour-bar')).toHaveCount(24);
  await runtime.assertBackLink(page);
  await runtime.screenshot(page);

  // Phone-sized smoke.
  const phone = await runtime.context('owner', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const phonePage = await phone.newPage();
  await phonePage.goto('/spots');
  await expect(phonePage.getByRole('heading', { level: 1 })).toHaveText('Spots');
  await expect(phonePage.getByTestId('spot-row').first()).toBeVisible();
  const overflow = await phonePage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await phonePage.goto('/forecast?lat=41.62&lng=-82.66&date=2026-06-15');
  await expect(phonePage.getByTestId('day-score')).toBeVisible();
  await phone.close();
} finally {
  await runtime.close();
}
