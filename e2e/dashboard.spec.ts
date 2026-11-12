import { expect, test } from '@playwright/test'

import { connect, mockGoatCounter, TOKEN } from './mock'

test('refuses a wrong key and says why', async ({ page }) => {
  await mockGoatCounter(page, { token: 'another-key' })
  await page.goto('/')
  await page.getByPlaceholder('stats.example.com').fill('stats.example.com')
  await page.locator('input[type=password]').fill(TOKEN)
  await page.getByRole('button', { name: 'Open the dashboard' }).click()
  await expect(page.getByRole('alert')).toHaveText('This API key is not valid.')
})

test('shows every section of the first site', async ({ page }) => {
  await mockGoatCounter(page)
  await connect(page)

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('example.com')
  await expect(page.locator('#summary .tile').first()).toContainText('Visits')
  await expect(page.locator('#summary svg path.bar')).toHaveCount(7)
  await expect(page.locator('#pages li').first()).toContainText('/')
  await expect(page.locator('#countries li').first()).toContainText('France')
  await expect(page.locator('#devices')).toContainText('Phone')
  await expect(page.locator('#events li')).toContainText('signup-click')
  await expect(page).toHaveURL(/\?site=1&period=7d$/)
})

test('leaves the site itself out of referrers and sources', async ({ page }) => {
  await mockGoatCounter(page)
  await connect(page)

  await expect(page.locator('#referrers li')).toHaveText([/Google/, /www\.reddit\.com/, /blog\.example\.net/])
  // 40 direct out of 100 external visits; the 50 internal ones don't count
  await expect(page.locator('#sources .share').first()).toContainText('40%')
})

test('changes the period and the site', async ({ page }) => {
  await mockGoatCounter(page)
  await connect(page)

  await page.getByRole('radio', { name: '30 days' }).click()
  await expect(page.locator('#summary svg path.bar')).toHaveCount(30)
  await expect(page).toHaveURL(/period=30d/)

  await page.getByRole('radio', { name: 'Today' }).click()
  await expect(page.locator('#summary svg path.bar').first()).toBeAttached()

  await page.locator('select').selectOption({ label: 'example.org' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('example.org')
  await expect(page).toHaveURL(/site=2/)
})

test('waits and retries when GoatCounter says too many requests', async ({ page }) => {
  const calls = await mockGoatCounter(page, { rateLimitOnce: '/stats/browsers' })
  await connect(page)

  await expect(page.locator('#browsers li').first()).toContainText('Firefox')
  expect(calls.filter((call) => call === '/stats/browsers')).toHaveLength(2)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('reads the chart from the keyboard and as a table', async ({ page }) => {
  await mockGoatCounter(page)
  await connect(page)

  await page.locator('#summary svg').focus()
  await page.keyboard.press('End')
  await expect(page.locator('#summary .tooltip')).toContainText('visits')

  await page.getByRole('button', { name: 'Table' }).click()
  await expect(page.locator('#summary table tbody tr')).toHaveCount(7)
})

test('fits a phone screen without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 })
  await mockGoatCounter(page)
  await connect(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
