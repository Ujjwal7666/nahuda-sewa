// Photos enhance the hero only after real, successfully decoded dimensions qualify.
for (const photo of document.querySelectorAll('[data-activity-hero-photo]')) {
  const image=photo.querySelector('img');
  const desktop=window.matchMedia('(min-width:700px)');
  let started=false;
  const reject=()=>photo.remove();
  const qualify=()=>{
    if(image.naturalWidth>=1200 && image.naturalHeight>=600) photo.hidden=false;
    else reject();
  };
  const load=()=>{
    if(started || !desktop.matches)return;
    started=true;
    image.addEventListener('load',qualify,{once:true});
    image.addEventListener('error',reject,{once:true});
    image.src=image.dataset.src;
    if(image.complete) image.naturalWidth?qualify():reject();
  };
  desktop.addEventListener('change',load);
  load();
}
