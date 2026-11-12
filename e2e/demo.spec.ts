import { expect, test } from '@playwright/test'

import { connect, mockGoatCounter } from './mock'

const idle = (page: import('@playwright/test').Page) =>
  page.waitForFunction(() => !document.querySelector('.section.busy'))

test('the demo shows made-up figures without asking anything of the network', async ({ page, baseURL }) => {
  const outside: string[] = []
  const errors: string[] = []
  page.on('request', (request) => !request.url().startsWith(baseURL!) && outside.push(request.url()))
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await page.getByRole('link', { name: 'Try the demo' }).click()
  await expect(page.locator('.demo-note')).toContainText('Made-up figures')
  await page.locator('#campaigns').waitFor()
  await idle(page)

  await expect(page.locator('select option')).toHaveCount(3)
  await expect(page.locator('#pages li').first()).toBeVisible()
  await expect(page.locator('#referrers li').first()).toBeVisible()
  await page.locator('#countries').getByRole('radio', { name: 'Map' }).click()
  await expect(page.locator('#countries path.country').first()).toBeVisible()

  // Every view keeps the demo in its address, so it can be shared
  await page.getByRole('radio', { name: '12 months' }).click()
  await idle(page)
  await expect(page).toHaveURL(/\?demo&.*period=12m/)
  await expect(page.locator('#summary svg path.bar')).toHaveCount(12)

  expect(outside).toEqual([])
  expect(errors).toEqual([])
})

test('a day of the demo adds up to its bar, and a page narrows it', async ({ page }) => {
  await page.goto('/?demo&period=30d')
  await page.locator('#campaigns').waitFor()
  await idle(page)
  await page.getByRole('button', { name: 'Table' }).click()
  const row = page.locator('#summary table tbody tr').nth(20)
  const value = (await row.locator('td').last().textContent())!.trim()
  await page.getByRole('button', { name: 'Chart' }).click()
  await page.locator('#summary svg[role=group] rect.pick').nth(20).click()
  await idle(page)
  await expect(page).toHaveURL(/period=day/)
  const visits = page.locator('#summary .tile strong').first()
  await expect(visits).toHaveText(value)

  const all = (await visits.textContent())!
  await page.locator('#pages li button').nth(1).click()
  await idle(page)
  await expect(page.locator('.filter')).toContainText('Only')
  await expect(visits).not.toHaveText(all)
})

test('leaving the demo leads to the sign-in form, or back to your own dashboard', async ({ page }) => {
  await page.goto('/?demo')
  await page.getByRole('button', { name: 'Use your GoatCounter' }).click()
  await expect(page.getByRole('button', { name: 'Open the dashboard' })).toBeVisible()
  await expect(page).not.toHaveURL(/demo/)

  // With a dashboard of your own, the demo doesn't replace it
  await mockGoatCounter(page)
  await connect(page)
  await page.goto('/?demo')
  await expect(page.locator('select option')).toHaveCount(3)
  await page.getByRole('button', { name: 'Exit demo' }).click()
  await expect(page.locator('.demo-note')).toHaveCount(0)
  await expect(page.locator('select option')).toHaveCount(2)
})

test('fits a phone from the first frame', async ({ page }) => {
  // The width the chart has when it enters the page, before anything could resize it
  await page.addInitScript(() => {
    new MutationObserver((_, observer) => {
      const chart = document.querySelector('#summary svg[role=group]')
      if (!chart) return
      ;(window as unknown as { firstWidth: number }).firstWidth = Number(chart.getAttribute('width'))
      observer.disconnect()
    }).observe(document, { childList: true, subtree: true })
  })
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/?demo&period=30d')
  await page.locator('#summary svg[role=group]').waitFor()
  expect(await page.evaluate(() => (window as unknown as { firstWidth: number }).firstWidth)).toBeLessThanOrEqual(390)
  await idle(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
})
