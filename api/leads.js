const { getStore, saveStore, handleCors, sendJson, parseBody, verifyAuth } = require('./_store');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const store = await getStore();
  const method = req.method;

  try {
    // 1. GET: Fetch Leads (Admin protected)
    if (method === 'GET') {
      if (!verifyAuth(req, store)) {
        return sendJson(res, 401, { error: 'Unauthorized: Admin authentication required to access client leads' });
      }
      return sendJson(res, 200, {
        success: true,
        count: store.leads ? store.leads.length : 0,
        leads: store.leads || []
      });
    }

    // 2. POST: Submit New Lead (Public inquiry form or manual admin entry)
    if (method === 'POST') {
      const body = await parseBody(req);
      const name = (body.name || '').trim();
      const email = (body.email || '').trim();
      const phone = (body.phone || '').trim();
      const interest = (body.interest || 'General Inquiry').trim();
      const message = (body.message || '').trim();

      if (!name) {
        return sendJson(res, 400, { error: 'Full name is required' });
      }
      if (!email && !phone) {
        return sendJson(res, 400, { error: 'Please provide at least an email or phone number' });
      }

      const newLead = {
        id: 'lead_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        name,
        email: email || 'Not provided',
        phone: phone || 'Not provided',
        interest,
        message: message || '-',
        status: 'new', // new | contacted | in_progress | closed
        timestamp: new Date().toISOString()
      };

      store.leads = store.leads || [];
      store.leads.unshift(newLead);
      await saveStore(store);

      return sendJson(res, 201, {
        success: true,
        message: 'Lead received successfully',
        lead: newLead
      });
    }

    // 3. PUT: Update Lead Status or Notes (Admin protected)
    if (method === 'PUT') {
      const body = await parseBody(req);
      if (!verifyAuth(req, store, body)) {
        return sendJson(res, 401, { error: 'Unauthorized: Admin authentication required' });
      }

      const leadId = body.id || (req.query && req.query.id);

      if (!leadId) {
        return sendJson(res, 400, { error: 'Lead ID is required for update' });
      }

      store.leads = store.leads || [];
      const index = store.leads.findIndex(l => l.id === leadId);
      if (index === -1) {
        return sendJson(res, 404, { error: 'Lead not found' });
      }

      if (body.status !== undefined) store.leads[index].status = body.status;
      if (body.notes !== undefined) store.leads[index].notes = body.notes;
      if (body.interest !== undefined) store.leads[index].interest = body.interest;

      await saveStore(store);

      return sendJson(res, 200, {
        success: true,
        message: 'Lead updated successfully',
        lead: store.leads[index]
      });
    }

    // 4. DELETE: Delete Lead by ID or Clear All (Admin protected)
    if (method === 'DELETE') {
      const body = await parseBody(req);
      if (!verifyAuth(req, store, body)) {
        return sendJson(res, 401, { error: 'Unauthorized: Admin authentication required' });
      }

      const queryId = req.query && req.query.id;
      const leadId = body.id || queryId;
      const clearAll = body.clearAll || (req.query && req.query.all === 'true');

      store.leads = store.leads || [];

      if (clearAll) {
        const deletedCount = store.leads.length;
        store.leads = [];
        await saveStore(store);
        return sendJson(res, 200, {
          success: true,
          message: `All ${deletedCount} inquiries cleared successfully`,
          count: 0
        });
      }

      if (!leadId) {
        return sendJson(res, 400, { error: 'Specify lead id to delete or ?all=true to clear all' });
      }

      const prevCount = store.leads.length;
      store.leads = store.leads.filter(l => l.id !== leadId);

      if (store.leads.length === prevCount) {
        return sendJson(res, 404, { error: 'Lead not found' });
      }

      await saveStore(store);

      return sendJson(res, 200, {
        success: true,
        message: 'Lead deleted successfully',
        remainingCount: store.leads.length
      });
    }

    return sendJson(res, 405, { error: `Method ${method} Not Allowed` });
  } catch (error) {
    console.error('Leads API error:', error);
    return sendJson(res, 500, { error: 'Internal Server Error', details: error.message });
  }
};
