const intro = document.getElementById('intro');
const skipIntro = document.getElementById('skipIntro');
const header = document.getElementById('siteHeader');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const INTRO_KEY = 'sylviePortfolioIntroSeen_v2';
const forceReplay = new URLSearchParams(window.location.search).get('intro') === '1';
const introTimers = [];
function getIntroSeen() {
  try { return localStorage.getItem(INTRO_KEY) === '1'; }
  catch (_) { return false; }
}
function finishIntro({ markSeen = true } = {}) {
  if (!intro || !intro.classList.contains('is-active')) return;
  const restoreFocus = intro.contains(document.activeElement);
  introTimers.forEach(clearTimeout);
  intro.classList.remove('is-active');
  intro.classList.add('done');
  if (markSeen) {
    try { localStorage.setItem(INTRO_KEY, '1'); }
    catch (_) {}
  }
  if (restoreFocus) document.querySelector('.brand')?.focus({ preventScroll: true });
}
skipIntro?.addEventListener('click', () => finishIntro());
if (intro && !reduceMotion && (!getIntroSeen() || forceReplay)) {
  // Set up the exit before activating the optional opening layer.
  introTimers.push(setTimeout(() => finishIntro({ markSeen: !forceReplay }), 7000));
  intro.classList.add('is-active');
  introTimers.push(setTimeout(() => intro.classList.add('drop-fruit'), 5050));
  introTimers.push(setTimeout(() => intro.classList.add('impact'), 5860));
  introTimers.push(setTimeout(() => intro.classList.add('transitioning'), 5960));
}
window.addEventListener('scroll', () => {
  header?.classList.toggle('scrolled', window.scrollY > 12);
}, { passive: true });
document.querySelector('[data-scroll-video]')?.addEventListener('click', () => {
  const target = document.getElementById('featuredVideo');
  const video = target?.querySelector('video');
  const message = document.getElementById('playbackMessage');
  if (message) message.hidden = true;
  // Play within the click to retain the user gesture on mobile browsers.
  video?.play().catch(() => {
    if (message) {
      message.textContent = '请点击视频里的播放按钮，或使用“单独打开视频”。';
      message.hidden = false;
    }
  });
  target?.scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth', block: 'center' });
});

document.querySelector('[data-open-yueji]')?.addEventListener('click', () => {
  const detail = document.getElementById('yueji-detail');
  if (detail) detail.open = true;
});

document.querySelector('[data-open-miaoxueyuan]')?.addEventListener('click', () => {
  const detail = document.getElementById('miaoxueyuan-detail');
  if (detail) detail.open = true;
});

document.querySelector('[data-open-prompt-forest]')?.addEventListener('click', () => {
  const detail = document.getElementById('prompt-forest-detail');
  if (detail) detail.open = true;
});
