const { 
  getStore, 
  saveStore, 
  handleCors, 
  sendJson, 
  parseBody, 
  verifyAuth,
  generateSessionToken,
  generatePassVerificationHash,
  verifyPasscode
} = require('./_store');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const store = await getStore();
  const method = req.method;

  try {
    // 0. GET: Verify if saved device session token is valid
    if (method === 'GET') {
      if (!verifyAuth(req, store)) {
        return sendJson(res, 401, {
          authenticated: false,
          error: 'Device session not recognized or expired'
        });
      }
      return sendJson(res, 200, {
        authenticated: true,
        message: 'Device session recognized'
      });
    }

    // 1. POST: Authenticate Admin
    if (method === 'POST') {
      const body = await parseBody(req);
      const entered = (body.passcode || '').trim();
      const actual = store.adminPass || 'Narayan@06';
      const verificationHash = (body.verificationHash || '').trim();

      if (verifyPasscode(entered, actual, verificationHash)) {
        // If verified via hash or env but store had old default, sync store in this instance
        if (store.adminPass !== entered) {
          store.adminPass = entered;
          await saveStore(store);
        }

        const sessionToken = generateSessionToken(entered);
        const passHash = generatePassVerificationHash(entered);

        return sendJson(res, 200, {
          success: true,
          token: sessionToken,
          passHash: passHash,
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
      const actual = store.adminPass || 'Narayan@06';
      const verificationHash = (body.verificationHash || '').trim();

      // Current passcode must match or request must have valid auth token
      const isAuthHeaderValid = verifyAuth(req, store, body);
      const isCurrentPassValid = verifyPasscode(current, actual, verificationHash);

      if (!isAuthHeaderValid && !isCurrentPassValid) {
        return sendJson(res, 401, { error: 'Current passcode is incorrect' });
      }

      if (next.length < 4) {
        return sendJson(res, 400, { error: 'New passcode must be at least 4 characters' });
      }

      store.adminPass = next;
      await saveStore(store);

      const sessionToken = generateSessionToken(next);
      const passHash = generatePassVerificationHash(next);

      return sendJson(res, 200, {
        success: true,
        message: 'Admin passcode updated successfully',
        token: sessionToken,
        passHash: passHash
      });
    }

    return sendJson(res, 405, { error: `Method ${method} Not Allowed` });
  } catch (error) {
    console.error('Auth API error:', error);
    return sendJson(res, 500, { error: 'Internal Server Error', details: error.message });
  }
};
