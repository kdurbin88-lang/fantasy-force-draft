#!/usr/bin/env node
import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:8080";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const fails = [];

try {
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  await page.setViewportSize({ width: 360, height: 740 });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => {
    const el = document.querySelector('[data-qa="seat-12"]');
    if (!el) return "missing seat 12";
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return "seat 12 has no size";
    if (r.right > window.innerWidth + 2) return `seat 12 clipped right ${r.right} > ${window.innerWidth}`;
    return null;
  });
  if (overflow) fails.push(overflow);

  await page.setViewportSize({ width: 1400, height: 900 });
  const lock = page.locator('[data-qa="lock-room"]');
  await page.locator('[data-qa="seat-6"]').click();
  await page.waitForTimeout(200);
  const you = await page.locator('[data-qa="seat-6"]').innerText();
  if (!you.includes("YOU")) fails.push(`seat 6 not YOU: ${you}`);
  if ((await lock.innerText()).includes("TAP YOUR PICK")) fails.push("lock still disabled after picking 6");

  await lock.click();
  await page.waitForTimeout(600);
  const body = await page.locator("body").innerText();
  if (!body.includes("DRAFT COMMAND")) fails.push("did not enter draft after LOCK ROOM");
  if (body.includes("RHAMONDRE")) fails.push("hero is Rhamondre on empty board");
  if (body.toLowerCase().includes("rashee rice") && body.includes("NEXT")) {
    const hero = await page.locator("h2").first().innerText().catch(() => "");
    if (/rashee rice/i.test(hero)) fails.push("hero is Rashee Rice");
  }
  const hero = await page.locator("h2").first().innerText().catch(() => "");
  console.log(JSON.stringify({ ok: fails.length === 0, fails, hero, url }, null, 2));
  if (fails.length) process.exit(1);
} catch (err) {
  console.log(JSON.stringify({ ok: false, fails: [...fails, String(err)], url }, null, 2));
  process.exit(1);
} finally {
  await browser.close();
}
