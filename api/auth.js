const { getStore, saveStore, handleCors, sendJson, parseBody, verifyAuth } = require('./_store');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const store = await getStore();
  const method = req.method;

  try {
    // 1. POST: Authenticate Admin
    if (method === 'POST') {
      const body = await parseBody(req);
      const entered = (body.passcode || '').trim();
      const actual = store.adminPass || 'admin';

      if (entered === actual) {
        return sendJson(res, 200, {
          success: true,
          token: actual,
          message: 'Authenticated successfully'
        });
      } else {
        return sendJson(res, 401, {
          success: false,
          error: 'Incorrect admin passcode'
        });
      }
    }

    // 2. PUT: Change Passcode
    if (method === 'PUT') {
      const body = await parseBody(req);
      const current = (body.currentPasscode || '').trim();
      const next = (body.newPasscode || '').trim();
      const actual = store.adminPass || 'admin';

      if (current !== actual) {
        return sendJson(res, 401, { error: 'Current passcode is incorrect' });
      }

      if (next.length < 4) {
        return sendJson(res, 400, { error: 'New passcode must be at least 4 characters' });
      }

      store.adminPass = next;
      await saveStore(store);

      return sendJson(res, 200, {
        success: true,
        message: 'Admin passcode updated successfully',
        token: next
      });
    }

    return sendJson(res, 405, { error: `Method ${method} Not Allowed` });
  } catch (error) {
    console.error('Auth API error:', error);
    return sendJson(res, 500, { error: 'Internal Server Error', details: error.message });
  }
};
