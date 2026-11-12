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

  await expect(page.locator('#referrers li')).toHaveText([/Google/, /www\.reddit\.com/, /Email/])
  // 40 direct out of 100 external visits; the 50 internal ones don't count
  await expect(page.locator('#sources .share').first()).toContainText('40%')
  await expect(page.locator('#sources .share', { hasText: 'Email' })).toContainText('10%')
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
  expect(calls.filter((call) => call.path === '/stats/browsers')).toHaveLength(2)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('reads the chart from the keyboard and as a table', async ({ page }) => {
  await mockGoatCounter(page)
  await connect(page)

  await page.locator('#summary svg[role=group]').focus()
  await page.keyboard.press('End')
  await expect(page.locator('#summary .tooltip')).toContainText('visits')

  await page.getByRole('button', { name: 'Table' }).click()
  await expect(page.locator('#summary table tbody tr')).toHaveCount(7)
  await expect(page.locator('#summary table tfoot')).toContainText('Average')
})

test('draws the average as a dotted line', async ({ page }) => {
  await mockGoatCounter(page)
  await connect(page)
  await expect(page.locator('#summary .average line')).toBeAttached()
  await expect(page.locator('#summary .key')).toHaveText(/avg \d+ per day/)
})

test('narrows everything to one page, then back to all pages', async ({ page }) => {
  const calls = await mockGoatCounter(page)
  await connect(page)

  await page.locator('#pages').getByRole('button', { name: '/pricing' }).click()
  await expect(page.locator('.filter')).toContainText('Only /pricing')
  await expect(page).toHaveURL(/page=2/)
  await expect(page.locator('#pages li')).toHaveCount(1)
  await page.waitForFunction(() => !document.querySelector('.section.busy'))
  const filtered = calls.filter((call) => call.params.get('include_paths') === '2').map((call) => call.path)
  expect(filtered).toEqual(expect.arrayContaining(['/stats/total', '/stats/hits', '/stats/toprefs', '/stats/locations', '/stats/browsers']))

  await page.getByRole('button', { name: 'Show all pages' }).click()
  await expect(page.locator('.filter')).toHaveCount(0)
  await expect(page).not.toHaveURL(/page=/)
  await expect(page.locator('#pages li')).toHaveCount(3)
})

test('shows the countries on a map when asked', async ({ page }) => {
  await mockGoatCounter(page)
  await connect(page)

  await expect(page.locator('#countries li')).toHaveCount(2)
  await page.locator('#countries').getByRole('radio', { name: 'Map' }).click()
  const map = page.locator('#countries .map')
  await expect(map.locator('path.country').first()).toBeAttached()
  expect(await map.locator('path.country').count()).toBeGreaterThan(150)
  // France and Germany have visits, the rest of the world doesn't
  expect(await map.locator('path.country:not(.level-0)').count()).toBe(2)
})

test('fits a phone screen without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 })
  await mockGoatCounter(page)
  await connect(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('counts nothing unless built with a GoatCounter address', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(new URL(request.url()).host))
  await mockGoatCounter(page)
  await connect(page)
  await expect(page.locator('script[data-goatcounter]')).toHaveCount(0)
  expect(requests.every((host) => host.startsWith('localhost') || host.startsWith('stats.example.'))).toBe(true)
  await expect(page.getByRole('link', { name: 'Source code' })).toHaveAttribute('href', 'https://github.com/flibustier/chalet')
})

const parisDay = (daysAgo: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(Date.now() - daysAgo * 86400000))

test('keeps the chart whole when going from yesterday to 30 days', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await mockGoatCounter(page)
  await connect(page)
  await page.getByRole('radio', { name: 'Yesterday' }).click()
  await page.waitForFunction(() => !document.querySelector('.section.busy'))
  await page.getByRole('radio', { name: '30 days' }).click()
  await page.waitForFunction(() => !document.querySelector('.section.busy'))

  const chart = page.locator('#summary svg[role=group]')
  await expect(chart.locator('path.bar')).toHaveCount(30)
  const { width, right } = await chart.evaluate((svg) => {
    const bars = [...svg.querySelectorAll('path.bar')].map((bar) => (bar as SVGPathElement).getBBox())
    return { width: Number(svg.getAttribute('width')), right: Math.max(...bars.map((b) => b.x + b.width)) }
  })
  expect(right).toBeGreaterThan(width * 0.9)
  expect(errors).toEqual([])
})

test('opens a day from the chart, moves day by day, and goes back', async ({ page }) => {
  await mockGoatCounter(page)
  await connect(page)
  await page.getByRole('radio', { name: '30 days' }).click()
  await page.waitForFunction(() => !document.querySelector('.section.busy'))

  const header = async () => {
    const [title, periods] = await Promise.all([page.locator('.title').boundingBox(), page.locator('.periods').boundingBox()])
    return { height: title!.height, top: periods!.y }
  }
  const before = await header()

  // The bar of the day 9 days ago
  const day = parisDay(9)
  await page.locator('#summary svg[role=group] rect.pick').nth(20).click()
  await expect(page).toHaveURL(new RegExp(`period=day&date=${day}`))
  await expect(page.locator('#summary svg path.bar')).toHaveCount(24)
  await expect(page.locator('.day-nav')).toContainText('compared with the day before')
  // A short date this year, the full one on hover, and the header keeps its shape
  await expect(page.locator('.day-nav time')).toHaveText(/^[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}$/)
  await expect(page.locator('.day-nav time')).toHaveAttribute('title', /, \d{4}$/)
  expect(await header()).toEqual(before)

  await page.getByRole('button', { name: 'Previous day' }).click()
  await expect(page).toHaveURL(new RegExp(`date=${parisDay(10)}`))
  await page.getByRole('button', { name: 'Next day' }).click()
  await page.getByRole('button', { name: 'Next day' }).click()
  await expect(page).toHaveURL(new RegExp(`date=${parisDay(8)}`))

  // The arrows leaf through days in place: one step back returns to the 30 days
  await page.goBack()
  await expect(page).toHaveURL(/period=30d/)
  await expect(page.locator('#summary svg path.bar')).toHaveCount(30)
})

test('has no next day after today', async ({ page }) => {
  await mockGoatCounter(page)
  await connect(page)
  await page.getByRole('radio', { name: 'Today' }).click()
  await expect(page.getByRole('button', { name: 'Next day' })).toBeDisabled()
  await page.getByRole('button', { name: 'Previous day' }).click()
  await expect(page.getByRole('radio', { name: 'Yesterday' })).toHaveAttribute('aria-checked', 'true')
})

test('picks a day in the calendar', async ({ page }) => {
  await mockGoatCounter(page)
  await connect(page)
  const day = parisDay(40)
  await page.locator('.calendar-input').evaluate((input: HTMLInputElement, value) => {
    input.value = value
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, day)
  await expect(page).toHaveURL(new RegExp(`period=day&date=${day}`))
  await expect(page.getByRole('radio', { name: 'Pick a day' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('#summary svg path.bar')).toHaveCount(24)
})
