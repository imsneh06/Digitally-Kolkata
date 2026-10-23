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

      store.pricing = {
        branding: body.branding !== undefined ? parseInt(body.branding, 10) || current.branding || 15000 : current.branding || 15000,
        uiux: body.uiux !== undefined ? parseInt(body.uiux, 10) || current.uiux || 20000 : current.uiux || 20000,
        webdev: body.webdev !== undefined ? parseInt(body.webdev, 10) || current.webdev || 28000 : current.webdev || 28000,
        seo: body.seo !== undefined ? parseInt(body.seo, 10) || current.seo || 12000 : current.seo || 12000,
        photo: body.photo !== undefined ? parseInt(body.photo, 10) || current.photo || 18000 : current.photo || 18000,
        social: body.social !== undefined ? parseInt(body.social, 10) || current.social || 15000 : current.social || 15000,
        perPage: body.perPage !== undefined ? parseInt(body.perPage, 10) || current.perPage || 1800 : current.perPage || 1800,
        baseMin: body.baseMin !== undefined ? parseInt(body.baseMin, 10) || current.baseMin || 12000 : current.baseMin || 12000
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
