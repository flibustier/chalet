import { test } from '@playwright/test'

import { connectDemo, mockDemo } from './demo'

// Regenerates the README screenshots from made-up data: npm run screenshots
test.skip(!process.env.SCREENSHOTS, 'only with SCREENSHOTS=1')
test.use({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })

for (const scheme of ['light', 'dark'] as const) {
  test(`README screenshot, ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await mockDemo(page)
    await connectDemo(page)
    await page.getByRole('radio', { name: '30 days' }).click()
    await page.waitForFunction(() => !document.querySelector('.section.busy'))
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
        clip: { x: 0, y: sources.y + (await page.evaluate(() => window.scrollY)) - 8, width: 1280, height: devices.y + devices.height - sources.y + 16 },
      })
    }
  })
}
