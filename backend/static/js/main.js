/* ===================== MENU ADMIN — MAIN.JS ===================== */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initPageAnimations();
  initSidebar();
  initTopbarClock();
  initToasts();
  initModals();
  initTableRowAnimations();
  initCounters();
  initFormEnhancements();
});

// ---- Thème clair / sombre ----
function initTheme() {
  const root = document.documentElement;
  const btn = document.getElementById('themeToggle');
  if (!btn) return;

  // Le thème est déjà appliqué par le script anti-flash dans <head>
  btn.addEventListener('click', () => {
    const current = root.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('menu-theme', next);
  });
}

// ---- Page entry animations (GSAP if available, CSS fallback) ----
// Robustesse : on utilise fromTo + clearProps pour qu'après l'animation les
// styles inline (opacity/transform) soient retirés — l'élément reste visible
// via le CSS. Un garde-fou force la visibilité au cas où un tween est
// interrompu (évite les sections qui « apparaissent puis disparaissent »).
const ANIM_SELECTOR = '.kpi-card, .chart-card, .glass-card, .table-wrapper, .page-header';

function forceVisible() {
  document.querySelectorAll(ANIM_SELECTOR).forEach((el) => {
    el.style.opacity = '1';
    el.style.transform = 'none';
  });
}

function initPageAnimations() {
  if (typeof gsap !== 'undefined') {
    const reveal = (sel, opts) => gsap.fromTo(
      sel,
      { opacity: 0, y: opts.y ?? 20 },
      {
        opacity: 1, y: 0, duration: opts.duration ?? 0.5, ease: 'power3.out',
        stagger: opts.stagger, delay: opts.delay ?? 0,
        overwrite: 'auto', clearProps: 'opacity,transform',
      },
    );
    reveal('.page-header', { y: 20 });
    reveal('.kpi-card', { y: 24, stagger: 0.06, delay: 0.1 });
    reveal('.glass-card', { y: 16, stagger: 0.05, delay: 0.15 });
    reveal('.chart-card', { y: 20, duration: 0.55, stagger: 0.08, delay: 0.25 });
    reveal('.table-wrapper', { y: 20, delay: 0.2 });
    // Garde-fou : quoi qu'il arrive, tout est visible après 1,5 s.
    setTimeout(forceVisible, 1500);
  } else {
    document.querySelectorAll(ANIM_SELECTOR).forEach((el, i) => {
      el.style.animation = `fadeInUp 0.5s cubic-bezier(0.4,0,0.2,1) ${i * 0.05}s both`;
    });
  }
}

// ---- KPI counter animation ----
function initCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseFloat(el.dataset.count);
    const isFloat = el.dataset.count.includes('.');
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const duration = 1500;
    const start = performance.now();

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;
      el.textContent = prefix + (isFloat ? current.toFixed(1) : Math.round(current).toLocaleString('fr-FR')) + suffix;
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  });
}

// ---- Sidebar toggle (mobile) ----
function initSidebar() {
  const toggle = document.querySelector('.sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');

  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay?.classList.toggle('active');
    });
    overlay?.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
  }

  // Active nav item highlight
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('href') && currentPath.startsWith(item.getAttribute('href'))) {
      item.classList.add('active');
    }
  });
}

// ---- Topbar live clock ----
function initTopbarClock() {
  const el = document.querySelector('.topbar-time');
  if (!el) return;
  function update() {
    el.textContent = new Date().toLocaleString('fr-FR', {
      weekday: 'short', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }
  update();
  setInterval(update, 1000);
}

// ---- Toast messages ----
function initToasts() {
  const container = document.querySelector('.toast-container');
  if (!container) return;

  // Auto-dismiss Django messages shown as toasts
  container.querySelectorAll('.toast').forEach(toast => {
    setTimeout(() => dismissToast(toast), 4000);
  });
}

function showToast(msg, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const colors = { success: 'var(--accent-green)', error: 'var(--accent-red)', warning: 'var(--accent-amber)' };
  const toast = document.createElement('div');
  toast.className = 'toast glass-card';
  toast.style.cssText = `padding:12px 20px;display:flex;align-items:center;gap:10px;min-width:260px;border-left:3px solid ${colors[type]};`;
  toast.innerHTML = `<span style="color:${colors[type]};font-size:0.875rem;">${msg}</span>
    <button onclick="dismissToast(this.parentElement)" style="margin-left:auto;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1rem;">×</button>`;
  container.appendChild(toast);
  setTimeout(() => dismissToast(toast), 4000);
}

function dismissToast(toast) {
  if (!toast || !toast.parentElement) return;
  if (typeof gsap !== 'undefined') {
    gsap.to(toast, { duration: 0.3, opacity: 0, x: 60, ease: 'power2.in', onComplete: () => toast.remove() });
  } else {
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(60px)';
    setTimeout(() => toast.remove(), 300);
  }
}

// ---- Modal helpers ----
function initModals() {
  document.querySelectorAll('[data-modal-open]').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.modalOpen));
  });
  document.querySelectorAll('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.closest('.modal-backdrop')));
  });
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) closeModal(backdrop);
    });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.active').forEach(closeModal);
    }
  });
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(el) {
  if (el) {
    el.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// ---- Table row stagger animation ----
function initTableRowAnimations() {
  const rows = document.querySelectorAll('tbody tr');
  if (!rows.length) return;
  if (typeof gsap !== 'undefined') {
    gsap.fromTo('tbody tr',
      { opacity: 0, x: -10 },
      {
        opacity: 1, x: 0, duration: 0.35, stagger: 0.03, ease: 'power2.out', delay: 0.3,
        overwrite: 'auto', clearProps: 'opacity,transform',
      },
    );
    // Garde-fou : les lignes restent visibles même si le tween est interrompu.
    setTimeout(() => rows.forEach(tr => { tr.style.opacity = '1'; tr.style.transform = 'none'; }), 1500);
  }
}

// ---- Form enhancements ----
function initFormEnhancements() {
  // Auto-dismiss alerts after 5s
  document.querySelectorAll('.alert').forEach(el => {
    setTimeout(() => {
      el.style.transition = 'opacity 0.4s';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 400);
    }, 5000);
  });

  // File input preview
  document.querySelectorAll('input[type="file"][data-preview]').forEach(input => {
    input.addEventListener('change', () => {
      const preview = document.getElementById(input.dataset.preview);
      if (preview && input.files[0]) {
        preview.src = URL.createObjectURL(input.files[0]);
        preview.style.display = 'block';
      }
    });
  });

  // Commission modal auto-fill
  document.querySelectorAll('[data-commission-rate]').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = document.getElementById('commissionRateInput');
      if (field) field.value = btn.dataset.commissionRate;
    });
  });
}

// ---- Confirm delete helper ----
function confirmDelete(form, name) {
  if (confirm(`Supprimer "${name}" ? Cette action est irréversible.`)) {
    form.submit();
  }
}

// ---- Expose globals ----
window.openModal = openModal;
window.closeModal = closeModal;
window.showToast = showToast;
window.confirmDelete = confirmDelete;
