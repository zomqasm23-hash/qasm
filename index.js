/**
 * Soulmate Image Chooser - Server version
 * Uses Playwright to open Google Images, pick a good image, and return a usable link.
 *
 * Endpoints:
 *   GET  /health
 *   POST /choose   { "url": "https://www.google.com/search?tbm=isch&q=...", "query": "optional" }
 *   POST /search   { "query": "صور زهور" }
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3000;

// ---------- Helper: open browser and pick image ----------
async function chooseFromGoogleImages(targetUrl, maxCandidates = 8) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'ar'
  });

  const page = await context.newPage();

  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500);

    // Accept cookies if any
    try {
      const acceptBtn = page.locator('button:has-text("Accept all"), button:has-text("أوافق"), button:has-text("I agree")').first();
      if (await acceptBtn.isVisible({ timeout: 2000 })) {
        await acceptBtn.click();
        await page.waitForTimeout(1000);
      }
    } catch (e) {}

    // Collect image candidates (thumbnails + possible original links)
    const candidates = await page.evaluate((max) => {
      const results = [];
      const seen = new Set();

      // Common selectors for Google Images results
      const imgs = document.querySelectorAll('img');
      for (const img of imgs) {
        if (results.length >= max) break;
        const src = img.src || img.getAttribute('data-src') || '';
        if (!src || src.startsWith('data:') || src.includes('logo') || src.includes('icon')) continue;
        if (seen.has(src)) continue;
        if (img.naturalWidth < 80 && img.width < 80) continue;

        seen.add(src);
        results.push({
          thumb: src,
          alt: (img.alt || '').slice(0, 120),
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height
        });
      }
      return results;
    }, maxCandidates);

    if (!candidates.length) {
      await browser.close();
      return { ok: false, error: 'ما لقيت صور بالصفحة' };
    }

    // Simple "taste" pick: prefer larger images, skip very small ones
    candidates.sort((a, b) => (b.width * b.height) - (a.width * a.height));
    const chosen = candidates[0];

    // Try to get a better direct / original URL by clicking the first good result
    let finalLink = chosen.thumb;
    let title = chosen.alt || 'صورة مختارة';

    try {
      // Click the first large-ish image
      const firstImg = page.locator('img').filter({ hasNot: page.locator('[src*="logo"], [src*="icon"]') }).first();
      await firstImg.click({ timeout: 5000 });
      await page.waitForTimeout(2000);

      // After click, Google shows a side panel. Try to extract the big image src
      const bigImg = await page.evaluate(() => {
        const big = document.querySelector('img.sFlh5c, img[jsname="kn3ccd"], img.n3VNCb, img.r48jcc');
        if (big && big.src && !big.src.startsWith('data:')) return big.src;
        // fallback: largest image on page
        let best = null, bestArea = 0;
        document.querySelectorAll('img').forEach(img => {
          const area = (img.naturalWidth || 0) * (img.naturalHeight || 0);
          if (area > bestArea && img.src && !img.src.startsWith('data:')) {
            bestArea = area;
            best = img.src;
          }
        });
        return best;
      });

      if (bigImg) finalLink = bigImg;

      // Try to get title / source
      const meta = await page.evaluate(() => {
        const t = document.querySelector('[data-attrid="title"], .n3VNCb + div, .UAiK1e, h1, h2');
        return t ? t.textContent.trim().slice(0, 150) : '';
      });
      if (meta) title = meta;
    } catch (e) {
      // click failed – keep the thumbnail
    }

    await browser.close();

    return {
      ok: true,
      chosen: {
        title,
        imageUrl: finalLink,          // الرابط المباشر للصورة
        pageUrl: targetUrl,           // رابط صفحة البحث الأصلية
        // رابط ياندكس reverse كخيار إضافي
        reverseUrl: 'https://yandex.com/images/search?rpt=imageview&url=' + encodeURIComponent(finalLink)
      },
      candidatesCount: candidates.length
    };
  } catch (err) {
    await browser.close().catch(() => {});
    return { ok: false, error: err.message || 'خطأ غير معروف' };
  }
}

// ---------- Routes ----------
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.post('/choose', async (req, res) => {
  const { url, query } = req.body || {};
  if (!url && !query) {
    return res.status(400).json({ ok: false, error: 'أرسل url أو query' });
  }

  let target = url;
  if (!target && query) {
    target = 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(query) + '&hl=ar';
  }

  console.log('Choosing from:', target);
  const result = await chooseFromGoogleImages(target);
  res.json(result);
});

app.post('/search', async (req, res) => {
  const { query } = req.body || {};
  if (!query) return res.status(400).json({ ok: false, error: 'أرسل query' });

  const target = 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(query) + '&hl=ar';
  const result = await chooseFromGoogleImages(target);
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`Soulmate Image Chooser running on port ${PORT}`);
});
