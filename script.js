/* ==========================================================================
   DIGITALLY KOLKATA - JAVASCRIPT MASTER LOGIC
   Features:
   - Sticky Glass Navbar with Active Section Highlighting
   - Mobile Drawer Menu
   - Interactive Portfolio Filtering
   - Real-time Project Cost & Timeline Calculator
   - Service & Case Study Modals
   - Contact Form Lead Processing with WhatsApp Redirection
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Navbar Scroll Effect & Active Section Tracking
  const navbar = document.getElementById('mainNavbar');
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('section[id], header[id]');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }

    // Active link highlighting
    let current = '';
    const scrollPos = window.pageYOffset + 120;
    
    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      if (scrollPos >= top && scrollPos < top + height) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${current}`) {
        link.classList.add('active');
      }
    });
  }, { passive: true });

  // 2. Mobile Menu Toggle
  const mobileToggle = document.getElementById('mobileMenuToggle');
  const navLinksContainer = document.getElementById('navLinks');

  if (mobileToggle && navLinksContainer) {
    mobileToggle.addEventListener('click', () => {
      navLinksContainer.classList.toggle('active');
      mobileToggle.textContent = navLinksContainer.classList.contains('active') ? '✕' : '☰';
    });

    // Close when clicking nav links
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navLinksContainer.classList.remove('active');
        mobileToggle.textContent = '☰';
      });
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (navLinksContainer.classList.contains('active') && !navLinksContainer.contains(e.target) && !mobileToggle.contains(e.target)) {
        navLinksContainer.classList.remove('active');
        mobileToggle.textContent = '☰';
      }
    });
  }

  // 3. Portfolio Category Filtering
  const filterBtns = document.querySelectorAll('.filter-btn');
  const portfolioCards = document.querySelectorAll('.portfolio-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      const filter = btn.dataset.filter;

      portfolioCards.forEach(card => {
        const cat = card.dataset.category;
        if (filter === 'all' || cat === filter) {
          card.style.display = 'block';
          card.style.animation = 'fadeInUp 0.4s ease forwards';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // 4. Dynamic Pricing Engine & Project Cost Calculator
  const serviceCheckboxes = document.querySelectorAll('.service-calc');
  const pageRange = document.getElementById('pageRange');
  const pageCountDisplay = document.getElementById('pageCountDisplay');
  const estimatedPriceDisplay = document.getElementById('estimatedPrice');
  const estimatedTimelineDisplay = document.getElementById('estimatedTimeline');
  const lockInQuoteBtn = document.getElementById('lockInQuoteBtn');
  const clientMessage = document.getElementById('clientMessage');

  // Active pricing config (defaults with live API sync)
  let activePricing = {
    branding: 15000,
    uiux: 20000,
    webdev: 28000,
    seo: 12000,
    photo: 18000,
    social: 15000,
    perPage: 1800,
    baseMin: 12000
  };

  // Agency Contact Details (defaults with live API sync)
  let agencyContact = {
    wa: '919073277478',
    email: 'duttarayan3@gmail.com',
    phone: '+91 90732 77478'
  };

  async function syncPricingFromApi() {
    try {
      const res = await fetch('/api/pricing');
      if (res.ok) {
        const data = await res.json();
        if (data && data.pricing) {
          activePricing = { ...activePricing, ...data.pricing };

          // Map service values to checkbox inputs
          const applyServiceRate = (cb, rate) => {
            if (!cb.dataset.originalText && cb.nextElementSibling) {
              cb.dataset.originalText = cb.nextElementSibling.textContent;
            }
            const orig = cb.dataset.originalText || '';
            const parentLabel = cb.closest('.check-card');
            const num = typeof rate === 'number' ? rate : parseFloat(String(rate).replace(/[^0-9.]/g, ''));
            const isTextStatus = typeof rate === 'string' && (isNaN(num) || rate.toLowerCase().includes('not') || rate.toLowerCase().includes('n/a') || rate.toLowerCase().includes('call'));

            if (isTextStatus || isNaN(num) || num <= 0) {
              cb.value = '0';
              cb.disabled = true;
              cb.checked = false;
              if (parentLabel) {
                parentLabel.classList.remove('checked');
                parentLabel.style.opacity = '0.55';
                parentLabel.style.cursor = 'not-allowed';
                parentLabel.title = String(rate || 'Currently not in service');
              }
              if (cb.nextElementSibling) {
                const badge = typeof rate === 'string' && rate.trim() ? rate.trim() : 'N/A';
                cb.nextElementSibling.textContent = `${orig} (${badge})`;
              }
            } else {
              cb.value = num;
              cb.disabled = false;
              if (parentLabel) {
                parentLabel.style.opacity = '1';
                parentLabel.style.cursor = 'pointer';
                parentLabel.title = '';
              }
              if (cb.nextElementSibling && orig) {
                cb.nextElementSibling.textContent = orig;
              }
            }
          };

          serviceCheckboxes.forEach(cb => {
            const labelSpan = (cb.dataset.originalText || (cb.nextElementSibling ? cb.nextElementSibling.textContent : '')).toLowerCase();
            if (labelSpan.includes('web')) applyServiceRate(cb, activePricing.webdev);
            else if (labelSpan.includes('brand')) applyServiceRate(cb, activePricing.branding);
            else if (labelSpan.includes('ui/ux') || labelSpan.includes('design')) applyServiceRate(cb, activePricing.uiux);
            else if (labelSpan.includes('seo') || labelSpan.includes('analytics')) applyServiceRate(cb, activePricing.seo);
            else if (labelSpan.includes('photo') || labelSpan.includes('shoot')) applyServiceRate(cb, activePricing.photo);
            else if (labelSpan.includes('social') || labelSpan.includes('marketing')) applyServiceRate(cb, activePricing.social);
          });

          calculateQuote();
        }
      }
    } catch (e) {
      console.warn('Live pricing sync skipped, running on default rates:', e.message);
    }
  }

  async function syncAgencyFromApi() {
    try {
      const res = await fetch('/api/agency');
      if (res.ok) {
        const data = await res.json();
        if (data && data.agency) {
          agencyContact = { ...agencyContact, ...data.agency };

          // 1. Update WhatsApp links across the page
          if (agencyContact.wa) {
            const cleanWa = agencyContact.wa.replace(/[^0-9]/g, '');
            document.querySelectorAll('a[href*="wa.me"]').forEach(a => {
              const currentHref = a.getAttribute('href') || '';
              const urlParts = currentHref.split('?');
              const queryPart = urlParts[1] ? `?${urlParts[1]}` : '';
              a.setAttribute('href', `https://wa.me/${cleanWa}${queryPart}`);
            });
          }

          // 2. Update Email links and displayed text
          if (agencyContact.email) {
            document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
              a.setAttribute('href', `mailto:${agencyContact.email}`);
              if (a.textContent.includes('@')) {
                a.textContent = agencyContact.email;
              }
            });
          }

          // 3. Update Phone numbers displayed
          if (agencyContact.phone) {
            document.querySelectorAll('.info-val, .footer-bottom, .contact-info').forEach(el => {
              if (el.textContent.includes('+91 90732') || el.textContent.includes('90732 77478')) {
                el.innerHTML = el.innerHTML.replace(/\+91\s*90732\s*77478/g, agencyContact.phone);
              }
            });
          }
        }
      }
    } catch (e) {
      console.warn('Agency profile sync skipped:', e.message);
    }
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, function(m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m];
    });
  }

  function calculateQuote() {
    let baseSum = 0;
    let selectedCount = 0;

    serviceCheckboxes.forEach(cb => {
      const parentLabel = cb.closest('.check-card');
      if (cb.checked && !cb.disabled) {
        baseSum += parseFloat(cb.value) || 0;
        selectedCount++;
        if (parentLabel) parentLabel.classList.add('checked');
      } else {
        if (parentLabel) parentLabel.classList.remove('checked');
      }
    });

    const pages = pageRange ? parseInt(pageRange.value, 10) : 5;
    if (pageCountDisplay) {
      pageCountDisplay.textContent = pages === 1 ? '1 Page (Landing)' : `${pages} Pages`;
    }

    // Dynamic Multiplier for page scope beyond base 5 pages
    let pageCost = 0;
    if (pages > 5) {
      const perPageRate = typeof activePricing.perPage === 'number' ? activePricing.perPage : (parseFloat(String(activePricing.perPage).replace(/[^0-9.]/g, '')) || 1800);
      pageCost = (pages - 5) * perPageRate;
    }

    const minBase = typeof activePricing.baseMin === 'number' ? activePricing.baseMin : (parseFloat(String(activePricing.baseMin).replace(/[^0-9.]/g, '')) || 12000);
    const totalEstimate = Math.max(minBase, baseSum + pageCost);
    if (estimatedPriceDisplay) {
      estimatedPriceDisplay.textContent = `₹${Math.round(totalEstimate).toLocaleString('en-IN')}`;
    }

    // Calculate timeline
    let timelineWeeks = '1 to 2 Weeks';
    if (pages > 15 || selectedCount >= 4) {
      timelineWeeks = '4 to 6 Weeks';
    } else if (pages > 7 || selectedCount >= 2) {
      timelineWeeks = '2 to 3 Weeks';
    }
    if (estimatedTimelineDisplay) {
      estimatedTimelineDisplay.textContent = timelineWeeks;
    }
  }

  serviceCheckboxes.forEach(cb => cb.addEventListener('change', calculateQuote));
  if (pageRange) pageRange.addEventListener('input', calculateQuote);

  // Initialize Calculator & Sync from API
  calculateQuote();
  syncPricingFromApi();
  syncAgencyFromApi();

  // "Lock In This Quote" transfers details to contact form
  if (lockInQuoteBtn && clientMessage) {
    lockInQuoteBtn.addEventListener('click', () => {
      const price = estimatedPriceDisplay ? estimatedPriceDisplay.textContent : '₹35,000';
      const timeline = estimatedTimelineDisplay ? estimatedTimelineDisplay.textContent : '2 to 3 Weeks';
      const pages = pageRange ? pageRange.value : 5;

      const selectedServices = Array.from(serviceCheckboxes)
        .filter(c => c.checked)
        .map(c => c.nextElementSibling ? c.nextElementSibling.textContent.trim() : '')
        .filter(Boolean)
        .join(', ');

      clientMessage.value = `I generated an instant estimate of ${price} (${timeline}) for ~${pages} pages.\nServices chosen: ${selectedServices}.\nI would like to schedule a discovery call to review my project.`;
    });
  }

  // 5. Modal System (Services & Case Studies)
  const modal = document.getElementById('projectModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalDescription = document.getElementById('modalDescription');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalCta = document.getElementById('modalCta');

  function openModal(title, text) {
    if (!modal) return;
    modalTitle.textContent = title;
    modalDescription.textContent = text;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Open from service links
  document.querySelectorAll('.open-service-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(btn.dataset.title, btn.dataset.details);
    });
  });

  // Open from portfolio cards
  portfolioCards.forEach(card => {
    card.addEventListener('click', () => {
      openModal(card.dataset.title, card.dataset.details);
    });
  });

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  if (modalCta) modalCta.addEventListener('click', closeModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
      closeModal();
    }
  });

  // 6. Lead Contact Form Processing & WhatsApp Action
  const leadForm = document.getElementById('leadContactForm');
  const submitContactBtn = document.getElementById('submitContactBtn');
  const toast = document.getElementById('toastNotice');
  const toastMessage = document.getElementById('toastMessage');

  function showToast(msg) {
    if (!toast) return;
    toastMessage.textContent = msg;
    toast.classList.add('visible');
    setTimeout(() => {
      toast.classList.remove('visible');
    }, 4500);
  }

  if (leadForm) {
    leadForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('clientName').value.trim();
      const email = document.getElementById('clientEmail').value.trim();
      const phone = document.getElementById('clientPhone').value.trim();
      const interest = document.getElementById('projectInterest').value;
      const message = document.getElementById('clientMessage').value.trim();

      // Loading state on button
      const originalBtnHtml = submitContactBtn ? submitContactBtn.innerHTML : '';
      if (submitContactBtn) {
        submitContactBtn.disabled = true;
        submitContactBtn.innerHTML = `<span>Recording Inquiry...</span>`;
      }

      showToast(`Thank you, ${name}! Recording your inquiry...`);

      const leadPayload = {
        name,
        email,
        phone: phone || 'Not provided',
        interest,
        message
      };

      // 1. Post to Serverless Backend API (POST /api/leads)
      let postSuccess = false;
      try {
        const response = await fetch('/api/leads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(leadPayload)
        });

        if (response.ok) {
          postSuccess = true;
          showToast(`Inquiry captured! Redirecting to official WhatsApp...`);
        } else {
          const errData = await response.json();
          console.warn('API submission notice:', errData);
        }
      } catch (networkErr) {
        console.warn('Network notice posting lead to API, saving client backup:', networkErr);
      }

      // 2. Client-side localStorage backup to guarantee zero lead loss
      try {
        const localLeads = JSON.parse(localStorage.getItem('dk_leads') || '[]');
        localLeads.unshift({
          ...leadPayload,
          id: 'lead_local_' + Date.now(),
          timestamp: new Date().toISOString()
        });
        localStorage.setItem('dk_leads', JSON.stringify(localLeads));
      } catch (storageErr) {
        console.error('Local backup save failed:', storageErr);
      }

      // 3. Open WhatsApp formatted lead chat
      const targetWa = (agencyContact.wa || '919073277478').replace(/[^0-9]/g, '');
      const waText = encodeURIComponent(
        `*New Inquiry - Digitally Kolkata*\n` +
        `👤 Name: ${name}\n` +
        `✉️ Email: ${email}\n` +
        `📞 Phone: ${phone || 'Not provided'}\n` +
        `🎯 Service: ${interest}\n` +
        `📝 Details: ${message}`
      );

      setTimeout(() => {
        window.open(`https://wa.me/${targetWa}?text=${waText}`, '_blank');
        if (submitContactBtn) {
          submitContactBtn.disabled = false;
          submitContactBtn.innerHTML = originalBtnHtml;
        }
      }, 1000);

      leadForm.reset();
      calculateQuote();
    });
  }
});
