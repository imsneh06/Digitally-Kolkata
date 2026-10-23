const { getStore, saveStore, handleCors, sendJson, parseBody, verifyAuth } = require('./_store');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const store = await getStore();
  const method = req.method;

  try {
    // 1. GET: Fetch Current Service Rates & Calculator Settings (Public)
    if (method === 'GET') {
      return sendJson(res, 200, {
        success: true,
        pricing: store.pricing || {
          branding: 15000,
          uiux: 20000,
          webdev: 28000,
          seo: 12000,
          photo: 18000,
          social: 15000,
          perPage: 1800,
          baseMin: 12000
        }
      });
    }

    // 2. PUT or POST: Update Rates (Admin protected)
    if (method === 'PUT' || method === 'POST') {
      const body = await parseBody(req);
      if (!verifyAuth(req, store, body)) {
        return sendJson(res, 401, { error: 'Unauthorized: Admin authentication required to update pricing' });
      }
      const current = store.pricing || {};

      function parseRateValue(val, fallback) {
        if (val === undefined || val === null) return fallback;
        if (typeof val === 'number') return val;
        const str = String(val).trim();
        if (!str) return fallback;
        if (/^\d+$/.test(str.replace(/,/g, ''))) {
          return parseInt(str.replace(/,/g, ''), 10);
        }
        return str;
      }

      store.pricing = {
        branding: parseRateValue(body.branding, current.branding !== undefined ? current.branding : 15000),
        uiux: parseRateValue(body.uiux, current.uiux !== undefined ? current.uiux : 20000),
        webdev: parseRateValue(body.webdev, current.webdev !== undefined ? current.webdev : 28000),
        seo: parseRateValue(body.seo, current.seo !== undefined ? current.seo : 12000),
        photo: parseRateValue(body.photo, current.photo !== undefined ? current.photo : 18000),
        social: parseRateValue(body.social, current.social !== undefined ? current.social : 15000),
        perPage: parseRateValue(body.perPage, current.perPage !== undefined ? current.perPage : 1800),
        baseMin: parseRateValue(body.baseMin, current.baseMin !== undefined ? current.baseMin : 12000)
      };

      await saveStore(store);

      return sendJson(res, 200, {
        success: true,
        message: 'Pricing architecture updated successfully',
        pricing: store.pricing
      });
    }

    // 3. DELETE: Reset to Default Pricing (Admin protected)
    if (method === 'DELETE') {
      if (!verifyAuth(req, store)) {
        return sendJson(res, 401, { error: 'Unauthorized: Admin authentication required' });
      }

      store.pricing = {
        branding: 15000,
        uiux: 20000,
        webdev: 28000,
        seo: 12000,
        photo: 18000,
        social: 15000,
        perPage: 1800,
        baseMin: 12000
      };

      await saveStore(store);

      return sendJson(res, 200, {
        success: true,
        message: 'Pricing reset to factory defaults',
        pricing: store.pricing
      });
    }

    return sendJson(res, 405, { error: `Method ${method} Not Allowed` });
  } catch (error) {
    console.error('Pricing API error:', error);
    return sendJson(res, 500, { error: 'Internal Server Error', details: error.message });
  }
};
