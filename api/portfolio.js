const { getStore, saveStore, handleCors, sendJson, parseBody, verifyAuth } = require('./_store');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const store = await getStore();
  const method = req.method;

  try {
    // 1. GET: Fetch Portfolio Projects (Public)
    if (method === 'GET') {
      return sendJson(res, 200, {
        success: true,
        count: store.portfolio ? store.portfolio.length : 0,
        portfolio: store.portfolio || []
      });
    }

    // 2. POST: Add New Project (Admin protected)
    if (method === 'POST') {
      const body = await parseBody(req);
      if (!verifyAuth(req, store, body)) {
        return sendJson(res, 401, { error: 'Unauthorized: Admin authentication required' });
      }

      const title = (body.title || '').trim();
      const category = (body.category || 'webdev').trim();
      const categoryLabel = (body.categoryLabel || '').trim();
      const metric = (body.metric || '').trim();
      const description = (body.description || '').trim();

      if (!title) {
        return sendJson(res, 400, { error: 'Project title is required' });
      }

      const newProject = {
        id: 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        title,
        category,
        categoryLabel: categoryLabel || category.toUpperCase(),
        metric: metric || 'Verified Impact',
        description: description || 'High-impact deliverables engineered for measurable performance.',
        active: body.active !== undefined ? Boolean(body.active) : true
      };

      store.portfolio = store.portfolio || [];
      store.portfolio.push(newProject);
      await saveStore(store);

      return sendJson(res, 201, {
        success: true,
        message: 'Project created successfully',
        project: newProject
      });
    }

    // 3. PUT: Update Project (Admin protected)
    if (method === 'PUT') {
      const body = await parseBody(req);
      if (!verifyAuth(req, store, body)) {
        return sendJson(res, 401, { error: 'Unauthorized: Admin authentication required' });
      }

      const projectId = body.id || (req.query && req.query.id);

      if (!projectId) {
        return sendJson(res, 400, { error: 'Project ID is required' });
      }

      store.portfolio = store.portfolio || [];
      const index = store.portfolio.findIndex(p => p.id === projectId);
      if (index === -1) {
        return sendJson(res, 404, { error: 'Project not found' });
      }

      if (body.title !== undefined) store.portfolio[index].title = body.title.trim();
      if (body.category !== undefined) store.portfolio[index].category = body.category.trim();
      if (body.categoryLabel !== undefined) store.portfolio[index].categoryLabel = body.categoryLabel.trim();
      if (body.metric !== undefined) store.portfolio[index].metric = body.metric.trim();
      if (body.description !== undefined) store.portfolio[index].description = body.description.trim();
      if (body.active !== undefined) store.portfolio[index].active = Boolean(body.active);

      await saveStore(store);

      return sendJson(res, 200, {
        success: true,
        message: 'Project updated successfully',
        project: store.portfolio[index]
      });
    }

    // 4. DELETE: Delete Project (Admin protected)
    if (method === 'DELETE') {
      const body = await parseBody(req);
      if (!verifyAuth(req, store, body)) {
        return sendJson(res, 401, { error: 'Unauthorized: Admin authentication required' });
      }

      const projectId = body.id || (req.query && req.query.id);

      if (!projectId) {
        return sendJson(res, 400, { error: 'Project ID is required' });
      }

      store.portfolio = store.portfolio || [];
      const prevCount = store.portfolio.length;
      store.portfolio = store.portfolio.filter(p => p.id !== projectId);

      if (store.portfolio.length === prevCount) {
        return sendJson(res, 404, { error: 'Project not found' });
      }

      await saveStore(store);

      return sendJson(res, 200, {
        success: true,
        message: 'Project deleted successfully',
        remainingCount: store.portfolio.length
      });
    }

    return sendJson(res, 405, { error: `Method ${method} Not Allowed` });
  } catch (error) {
    console.error('Portfolio API error:', error);
    return sendJson(res, 500, { error: 'Internal Server Error', details: error.message });
  }
};
