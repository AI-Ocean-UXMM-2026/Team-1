import { test as base } from "@playwright/test";

export { expect } from "@playwright/test";

/** The Next.js dev indicator floats over the bottom-left corner of the page. */
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(() => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal{display:none!important}";
      document.addEventListener("DOMContentLoaded", () =>
        document.head.append(style),
      );
    });
    await use(context);
  },
});
