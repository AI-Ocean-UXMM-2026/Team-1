import { signInAs } from "./support/supabase-mock";
import { expect, test } from "./support/test";

// BottomNavigationAction hard-codes focusRipple: true and ignores
// disableFocusRipple, so moving focus (view switch, coming back to a page)
// used to start the pulsating focus ripple there, making a tap on one control
// appear to ripple another. Touch ripples themselves got stuck after
// tap-navigations: the deferred touch commit never scheduled the exit timer,
// leaving .MuiTouchRipple-rippleVisible elements behind on controls that were
// no longer on screen.
const PULSATE = ".MuiTouchRipple-ripplePulsate";
const TOUCH =
  ".MuiTouchRipple-rippleVisible:not(.MuiTouchRipple-ripplePulsate)";

test("a navigation roundtrip never ripples a control that was not tapped", async ({
  page,
  context,
}) => {
  await signInAs(context, "customer", {});
  await page.goto("/home");
  const nav = page.getByRole("navigation", { name: "Customer app" });
  await expect(nav).toBeVisible();
  // Let client hydration finish so taps really reach ButtonBase.
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  // Touch ripple plays on the control that was actually tapped...
  await nav.getByRole("link", { name: "Profile" }).tap({ timeout: 20_000 });
  await expect.poll(() => nav.locator(TOUCH).count()).toBeGreaterThan(0);
  // ...and not the pulsating focus variant...
  await expect(nav.locator(`${TOUCH}${PULSATE}`)).toHaveCount(0);
  // ...and it leaves the DOM once the exit animation is done.
  await expect
    .poll(() => page.locator(".MuiTouchRipple-rippleVisible").count(), {
      timeout: 10_000,
    })
    .toBe(0);

  // Leave and come back; no ripple may be left on any other control.
  await nav.getByRole("link", { name: "Orders" }).tap({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/orders/);
  await nav.getByRole("link", { name: "Profile" }).tap({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/profile/);
  await expect
    .poll(() => page.locator(".MuiTouchRipple-rippleVisible").count(), {
      timeout: 10_000,
    })
    .toBe(0);

  // Pulsate (focus) ripples are removed at the source; anything that MUI still
  // mounts must stay invisible.
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll(".MuiTouchRipple-ripplePulsate")].every(
        (el) => getComputedStyle(el).display === "none",
      ),
    ),
  ).toBe(true);

  // Keyboard focus keeps a visible indication: the outline.
  let hasFocusVisible = false;
  for (let i = 0; i < 20 && !hasFocusVisible; i++) {
    await page.keyboard.press("Tab");
    hasFocusVisible = (await page.locator(".Mui-focusVisible").count()) > 0;
  }
  expect(hasFocusVisible).toBe(true);
  const outline = await page.evaluate(
    () =>
      getComputedStyle(document.querySelector(".Mui-focusVisible") as Element)
        .outlineWidth,
  );
  expect(outline).toBe("3px");
});
