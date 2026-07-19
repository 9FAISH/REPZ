// E2E: first-run setup → dashboard, and profile persistence across reload.
import { chromium } from 'playwright'

const SHOT_DIR = process.env.SHOT_DIR ?? '.'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 402, height: 874 } })
const fail = (msg) => {
  console.error('FAIL:', msg)
  process.exitCode = 1
}

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })

// Fresh profile-less state must land on setup
await page.waitForURL(/#\/setup/, { timeout: 5000 })
await page.getByText("Who's lifting?").waitFor()
await page.screenshot({ path: `${SHOT_DIR}/e2e-setup-step0.png` })

// Step 0: name + basics
await page.getByPlaceholder('optional').fill('Faris')
await page.getByRole('button', { name: 'Increase age' }).click()
await page.getByRole('button', { name: 'Next' }).click()

// Step 1: goal (keep BULK)
await page.getByText('Pick your mission.').waitFor()
await page.getByRole('button', { name: 'Next' }).click()

// Step 2: activity (pick Active)
await page.getByText('How active are you?').waitFor()
await page.getByRole('button', { name: /^Active/ }).click()
await page.getByRole('button', { name: 'Next' }).click()

// Step 3: split (keep PPL)
await page.getByText('Choose a split.').waitFor()
await page.getByRole('button', { name: 'Next' }).click()

// Step 4: equipment — switch Barbell IN, then finish
await page.getByText("What's in your gym?").waitFor()
await page.screenshot({ path: `${SHOT_DIR}/e2e-setup-equip.png` })
await page.getByRole('button', { name: /Barbell/ }).click()
await page.getByRole('button', { name: "Let's go →" }).click()

// Dashboard
await page.waitForURL(/#\/$/, { timeout: 5000 })
const greeting = await page.locator('.home-greeting').textContent()
if (!greeting?.includes('Faris')) fail(`greeting missing name: "${greeting}"`)
await page.locator('.home-stats').waitFor()
await page.screenshot({ path: `${SHOT_DIR}/e2e-dashboard.png` })

// Persisted values
const saved = await page.evaluate(async () => {
  const { repo } = window.repz
  const p = await repo.getProfile()
  const eq = await repo.availableEquipmentNames()
  return { name: p?.name, age: p?.age, activity: p?.activityLevel, split: p?.split, barbell: eq.has('BARBELL'), dumbbell: eq.has('DUMBBELL'), kettlebell: eq.has('KETTLEBELL') }
})
if (saved.name !== 'Faris') fail(`profile name: ${saved.name}`)
if (saved.age !== 29) fail(`age stepper: ${saved.age}`)
if (saved.activity !== 'active') fail(`activity: ${saved.activity}`)
if (saved.split !== 'ppl') fail(`split: ${saved.split}`)
if (!saved.barbell) fail('barbell should be available after toggle')
if (!saved.dumbbell) fail('dumbbell default should be available')
if (saved.kettlebell) fail('kettlebell should stay unavailable')

// Reload → straight to dashboard, setup blocked
await page.reload({ waitUntil: 'networkidle' })
await page.locator('.home-greeting').waitFor({ timeout: 5000 })
await page.goto('http://localhost:5173/#/setup', { waitUntil: 'networkidle' })
await page.waitForURL(/#\/$/, { timeout: 5000 }).catch(() => fail('setup not blocked with existing profile'))

await browser.close()
console.log(process.exitCode ? 'E2E FAILED' : 'E2E ALL PASS', JSON.stringify(saved))
