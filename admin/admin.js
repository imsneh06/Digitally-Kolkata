/* ==========================================================================
   DIGITALLY KOLKATA - ENTERPRISE ADMIN LOGIC ENGINE
   Features:
   - Full RESTful APIs with GET, POST, PUT, DELETE
   - Real-time Client Inquiries Management & Instant Status Updating
   - Live Dynamic Service Pricing Architecture
   - Business Profile & Contact Dispatching
   - Full Dynamic Portfolio CRUD Engine (Add, Edit, Toggle, Delete)
   - Cloud Database Sync (Upstash Redis / Vercel KV) & JSON Snapshots
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Live Clock
  const clock = document.getElementById('currentTime');
  function updateClock() {
    if (clock) {
      const now = new Date();
      clock.textContent = now.toLocaleTimeString('en-IN', { hour12: true });
    }
  }
  updateClock();
  setInterval(updateClock, 1000);

  // 2. Authentication Engine
  const loginOverlay = document.getElementById('loginOverlay');
  const adminApp = document.getElementById('adminApp');
  const loginForm = document.getElementById('loginForm');
  const adminPassInput = document.getElementById('adminPass');
  const loginError = document.getElementById('loginError');
  const rememberMe = document.getElementById('rememberMe');
  const togglePassBtn = document.getElementById('togglePassBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  function getAuthToken() {
    let token = sessionStorage.getItem('dk_auth_token') || localStorage.getItem('dk_auth_token');
    if (!token && (sessionStorage.getItem('dk_auth') === 'true' || localStorage.getItem('dk_auth') === 'true')) {
      token = localStorage.getItem('dk_admin_pass') || 'admin';
      sessionStorage.setItem('dk_auth_token', token);
    }
    return token || 'admin';
  }

  function getAuthHeaders() {
    const token = getAuthToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-admin-key': token
    };
  }

  function checkSession() {
    const token = getAuthToken();
    if (token) {
      loginOverlay.classList.remove('active');
      adminApp.style.display = 'flex';
      loadAllData();
    } else {
      loginOverlay.classList.add('active');
      adminApp.style.display = 'none';
    }
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const entered = adminPassInput.value.trim();
      loginError.classList.remove('visible');

      try {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passcode: entered })
        });

        const data = await res.json();

        if (res.ok && data.success) {
          const token = data.token || entered;
          if (rememberMe.checked) {
            localStorage.setItem('dk_auth_token', token);
          } else {
            sessionStorage.setItem('dk_auth_token', token);
          }
          loginOverlay.classList.remove('active');
          adminApp.style.display = 'flex';
          loadAllData();
          showToast('Welcome back to Digitally Kolkata Control Panel!');
        } else {
          loginError.textContent = data.error || 'Incorrect passcode. Try again.';
          loginError.classList.add('visible');
          adminPassInput.focus();
        }
      } catch (err) {
        // Fallback for offline local dev mode
        if (entered === (localStorage.getItem('dk_admin_pass') || 'admin')) {
          sessionStorage.setItem('dk_auth_token', entered);
          loginOverlay.classList.remove('active');
          adminApp.style.display = 'flex';
          loadAllData();
          showToast('Authenticated in offline fallback mode.');
        } else {
          loginError.textContent = 'Connection error. Check network.';
          loginError.classList.add('visible');
        }
      }
    });
  }

  if (togglePassBtn) {
    togglePassBtn.addEventListener('click', () => {
      adminPassInput.type = adminPassInput.type === 'password' ? 'text' : 'password';
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('dk_auth_token');
      sessionStorage.removeItem('dk_auth_token');
      window.location.reload();
    });
  }

  // 3. Tab Switching
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.admin-tab-pane');
  const tabHeaderTitle = document.getElementById('tabHeaderTitle');
  const tabHeaderSubtitle = document.getElementById('tabHeaderSubtitle');

  const tabTitles = {
    'tab-overview': { title: 'Overview & Client Leads', subtitle: 'Real-time inquiries and project requests captured from your website.' },
    'tab-services': { title: 'Services & Pricing Architecture', subtitle: 'Configure base rates powering your interactive quote calculator.' },
    'tab-agency': { title: 'Business Profile & Contacts', subtitle: 'Manage your WhatsApp number, phone, email, and Kolkata headquarters.' },
    'tab-portfolio': { title: 'Portfolio & Case Studies', subtitle: 'Showcase your client work, performance metrics, and deliverables.' },
    'tab-settings': { title: 'Security & Infrastructure', subtitle: 'Manage your admin credentials, database sync, and serverless health.' }
  };

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = item.dataset.tab;
      navItems.forEach(n => n.classList.remove('active'));
      tabPanes.forEach(t => t.classList.remove('active'));

      item.classList.add('active');
      const pane = document.getElementById(targetTab);
      if (pane) pane.classList.add('active');

      if (tabTitles[targetTab]) {
        tabHeaderTitle.textContent = tabTitles[targetTab].title;
        tabHeaderSubtitle.textContent = tabTitles[targetTab].subtitle;
      }

      // Automatically load and refresh data for the selected tab
      if (targetTab === 'tab-overview') loadLeads();
      else if (targetTab === 'tab-services') loadPricing();
      else if (targetTab === 'tab-agency') loadAgencyInfo();
      else if (targetTab === 'tab-portfolio') loadPortfolio();
      else if (targetTab === 'tab-settings') checkSyncStatus();
    });
  });

  // 4. Leads Management (GET, PUT, DELETE)
  const leadsTableBody = document.getElementById('leadsTableBody');
  const totalLeadsCount = document.getElementById('totalLeadsCount');
  const refreshLeadsBtn = document.getElementById('refreshLeadsBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const clearLeadsBtn = document.getElementById('clearLeadsBtn');

  let currentLeads = [];

  async function loadLeads() {
    if (!leadsTableBody) return;
    leadsTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">Loading inquiries from server...</td>
      </tr>
    `;

    try {
      const res = await fetch('/api/leads', {
        method: 'GET',
        headers: getAuthHeaders()
      });

      if (res.status === 401) {
        showToast('Session expired. Please sign in again.');
        logoutBtn.click();
        return;
      }

      const data = await res.json();
      currentLeads = data.leads || [];

      // Also check client localStorage backup and merge any non-synced leads
      try {
        const localBackup = JSON.parse(localStorage.getItem('dk_leads') || '[]');
        localBackup.forEach(bl => {
          if (!currentLeads.some(cl => cl.name === bl.name && cl.email === bl.email && cl.message === bl.message)) {
            currentLeads.unshift(bl);
          }
        });
      } catch (e) {}

      renderLeadsTable(currentLeads);
    } catch (err) {
      console.warn('Failed to load leads from server, loading local backup:', err);
      currentLeads = JSON.parse(localStorage.getItem('dk_leads') || '[]');
      renderLeadsTable(currentLeads);
    }
  }

  function renderLeadsTable(leads) {
    if (totalLeadsCount) totalLeadsCount.textContent = leads.length;

    if (!leadsTableBody) return;

    if (leads.length === 0) {
      leadsTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            No inquiries recorded yet. When clients submit inquiries on your site, they appear here instantly.
          </td>
        </tr>
      `;
      return;
    }

    leadsTableBody.innerHTML = leads.map(l => {
      const date = l.timestamp ? new Date(l.timestamp).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }) : 'Recently';

      const cleanPhone = (l.phone || '').replace(/[^0-9]/g, '');
      const waLink = cleanPhone ? `https://wa.me/${cleanPhone}` : '#';
      const status = l.status || 'new';

      return `
        <tr data-lead-id="${escapeHtml(l.id)}">
          <td style="font-size: 12px; color: var(--text-muted);">${date}</td>
          <td><strong>${escapeHtml(l.name)}</strong></td>
          <td>
            <div style="font-size: 13px;">${escapeHtml(l.email)}</div>
            <small style="color: #9CA3AF">${escapeHtml(l.phone)}</small>
          </td>
          <td><span class="badge-service">${escapeHtml(l.interest || 'General')}</span></td>
          <td style="max-width: 260px; white-space: pre-wrap; font-size: 12px; line-height: 1.4;">${escapeHtml(l.message || '-')}</td>
          <td>
            <select class="lead-status-select" onchange="window.updateLeadStatus('${escapeHtml(l.id)}', this.value)">
              <option value="new" ${status === 'new' ? 'selected' : ''}>🟡 New</option>
              <option value="contacted" ${status === 'contacted' ? 'selected' : ''}>🔵 Contacted</option>
              <option value="in_progress" ${status === 'in_progress' ? 'selected' : ''}>🟣 In Progress</option>
              <option value="closed" ${status === 'closed' ? 'selected' : ''}>🟢 Closed</option>
            </select>
          </td>
          <td>
            <div class="lead-actions" style="display: flex; gap: 6px; align-items: center;">
              ${cleanPhone ? `<a href="${waLink}" target="_blank" class="btn-chat-wa" title="Chat on WhatsApp">💬</a>` : ''}
              <a href="mailto:${escapeHtml(l.email)}" class="btn-secondary-sm" style="padding: 4px 8px; font-size: 11px;" title="Send Email">✉️</a>
              <button type="button" class="btn-icon-danger" onclick="window.deleteLead('${escapeHtml(l.id)}')" title="Delete Inquiry">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Global handler for Lead Status update (PUT /api/leads)
  window.updateLeadStatus = async function (leadId, nextStatus) {
    try {
      const res = await fetch('/api/leads', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id: leadId, status: nextStatus })
      });

      if (res.ok) {
        showToast(`Lead status updated to ${nextStatus.toUpperCase()}`);
        const lead = currentLeads.find(l => l.id === leadId);
        if (lead) lead.status = nextStatus;
      } else {
        showToast('Failed to update lead status on server.');
      }
    } catch (err) {
      console.error('Status update error:', err);
      showToast('Network error updating status.');
    }
  };

  // Global handler for Single Lead Delete (DELETE /api/leads?id=...)
  window.deleteLead = async function (leadId) {
    if (!confirm('Are you sure you want to delete this client inquiry?')) return;

    try {
      const res = await fetch(`/api/leads?id=${encodeURIComponent(leadId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id: leadId })
      });

      if (res.ok) {
        currentLeads = currentLeads.filter(l => l.id !== leadId);
        renderLeadsTable(currentLeads);
        showToast('Lead deleted successfully.');
      } else {
        const err = await res.json();
        showToast(`Delete failed: ${err.error || 'Server error'}`);
      }
    } catch (err) {
      console.error('Delete lead error:', err);
      // Fallback local removal
      currentLeads = currentLeads.filter(l => l.id !== leadId);
      renderLeadsTable(currentLeads);
      showToast('Lead removed locally.');
    }
  };

  // Refresh Leads
  if (refreshLeadsBtn) {
    refreshLeadsBtn.addEventListener('click', () => {
      refreshLeadsBtn.textContent = '⏳ Loading...';
      loadLeads().finally(() => {
        refreshLeadsBtn.textContent = '🔄 Refresh';
        showToast('Leads refreshed.');
      });
    });
  }

  // Clear All Leads (DELETE /api/leads?all=true)
  if (clearLeadsBtn) {
    clearLeadsBtn.addEventListener('click', async () => {
      if (!confirm('DANGER: Are you sure you want to delete ALL inquiries? This cannot be undone.')) return;

      try {
        const res = await fetch('/api/leads?all=true', {
          method: 'DELETE',
          headers: getAuthHeaders(),
          body: JSON.stringify({ clearAll: true })
        });

        if (res.ok) {
          currentLeads = [];
          localStorage.removeItem('dk_leads');
          renderLeadsTable([]);
          showToast('All client inquiries cleared.');
        } else {
          showToast('Failed to clear leads from server.');
        }
      } catch (err) {
        currentLeads = [];
        localStorage.removeItem('dk_leads');
        renderLeadsTable([]);
        showToast('Leads cleared locally.');
      }
    });
  }

  // Export Leads to CSV
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      if (currentLeads.length === 0) {
        showToast('No inquiries to export.');
        return;
      }

      let csv = 'Date,Name,Email,Phone,Service,Status,Message\n';
      currentLeads.forEach(l => {
        csv += `"${l.timestamp || ''}","${(l.name || '').replace(/"/g, '""')}","${l.email || ''}","${l.phone || ''}","${l.interest || ''}","${l.status || 'new'}","${(l.message || '').replace(/"/g, '""')}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Digitally_Kolkata_Leads_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('CSV Exported successfully!');
    });
  }

  // 5. Pricing Settings (GET, PUT, DELETE)
  const savePricingBtn = document.getElementById('savePricingBtn');
  const resetPricingBtn = document.getElementById('resetPricingBtn');

  function populatePricingInputs(p) {
    if (!p) return;
    if (p.branding && document.getElementById('priceBranding')) document.getElementById('priceBranding').value = p.branding;
    if (p.uiux && document.getElementById('priceUiux')) document.getElementById('priceUiux').value = p.uiux;
    if (p.webdev && document.getElementById('priceWebdev')) document.getElementById('priceWebdev').value = p.webdev;
    if (p.seo && document.getElementById('priceSeo')) document.getElementById('priceSeo').value = p.seo;
    if (p.photo && document.getElementById('pricePhoto')) document.getElementById('pricePhoto').value = p.photo;
    if (p.social && document.getElementById('priceSocial')) document.getElementById('priceSocial').value = p.social;
    if (p.perPage && document.getElementById('pricePerPage')) document.getElementById('pricePerPage').value = p.perPage;
    if (p.baseMin && document.getElementById('priceBaseMin')) document.getElementById('priceBaseMin').value = p.baseMin;
  }

  async function loadPricing() {
    try {
      const res = await fetch('/api/pricing');
      if (res.ok) {
        const data = await res.json();
        const p = data.pricing || {};
        localStorage.setItem('dk_pricing', JSON.stringify(p));
        populatePricingInputs(p);
        return;
      }
    } catch (e) {
      console.warn('Fetch pricing error:', e.message);
    }
    // Fallback to local storage
    try {
      const cached = JSON.parse(localStorage.getItem('dk_pricing') || '{}');
      populatePricingInputs(cached);
    } catch (e) {}
  }

  if (savePricingBtn) {
    savePricingBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      savePricingBtn.textContent = '💾 Saving...';

      const getVal = (id, def) => {
        const el = document.getElementById(id);
        if (!el || !el.value) return def;
        const v = parseInt(el.value, 10);
        return isNaN(v) ? def : v;
      };

      const payload = {
        branding: getVal('priceBranding', 15000),
        uiux: getVal('priceUiux', 20000),
        webdev: getVal('priceWebdev', 28000),
        seo: getVal('priceSeo', 12000),
        photo: getVal('pricePhoto', 18000),
        social: getVal('priceSocial', 15000),
        perPage: getVal('pricePerPage', 1800),
        baseMin: getVal('priceBaseMin', 12000),
        token: getAuthToken()
      };

      // Always save to localStorage immediately
      try {
        localStorage.setItem('dk_pricing', JSON.stringify(payload));
      } catch (e) {}

      try {
        const res = await fetch('/api/pricing', {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          showToast('Pricing updated! Rates are now live on calculator.');
        } else {
          showToast('Rates saved to local storage (server notice).');
        }
      } catch (err) {
        console.error('Pricing save error:', err);
        showToast('Pricing saved locally.');
      } finally {
        savePricingBtn.textContent = '💾 Save Rates';
      }
    });
  }

  if (resetPricingBtn) {
    resetPricingBtn.addEventListener('click', async () => {
      if (!confirm('Reset all service pricing to factory defaults?')) return;
      try {
        const res = await fetch('/api/pricing', {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        if (res.ok) {
          localStorage.removeItem('dk_pricing');
          await loadPricing();
          showToast('Pricing reset to defaults.');
        }
      } catch (e) {
        showToast('Error resetting pricing.');
      }
    });
  }

  // 6. Agency Business Info (GET, PUT)
  const saveAgencyBtn = document.getElementById('saveAgencyBtn');

  function populateAgencyInputs(a) {
    if (!a) return;
    if (a.name && document.getElementById('agencyName')) document.getElementById('agencyName').value = a.name;
    if (a.tagline && document.getElementById('agencyTagline')) document.getElementById('agencyTagline').value = a.tagline;
    if (a.wa && document.getElementById('agencyWhatsApp')) document.getElementById('agencyWhatsApp').value = a.wa;
    if (a.email && document.getElementById('agencyEmail')) document.getElementById('agencyEmail').value = a.email;
    if (a.phone && document.getElementById('agencyPhone')) document.getElementById('agencyPhone').value = a.phone;
    if (a.address && document.getElementById('agencyAddress')) document.getElementById('agencyAddress').value = a.address;
  }

  async function loadAgencyInfo() {
    try {
      const res = await fetch('/api/agency');
      if (res.ok) {
        const data = await res.json();
        const a = data.agency || {};
        localStorage.setItem('dk_agency_info', JSON.stringify(a));
        populateAgencyInputs(a);
        return;
      }
    } catch (e) {
      console.warn('Fetch agency error:', e.message);
    }
    // Fallback to local storage
    try {
      const cached = JSON.parse(localStorage.getItem('dk_agency_info') || '{}');
      populateAgencyInputs(cached);
    } catch (e) {}
  }

  if (saveAgencyBtn) {
    saveAgencyBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      saveAgencyBtn.textContent = '💾 Saving...';

      const payload = {
        name: (document.getElementById('agencyName') ? document.getElementById('agencyName').value : 'Digitally Kolkata').trim(),
        tagline: (document.getElementById('agencyTagline') ? document.getElementById('agencyTagline').value : '').trim(),
        wa: (document.getElementById('agencyWhatsApp') ? document.getElementById('agencyWhatsApp').value : '919073277478').trim(),
        email: (document.getElementById('agencyEmail') ? document.getElementById('agencyEmail').value : 'duttarayan3@gmail.com').trim(),
        phone: (document.getElementById('agencyPhone') ? document.getElementById('agencyPhone').value : '+91 90732 77478').trim(),
        address: (document.getElementById('agencyAddress') ? document.getElementById('agencyAddress').value : 'Salt Lake Sector V, Kolkata').trim(),
        token: getAuthToken()
      };

      try {
        localStorage.setItem('dk_agency_info', JSON.stringify(payload));
      } catch (e) {}

      try {
        const res = await fetch('/api/agency', {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          showToast('Business details saved & live across website!');
        } else {
          showToast('Business details saved locally.');
        }
      } catch (err) {
        console.error('Agency save error:', err);
        showToast('Business details saved locally.');
      } finally {
        saveAgencyBtn.textContent = '💾 Save Business Details';
      }
    });
  }

  // 7. Portfolio Projects CRUD (GET, POST, PUT, DELETE)
  const portfolioList = document.getElementById('portfolioList');
  const addProjectBtn = document.getElementById('addProjectBtn');
  const portfolioModalBackdrop = document.getElementById('portfolioModalBackdrop');
  const portfolioModalTitle = document.getElementById('portfolioModalTitle');
  const portfolioModalForm = document.getElementById('portfolioModalForm');
  const closePortfolioModalBtn = document.getElementById('closePortfolioModalBtn');
  const cancelPortfolioModalBtn = document.getElementById('cancelPortfolioModalBtn');
  const modalProjectId = document.getElementById('modalProjectId');
  const modalProjectTitle = document.getElementById('modalProjectTitle');
  const modalProjectCategory = document.getElementById('modalProjectCategory');
  const modalProjectCategoryLabel = document.getElementById('modalProjectCategoryLabel');
  const modalProjectMetric = document.getElementById('modalProjectMetric');
  const modalProjectDesc = document.getElementById('modalProjectDesc');
  const modalProjectActive = document.getElementById('modalProjectActive');

  let currentProjects = [];

  async function loadPortfolio() {
    if (!portfolioList) return;
    try {
      const res = await fetch('/api/portfolio');
      if (res.ok) {
        const data = await res.json();
        currentProjects = data.portfolio || [];
        localStorage.setItem('dk_portfolio', JSON.stringify(currentProjects));
        renderPortfolioList(currentProjects);
        return;
      }
    } catch (e) {
      console.warn('Error loading portfolio:', e.message);
    }
    // Fallback to local storage
    try {
      currentProjects = JSON.parse(localStorage.getItem('dk_portfolio') || '[]');
      if (currentProjects.length > 0) {
        renderPortfolioList(currentProjects);
      }
    } catch (e) {}
  }

  function renderPortfolioList(projects) {
    if (!portfolioList) return;
    if (projects.length === 0) {
      portfolioList.innerHTML = `<div class="empty-state">No portfolio projects found. Click "+ Add Project" to create one.</div>`;
      return;
    }

    portfolioList.innerHTML = projects.map(p => {
      const isActive = p.active !== false;
      return `
        <div class="portfolio-admin-item">
          <div class="item-info">
            <h4>${escapeHtml(p.title)}</h4>
            <p>${escapeHtml(p.categoryLabel || p.category)} • <strong style="color: var(--accent-gold);">${escapeHtml(p.metric || '')}</strong></p>
            <p style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">${escapeHtml(p.description || '')}</p>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button type="button" class="item-badge" style="cursor: pointer; background: ${isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(156, 163, 175, 0.15)'}; color: ${isActive ? '#34D399' : '#9CA3AF'};" onclick="window.toggleProjectActive('${escapeHtml(p.id)}', ${!isActive})">
              ${isActive ? '● Active on Home' : '○ Hidden'}
            </button>
            <button type="button" class="btn-secondary-sm" style="padding: 4px 8px; font-size: 11px;" onclick="window.editProject('${escapeHtml(p.id)}')">✏️ Edit</button>
            <button type="button" class="btn-icon-danger" onclick="window.deleteProject('${escapeHtml(p.id)}')">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Open modal for Create
  if (addProjectBtn) {
    addProjectBtn.addEventListener('click', () => {
      portfolioModalTitle.textContent = 'Add New Portfolio Project';
      modalProjectId.value = '';
      portfolioModalForm.reset();
      modalProjectActive.checked = true;
      portfolioModalBackdrop.classList.add('active');
    });
  }

  function closePortfolioModal() {
    if (portfolioModalBackdrop) portfolioModalBackdrop.classList.remove('active');
  }

  if (closePortfolioModalBtn) closePortfolioModalBtn.addEventListener('click', closePortfolioModal);
  if (cancelPortfolioModalBtn) cancelPortfolioModalBtn.addEventListener('click', closePortfolioModal);

  // Edit Project
  window.editProject = function (projectId) {
    const proj = currentProjects.find(p => p.id === projectId);
    if (!proj) return;

    portfolioModalTitle.textContent = 'Edit Portfolio Project';
    modalProjectId.value = proj.id;
    modalProjectTitle.value = proj.title || '';
    modalProjectCategory.value = proj.category || 'webdev';
    modalProjectCategoryLabel.value = proj.categoryLabel || '';
    modalProjectMetric.value = proj.metric || '';
    modalProjectDesc.value = proj.description || '';
    modalProjectActive.checked = proj.active !== false;

    portfolioModalBackdrop.classList.add('active');
  };

  // Toggle Active Visibility
  window.toggleProjectActive = async function (projectId, nextActive) {
    try {
      const res = await fetch('/api/portfolio', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id: projectId, active: nextActive })
      });
      if (res.ok) {
        const p = currentProjects.find(item => item.id === projectId);
        if (p) p.active = nextActive;
        renderPortfolioList(currentProjects);
        showToast(`Project visibility updated.`);
      }
    } catch (e) {
      showToast('Error updating project visibility.');
    }
  };

  // Delete Project (DELETE /api/portfolio?id=...)
  window.deleteProject = async function (projectId) {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      const res = await fetch(`/api/portfolio?id=${encodeURIComponent(projectId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id: projectId })
      });
      if (res.ok) {
        currentProjects = currentProjects.filter(p => p.id !== projectId);
        renderPortfolioList(currentProjects);
        showToast('Project deleted successfully.');
      } else {
        showToast('Failed to delete project.');
      }
    } catch (e) {
      showToast('Network error deleting project.');
    }
  };

  // Modal Form Submit (POST or PUT /api/portfolio)
  if (portfolioModalForm) {
    portfolioModalForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = modalProjectId.value;
      const isEdit = Boolean(id);
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        id: id || undefined,
        title: modalProjectTitle.value.trim(),
        category: modalProjectCategory.value,
        categoryLabel: modalProjectCategoryLabel.value.trim(),
        metric: modalProjectMetric.value.trim(),
        description: modalProjectDesc.value.trim(),
        active: modalProjectActive.checked
      };

      try {
        const res = await fetch('/api/portfolio', {
          method,
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          closePortfolioModal();
          await loadPortfolio();
          showToast(isEdit ? 'Project updated successfully!' : 'New project added to portfolio!');
        } else {
          showToast('Failed to save project.');
        }
      } catch (err) {
        console.error('Portfolio save error:', err);
        showToast('Network error saving project.');
      }
    });
  }

  // 8. Security Passcode Update (PUT /api/auth)
  const securityForm = document.getElementById('securityForm');
  if (securityForm) {
    securityForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const current = document.getElementById('currentPasscode').value;
      const next = document.getElementById('newPasscode').value;

      try {
        const res = await fetch('/api/auth', {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ currentPasscode: current, newPasscode: next })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          if (data.token) {
            sessionStorage.setItem('dk_auth_token', data.token);
            if (localStorage.getItem('dk_auth_token')) localStorage.setItem('dk_auth_token', data.token);
          }
          securityForm.reset();
          showToast('Admin passcode updated successfully!');
        } else {
          showToast(`Error: ${data.error || 'Failed to update passcode'}`);
        }
      } catch (err) {
        showToast('Network error updating passcode.');
      }
    });
  }

  // 9. Cloud Storage Sync & JSON Backup Engine (api/sync)
  const kvConfigForm = document.getElementById('kvConfigForm');
  const syncEngineBadge = document.getElementById('syncEngineBadge');
  const exportBackupBtn = document.getElementById('exportBackupBtn');
  const importBackupInput = document.getElementById('importBackupInput');

  async function checkSyncStatus() {
    if (!syncEngineBadge) return;
    try {
      const res = await fetch('/api/sync');
      if (res.ok) {
        const data = await res.json();
        syncEngineBadge.textContent = data.hasCloudKv ? '● Upstash Cloud KV Active' : '○ Local / Edge Temp Mode';
        syncEngineBadge.style.color = data.hasCloudKv ? '#34D399' : '#FDB840';
      }
    } catch (e) {
      syncEngineBadge.textContent = '● Standalone Engine';
    }
  }

  if (kvConfigForm) {
    kvConfigForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const kvUrl = document.getElementById('kvUrlInput').value.trim();
      const kvToken = document.getElementById('kvTokenInput').value.trim();

      try {
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ action: 'configureKv', kvUrl, kvToken })
        });

        const data = await res.json();
        if (res.ok) {
          showToast(data.message || 'Cloud storage configured!');
          checkSyncStatus();
        } else {
          showToast(`Configuration error: ${data.error}`);
        }
      } catch (e) {
        showToast('Network error configuring Cloud KV.');
      }
    });
  }

  // Backup Export
  if (exportBackupBtn) {
    exportBackupBtn.addEventListener('click', async () => {
      try {
        const [leadsRes, pricingRes, agencyRes, portfolioRes] = await Promise.all([
          fetch('/api/leads', { headers: getAuthHeaders() }),
          fetch('/api/pricing'),
          fetch('/api/agency'),
          fetch('/api/portfolio')
        ]);

        const backupData = {
          exportedAt: new Date().toISOString(),
          leads: (await leadsRes.json()).leads || [],
          pricing: (await pricingRes.json()).pricing || {},
          agency: (await agencyRes.json()).agency || {},
          portfolio: (await portfolioRes.json()).portfolio || []
        };

        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Digitally_Kolkata_Full_Backup_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Database snapshot downloaded successfully!');
      } catch (err) {
        showToast('Error exporting database backup.');
      }
    });
  }

  // Backup Import
  if (importBackupInput) {
    importBackupInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (!confirm(`Restore database snapshot from "${file.name}"? This will sync all records.`)) return;

          const res = await fetch('/api/sync', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'restore', data: parsed })
          });

          if (res.ok) {
            showToast('Database restored successfully!');
            loadAllData();
          } else {
            const err = await res.json();
            showToast(`Restore failed: ${err.error}`);
          }
        } catch (err) {
          showToast('Invalid JSON file format.');
        }
      };
      reader.readAsText(file);
    });
  }

  // 10. Master Data Loader
  function loadAllData() {
    loadLeads();
    loadPricing();
    loadAgencyInfo();
    loadPortfolio();
    checkSyncStatus();
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, function(m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m];
    });
  }

  const toast = document.getElementById('adminToast');
  const toastText = document.getElementById('toastText');
  function showToast(msg) {
    if (!toast) return;
    toastText.textContent = msg;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 3500);
  }

  // Init
  checkSession();
});
