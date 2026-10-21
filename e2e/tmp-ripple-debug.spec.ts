import { signInAs } from "./support/supabase-mock";
import { expect, test } from "./support/test";

test("debug: fiber state of stuck ripple", async ({ page, context }) => {
  await signInAs(context, "customer", {});
  await page.goto("/home");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  const nav = page.getByRole("navigation", { name: "Customer app" });
  // Create stuck ripples with taps.
  await nav.getByRole("link", { name: "Profile" }).tap();
  await page.waitForTimeout(700);
  await nav.getByRole("link", { name: "Orders" }).tap();
  await page.waitForTimeout(700);
  await nav.getByRole("link", { name: "Profile" }).tap();
  await page.waitForTimeout(3000);

  const report = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll(".MuiTouchRipple-rippleVisible")) {
      const fiberKey = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
      if (!fiberKey) {
        out.push("NO FIBER (dead node)");
        continue;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const walk = (fiber: any, what: string) => {
        if (!fiber) return;
        const type =
          typeof fiber.type === "string"
            ? fiber.type
            : fiber.type?.name ?? fiber.type?.displayName ?? "?";
        let stateDesc = "";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let hook = fiber.memoizedState as any;
        // Hook lists exist on function and forward-ref fibers alike.
        if (hook !== null) {
          const states: string[] = [];
          let i = 0;
          while (hook && i < 12) {
            let s = hook.memoizedState;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sAny = s as any;
            if (typeof sAny === "object" && sAny !== null) {
              if (Array.isArray(sAny)) s = `[${sAny.map((x) => `k${(x as { key?: unknown })?.key}`).join(",")}]`;
              else if ("order" in sAny) {
                s = `items=${JSON.stringify((sAny.items ?? []).map((x: { key: unknown; exiting: boolean }) => `${x?.key}${x?.exiting ? "x" : ""}`))} order=${JSON.stringify(sAny.order)}`;
              } else s = "obj";
            }
            states.push(`${i}:${String(s).slice(0, 110)}`);
            hook = hook.next;
            i += 1;
          }
          stateDesc = ` hooks{${states.join("; ")}}`;
        }
        let propDesc = "";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const props = fiber.memoizedProps as any;
        if (props && typeof props === "object" && "in" in props) {
          propDesc = ` props: in=${String(props.in)} onExited=${String(typeof props.onExited)}`;
        out.push(`${what}: ${type} tag=${fiber.tag}${propDesc}${stateDesc}`);
        // eslint-disable-next-line @typescript-eslint/no-parameters
        walk(fiber.return, "");
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      walk((el as unknown as Record<string, any>)[fiberKey], "parent-of-node");
      out.push("---");
    }
    return out.join("\n");
  });
  console.log(report);
  expect(true).toBe(true);
});
