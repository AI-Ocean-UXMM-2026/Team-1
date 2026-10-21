import { signInAs } from "./support/supabase-mock";
import { expect, test } from "./support/test";

async function rippleTimeline(page: import("@playwright/test").Page): Promise<string[]> {
  return page.evaluate(async () => {
    // wait until no ripple is present or 3s pass, sampling classes
    const samples: string[] = [];
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 50));
      const state = [...document.querySelectorAll(".MuiTouchRipple-ripple")]
        .map((e) => {
          const child = e.querySelector(".MuiTouchRipple-child");
          const anims = (e as HTMLElement).getAnimations({ subtree: true });
          return `${e.classList.contains("MuiTouchRipple-rippleVisible") ? "V" : "v"}${child?.classList.contains("MuiTouchRipple-childLeaving") ? "L" : "-"}${anims.map((a) => String(Math.round(a.currentTime ?? -1))).join(",")}`;
        })
        .join("|");
      samples.push(state || "-");
      if (i > 10 && state === "-") break;
    }
    return samples;
  });
}

test("debug: click vs tap ripple exit", async ({ page, context }) => {
  await signInAs(context, "customer", {});
  await page.goto("/home");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  const nav = page.getByRole("navigation", { name: "Customer app" });

  // 1. Mouse click on Orders.
  await nav.getByRole("link", { name: "Orders" }).click();
  const clickSamples = await rippleTimeline(page);
  console.log("CLICK TIMELINE (Orders):\n  " + clickSamples.join("\n  "));

  // 2. Touch tap on Profile with regular tap().
  await nav.getByRole("link", { name: "Profile" }).tap();
  const tapSamples = await rippleTimeline(page);
  console.log("TAP TIMELINE (Profile):\n  " + tapSamples.join("\n  "));
  expect(true).toBe(true);
});
