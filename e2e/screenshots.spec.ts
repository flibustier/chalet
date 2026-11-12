import { test } from '@playwright/test'

// Regenerates the README screenshots from the demo's made-up figures: npm run screenshots
test.skip(!process.env.SCREENSHOTS, 'only with SCREENSHOTS=1')
test.use({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })

for (const scheme of ['light', 'dark'] as const) {
  test(`README screenshot, ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/?demo&period=30d')
    await page.locator('#campaigns').waitFor()
    await page.waitForFunction(() => !document.querySelector('.section.busy'))
    // The pictures show the dashboard itself, without the demo's notice
    await page.locator('.demo-note').evaluate((note) => note.remove())
    await page.mouse.move(0, 0)
    // The header, the summary and the start of the pages
    await page.screenshot({ path: `docs/screenshot-${scheme}.png`, clip: { x: 0, y: 0, width: 1280, height: 1080 } })

    await page.locator('#countries').getByRole('radio', { name: 'Map' }).click()
    await page.locator('#countries path.country').first().waitFor()
    await page.locator('#sources').scrollIntoViewIfNeeded()
    const sources = await page.locator('#sources').boundingBox()
    const devices = await page.locator('#devices').boundingBox()
    if (sources && devices) {
      await page.screenshot({
        path: `docs/sections-${scheme}.png`,
        fullPage: true,
        // The sections only, without the side menu
        clip: {
          x: sources.x - 24,
          y: sources.y + (await page.evaluate(() => window.scrollY)) - 8,
          width: sources.width + 48,
          height: devices.y + devices.height - sources.y + 16,
        },
      })
    }
  })
}
