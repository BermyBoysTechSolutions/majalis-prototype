(() => {
  const story = document.querySelector('.scroll-story');
  const heroCopy = document.querySelector('.hero-copy');
  const heroArt = document.querySelector('.hero-art');
  const panel = document.querySelector('.learning-panel');
  const outro = document.querySelector('.story-outro');
  const cards = [...document.querySelectorAll('.space-item')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const mobileLayout = matchMedia('(max-width: 700px)');
  const effects = [];
  let storyTop = 0;
  let storyDistance = 1;
  let fallback = false;
  let fallbackFrame = 0;
  let resizeFrame = 0;
  let lastState = '';

  const clamp = (n) => Math.min(1, Math.max(0, n));
  const smoothstep = (n) => n * n * (3 - 2 * n);
  const easeOutBack = (n) => 1 + 2.1 * (n - 1) ** 3 + 1.1 * (n - 1) ** 2;
  const progress = () => clamp((scrollY - storyTop) / storyDistance);

  function sceneAt(p) {
    const panelEnter = smoothstep(clamp(p / 0.22));
    const exit = smoothstep(clamp((p - 0.86) / 0.14));
    const copyExit = smoothstep(clamp(p / 0.23));
    const artExit = smoothstep(clamp(p / 0.25));
    return {
      panel: {
        transform: `translate3d(0, calc(${104 * (1 - panelEnter)}% - ${22 * exit}px), 0)`,
        opacity: 1 - exit,
      },
      outro: {
        transform: `translate3d(0, ${18 * (1 - exit)}px, 0)`,
        opacity: exit,
      },
      copy: {
        transform: `translate3d(0, calc(${mobileLayout.matches ? '0%' : '-46%'} - ${copyExit * 30}px), 0)`,
        opacity: 1 - copyExit,
      },
      art: {
        transform: `translate3d(0, calc(-50% - ${artExit * 18}px), 0) scale(${1 - artExit * 0.045})`,
        opacity: 1 - artExit,
      },
      cards: cards.map((_, index) => {
        const raw = clamp((p - 0.21 - index * 0.025) / (0.16 - index * 0.004));
        const bounce = easeOutBack(raw);
        const side = index % 2 === 0 ? -1 : 1;
        return {
          transform: `translate3d(${(1 - bounce) * side * 13}px, ${(1 - bounce) * 42 - exit * 18}px, 0) rotate(${(1 - bounce) * side * 2}deg) scale(${0.82 + bounce * 0.18 - exit * 0.045})`,
          opacity: smoothstep(raw),
        };
      }),
    };
  }

  function updateInteraction() {
    const p = progress();
    const state = `${p < 0.18}:${p > 0.98}:${p > 0.975}:${p > 0.26}:${p < 0.78}`;
    if (state === lastState) return;
    lastState = state;
    const panelHidden = !reducedMotion.matches && (p < 0.18 || p > 0.98);
    panel.inert = panelHidden;
    panel.setAttribute('aria-hidden', `${panelHidden}`);
    const outroHidden = reducedMotion.matches || p <= 0.975;
    outro.inert = outroHidden;
    outro.setAttribute('aria-hidden', `${outroHidden}`);
    outro.style.pointerEvents = outroHidden ? 'none' : 'auto';
    heroCopy.inert = !reducedMotion.matches && p > 0.26;
    heroArt.classList.toggle('is-covered', p > 0.26);
    outro.classList.toggle('is-dormant', p < 0.78);
  }

  function measure() {
    storyTop = story.getBoundingClientRect().top + scrollY;
    storyDistance = Math.max(1, story.offsetHeight - innerHeight);
    updateInteraction();
  }

  function renderFallback() {
    fallbackFrame = 0;
    if (!fallback || reducedMotion.matches) return;
    const scene = sceneAt(progress());
    for (const [element, style] of [[panel, scene.panel], [outro, scene.outro], [heroCopy, scene.copy], [heroArt, scene.art], ...cards.map((card, i) => [card, scene.cards[i]])]) {
      element.style.transform = style.transform;
      element.style.opacity = style.opacity;
    }
  }

  function setupStory() {
    effects.splice(0).forEach((effect) => effect.cancel());
    [panel, outro, heroCopy, heroArt, ...cards].forEach((element) => {
      element.style.removeProperty('transform');
      element.style.removeProperty('opacity');
    });
    fallback = false;
    lastState = '';
    measure();
    if (reducedMotion.matches) {
      document.documentElement.dataset.motionEngine = 'reduced';
      return;
    }
    if ('ViewTimeline' in window) {
      try {
        const timeline = new ViewTimeline({ subject: story, axis: 'block' });
        // Sample easing once. Chrome interpolates these transform/opacity frames
        // on its compositor; scrolling does not run a JavaScript animation loop.
        const frames = Array.from({ length: 257 }, (_, index) => sceneAt(index / 256));
        const targets = [[panel, 'panel'], [outro, 'outro'], [heroCopy, 'copy'], [heroArt, 'art'], ...cards.map((card, index) => [card, index])];
        targets.forEach(([element, key]) => {
          const keyframes = frames.map((frame, index) => ({
            ...(typeof key === 'number' ? frame.cards[key] : frame[key]),
            offset: index / 256,
          }));
          effects.push(element.animate(keyframes, {
            timeline, rangeStart: 'contain 0%', rangeEnd: 'contain 100%',
            fill: 'both', easing: 'linear',
          }));
        });
        document.documentElement.dataset.motionEngine = 'native-scroll';
        return;
      } catch {
        effects.splice(0).forEach((effect) => effect.cancel());
      }
    }
    // Older browsers use cached geometry and direct properties, without
    // inherited CSS variables or layout reads in the scroll render loop.
    document.documentElement.dataset.motionEngine = 'fallback';
    fallback = true;
    renderFallback();
  }

  if (!story || !panel || !outro) return;
  setupStory();
  new ResizeObserver(measure).observe(story);
  addEventListener('scroll', () => {
    updateInteraction();
    if (fallback && !fallbackFrame) fallbackFrame = requestAnimationFrame(renderFallback);
  }, { passive: true });
  addEventListener('resize', () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      measure();
      if (fallback) renderFallback();
    });
  }, { passive: true });
  reducedMotion.addEventListener('change', setupStory);
  mobileLayout.addEventListener('change', setupStory);

  document.querySelectorAll('a[href="#spaces"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (reducedMotion.matches) return;
      event.preventDefault();
      scrollTo({ top: storyTop + storyDistance * 0.48, behavior: 'smooth' });
    });
  });

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => target.classList.toggle('is-visible', isIntersecting));
  }, { threshold: 0.1, rootMargin: '-4% 0px -4% 0px' });
  document.querySelectorAll('.about-copy, .about-visual, .practice-item, .community-content').forEach((element) => {
    element.classList.add('reveal-ready');
    revealObserver.observe(element);
  });

  const ambientObserver = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => target.classList.toggle('motion-paused', !isIntersecting));
  }, { rootMargin: '100px' });
  document.querySelectorAll('.hero-art, .story-outro, .about-visual, .community-section').forEach((element) => ambientObserver.observe(element));
  const syncVisibility = () => document.documentElement.classList.toggle('page-hidden', document.hidden);
  document.addEventListener('visibilitychange', syncVisibility);
  syncVisibility();
})();
