/* ============================================================
   CONTENT — contact link, work catalog
   ============================================================ */
const WHATSAPP_LINK = 'https://wa.me/94783876112';

const CATALOG_ITEMS = [
  {
    name: 'Graphic Designer', order: 1,
    desc: 'Graphic Designer & Photoshop expert specializing in striking photo manipulation, creative portraits, and dynamic visual storytelling.',
    image: 'images/graphic-designer.jpg',
    link: 'https://drive.google.com/drive/folders/1CxHi8clV6A4Qi9uU19Z8gc-y4tFKMzoP?usp=drive_link',
    cta: 'Check it out'
  },
  {
    name: 'UI/UX Designer', order: 2,
    desc: 'UI/UX Designer crafting human centered web & mobile experiences with Figma, design systems and interactive prototyping.',
    image: 'images/ui-ux-designer.jpg',
    link: 'https://drive.google.com/drive/folders/1fcJXDBZ3wVZ45ZMuSQstXKI5UeakMlpG?usp=drive_link',
    cta: 'Check it out'
  },
  {
    name: 'Video Editor', order: 3,
    desc: 'Video Editor & Motion Designer transforming raw footage into visual stories with Adobe After Effects.',
    image: 'images/video-editor.jpg',
    link: 'https://www.tiktok.com/@_azper',
    cta: 'Check it out'
  },
];

/* ============================================================
   WORDS PULL-UP — wraps text into words, reveals them staggered
   on scroll into view. Mirrors the Prisma WordsPullUp component.
   ============================================================ */
function wordsPullUp(el, text, { staggerDelay = 0.08, asterisk = false } = {}) {
  const words = text.split(' ');
  el.innerHTML = '';
  words.forEach((word, i) => {
    const isLast = i === words.length - 1;
    const wrap = document.createElement('span');
    wrap.className = 'pullup-word';
    const inner = document.createElement('span');
    inner.className = 'pullup-inner' + (isLast && asterisk ? ' hero-asterisk' : '');
    inner.style.transitionDelay = `${i * staggerDelay}s`;
    inner.textContent = word;
    wrap.appendChild(inner);
    el.appendChild(wrap);
    if (!isLast) el.appendChild(document.createTextNode('\u00A0'));
  });
  observeReveal(el.querySelectorAll('.pullup-word'));
}

/* Multi-style variant: segments = [{ text, className }], continuous stagger. */
function wordsPullUpMultiStyle(el, segments, { staggerDelay = 0.08 } = {}) {
  el.innerHTML = '';
  let index = 0;
  segments.forEach(seg => {
    seg.text.split(' ').forEach(word => {
      const wrap = document.createElement('span');
      wrap.className = 'pullup-word';
      const inner = document.createElement('span');
      inner.className = `pullup-inner ${seg.className || ''}`;
      inner.style.transitionDelay = `${index * staggerDelay}s`;
      inner.textContent = word;
      wrap.appendChild(inner);
      el.appendChild(wrap);
      index++;
    });
  });
  observeReveal(el.querySelectorAll('.pullup-word'));
}

function observeReveal(nodeList) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '-40px' });
  nodeList.forEach(n => io.observe(n));
}

/* ============================================================
   SCROLL LETTER REVEAL — each character's opacity ramps up as
   the paragraph scrolls through the viewport. Mirrors Prisma's
   AnimatedLetter + useScroll(['start 0.8','end 0.2']) behaviour.
   ============================================================ */
