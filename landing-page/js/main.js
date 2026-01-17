document.addEventListener('DOMContentLoaded', () => {
    // State
    const state = {
        lang: 'en',
        theme: 'light'
    };

    // Elements
    const langSelect = document.getElementById('lang-select');
    const themeToggle = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;

    // Supported languages
    const supportedLangs = Object.keys(translations);

    // Initialize Language
    function initLanguage() {
        const browserLang = navigator.language.split('-')[0];
        // Special case for Chinese
        if (navigator.language === 'zh-TW' || navigator.language === 'zh-HK') {
            state.lang = 'zh-TW';
        } else if (navigator.language.startsWith('zh')) {
            state.lang = 'zh-CN';
        } else {
            state.lang = supportedLangs.includes(browserLang) ? browserLang : 'en';
        }

        // Restore from local storage if available
        const savedLang = localStorage.getItem('molitutu-lang');
        if (savedLang && supportedLangs.includes(savedLang)) {
            state.lang = savedLang;
        }

        langSelect.value = state.lang;
        updateText();
    }

    // Initialize Theme
    function initTheme() {
        // Check local storage or system preference
        const savedTheme = localStorage.getItem('molitutu-theme');
        if (savedTheme) {
            state.theme = savedTheme;
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            state.theme = 'dark';
        }

        applyTheme();
    }

    // Apply Theme
    function applyTheme() {
        if (state.theme === 'dark') {
            htmlElement.classList.add('dark');
            themeToggle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>';
        } else {
            htmlElement.classList.remove('dark');
            themeToggle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>';
        }
        localStorage.setItem('molitutu-theme', state.theme);
    }

    // Update Text Content
    function updateText() {
        const t = translations[state.lang];

        // Helper to safe set text
        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        setText('hero-title', t.title);
        setText('hero-subtitle', t.subtitle);
        setText('hero-desc', t.description);
        setText('hero-download', t.download);
        setText('hero-github', t.github);
        setText('footer-text', t.footer);

        // Features
        setText('features-title', t.features.title);
        setText('feat-compression-title', t.features.compression.title);
        setText('feat-compression-desc', t.features.compression.desc);
        setText('feat-upload-title', t.features.upload.title);
        setText('feat-upload-desc', t.features.upload.desc);
        setText('feat-privacy-title', t.features.privacy.title);
        setText('feat-privacy-desc', t.features.privacy.desc);
        setText('feat-proxy-title', t.features.proxy.title);
        setText('feat-proxy-desc', t.features.proxy.desc);

        // How It Works
        setText('how-title', t.howItWorks.title);
        setText('step-1-title', t.howItWorks.step1.title);
        setText('step-1-desc', t.howItWorks.step1.desc);
        setText('step-2-title', t.howItWorks.step2.title);
        setText('step-2-desc', t.howItWorks.step2.desc);
        setText('step-3-title', t.howItWorks.step3.title);
        setText('step-3-desc', t.howItWorks.step3.desc);

        // Advanced
        setText('adv-title', t.advanced.title);
        setText('adv-1-title', t.advanced.batch.title);
        setText('adv-1-desc', t.advanced.batch.desc);
        setText('adv-2-title', t.advanced.history.title);
        setText('adv-2-desc', t.advanced.history.desc);
        setText('adv-3-title', t.advanced.dev.title);
        setText('adv-3-desc', t.advanced.dev.desc);

        // FAQ
        setText('faq-title', t.faq.title);
        setText('faq-1-q', t.faq.q1.q);
        setText('faq-1-a', t.faq.q1.a);
        setText('faq-2-q', t.faq.q2.q);
        setText('faq-2-a', t.faq.q2.a);
        setText('faq-3-q', t.faq.q3.q);
        setText('faq-3-a', t.faq.q3.a);

        // Update document title & meta
        document.title = `${t.title} - ${t.subtitle}`;
        document.documentElement.lang = state.lang;

        // Meta Description
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.name = 'description';
            document.head.appendChild(metaDesc);
        }
        metaDesc.content = t.description;

        // Meta Keywords
        if (t.seo && t.seo.keywords) {
            let metaKw = document.querySelector('meta[name="keywords"]');
            if (!metaKw) {
                metaKw = document.createElement('meta');
                metaKw.name = 'keywords';
                document.head.appendChild(metaKw);
            }
            metaKw.content = t.seo.keywords;
        }

        // Update Direction for Arabic
        if (state.lang === 'ar') {
            htmlElement.dir = 'rtl';
        } else {
            htmlElement.dir = 'ltr';
        }

        localStorage.setItem('molitutu-lang', state.lang);
    }

    // Event Listeners
    langSelect.addEventListener('change', (e) => {
        state.lang = e.target.value;
        updateText();
    });

    themeToggle.addEventListener('click', () => {
        state.theme = state.theme === 'light' ? 'dark' : 'light';
        applyTheme();
    });

    // Run
    initLanguage();
    initTheme();
});
