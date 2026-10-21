import type { Page } from "@playwright/test";

/** Drags a swipe-to-confirm knob across its track, as a thumb would. */
export async function swipeToConfirm(page: Page, name: RegExp, fraction = 1) {
  const knob = page.getByRole("button", { name });
  const track = knob.locator("xpath=..");
  // The sheet animates in and out; measure only once the knob has stopped.
  let knobBox = await knob.boundingBox();
  for (let tries = 0; tries < 40; tries++) {
    await page.waitForTimeout(60);
    const next = await knob.boundingBox();
    const settled =
      next && knobBox && next.x === knobBox.x && next.y === knobBox.y;
    knobBox = next;
    if (settled) break;
  }
  const trackBox = await track.boundingBox();
  if (!knobBox || !trackBox) throw new Error("swipe control not visible");
  const y = knobBox.y + knobBox.height / 2;
  const startX = knobBox.x + knobBox.width / 2;
  const endX = startX + (trackBox.width - knobBox.width - 8) * fraction;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move((startX + endX) / 2, y, { steps: 6 });
  await page.mouse.move(endX, y, { steps: 6 });
  await page.mouse.up();
}