function scrollLetterReveal(el, text) {
  el.innerHTML = '';
  const chars = text.split('');
  const spans = chars.map(ch => {
    const span = document.createElement('span');
    span.className = 'char';
    span.textContent = ch;
    el.appendChild(span);
    return span;
  });

  const total = chars.length;
  let ticking = false;

  function update() {
    ticking = false;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    // 'start 0.8' -> progress 0 when el top hits 80% of viewport height
    // 'end 0.2'   -> progress 1 when el bottom hits 20% of viewport height
    const startY = vh * 0.8;
    const endY = vh * 0.2;
    const progress = Math.min(1, Math.max(0, (startY - rect.top) / (startY - endY + rect.height)));

    spans.forEach((span, i) => {
      const charProgress = i / total;
      const start = Math.max(0, charProgress - 0.1);
      const end = Math.min(1, charProgress + 0.05);
      let t = (progress - start) / (end - start || 1);
      t = Math.min(1, Math.max(0, t));
      span.style.opacity = String(0.2 + t * 0.8);
    });
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
}

/* ============================================================
   360° VIDEO — equirectangular video wrapped on the inside of a
   sphere, inside the hero's rounded container.
   Drag to look around; slow auto-rotate when idle.
   The video file is already trimmed to the 2:10 → 4:25 section
   of the original, so the native loop restarts at 2:10.
   ============================================================ */
const video360 = (function () {
  const zone   = document.getElementById('hero-zone');
  const canvas = document.getElementById('hero-360-canvas');
  const video  = document.getElementById('hero-video');
  if (!zone || !canvas || !video || typeof THREE === 'undefined') return null;

  // ---- settings ----
  const FADE_IN        = 1.6;    // seconds: fade up from black at the start of every loop
  const FADE_OUT       = 0.9;    // seconds: fade down just before the loop restarts
  const AUTO_SPEED     = 0.5;    // degrees/second of idle auto-rotate
  const IDLE_DELAY     = 2500;   // ms after the last interaction before auto-rotate resumes
  const DRAG_SENS      = 0.12;   // degrees of rotation per pixel dragged
  const INITIAL_LON    = 180;    // 180 = centre of the video frame faces the camera
  const INITIAL_LAT    = 0;
  const MIN_HFOV       = 90;     // horizontal field of view, degrees (wider = less zoomed in)
  const reduceMotion   = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- three.js setup ----
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x050505, 1);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1100);

  const texture = new THREE.VideoTexture(video);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const geometry = new THREE.SphereGeometry(500, 64, 40);
  geometry.scale(-1, 1, 1);                       // flip so the video faces inward
  const sphere = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }));
  scene.add(sphere);

  // ---- view state ----
  let lon = INITIAL_LON, lat = INITIAL_LAT;
  let velLon = 0, velLat = 0;                     // drag inertia
  let dragging = false, lastX = 0, lastY = 0, lastInteract = -Infinity;

  function resize() {
    const w = zone.clientWidth, h = zone.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep at least MIN_HFOV across, so portrait phones don't get a tiny slice
    const vfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(MIN_HFOV) / 2) / camera.aspect);
    camera.fov = Math.min(100, THREE.MathUtils.radToDeg(vfov));
    camera.updateProjectionMatrix();
  }
  resize();
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(zone);
  else window.addEventListener('resize', resize);

  // ---- drag to look around (mouse, pen and touch) ----
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY; velLon = velLat = 0;
    lastInteract = performance.now();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    kickVideo();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    velLon = -dx * DRAG_SENS;
    velLat =  dy * DRAG_SENS;
    lon += velLon; lat += velLat;
    lastInteract = performance.now();
  });
  const endDrag = () => { dragging = false; lastInteract = performance.now(); };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // ---- video playback ----
  video.muted = true;
  video.loop = true;                              // native loop: trimmed file restarts at 2:10
  video.playsInline = true;
  function kickVideo() {
    if (video.paused) { const p = video.play(); if (p && p.catch) p.catch(() => {}); }
  }
  kickVideo();
  // some browsers block autoplay until the first gesture
  ['pointerdown', 'touchstart', 'keydown'].forEach((ev) =>
    window.addEventListener(ev, kickVideo, { once: true, passive: true }));

  // ---- only run while the hero is on screen and the tab is visible ----
  let heroVisible = true, running = false, lastT = performance.now();
  function setRunning() {
    const shouldRun = heroVisible && !document.hidden;
    if (shouldRun && !running) {
      running = true; lastT = performance.now(); kickVideo(); requestAnimationFrame(frame);
    } else if (!shouldRun && running) {
      running = false; video.pause();
    }
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => { heroVisible = entries[0].isIntersecting; setRunning(); },
      { threshold: 0.05 }).observe(zone);
  }
  document.addEventListener('visibilitychange', setRunning);

  // ---- render loop ----
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;

    // inertia after release
    if (!dragging && (Math.abs(velLon) > 0.001 || Math.abs(velLat) > 0.001)) {
      lon += velLon; lat += velLat;
      velLon *= 0.92; velLat *= 0.92;
    }
    // idle auto-rotate
    if (!reduceMotion && !dragging && now - lastInteract > IDLE_DELAY) lon += AUTO_SPEED * dt;

    lat = Math.max(-85, Math.min(85, lat));
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon);
    camera.lookAt(
      500 * Math.sin(phi) * Math.cos(theta),
      500 * Math.cos(phi),
      500 * Math.sin(phi) * Math.sin(theta)
    );

    // fade in from black at the start of the clip, and out just before it loops
    const d = video.duration;
    let a = 0;
    if (video.readyState >= 2 && isFinite(d) && d > 0) {
      const t = video.currentTime;
      a = Math.min(1, t / FADE_IN, (d - t) / FADE_OUT);
      a = Math.max(0, a);
      a = a * a * (3 - 2 * a);                    // smoothstep easing
    }
    canvas.style.opacity = a.toFixed(3);

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  setRunning();

  return { video, get lon() { return lon; }, get lat() { return lat; } };
})();

