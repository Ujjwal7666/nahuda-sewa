const menuButton = document.querySelector('[data-menu-toggle]');
const navigation = document.querySelector('#public-navigation');

if (menuButton && navigation) {
  const desktop = window.matchMedia('(min-width: 900px)');
  const setMenu = (open) => {
    navigation.hidden = !open;
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? menuButton.dataset.closeLabel : menuButton.dataset.openLabel);
    if (!open) navigation.querySelectorAll('details[open]').forEach((item) => { item.open = false; });
  };
  const syncViewport = () => { menuButton.hidden = desktop.matches; setMenu(desktop.matches); };
  syncViewport();
  desktop.addEventListener('change', syncViewport);
  menuButton.addEventListener('click', () => setMenu(navigation.hidden));
  navigation.querySelectorAll('.nav-services').forEach(item => {
    item.addEventListener('pointerenter', event => { if (desktop.matches && event.pointerType === 'mouse') item.open = true; });
    item.addEventListener('pointerleave', event => { if (desktop.matches && event.pointerType === 'mouse' && !item.contains(document.activeElement)) item.open = false; });
    item.addEventListener('focusout', event => { if (!item.contains(event.relatedTarget)) item.open = false; });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const openDropdown = navigation.querySelector('details[open]');
    if (openDropdown) {
      openDropdown.open = false;
      openDropdown.querySelector('summary').focus();
    } else if (!desktop.matches && !navigation.hidden) {
      setMenu(false);
      menuButton.focus();
    }
  });
  document.addEventListener('click', (event) => {
    navigation.querySelectorAll('details[open]').forEach((item) => {
      if (!item.contains(event.target)) item.open = false;
    });
  });
}

// Language remains URL-driven. Retain an in-page anchor when switching languages.
document.querySelectorAll('[data-language-link]').forEach((link) => {
  if (window.location.hash) link.hash = window.location.hash;
});

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
// Content stays visible without JavaScript; animate each member once on entry.
const memberCards = document.querySelectorAll('[data-member-card]');
memberCards.forEach(card => {
  const photo = card.querySelector('.member-photo');
  if (!photo) return;
  const showFallback = () => { photo.hidden = true; };
  photo.addEventListener('error', showFallback, {once:true});
  if (photo.complete && !photo.naturalWidth) showFallback();
});
if (memberCards.length && 'IntersectionObserver' in window && !reducedMotion.matches) {
  const observer = new IntersectionObserver(entries => {
    let stagger = 0;
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      if (reducedMotion.matches || !entry.target.animate) return;
      entry.target.animate([{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}], {duration:380,delay:Math.min(stagger++ * 50,150),easing:'ease-out'});
    });
  }, {threshold:0.08});
  memberCards.forEach(card => observer.observe(card));
}
document.querySelectorAll('[data-social-link]').forEach((link) => {
  const animate = () => {
    const icon = link.querySelector('.social-icon');
    if (reducedMotion.matches || !icon?.animate) return;
    icon.getAnimations().forEach(animation => animation.cancel());
    icon.animate([{transform:'translateY(0) rotate(0)'},{transform:'translateY(-3px) rotate(-7deg)'},{transform:'translateY(0) rotate(0)'}],{duration:320,easing:'ease-out'});
  };
  link.addEventListener('pointerenter',animate);
  link.addEventListener('focus',animate);
});
document.querySelectorAll('[data-copy-target]').forEach((button) => {
  if (!navigator.clipboard?.writeText) return;
  button.hidden=false;
  button.addEventListener('click',async()=>{
    const status=document.querySelector('[data-copy-status]');
    try {
      await navigator.clipboard.writeText(document.getElementById(button.dataset.copyTarget).textContent);
      status.textContent=button.dataset.copied;
    } catch {status.textContent=button.dataset.copyFailed;}
  });
});
