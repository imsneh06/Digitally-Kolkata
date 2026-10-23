const { getStore, saveStore, handleCors, sendJson, parseBody, verifyAuth, getKvConfig } = require('./_store');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const store = await getStore();
  const method = req.method;

  try {
    // 1. GET: System Health & Sync Status
    if (method === 'GET') {
      const kv = getKvConfig(store);
      return sendJson(res, 200, {
        success: true,
        status: 'online',
        timestamp: new Date().toISOString(),
        engine: kv.active ? 'Upstash Redis / Vercel KV (Cloud Distributed)' : 'Local File / Vercel Serverless Temp',
        hasCloudKv: kv.active,
        kvUrlConfigured: Boolean(kv.url),
        stats: {
          leadsCount: store.leads ? store.leads.length : 0,
          portfolioCount: store.portfolio ? store.portfolio.length : 0,
          servicesConfigured: store.pricing ? Object.keys(store.pricing).length : 0
        }
      });
    }

    // 2. POST: Test / Save Cloud KV Credentials or Import Backup JSON (Admin protected)
    if (method === 'POST') {
      if (!verifyAuth(req, store)) {
        return sendJson(res, 401, { error: 'Unauthorized: Admin authentication required' });
      }

      const body = await parseBody(req);

      // Action: Import entire database backup
      if (body.action === 'restore' && body.data) {
        const importData = body.data;
        if (typeof importData !== 'object') {
          return sendJson(res, 400, { error: 'Invalid backup JSON data' });
        }

        if (importData.pricing) store.pricing = importData.pricing;
        if (importData.agency) store.agency = importData.agency;
        if (Array.isArray(importData.portfolio)) store.portfolio = importData.portfolio;
        if (Array.isArray(importData.leads)) store.leads = importData.leads;
        if (importData.adminPass) store.adminPass = importData.adminPass;

        await saveStore(store);

        return sendJson(res, 200, {
          success: true,
          message: 'Database restored successfully from backup',
          stats: {
            leadsCount: store.leads.length,
            portfolioCount: store.portfolio.length
          }
        });
      }

      // Action: Configure Upstash / Vercel KV REST URL and Token
      if (body.action === 'configureKv') {
        let kvUrl = (body.kvUrl || '').trim();
        const kvToken = (body.kvToken || '').trim();

        if (!kvUrl && !kvToken) {
          // Clearing configuration
          store.cloudConfig = { kvUrl: '', kvToken: '' };
          await saveStore(store);
          return sendJson(res, 200, {
            success: true,
            message: 'Cloud KV configuration cleared. Operating in serverless local mode.',
            hasCloudKv: false
          });
        }

        if (kvUrl && !kvToken) {
          return sendJson(res, 400, { error: 'KV Token is required when providing KV REST URL' });
        }

        // Auto-prefix https:// if user provided domain like "xxx.upstash.io"
        if (!/^https?:\/\//i.test(kvUrl)) {
          if (kvUrl.includes('.')) {
            kvUrl = 'https://' + kvUrl;
          } else {
            return sendJson(res, 400, {
              error: 'Invalid URL. Please enter a valid Upstash Redis or Vercel KV REST URL (e.g. https://your-db.upstash.io). If you do not have Upstash Redis, leave this blank.'
            });
          }
        }

        // Test connection if provided
        if (kvUrl && kvToken) {
          try {
            const cleanUrl = kvUrl.replace(/\/+$/, '');
            const testRes = await fetch(`${cleanUrl}/set/dk_test_ping`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${kvToken}`,
                'Content-Type': 'text/plain'
              },
              body: 'pong'
            });

            if (!testRes.ok) {
              return sendJson(res, 400, {
                error: `Failed to connect to KV. Upstash returned status ${testRes.status}. Check your REST Token.`
              });
            }
          } catch (e) {
            return sendJson(res, 400, {
              error: `Connection test failed: ${e.message}. Please ensure the URL starts with https://`
            });
          }
        }

        store.cloudConfig = store.cloudConfig || {};
        store.cloudConfig.kvUrl = kvUrl;
        store.cloudConfig.kvToken = kvToken;

        await saveStore(store);

        return sendJson(res, 200, {
          success: true,
          message: kvUrl ? 'Cloud KV connected and verified!' : 'Cloud KV configuration cleared',
          hasCloudKv: Boolean(kvUrl && kvToken)
        });
      }

      return sendJson(res, 400, { error: 'Invalid action specified' });
    }

    return sendJson(res, 405, { error: `Method ${method} Not Allowed` });
  } catch (error) {
    console.error('Sync API error:', error);
    return sendJson(res, 500, { error: 'Internal Server Error', details: error.message });
  }
};
