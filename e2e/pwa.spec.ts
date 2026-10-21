import { expect, test } from "./support/test";

test("the app is installable: manifest, icons and theme colour (D-07)", async ({
  page,
  request,
}) => {
  await page.goto("/welcome");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();
  const response = await request.get(href as string);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    display: "standalone",
    start_url: "/home",
  });
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
  }
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#F8FAFC",
  );
});

test("Burmese text renders with the bundled font (H-14)", async ({ page }) => {
  await page.goto("/welcome");
  const loaded = await page.evaluate(async () => {
    const node = document.createElement("p");
    node.lang = "my";
    node.textContent = "ဗဟန်းမြို့နယ်၊ ရန်ကုန်";
    document.body.append(node);
    await document.fonts.ready;
    return [...document.fonts]
      .filter((face) => face.status === "loaded")
      .map((face) => face.family);
  });
  expect(loaded.some((family) => /myanmar/i.test(family))).toBe(true);
});
