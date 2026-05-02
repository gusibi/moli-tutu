/**
 * MoliTutu — Landing Page JavaScript
 * Handles: i18n, theme, animations, scroll effects, mobile nav, FAQ accordion
 */
(function() {
  'use strict';

  // ======================== STATE ========================
  const state = {
    lang: 'en',
    theme: localStorage.getItem('molitutu-theme') ||
           (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  };

  const SUPPORTED_LANGS = Object.keys(translations);
  const HTML = document.documentElement;
  const BODY = document.body;

  // ======================== DOM REFS ========================
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  // ======================== I18N ========================
  function detectLang() {
    const saved = localStorage.getItem('molitutu-lang');
    if (saved && SUPPORTED_LANGS.includes(saved)) return saved;

    const navLang = navigator.language;
    if (navLang === 'zh-TW' || navLang === 'zh-HK') return 'zh-TW';
    if (navLang.startsWith('zh')) return 'zh-CN';
    if (SUPPORTED_LANGS.includes(navLang)) return navLang;
    // Check short form
    const short = navLang.split('-')[0];
    if (SUPPORTED_LANGS.includes(short)) return short;
    return 'en';
  }

  function setLang(lang) {
    const t = translations[lang] || translations['en'];
    state.lang = lang;
    localStorage.setItem('molitutu-lang', lang);

    // Set all data-i18n elements
    $$('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = getNestedValue(t, key);
      if (val) {
        if (el.tagName === 'META' && el.hasAttribute('content')) {
          el.setAttribute('content', val);
        } else if (el.tagName === 'INPUT' && el.hasAttribute('placeholder')) {
          el.placeholder = val;
        } else {
          el.textContent = val;
        }
      }
    });

    // Document title
    const metaTitle = getNestedValue(t, 'meta.title');
    if (metaTitle) document.title = metaTitle;

    // HTML lang attribute
    HTML.lang = lang;

    // Direction (RTL for Arabic)
    HTML.dir = lang === 'ar' ? 'rtl' : 'ltr';

    // Language selector
    const sel = document.getElementById('lang-select');
    if (sel) sel.value = lang;
  }

  function getNestedValue(obj, path) {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  }

  // ======================== THEME ========================
  function setTheme(theme) {
    state.theme = theme;
    localStorage.setItem('molitutu-theme', theme);

    if (theme === 'dark') {
      HTML.classList.add('dark');
    } else {
      HTML.classList.remove('dark');
    }

    const icon = document.getElementById('theme-icon');
    if (icon) {
      icon.innerHTML = theme === 'dark'
        ? '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>'
        : '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>';
    }
  }

  // ======================== MOBILE NAV ========================
  function toggleMobileNav(open) {
    const nav = document.getElementById('mobile-nav');
    const btn = document.getElementById('mobile-menu-btn');
    if (!nav || !btn) return;

    if (open === undefined) {
      open = !nav.classList.contains('open');
    }
    nav.classList.toggle('open', open);
    btn.classList.toggle('active', open);
    HTML.style.overflow = open ? 'hidden' : '';
  }

  window.closeMobileNav = function() {
    toggleMobileNav(false);
  };

  // ======================== FAQ ACCORDION ========================
  function initFAQ() {
    $$('.faq-trigger').forEach(btn => {
      btn.addEventListener('click', function() {
        const answer = this.nextElementSibling;
        const icon = this.querySelector('.faq-toggle');
        const isOpen = answer.classList.contains('open');

        // Close all
        $$('.faq-answer.open').forEach(a => {
          a.classList.remove('open');
          a.previousElementSibling.setAttribute('aria-expanded', 'false');
          a.previousElementSibling.querySelector('.faq-toggle')?.classList.remove('open');
        });

        if (!isOpen) {
          answer.classList.add('open');
          this.setAttribute('aria-expanded', 'true');
          icon?.classList.add('open');
        }
      });
    });
  }

  // ======================== COUNTER ANIMATION ========================

  function initRevealAnimations() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    // Observe reveal elements
    $$('.reveal').forEach(el => observer.observe(el));
    // Observe stagger containers
    $$('.stagger').forEach(el => observer.observe(el));
  }

  // ======================== BACK TO TOP ========================
  function initBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;

    window.addEventListener('scroll', () => {
      btn.classList.toggle('visible', window.scrollY > 500);
    }, { passive: true });

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }


  // ======================== NAVBAR SCROLL EFFECT ========================
  function initNavbarScroll() {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const nav = document.querySelector('.glass-nav');
          if (nav) {
            nav.style.borderBottomColor = window.scrollY > 20
              ? 'rgba(0,0,0,0.1)'
              : 'rgba(0,0,0,0.06)';
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  // ======================== ACTIVE NAV LINK ========================
  function initActiveNav() {
    const sections = $$('section[id]');
    const navLinks = $$('.nav-link');

    if (!sections.length || !navLinks.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach(link => {
            link.style.color = link.getAttribute('href') === '#' + id
              ? '' : '';
          });
        }
      });
    }, { threshold: 0.3 });

    sections.forEach(s => observer.observe(s));
  }

  // ======================== SETTINGS DETECT ========================
  function initThemeDetect() {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!localStorage.getItem('molitutu-theme')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  // ======================== INIT ========================
  function init() {
    // Detect and set language
    const detectedLang = detectLang();
    setLanguageState(detectedLang);

    // Set theme
    setTheme(state.theme);

    // Event listeners
    bindEvents();

    // Init components
    initFAQ();
    initRevealAnimations();
    initBackToTop();
    initNavbarScroll();
    initActiveNav();
    initThemeDetect();
  }

  function setLanguageState(lang) {
    // We need translations loaded
    setLang(lang);
  }

  function bindEvents() {
    // Language selector
    const langSel = document.getElementById('lang-select');
    if (langSel) {
      langSel.addEventListener('change', (e) => setLang(e.target.value));
    }

    // Theme toggle
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        setTheme(state.theme === 'light' ? 'dark' : 'light');
      });
    }

    // Mobile menu
    const menuBtn = document.getElementById('mobile-menu-btn');
    if (menuBtn) {
      menuBtn.addEventListener('click', () => toggleMobileNav());
    }

    // Close mobile nav on resize
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 768) toggleMobileNav(false);
    });

    // Keyboard: Escape closes mobile nav
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') toggleMobileNav(false);
    });
  }

  // Start on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
