// Legacy viewer app adapted to call /api/legacy/* endpoints
// Based on archived static viewer

class BusinessViewer {
  constructor() {
    this.currentPage = 1;
    this.perPage = 50;
    this.viewMode = 'grid';
    this.categories = [];
    this.knownCategories = [];
    this.filters = {
      search: '',
      category: 'all',
      minScore: 0,
      verified: '',
      outreach: '',
      stage: '',
      sortBy: '',
      sortDir: 'desc',
    };

    this.init();
  }

  init() {
    this.loadStats();
    this.loadCategories();
    this.loadBusinesses();
    this.attachEventListeners();
  }

  attachEventListeners() {
    const byId = (id) => document.getElementById(id);

    byId('search-input')?.addEventListener('input', (e) => {
      this.filters.search = e.target.value;
      this.currentPage = 1;
      this.loadBusinesses();
    });

    byId('category-filter')?.addEventListener('change', (e) => {
      this.filters.category = e.target.value;
      this.currentPage = 1;
      this.loadBusinesses();
    });

    byId('score-filter')?.addEventListener('change', (e) => {
      this.filters.minScore = parseInt(e.target.value);
      this.currentPage = 1;
      this.loadBusinesses();
    });

    byId('verified-filter')?.addEventListener('change', (e) => {
      this.filters.verified = e.target.value;
      this.currentPage = 1;
      this.loadBusinesses();
    });

    byId('outreach-filter')?.addEventListener('change', (e) => {
      this.filters.outreach = e.target.value;
      this.currentPage = 1;
      this.loadBusinesses();
    });

    byId('stage-filter')?.addEventListener('change', (e) => {
      this.filters.stage = e.target.value;
      this.currentPage = 1;
      this.loadBusinesses();
    });

    byId('per-page')?.addEventListener('change', (e) => {
      this.perPage = parseInt(e.target.value);
      this.currentPage = 1;
      this.loadBusinesses();
    });

    byId('view-grid')?.addEventListener('click', () => this.setViewMode('grid'));
    byId('view-list')?.addEventListener('click', () => this.setViewMode('list'));

    byId('sort-by')?.addEventListener('change', (e) => {
      this.filters.sortBy = e.target.value;
      this.currentPage = 1;
      this.loadBusinesses();
    });

    byId('sort-dir')?.addEventListener('change', (e) => {
      this.filters.sortDir = e.target.value;
      this.currentPage = 1;
      this.loadBusinesses();
    });
  }

  setViewMode(mode) {
    this.viewMode = mode;
    document.getElementById('view-grid')?.classList.toggle('active', mode === 'grid');
    document.getElementById('view-list')?.classList.toggle('active', mode === 'list');
    this.loadBusinesses();
  }

  async loadStats() {
    try {
      const response = await fetch('/api/legacy/stats');
      const stats = await response.json();
      document.getElementById('total-businesses')?.append?.(stats.total_businesses?.toLocaleString?.() ?? stats.total_businesses);
      document.getElementById('total-businesses').textContent = stats.total_businesses.toLocaleString();
      document.getElementById('phone-coverage').textContent = stats.phone_coverage + '%';
      document.getElementById('social-coverage').textContent = stats.social_coverage + '%';
      document.getElementById('review-coverage').textContent = stats.review_coverage + '%';
      document.getElementById('website-coverage').textContent = stats.website_coverage + '%';
      const avgScore = (stats.avg_intelligence_score && stats.avg_intelligence_score > 0)
        ? stats.avg_intelligence_score
        : stats.avg_rating;
      document.getElementById('avg-score').textContent = avgScore?.toFixed ? avgScore.toFixed(1) : avgScore;
      document.getElementById('loaded-file').textContent = stats.loaded_file || 'Database';
    } catch (e) {
      console.error('stats failed', e);
    }
  }

