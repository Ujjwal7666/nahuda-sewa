// Suggest a shared URL while authoring; existing URLs and manual choices stay intact.
const newsTitle=document.querySelector('#title_en')||document.querySelector('#name_en');
const newsSlug=document.querySelector('#slug');
if(newsTitle && newsSlug && !newsSlug.readOnly) {
  const suggest=()=>newsTitle.value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120).replace(/-+$/g,'');
  let automatic=!newsSlug.value;
  const update=()=>{if(automatic) newsSlug.value=suggest();};
  newsTitle.addEventListener('input',update);
  newsSlug.addEventListener('input',()=>{automatic=!newsSlug.value;});
  update();
}