/* ============================================================
   WORK — feature-card catalog, staggered entrance on scroll
   ============================================================ */
(function buildCatalog() {
  const grid = document.getElementById('catalog-grid');
  if (!grid) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '-60px' });

  CATALOG_ITEMS.forEach((p, i) => {
    const card = document.createElement('a');
    card.className = 'feature-card';
    card.href = p.link;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.style.transitionDelay = `${i * 0.15}s`;
    card.innerHTML = `
      <img class="card-img" src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.style.display='none'">
      <h3>${p.name}</h3>
      <span class="checkout-btn">${p.cta}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(-45deg);"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </span>
    `;
    grid.appendChild(card);
    io.observe(card);
  });
})();

/* ============================================================
   ABOUT & CONTACT IMAGES — optional, drop files into an
   "images" folder next to index.html using these filenames.
   ============================================================ */
(function addAboutAndContactImages() {
  const aboutCard = document.querySelector('.about-card');
  if (aboutCard) {
    const img = document.createElement('img');
    img.className = 'about-img';
    img.src = 'images/about-me.jpg';
    img.alt = 'Nirush Madushan';
    img.loading = 'lazy';
    img.onerror = function () { this.style.display = 'none'; };
    aboutCard.insertBefore(img, aboutCard.firstChild);
  }

  const ctaSection = document.querySelector('.cta');
  if (ctaSection) {
    const img = document.createElement('img');
    img.className = 'cta-img';
    img.src = 'images/contact.jpg';
    img.alt = 'Contact';
    img.loading = 'lazy';
    img.onerror = function () { this.style.display = 'none'; };
    ctaSection.insertBefore(img, ctaSection.firstChild);
  }
})();

/* ============================================================
   TEXT CONTENT — wire up the pull-up / scroll-reveal copy
   ============================================================ */
wordsPullUp(document.getElementById('hero-heading'), 'AZPER', { asterisk: true });

wordsPullUpMultiStyle(document.getElementById('about-heading'), [
  { text: 'Hi! I’m Nirush Madushan Aka Azper,', className: 'style-regular' },
  { text: 'a self taught creator.', className: 'style-italic' },
]);

document.getElementById('about-body').textContent =
  'Skilled in Figma, Photoshop and After Effects.I’m always learning from new projects and very adaptive.';

wordsPullUpMultiStyle(document.getElementById('features-line-1'), [
  { text: 'Featured projects', className: 'style-regular' },
]);
wordsPullUpMultiStyle(document.getElementById('features-line-2'), [
  { text: 'across design and motion.', className: 'style-regular' },
]);

/* ============================================================
   NAV ACTIVE STATE
   ============================================================ */
(function navActiveState() {
  const navLinks = Array.from(document.querySelectorAll('.navbar-pill a'));
  const sectionForLink = navLinks.map(link => document.getElementById((link.getAttribute('href') || '').slice(1)));

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const idx = sectionForLink.indexOf(entry.target);
      if (entry.isIntersecting && idx > -1) {
        navLinks.forEach(l => l.classList.remove('active'));
        navLinks[idx].classList.add('active');
      }
    });
  }, { threshold: 0.4 });
  sectionForLink.forEach(s => s && io.observe(s));
})();
