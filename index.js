/**
 * Soulmate Image Chooser - Light version (no Playwright)
 * Uses simple HTTP requests to fetch image search results.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3000;

// ---------- Helper: search images via Bing (lightweight) ----------
async function searchImages(query, max = 10) {
  const url = 'https://www.bing.com/images/search?q=' + encodeURIComponent(query) + '&form=HDRSC2&first=1';

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'ar,en;q=0.9'
    }
  });

  if (!res.ok) {
    throw new Error('فشل جلب النتائج: ' + res.status);
  }

  const html = await res.text();

  // Extract image URLs from Bing HTML (common patterns)
  const urls = new Set();

  // Pattern 1: murl (original image)
  const murlRegex = /"murl"\s*:\s*"([^"]+)"/g;
  let match;
  while ((match = murlRegex.exec(html)) !== null) {
    if (urls.size >= max) break;
    const u = match[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
    if (u.startsWith('http') && !u.includes('bing.com') && !u.includes('data:')) {
      urls.add(u);
    }
  }

  // Pattern 2: fallback - any large image-looking URLs
  if (urls.size < 3) {
    const imgRegex = /https?:\/\/[^"'\s]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s]*)?/gi;
    let m;
    while ((m = imgRegex.exec(html)) !== null) {
      if (urls.size >= max) break;
      const u = m[0];
      if (!u.includes('bing.com') && !u.includes('logo') && !u.includes('icon') && u.length > 30) {
        urls.add(u);
      }
    }
  }

  return Array.from(urls);
}

// ---------- Routes ----------
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), mode: 'light' });
});

app.post('/search', async (req, res) => {
  try {
    const { query } = req.body || {};
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ ok: false, error: 'أرسل query' });
    }

    console.log('Searching for:', query);
    const images = await searchImages(query.trim(), 12);

    if (!images.length) {
      return res.json({
        ok: false,
        error: 'ما لقيت صور بهالبحث',
        query
      });
    }

    // Pick one (first or random)
    const chosen = images[Math.floor(Math.random() * Math.min(images.length, 6))];

    res.json({
      ok: true,
      chosen: {
        title: query,
        imageUrl: chosen,
        pageUrl: 'https://www.bing.com/images/search?q=' + encodeURIComponent(query),
        reverseUrl: 'https://yandex.com/images/search?rpt=imageview&url=' + encodeURIComponent(chosen)
      },
      candidatesCount: images.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message || 'خطأ داخلي' });
  }
});

app.post('/choose', async (req, res) => {
  const { query } = req.body || {};
  if (query) {
    // reuse search logic
    req.body = { query };
    return app._router.handle({ ...req, url: '/search', method: 'POST' }, res);
  }
  res.status(400).json({ ok: false, error: 'أرسل query' });
});

app.listen(PORT, () => {
  console.log(`Soulmate Image Chooser (Light) running on port ${PORT}`);
});
