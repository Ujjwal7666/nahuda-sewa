import {sanitizeActivityHtml} from '../config/activity-rich-text.js';
import {mkdir,open,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {uploadRoot} from './organization-settings.js';
import {AssetError,decodeAsset,safeKey} from './image-assets.js';
import {removeUnreferencedMedia} from './media-references.js';
import {mediaModules,safeSlug,galleryBatchLimit} from '../config/media-content.js';
const imageOrder=[{display_order:'asc'},{id:'asc'}];
const includes=module=>({...(module.asset?{[module.asset]:true}:{}),...(['news','galleryAlbum','service','program'].includes(module.model)?{images:{include:{[module.model==='news'?'media':'image']:true},orderBy:imageOrder}}:{}),...(module.service?{category:true,features:{orderBy:imageOrder}}:{})});
const ordering=module=>module.ordered?imageOrder:[{[module.date]:'desc'},{id:'desc'}];
export function mediaContentService(db,directory=uploadRoot) {
  const root=resolve(directory);
  const read=(module,id,parentId)=>db[module.model].findFirst({where:{id,...(module.parent?{[module.parentKey]:parentId}:{})},include:includes(module)});
  async function removeFile(key) {
    if(!safeKey(key)) return;
    try {await unlink(join(root,key));} catch(error) {if(error.code!=='ENOENT') console.error('Media cleanup failed; inspect upload storage.');}
  }
  async function mutate(module,id,values,body,file,parentId,deleting=false) {
    if(file && !module.asset) throw new AssetError('This form does not accept images.');
    if(file && body.clear_photo==='1') throw new AssetError('Choose image replacement or removal, not both.');
    const prepared=file?await decodeAsset(file,{key:'content',label:'Image'}):null;
    let written; const obsolete=[];
    try {
      if(prepared) {
        await mkdir(root,{recursive:true}); const handle=await open(join(root,prepared.metadata.storage_key),'wx'); written=prepared.metadata.storage_key;
        try {await handle.writeFile(prepared.data);} finally {await handle.close();}
      }
      const result=await db.$transaction(async tx=> {
        if(module.parent && !await tx[mediaModules[module.parent].model].findUnique({where:{id:parentId}})) throw new AssetError('Parent record not found.',404);
        const previous=id?await tx[module.model].findFirst({where:{id,...(module.parent?{[module.parentKey]:parentId}:{})},include:includes(module)}):null;
        if(id && !previous) throw new AssetError('Record not found.',404);
        if((previous?.revision||0)!==Number(body.revision)) throw new AssetError('Content changed in another tab. Reload before trying again.',409);
        const data={...values};
        if((module.service || module.program) && !deleting && (data.description_format||previous?.description_format)==='HTML') for(const lang of ['en','ne']) if(typeof data['full_description_'+lang]==='string') data['full_description_'+lang]=sanitizeActivityHtml(data['full_description_'+lang]);
        if(module.program && !deleting && (data.additional_format||previous?.additional_format)==='HTML') for(const lang of ['en','ne']) if(typeof data['additional_content_'+lang]==='string') data['additional_content_'+lang]=sanitizeActivityHtml(data['additional_content_'+lang]);
        if(module.service && !deleting && data.category_id && !await tx.serviceCategory.findUnique({where:{id:data.category_id}})) throw new AssetError('Service category not found.');
        if(module.news && !deleting) {
          if(previous?.slug_locked && data.slug!==previous.slug) throw new AssetError('The slug is locked after publication to preserve shared URLs.',409);
          data.slug_locked=Boolean(previous?.slug_locked || data.status==='PUBLISHED');
        }
        if(module.requiredImage && !previous && !prepared && !deleting) throw new AssetError('Choose an image.');
        if(module.parent) data[module.parentKey]=parentId;
        if(prepared || body.clear_photo==='1' || deleting) {
          if(previous?.[module.asset]) obsolete.push(previous[module.asset]);
          if(!deleting) data[module.asset+'_id']=prepared?(await tx.mediaAsset.create({data:prepared.metadata})).id:null;
        }
        if(deleting && previous.images) {
          const child=module.program?mediaModules.programImage:module.service?mediaModules.serviceImage:module.news?mediaModules.newsImage:mediaModules.galleryImage;
          obsolete.push(...previous.images.map(image=>image[child.asset]));
          await tx[child.model].deleteMany({where:{[child.parentKey]:id}});
          if(module.service) await tx.serviceFeature.deleteMany({where:{service_id:id}});
        }
        let row;
        if(previous) {
          const changed=deleting?await tx[module.model].deleteMany({where:{id,revision:previous.revision}}):await tx[module.model].updateMany({where:{id,revision:previous.revision},data:{...data,revision:{increment:1}}});
          if(changed.count!==1) throw new AssetError('Content changed in another tab. Reload before trying again.',409);
          row={id};
        } else row=await tx[module.model].create({data});
        // Bump the parent revision on image mutations, so stale parent deletes cannot erase new images.
        if(module.parent) await tx[mediaModules[module.parent].model].update({where:{id:parentId},data:{revision:{increment:1}}});
        for(const asset of obsolete) await removeUnreferencedMedia(tx,asset);
        return row;
      });
      for(const asset of obsolete) if(!await db.mediaAsset.findUnique({where:{id:asset.id}})) await removeFile(asset.storage_key);
      return result;
    } catch(error) {
      // A post-commit cleanup/read failure must not delete a committed replacement.
      if(written && !await db.mediaAsset.findUnique({where:{storage_key:written}}).catch(()=>true)) await removeFile(written);
      if(error.code==='P2002') throw new AssetError('That slug already exists. Choose a unique slug.',409);
      if(error.code==='P2003') throw new AssetError('This record is still in use. Remove its relationships first.',409);
      if(['P2034','P2025'].includes(error.code)) throw new AssetError('Content changed in another tab. Reload before trying again.',409);
      throw error;
    }
  }
  async function addGalleryImages(parentId,values,body,files=[]) {
    if(!files.length || files.length>galleryBatchLimit) throw new AssetError(`Choose 1–${galleryBatchLimit} images per upload. Add further batches to the same album.`);
    if(!Number.isInteger(values.display_order) || values.display_order<0 || values.display_order+files.length-1>999999) throw new AssetError('Image display orders must stay between 0 and 999999.');
    // Decode the entire bounded batch before writing anything. One bad photo rejects the batch.
    const prepared=[];
    for(const file of files) prepared.push(await decodeAsset(file,{key:'content',label:'Image'}));
    const written=[];let committed=false;
    try {
      await mkdir(root,{recursive:true});
      for(const image of prepared) {
        const handle=await open(join(root,image.metadata.storage_key),'wx');written.push(image.metadata.storage_key);
        try {await handle.writeFile(image.data);} finally {await handle.close();}
      }
      const rows=await db.$transaction(async tx=> {
        const parent=await tx.galleryAlbum.findUnique({where:{id:parentId}});
        if(!parent) throw new AssetError('Album not found.',404);
        const changed=await tx.galleryAlbum.updateMany({where:{id:parentId,revision:Number(body.revision)},data:{revision:{increment:1}}});
        if(changed.count!==1) throw new AssetError('Album changed in another tab. Reload before uploading.',409);
        const results=[];
        for(const [index,image] of prepared.entries()) {
          const asset=await tx.mediaAsset.create({data:image.metadata});
          results.push(await tx.galleryImage.create({data:{...values,album_id:parentId,image_id:asset.id,display_order:values.display_order+index}}));
        }
        return results;
      });
      committed=true;
      return rows;
    } catch(error) {
      if(!committed) for(const key of written) {
        // Retain any committed reference if database state is uncertain.
        if(!await db.mediaAsset.findUnique({where:{storage_key:key}}).catch(()=>true)) await removeFile(key);
      }
      if(['P2034','P2025'].includes(error.code)) throw new AssetError('Album changed in another tab. Reload before uploading.',409);
      throw error;
    }
  }
  return {read,
    homeHighlights:async()=> {
      const [news,albums,testimonials]=await Promise.all([
        db.news.findMany({where:{status:'PUBLISHED'},include:{featured_image:true},orderBy:[{published_date:'desc'},{id:'desc'}],take:3}),
        db.galleryAlbum.findMany({where:{is_active:true},include:{cover_image:true,images:{take:1,orderBy:imageOrder,include:{image:true}}},orderBy:[{date:'desc'},{id:'desc'}],take:4}),
        db.testimonial.findMany({where:{is_active:true},include:{photo:true},orderBy:imageOrder,take:3}),
      ]);
      return {news,albums,testimonials};
    },
    homePrograms:()=>db.program.findMany({where:{is_active:true},include:{featured_image:true},orderBy:imageOrder,take:4}),
    activeProgram:slug=>safeSlug(slug)?db.program.findFirst({where:{slug,is_active:true},include:includes(mediaModules.programs)}):null,
    activeServices:()=>db.service.findMany({where:{is_active:true},include:{featured_image:true,category:true},orderBy:imageOrder}),
    featuredServices:()=>db.service.findMany({where:{is_active:true,is_featured:true},include:{featured_image:true,category:true},orderBy:imageOrder}),
    activeService:slug=>safeSlug(slug)?db.service.findFirst({where:{slug,is_active:true},include:includes(mediaModules.services)}):null,
    activeServiceCategory:slug=>safeSlug(slug)?db.serviceCategory.findFirst({where:{slug,is_active:true},include:{services:{where:{is_active:true},include:{featured_image:true},orderBy:imageOrder}}}):null,
    galleryOverview:()=>db.galleryAlbum.findMany({where:{is_active:true},include:{cover_image:true,_count:{select:{images:true}},images:{take:1,orderBy:imageOrder,include:{image:true}}},orderBy:[{date:'desc'},{id:'desc'}]}),
    activeAlbum:id=>db.galleryAlbum.findFirst({where:{id,is_active:true},include:includes(mediaModules.gallery)}),
    addGalleryImages,
    reorderGalleryImage:(id,parentId,order,body)=>mutate(mediaModules.galleryImage,id,{display_order:order},body,null,parentId),
    list:(module,publicOnly=false,parentId)=>db[module.model].findMany({where:module.parent?{[module.parentKey]:parentId,...(publicOnly?{[module.parent==='services'?'service':module.parent==='programs'?'program':module.parent==='news'?'news':'album']:module.parent==='news'?{status:'PUBLISHED'}:{is_active:true}}:{})}:publicOnly?module.news?{status:'PUBLISHED'}:{is_active:true}:undefined,include:includes(module),orderBy:ordering(module)}),
    publishedNews:slug=>safeSlug(slug)?db.news.findFirst({where:{slug,status:'PUBLISHED'},include:includes(mediaModules.news)}):null,
    save:(module,id,values,body,file,parentId)=>mutate(module,id,values,body,file,parentId),
    delete:(module,id,body,parentId)=>mutate(module,id,{},body,null,parentId,true),
  };
}
