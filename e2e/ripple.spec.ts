import { signInAs } from "./support/supabase-mock";
import { expect, test } from "./support/test";

// The bottom nav hard-codes focusRipple: true inside BottomNavigationAction,
// which cannot be turned off with the disableFocusRipple prop. Moving focus
// (view switch, coming back to a page) used to start the pulsating focus
// ripple there, so a tap on one control appeared to ripple another.
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

  // Touch ripple still plays on the control that was actually tapped.
  await nav.getByRole("link", { name: "Profile" }).tap();
  await expect.poll(() => nav.locator(TOUCH).count()).toBeGreaterThan(0);
  await expect(nav.locator(`${TOUCH}${PULSATE}`)).toHaveCount(0);

  // Leave and come back; the re-focused view must not start a focus ripple.
  await nav.getByRole("link", { name: "Orders" }).tap();
  await expect(page).toHaveURL(/\/orders/);
  await nav.getByRole("link", { name: "Profile" }).tap();
  await expect(page).toHaveURL(/\/profile/);
  await page.waitForTimeout(700);
  const leftover = await page.evaluate(() => ({
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    ripples: [
      ...document.querySelectorAll(".MuiTouchRipple-rippleVisible"),
    ].map((el) => {
      const child = el.querySelector(".MuiTouchRipple-child");
      return {
        childCls: child ? child.className : null,
        childAnim: child ? getComputedStyle(child).animationName : null,
        parentAnim: getComputedStyle(el).animationName,
        html: el.outerHTML.slice(0, 400),
      };
    }),
  }));
  console.log("LEFTOVER RIPPLES:", JSON.stringify(leftover, null, 2));
  await expect(page.locator(".MuiTouchRipple-rippleVisible")).toHaveCount(0);

  // Pulsate (focus) ripples are removed at the source; anything that MUI
  // still mounts must stay invisible.
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll(PULSATE)].every(
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