  async loadCategories() {
    try {
      const respPresent = await fetch('/api/legacy/categories');
      const present = await respPresent.json();
      this.categories = Array.isArray(present) ? present : [];

      try {
        const respKnown = await fetch('/api/legacy/categories_known');
        if (respKnown.ok) this.knownCategories = await respKnown.json();
        else this.knownCategories = this.categories.slice();
      } catch {
        this.knownCategories = this.categories.slice();
      }

      const select = document.getElementById('category-filter');
      if (!select) return;
      while (select.children.length > 1) select.removeChild(select.lastChild);
      this.categories.forEach((category) => {
        const option = document.createElement('option');
        option.value = (category || 'Unknown').toLowerCase();
        option.textContent = category || 'Unknown';
        select.appendChild(option);
      });
    } catch (e) {
      console.error('categories failed', e);
    }
  }

  async loadBusinesses() {
    try {
      const params = new URLSearchParams({
        search: this.filters.search,
        category: this.filters.category,
        min_score: this.filters.minScore,
        verified: this.filters.verified,
        outreach: this.filters.outreach,
        stage: this.filters.stage,
        page: this.currentPage,
        per_page: this.perPage,
        sort_by: this.filters.sortBy,
        sort_dir: this.filters.sortDir,
      });
      const response = await fetch(`/api/legacy/businesses?${params}`);
      const data = await response.json();
      this.renderBusinesses(data.businesses || []);
      this.updateResultsCount(data.total || 0);
      this.renderPagination(data);
    } catch (e) {
      console.error('businesses failed', e);
      document.getElementById('businesses-container').innerHTML = '<div class="col-12"><div class="alert alert-danger">Error loading businesses</div></div>';
    }
  }

  renderBusinesses(businesses) {
    const container = document.getElementById('businesses-container');
    if (!container) return;

    if (businesses.length === 0) {
      container.innerHTML = `
        <div class="col-12 text-center py-5">
          <i class="fas fa-search fa-3x text-muted mb-3"></i>
          <h4 class="text-muted">No businesses found</h4>
          <p class="text-muted">Try adjusting your search criteria</p>
        </div>`;
      return;
    }

    if (this.viewMode === 'grid') {
      container.className = 'row';
      container.innerHTML = businesses.map((b) => this.renderBusinessCard(b)).join('');
    } else {
      container.className = '';
      container.innerHTML = businesses.map((b) => this.renderBusinessListItem(b)).join('');
    }

    businesses.forEach((b) => {
      const el = document.getElementById(`business-${b.id}`);
      if (el) el.addEventListener('click', () => this.showBusinessDetail(b.id));
    });
  }

