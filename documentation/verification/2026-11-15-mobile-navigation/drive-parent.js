// After drive-back.js, in the same session: a quest started on a wide window, then opened on a narrow one, goes Back to
// the Borderlands list, not the Guild Hall.
async (page) => {
  const dir = "documentation/verification/2026-11-15-mobile-navigation";
  const button = (name) => page.getByRole("button", { name, exact: true });
  await page.setViewportSize({ width: 1200, height: 780 });
  await page.waitForTimeout(1000);
  await page.mouse.move(140, 189);
  await page.getByLabel("New quest in borderlands", { exact: true }).click({ force: true });
  await page.waitForTimeout(1500);
  await page.setViewportSize({ width: 390, height: 780 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${dir}/phone-quest.png` });
  await button("← Back").or(page.getByText("← Back")).first().click({ force: true });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${dir}/phone-quest-back.png` });
  if ((await page.getByText("No quest in the Borderlands yet.").count()) !== 0) throw new Error("Back did not show the quest's parent list");
}
