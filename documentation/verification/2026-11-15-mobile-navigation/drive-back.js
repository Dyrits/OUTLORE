// After drive.js, in the same session: Chronicler as the whole content area, and a quest's Back going to its parent.
async (page) => {
  const dir = "documentation/verification/2026-11-15-mobile-navigation";
  const button = (name) => page.getByRole("button", { name, exact: true });
  await button("Ask Chronicler").click({ force: true });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${dir}/phone-chronicler.png` });
  await button("Restore Chronicler").click({ force: true });
  await button("Open the menu").click({ force: true });
  await button("Borderlands").click({ force: true });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${dir}/phone-borderlands.png` });
}
