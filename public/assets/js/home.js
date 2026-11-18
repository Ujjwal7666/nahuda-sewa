// One coordinated entrance per section. Server-rendered content is never hidden.
(() => {
  const root = document.querySelector('.home-page');
  if (!root) return;
  const hoverCategories = window.matchMedia('(hover: hover) and (pointer: fine)');
  for (const category of root.querySelectorAll('.home-category-details')) {
    category.addEventListener('pointerenter', () => {
      if (!hoverCategories.matches || category.open) return;
      category.dataset.hoverOpened = 'true';
      category.open = true;
    });
    category.addEventListener('pointerleave', () => {
      if (category.dataset.hoverOpened !== 'true') return;
      delete category.dataset.hoverOpened;
      if (!category.contains(document.activeElement)) category.open = false;
    });
    category.addEventListener('toggle', () => {
      if (!category.open) delete category.dataset.hoverOpened;
    });
  }
  if (!('IntersectionObserver' in window)) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const running = new Set();
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      if (motion.matches || !entry.target.animate) continue;
      const animation = entry.target.animate(
        [{opacity: .25, transform: 'translateY(14px)'}, {opacity: 1, transform: 'translateY(0)'}],
        {duration: 420, easing: 'cubic-bezier(.2,.65,.3,1)'}
      );
      running.add(animation);
      animation.finished.then(() => running.delete(animation), () => running.delete(animation));
    }
  }, {threshold: .06});
  const stopMotion = () => {
    if (!motion.matches) return;
    observer.disconnect();
    for (const animation of running) animation.cancel();
    running.clear();
  };
  if (!motion.matches) root.querySelectorAll('[data-home-reveal]').forEach(section => observer.observe(section));
  motion.addEventListener('change', stopMotion);
  // Keyboard interaction always takes precedence over a decorative reveal.
  root.addEventListener('focusin', () => { for (const animation of running) animation.finish(); });
})();