  renderBusinessCard(b) {
    const tags = (b.services_tags || []).slice(0, 6);
    const servicesTagsHtml = tags.length ? `<div class="mt-2">${tags.map(t => `<span class=\"badge badge-custom me-1 mb-1\">${t}</span>`).join('')}</div>` : '';
    const phones = (b.phones || []).slice(0, 2).map(p => `<span class="contact-item"><i class="fas fa-phone"></i> ${p.number}</span>`).join('');
    const social = (b.social_media || []).slice(0, 3).map(s => `<a href="${s.url}" class="social-link" target="_blank" title="${s.platform}"><i class="fab fa-${this.getSocialIcon(s.platform)}"></i></a>`).join('');
    const websites = (b.websites || []).slice(0, 1).map(w => `<a href="${w.url}" class="social-link" target="_blank" title="Website"><i class="fas fa-globe"></i></a>`).join('');
    const rating = (b.total_reviews > 0 && b.average_rating > 0) ? `<div class="rating-stars" title="${b.average_rating} from ${b.total_reviews} reviews">${this.renderStars(b.average_rating)} <small>(${b.total_reviews} reviews)</small></div>` : '';
    const verifiedBadge = b.verified ? `<span class="badge bg-success position-absolute" style="top:10px; left:10px;"><i class="fas fa-check"></i> Verified</span>` : '';

    return `
      <div class="col-md-6 col-lg-4 mb-4">
        <div class="card business-card h-100" id="business-${b.id}">
          <div class="card-body position-relative">
            ${verifiedBadge}
            <div class="intelligence-score">${Number.isFinite(b.intelligence_score) && b.intelligence_score > 0 ? b.intelligence_score : ''}</div>
            <h5 class="card-title mb-2">${b.name}</h5>
            <p class="card-text text-muted mb-2"><i class="fas fa-tag"></i> ${b.category || ''}</p>
            ${b.address ? `<p class="card-text text-muted mb-2"><i class="fas fa-map-marker-alt"></i> ${b.address}</p>` : ''}
            ${b.email ? `<p class="card-text text-muted mb-2"><i class="fas fa-envelope"></i> ${b.email}</p>` : ''}
            ${phones}
            ${rating}
            <div class="mt-3">${social}${websites}</div>
            ${servicesTagsHtml}
            <div class=\"mt-3\">
              <div class="row text-center">
                <div class="col-3"><small class="text-muted">Phones</small><br><span class="badge bg-success">${b.phones_found || 0}</span></div>
                <div class="col-3"><small class="text-muted">Social</small><br><span class="badge bg-info">${b.social_accounts || 0}</span></div>
                <div class="col-3"><small class="text-muted">Reviews</small><br><span class="badge bg-warning">${b.reviews_found || 0}</span></div>
                <div class="col-3"><small class="text-muted">Sites</small><br><span class="badge bg-secondary">${b.websites_found || 0}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  renderBusinessListItem(b) {
    const tags = (b.services_tags || []).slice(0, 4);
    const servicesTagsHtml = tags.length ? `<div class=\"mt-2\">${tags.map(t => `<span class=\"badge badge-custom me-1 mb-1\">${t}</span>`).join('')}</div>` : '';
    const phone = (b.phones || []).slice(0, 1).map(p => p.number).join(', ');
    const rating = (b.total_reviews > 0 && b.average_rating > 0) ? `<span title="${b.average_rating} from ${b.total_reviews} reviews">${this.renderStars(b.average_rating)}</span> (${b.total_reviews})` : 'No reviews';
    return `
      <div class="card business-card mb-3" id="business-${b.id}">
        <div class="card-body">
          <div class="row align-items-center">
            <div class="col-md-4">
              <h5 class="mb-1">${b.name}</h5>
              <small class="text-muted"><i class="fas fa-tag"></i> ${b.category || ''}</small>
              <div class="intelligence-score position-static mt-2">${b.intelligence_score || ''}</div>
            </div>
            <div class="col-md-3">
              ${b.address ? `<small><i class="fas fa-map-marker-alt"></i> ${b.address}</small><br>` : ''}
              ${phone ? `<small><i class="fas fa-phone"></i> ${phone}</small><br>` : ''}
              ${b.email ? `<small><i class="fas fa-envelope"></i> ${b.email}</small>` : ''}
            </div>
            <div class=\"col-md-2 text-center\"><div class=\"rating-stars small\">${rating}</div>${servicesTagsHtml}</div>
            <div class=\"col-md-3 text-end\">
              <div class="row text-center">
                <div class="col-3"><span class="badge bg-success">${b.phones_found || 0}</span><small class="d-block">Phones</small></div>
                <div class="col-3"><span class="badge bg-info">${b.social_accounts || 0}</span><small class="d-block">Social</small></div>
                <div class="col-3"><span class="badge bg-warning">${b.reviews_found || 0}</span><small class="d-block">Reviews</small></div>
                <div class="col-3"><span class="badge bg-secondary">${b.websites_found || 0}</span><small class="d-block">Sites</small></div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  async showBusinessDetail(id) {
    try {
      document.getElementById('modal-business-name').textContent = 'Loading...';
      document.getElementById('modal-body').innerHTML = '<div class="text-center"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div><p class="mt-2">Loading business details...</p></div>';
      const modal = new bootstrap.Modal(document.getElementById('businessModal'));
      modal.show();
      const response = await fetch(`/api/legacy/business/${id}`);
      const business = await response.json();
      this.renderBusinessDetail(business);
    } catch (e) {
      console.error('detail failed', e);
      document.getElementById('modal-body').innerHTML = '<div class="alert alert-danger">Error loading business details</div>';
    }
  }

  renderBusinessDetail(b) {
    const renderReview = (r) => {
      const stars = r && r.rating ? `<span class=\"rating-stars small\">${this.renderStars(r.rating)}</span>` : '';
      const author = r && r.author ? `<strong>${r.author}</strong>` : '';
      const date = r && r.date ? `<small class=\"text-muted\"> ${new Date(r.date).toLocaleDateString?.() || r.date}</small>` : '';
      const text = r && r.text ? `<div class=\"mt-1\"><small>${this.truncateText(r.text, 300)}</small></div>` : '';
      return `<div class=\"mb-3\">${author} ${date} ${stars}${text}</div>`;
    };
    document.getElementById('modal-business-name').textContent = b.name || '';
    const modalBody = document.getElementById('modal-body');
    const google = b.google || {};
    const reviewList = (google.reviews || []).slice(0, 6);
    const reviewsSection = reviewList.length ? `
      <div class=\"info-section\">
        <h6><i class=\"fas fa-star\"></i> Recent Reviews</h6>
        ${reviewList.map(renderReview).join('')}
      </div>` : '';

