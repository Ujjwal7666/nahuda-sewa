// Progressive image states: links remain usable when JavaScript is unavailable.
for(const image of document.querySelectorAll('.gallery-load-image')) {
  const shell=image.closest('[data-image-shell]');
  const ready=()=>{shell.classList.add(image.naturalWidth?'is-loaded':'is-broken');};
  shell.classList.add('is-loading');
  image.addEventListener('load',ready,{once:true});
  image.addEventListener('error',()=>shell.classList.add('is-broken'),{once:true});
  if(image.complete) ready();
}
const dialog=document.querySelector('[data-gallery-lightbox]');
const links=[...document.querySelectorAll('[data-gallery-photo]')];
if(dialog && links.length && typeof dialog.showModal==='function') {
  const image=dialog.querySelector('[data-lightbox-image]'),fallback=dialog.querySelector('[data-lightbox-fallback]');
  const caption=dialog.querySelector('[data-lightbox-caption]'),credit=dialog.querySelector('[data-lightbox-credit]'),counter=dialog.querySelector('[data-lightbox-counter]');
  const thumbs=[...dialog.querySelectorAll('[data-lightbox-thumb]')];
  const previous=dialog.querySelector('[data-lightbox-prev]'),next=dialog.querySelector('[data-lightbox-next]'),close=dialog.querySelector('[data-lightbox-close]');
  let current=0,opener,scrollY=0,previousBodyStyle='',touchStart,locked=false,closing=false;
  const restore=()=> {
    if(!locked) return;
    locked=false;document.body.setAttribute('style',previousBodyStyle);
    window.scrollTo(0,scrollY);opener?.focus({preventScroll:true});
  };
  const show=index=> {
    current=(index+links.length)%links.length;
    const link=links[current];
    image.classList.remove('is-ready');fallback.hidden=true;image.hidden=false;
    image.alt=link.querySelector('img').alt;image.src=link.href;
    caption.textContent=link.dataset.caption;caption.hidden=!caption.textContent;
    credit.textContent=link.dataset.credit;credit.hidden=!credit.textContent;
    counter.textContent=`${current+1} / ${links.length}`;
    thumbs.forEach((thumb,index)=>thumb.setAttribute('aria-pressed',String(index===current)));
    thumbs[current].scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
    // Only neighboring photos are eagerly prepared; the rest stay lazy.
    for(const index of new Set([(current+1)%links.length,(current+links.length-1)%links.length])) {
      if(index!==current) {const adjacent=new Image();adjacent.src=links[index].href;}
    }
  };
  image.addEventListener('load',()=>image.classList.add('is-ready'));
  image.addEventListener('error',()=>{image.hidden=true;fallback.hidden=false;});
  previous.hidden=next.hidden=links.length===1;
  links.forEach((link,index)=>link.addEventListener('click',event=> {
    if(event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();opener=link;scrollY=window.scrollY;previousBodyStyle=document.body.getAttribute('style')||'';locked=true;
    const scrollbar=window.innerWidth-document.documentElement.clientWidth;
    const padding=parseFloat(getComputedStyle(document.body).paddingRight)||0;
    document.body.style.position='fixed';document.body.style.top=`-${scrollY}px`;document.body.style.width='100%';
    document.body.style.paddingRight=`${padding+scrollbar}px`;
    dialog.showModal();show(index);close.focus();
  }));
  const dismiss=()=> {
    if(closing) return;closing=true;dialog.classList.add('is-closing');
    const finish=()=>{dialog.close();dialog.classList.remove('is-closing');closing=false;restore();};
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) finish();
    else window.setTimeout(finish,200);
  };
  close.addEventListener('click',dismiss);
  dialog.addEventListener('close',restore);
  dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss();});
  dialog.addEventListener('click',event=>{if(event.target===dialog) {const box=dialog.getBoundingClientRect();if(event.clientX<box.left || event.clientX>box.right || event.clientY<box.top || event.clientY>box.bottom) dismiss();}});
  previous.addEventListener('click',()=>show(current-1));next.addEventListener('click',()=>show(current+1));
  thumbs.forEach((thumb,index)=>thumb.addEventListener('click',()=>show(index)));
  dialog.addEventListener('keydown',event=> {
    if(event.key==='ArrowLeft' || event.key==='ArrowRight') {event.preventDefault();show(current+(event.key==='ArrowLeft'?-1:1));}
    if(event.key==='Escape') {event.preventDefault();dismiss();}
    if(event.key==='Tab') {
      const focusable=[...dialog.querySelectorAll('button:not([hidden])')].filter(button=>!button.disabled);
      const first=focusable[0],last=focusable.at(-1);
      if(event.shiftKey && document.activeElement===first) {event.preventDefault();last.focus();}
      else if(!event.shiftKey && document.activeElement===last) {event.preventDefault();first.focus();}
    }
  });
  const stage=dialog.querySelector('.gallery-lightbox-stage');
  stage.addEventListener('touchstart',event=>{if(event.touches.length===1) touchStart={x:event.touches[0].clientX,y:event.touches[0].clientY};},{passive:true});
  stage.addEventListener('touchend',event=>{if(!touchStart) return;const end=event.changedTouches[0],dx=end.clientX-touchStart.x,dy=end.clientY-touchStart.y;touchStart=null;if(Math.abs(dx)>50 && Math.abs(dx)>Math.abs(dy)*1.5) show(current+(dx<0?1:-1));},{passive:true});
  stage.addEventListener('touchcancel',()=>{touchStart=null;});
}
