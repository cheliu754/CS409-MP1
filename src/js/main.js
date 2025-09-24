/* eslint-disable no-console */
console.log('Hello World!');

// helpers
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const on = (el, evt, handler, opts) => el?.addEventListener(evt, handler, opts);
const create = (tag, props = {}) => Object.assign(document.createElement(tag), props);

// Gallery background position (safe no-op if missing)
const positionGalleryBg = () => {
  const gallerySection = $('#gallery');
  const galleryBg = $('.gallery-bg');
  if (!gallerySection || !galleryBg) return;
  galleryBg.style.top = `${gallerySection.offsetTop}px`;
};

on(window, 'resize', positionGalleryBg);
on(window, 'load', positionGalleryBg);

// Smooth scroll with sticky-offset
const smoothScrollTo = (targetEl, offset = 0) => {
  if (!targetEl) return;
  const prefersNoMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const top = targetEl.getBoundingClientRect().top + window.scrollY - offset + 1;
  window.scrollTo({ top, behavior: prefersNoMotion ? 'auto' : 'smooth' });
};

// Navbar + Scroll Indicator
const initNavbar = () => {
  const navbar = $('#navbar');
  const navLinks = $$('#navbar ul li a');
  const indicator = $('#scroll-indicator');

// 页面 section 列表（用于高亮）
  const sections = ['#hero', '#about', '#experience', '#projects', '#skills', '#contact']
    .map(sel => $(sel))
    .filter(Boolean);

  const resizeThreshold = 10;

  const resizeNavbar = () => {
    const shrink = window.scrollY > resizeThreshold;
    navbar.classList.toggle('shrink', shrink);
    document.documentElement.style.setProperty('--nav-scale', shrink ? '0.92' : '1');
  };

  const setActiveLink = () => {
    const navRect = navbar.getBoundingClientRect();
    const bottomLine = navRect.bottom + window.scrollY;
    const scrollBottom = window.scrollY + window.innerHeight;
    const docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);

    // original indicator, but now don't used
    const progress = Math.min(1, scrollBottom / docHeight);
    if (indicator) indicator.style.width = `${progress * 100}%`;

    // 到底部：高亮最后一项
    if (scrollBottom >= docHeight - 1) {
      navLinks.forEach(l => l.classList.remove('active'));
      navLinks[navLinks.length - 1]?.classList.add('active');
      return;
    }

    // find section
    let current = sections[0];
    for (const sec of sections) {
      const secTopDoc = sec.getBoundingClientRect().top + window.scrollY;
      if (secTopDoc <= bottomLine + 1) current = sec;
      else break;
    }

    const id = `#${current.id}`;
    navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === id));
  };

  // 平滑滚动（考虑 sticky 高度）
  navLinks.forEach(a => {
    on(a, 'click', ev => {
      const hash = a.getAttribute('href');
      if (!hash || !hash.startsWith('#')) return;
      ev.preventDefault();

      const target = document.querySelector(hash);
      if (!target) return;

      const navHeight = navbar.getBoundingClientRect().height;
      smoothScrollTo(target, navHeight);

      history.replaceState(null, '', hash); // 地址栏 hash
      // 立即高亮，滚动后 setActiveLink 会再次校正
      navLinks.forEach(l => l.classList.remove('active'));
      a.classList.add('active');
    });
  });

  // 初始与滚动
  resizeNavbar();
  setActiveLink();

  // 使用 rAF 合并回流
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      resizeNavbar();
      setActiveLink();
      ticking = false;
    });
  };
  on(window, 'scroll', onScroll, { passive: true });
};