    const googleSection = `
      <div class=\"info-section\">
        <h6><i class="fab fa-google"></i> Google</h6>
        ${(google.reviews_count > 0 && google.rating) ? `<p><strong>Google Rating:</strong> <span class="rating-stars">${this.renderStars(google.rating)}</span> <small>(${google.reviews_count})</small></p>` : ''}
        ${google.address ? `<p><i class="fas fa-map-marker-alt"></i> ${google.address}</p>` : ''}
        ${google.phone ? `<p><i class="fas fa-phone"></i> <a href="tel:${google.phone}">${google.phone}</a></p>` : ''}
        ${google.hours_summary ? `<p><i class="fas fa-clock"></i> ${google.hours_summary}</p>` : ''}
        ${google.from_business ? `<div class="mt-2"><strong>From the business:</strong><br><small class="text-muted">${this.truncateText(google.from_business, 300)}</small></div>` : ''}
      </div>`;

    modalBody.innerHTML = `
      <div class="row">
        <div class="col-md-8">
          <div class="info-section">
            <h6><i class="fas fa-info-circle"></i> Basic Information</h6>
            <div class="row">
              <div class="col-md-6">
                <p><strong>Category:</strong> ${b.category || ''}</p>
                ${Number.isFinite(b.intelligence_score) && b.intelligence_score > 0 ? `<p><strong>Intelligence Score:</strong> <span class="badge bg-primary">${b.intelligence_score}/10</span></p>` : ''}
                ${b.email ? `<p><strong>Email:</strong> <a href="mailto:${b.email}">${b.email}</a></p>` : ''}
              </div>
              <div class="col-md-6">
                ${(b.total_reviews > 0 && b.average_rating > 0) ? `<p><strong>Average Rating:</strong> <span class="rating-stars">${this.renderStars(b.average_rating)}</span> <small>(${b.total_reviews} total reviews)</small></p>` : ''}
                ${b.scraped_at ? `<p><strong>Data Updated:</strong> ${new Date(b.scraped_at).toLocaleDateString()}</p>` : ''}
              </div>
            </div>
          </div>

          ${b.address ? `<div class="info-section"><h6><i class="fas fa-map-marker-alt"></i> Addresses</h6><p><i class="fas fa-building"></i> ${b.address}</p></div>` : ''}

          ${(b.phones || []).length ? `<div class=\"info-section\"><h6><i class=\"fas fa-phone\"></i> Phone Numbers</h6>${(b.phones || []).map(p => `<p><i class=\"fas fa-phone\"></i> <a href=\"tel:${p.number}\">${p.number}</a> ${p.location ? ` (${p.location})` : ''} ${p.type ? ` <span class=\\\"badge badge-custom\\\">${p.type}</span>` : ''} ${p.confidence ? `<small class=\\\"text-muted\\\">Confidence: ${Math.round(p.confidence * 100)}%</small>` : ''}</p>`).join('')}</div>` : ''}

