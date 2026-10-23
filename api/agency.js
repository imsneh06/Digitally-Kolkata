const { getStore, saveStore, handleCors, sendJson, parseBody, verifyAuth } = require('./_store');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const store = await getStore();
  const method = req.method;

  try {
    // 1. GET: Fetch Agency Business Profile (Public)
    if (method === 'GET') {
      return sendJson(res, 200, {
        success: true,
        agency: store.agency || {
          name: "Digitally Kolkata",
          tagline: "High-Impact Digital Marketing & Web Engineering",
          wa: "919073277478",
          email: "duttarayan3@gmail.com",
          phone: "+91 90732 77478",
          address: "Salt Lake Sector V, Kolkata, West Bengal 700091"
        }
      });
    }

    // 2. PUT or POST: Update Agency Business Details (Admin protected)
    if (method === 'PUT' || method === 'POST') {
      const body = await parseBody(req);
      if (!verifyAuth(req, store, body)) {
        return sendJson(res, 401, { error: 'Unauthorized: Admin authentication required' });
      }
      const current = store.agency || {};

      store.agency = {
        name: (body.name !== undefined ? body.name : current.name || 'Digitally Kolkata').trim(),
        tagline: (body.tagline !== undefined ? body.tagline : current.tagline || '').trim(),
        wa: (body.wa !== undefined ? body.wa : current.wa || '919073277478').replace(/[^0-9]/g, ''),
        email: (body.email !== undefined ? body.email : current.email || 'duttarayan3@gmail.com').trim(),
        phone: (body.phone !== undefined ? body.phone : current.phone || '+91 90732 77478').trim(),
        address: (body.address !== undefined ? body.address : current.address || '').trim()
      };

      await saveStore(store);

      return sendJson(res, 200, {
        success: true,
        message: 'Agency profile updated successfully',
        agency: store.agency
      });
    }

    return sendJson(res, 405, { error: `Method ${method} Not Allowed` });
  } catch (error) {
    console.error('Agency API error:', error);
    return sendJson(res, 500, { error: 'Internal Server Error', details: error.message });
  }
};