// Reveal on scroll (IntersectionObserver)
const initReveals = () => {
  const els = $$('.reveal');
  if (!els.length) return;

  const io = new IntersectionObserver(
    entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  els.forEach(el => io.observe(el));

  // 初始轻微延时入场
  setTimeout(() => els.forEach(el => el.classList.add('visible')), 50);
};

// Basic Modal helpers (shared)
const makeModalControls = modalEl => {
  if (!modalEl) return {};
  const closeBtn = $('.close', modalEl);

  const open = () => modalEl.classList.add('open');
  const close = () => modalEl.classList.remove('open');

  on(closeBtn, 'click', close);
  on(modalEl, 'click', e => { if (e.target === modalEl) close(); });
  on(document, 'keydown', e => { if (e.key === 'Escape' && modalEl.classList.contains('open')) close(); });

  return { open, close };
};

// Contact modal
const initContactModal = () => {
  const contactBtn = $('#contactBtn');
  const modal = $('#contactModal');
  if (!contactBtn || !modal) return;

  const { open, close } = makeModalControls(modal);
  on(contactBtn, 'click', open);
  // 暴露给其他地方可能需要时调用
  return { open, close };
};

// Experience detail modal
const initExperienceModal = () => {
  const modal = $('#projectModal');
  if (!modal) return;

  const titleEl = $('#projectTitle');
  const metaEl = $('#projectMeta');
  const bodyEl = $('#projectBody');
  const linkWrap = $('#projectLinkWrap');
  const linkEl = $('#projectLink');

  const { open, close } = makeModalControls(modal);

  const render = ({ title = 'Experience', meta = '', paragraphs = [], desc = '', link, linkText = 'More info' }) => {
    titleEl.textContent = title;

    metaEl.textContent = meta;
    metaEl.style.display = meta ? '' : 'none';

    bodyEl.innerHTML = '';
    const lines = paragraphs?.length ? paragraphs : (desc ? [desc] : []);
    lines.filter(Boolean).forEach(t => bodyEl.appendChild(create('p', { textContent: t })));

    if (link) {
      linkEl.href = link;
      linkEl.textContent = linkText;
      linkWrap.style.display = '';
    } else {
      linkWrap.style.display = 'none';
    }
  };

  const extractFromCard = card => {
    const title = $('.xp-title', card)?.textContent?.trim() || 'Experience';
    const desc = $('.xp-desc', card)?.textContent?.trim() || '';
    return { title, desc, paragraphs: [desc] };
  };

  // 每个 xp-item 可点击 + 键盘可用
  $$('#experience .xp-item').forEach(card => {
    card.style.cursor = 'pointer';
    card.tabIndex = 0;

    const openFromCard = () => {
      render(extractFromCard(card));
      open();
    };

    on(card, 'click', openFromCard);
    on(card, 'keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openFromCard();
      }
    });
  });

  return { open, close };
};

// Projects carousel (vanilla)
const initCarousel = () => {
  const root = $('#projects .carousel');
  if (!root) return;

  // 复用或创建结构
  let viewport = $('.viewport', root);
  let track = $('.track', root);

  if (!viewport || !track) {
    viewport = create('div', { className: 'viewport' });
    track = create('div', { className: 'track' });

    // 把现有 .slide 包进 track
    $$('.slide', root).forEach(s => track.appendChild(s));
    viewport.appendChild(track);
    root.insertBefore(viewport, root.firstChild);
  }

  const slides = $$('.slide', track);
  if (!slides.length) return;

  const prevBtn = $('.prev', root);
  const nextBtn = $('.next', root);

  // 创建或复用圆点容器（居中）
  let dotsWrap = $('.dots', root);
  if (!dotsWrap) {
    dotsWrap = create('div', { className: 'dots' });
    slides.forEach((_, i) => {
      const dot = create('button', { type: 'button', ariaLabel: `Go to slide ${i + 1}` });
      on(dot, 'click', () => go(i));
      dotsWrap.appendChild(dot);
    });
    root.appendChild(dotsWrap);
  }

  const dots = $$('button', dotsWrap);
  let index = 0;

  const update = () => {
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === index));
  };

  const go = i => {
    index = (i + slides.length) % slides.length;
    update();
  };

  on(prevBtn, 'click', () => go(index - 1));
  on(nextBtn, 'click', () => go(index + 1));
  on(document, 'keydown', e => {
    if (e.key === 'ArrowLeft') go(index - 1);
    if (e.key === 'ArrowRight') go(index + 1);
  });

  update();
  // 可选自动播放：
  // setInterval(() => go(index + 1), 6000);
};

// Bootstrap on DOM ready
on(document, 'DOMContentLoaded', () => {
  positionGalleryBg();
  initNavbar();
  initReveals();
  initCarousel();
  initContactModal();
  initExperienceModal();
});
