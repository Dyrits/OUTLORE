// Run in an attached Playwright CLI session on a throwaway Outlore (fake harness, fresh data folder).
// Clicks are forced because an occluded window never settles Playwright's "stable" check.
async (page) => {
  const dir = "documentation/verification/2026-11-15-mobile-navigation";
  const button = (name) => page.getByRole("button", { name, exact: true });
  await page.setViewportSize({ width: 390, height: 780 });
  await page.evaluate(() => localStorage.setItem("outlore:assistant-open", "0"));
  await page.reload();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${dir}/phone-hall.png` });
  await button("Open the menu").click({ force: true });
  await button("Workshop").waitFor({ timeout: 10000 });
  await page.screenshot({ path: `${dir}/phone-menu.png` });
  await button("Workshop").click({ force: true });
  await button("Open the menu").waitFor({ timeout: 10000 });
  if ((await button("Workshop").count()) !== 0) throw new Error("The menu stayed open after choosing a place");
  await page.screenshot({ path: `${dir}/phone-workshop.png` });
  await button("Open the menu").click({ force: true });
  await button("Close the menu").click({ force: true });
  if ((await button("Workshop").count()) !== 0) throw new Error("The close button did not close the menu");
  await button("Open the menu").click({ force: true });
  await button("Realms").click({ force: true });
  await page.screenshot({ path: `${dir}/phone-realms.png` });
  await button("Open the menu").click({ force: true });
  await button("Rituals").click({ force: true });
  await page.screenshot({ path: `${dir}/phone-rituals.png` });
}
