// File previews are progressive enhancement; validation and persistence stay on the server.
for(const form of document.querySelectorAll('[data-gallery-upload]')) {
  const input=form.querySelector('[data-gallery-files]'),grid=form.querySelector('[data-gallery-previews]'),status=form.querySelector('[data-gallery-selection]');
  let urls=[];
  const release=()=>{for(const url of urls) URL.revokeObjectURL(url);urls=[];};
  input.addEventListener('change',()=> {
    release();grid.replaceChildren();input.setCustomValidity('');
    const files=[...input.files],max=Number(input.dataset.maxFiles);
    if(files.length>max) input.setCustomValidity(`Choose up to ${max} photos per upload. Add more in another batch.`);
    else if(files.some(file=>file.size>10*1024*1024 || !['image/png','image/jpeg','image/webp'].includes(file.type))) input.setCustomValidity('Use PNG, JPEG or WebP photos, each up to 10 MB.');
    status.textContent=input.validationMessage||`${files.length} photo${files.length===1?'':'s'} selected.`;
    for(const file of files.slice(0,max)) {
      const card=document.createElement('figure'),caption=document.createElement('figcaption');card.className='gallery-upload-preview';caption.textContent=file.name;
      if(['image/png','image/jpeg','image/webp'].includes(file.type) && file.size<=10*1024*1024) {
        const image=document.createElement('img'),url=URL.createObjectURL(file);urls.push(url);image.src=url;image.alt='Selected photo preview';image.className='gallery-admin-preview';card.append(image);
      }
      card.append(caption);grid.append(card);
    }
  });
  window.addEventListener('pagehide',release);
}
