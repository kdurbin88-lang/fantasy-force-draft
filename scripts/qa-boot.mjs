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

  const lock = page.locator('[data-qa="lock-room"]');
  if (!(await lock.count())) fails.push("LOCK ROOM not on screen after clear storage");

  const twelve = page.locator('[data-qa="teams-12"]');
  const ten = page.locator('[data-qa="teams-10"]');
  await ten.click({ timeout: 5000 });
  await page.waitForTimeout(200);
  const tenBg = await ten.evaluate((el) => getComputedStyle(el).backgroundColor);
  if (!tenBg.includes("61") && !tenBg.includes("3db4ff") && !String(tenBg).includes("61, 180")) {
    // accent #3db4ff = rgb(61, 180, 255)
    if (!tenBg.includes("61, 180, 255")) fails.push(`10 click did not highlight, bg=${tenBg}`);
  }

  await twelve.click();
  await page.waitForTimeout(200);

  await page.locator('[data-qa="seat-4"]').click();
  await page.waitForTimeout(200);
  const you = await page.locator('[data-qa="seat-4"]').innerText();
  if (!you.includes("YOU")) fails.push(`seat 4 not YOU: ${you}`);

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