          ${(b.services_tags || []).length ? `<div class=\"info-section\"><h6><i class=\"fas fa-cogs\"></i> Services</h6><div>${(b.services_tags||[]).map(t => `<span class=\\\"badge badge-custom me-1 mb-1\\\">${t}</span>`).join('')}</div></div>` : (b.services ? `<div class=\"info-section\"><h6><i class=\"fas fa-cogs\"></i> Services</h6><p>${this.truncateText(b.services, 300)}</p></div>` : '')}
          ${googleSection}
          ${reviewsSection}
        </div>
        <div class="col-md-4">
          ${(b.websites || []).length ? `<div class="info-section"><h6><i class="fas fa-globe"></i> Websites</h6>${b.websites.map(w => `<p><a href=\"${w.url}\" target=\"_blank\" class=\"social-link\"><i class=\"fas fa-external-link-alt\"></i> ${this.getDomainFromUrl(w.url)}</a> ${w.type ? `<br><small class=\"text-muted\">${w.type}</small>` : ''}</p>`).join('')}</div>` : ''}
          ${(b.social_media || []).length ? `<div class="info-section"><h6><i class="fas fa-share-alt"></i> Social Media</h6>${b.social_media.map(s => `<p><a href=\"${s.url}\" target=\"_blank\" class=\"social-link\"><i class=\"fab fa-${this.getSocialIcon(s.platform)}\"></i> ${s.platform}</a> ${s.handle ? `<br><small class=\"text-muted\">${s.handle}</small>` : ''}</p>`).join('')}</div>` : ''}
        </div>
      </div>`;
  }

  updateResultsCount(total) {
    const el = document.getElementById('results-count');
    if (!el) return;
    el.textContent = total === 1 ? '1 business found' : `${(total || 0).toLocaleString()} businesses found`;
  }

  renderPagination(data) {
    const nav = document.getElementById('pagination-nav');
    const pagination = document.getElementById('pagination');
    if (!nav || !pagination) return;
    if ((data.total_pages || 1) <= 1) { nav.style.display = 'none'; return; }
    nav.style.display = 'block';
    pagination.innerHTML = '';

    if (data.page > 1) {
      pagination.innerHTML += `<li class="page-item"><a class="page-link" href="#" data-page="${data.page - 1}">Previous</a></li>`;
    }

    const start = Math.max(1, data.page - 2);
    const end = Math.min(data.total_pages, data.page + 2);

    if (start > 1) {
      pagination.innerHTML += `<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>`;
      if (start > 2) pagination.innerHTML += '<li class="page-item disabled"><span class="page-link">...</span></li>';
    }

    for (let i = start; i <= end; i++) {
      pagination.innerHTML += `<li class="page-item ${i === data.page ? 'active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
    }

    if (end < data.total_pages) {
      if (end < data.total_pages - 1) pagination.innerHTML += '<li class="page-item disabled"><span class="page-link">...</span></li>';
      pagination.innerHTML += `<li class="page-item"><a class="page-link" href="#" data-page="${data.total_pages}">${data.total_pages}</a></li>`;
    }

    if (data.page < data.total_pages) {
      pagination.innerHTML += `<li class="page-item"><a class="page-link" href="#" data-page="${data.page + 1}">Next</a></li>`;
    }

    pagination.querySelectorAll('a[data-page]').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        this.currentPage = parseInt(e.currentTarget.getAttribute('data-page'));
        this.loadBusinesses();
        window.scrollTo(0, 0);
      });
    });
  }

  getSocialIcon(platform) {
    const icons = { facebook: 'facebook-f', twitter: 'twitter', instagram: 'instagram', linkedin: 'linkedin-in', youtube: 'youtube', tiktok: 'tiktok' };
    return icons[(platform || '').toLowerCase()] || 'share-alt';
  }

  renderStars(rating) {
    const r = Math.max(0, Math.min(5, Number(rating) || 0));
    if (r <= 0) return '';
    const full = Math.floor(r);
    const half = (r - full) >= 0.5 && r < 5;
    let stars = '';
    for (let i = 0; i < full; i++) stars += '<i class="fa-solid fa-star"></i>';
    if (half) stars += '<i class="fa-solid fa-star-half-stroke"></i>';
    return stars + ` <span class="text-muted">(${r.toFixed(1)})</span>`;
  }

  truncateText(t, n) { if (!t || t === 'nan') return ''; return t.length <= n ? t : (t.substring(0, n) + '...'); }
  getDomainFromUrl(url) { try { return new URL(url).hostname; } catch { return url; } }
}

document.addEventListener('DOMContentLoaded', () => new BusinessViewer());
