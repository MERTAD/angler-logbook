// Shared steps for the release suites. Selectors are the app's test IDs.
import { expect } from '/home/user/oss-new/control/runtime/index.mjs';

// A 2x2 PNG, enough for an image upload.
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGNgYGD4z8DAwMDAwMDAAAAWBgEBXyyRbAAAAABJRU5ErkJggg==',
  'base64',
);

export async function createSpot(page, { name, lat, lng, notes = '', icon, color }) {
  await page.goto('/spots/new');
  await page.getByTestId('spot-name').fill(name);
  await page.getByTestId('spot-lat').fill(String(lat));
  await page.getByTestId('spot-lng').fill(String(lng));
  if (notes) await page.getByTestId('spot-notes').fill(notes);
  if (icon) await page.getByTestId(`icon-option-${icon}`).click();
  if (color) await page.getByTestId(`color-option-${color}`).click();
  await Promise.all([
    page.waitForURL(/\/spots\/[0-9a-f-]{36}$/),
    page.getByTestId('save-spot').click(),
  ]);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  return page.url().split('/').pop();
}

export async function createCatch(page, { species, spotName, lengthCm, weightKg, gear, notes, photo = true }) {
  await page.goto('/catches/new');
  await page.getByTestId('catch-species').fill(species);
  if (spotName) {
    await page.getByTestId('catch-spot').click();
    await page.getByRole('option', { name: spotName }).click();
  }
  if (lengthCm !== undefined) await page.getByTestId('catch-length').fill(String(lengthCm));
  if (weightKg !== undefined) await page.getByTestId('catch-weight').fill(String(weightKg));
  if (gear) await page.getByTestId('catch-gear').fill(gear);
  if (notes) await page.getByTestId('catch-notes').fill(notes);
  if (photo) {
    await page.getByTestId('catch-photos-input').setInputFiles({ name: 'catch.png', mimeType: 'image/png', buffer: PNG });
  }
  await Promise.all([
    page.waitForURL(/\/catches\/[0-9a-f-]{36}$/),
    page.getByTestId('save-catch').click(),
  ]);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(species);
  if (photo) await expect(page.getByTestId('catch-photo')).toHaveCount(1);
  return page.url().split('/').pop();
}

/** Clicks the map at fractions of its box. */
export async function clickMap(page, testId, fx, fy) {
  const box = await page.getByTestId(testId).boundingBox();
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}
