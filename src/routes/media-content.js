import {activityDescription,sanitizeActivityHtml} from '../config/activity-rich-text.js';
import {Router,urlencoded} from 'express';
import multer from 'multer';
import {requireAdmin,csrfProtection} from '../middleware/admin-auth.js';
import {mediaModules,positiveId,validateMediaContent,dateInput,galleryBatchLimit} from '../config/media-content.js';
import {AssetError} from '../services/image-assets.js';
import {assetUrl} from '../services/organization-settings.js';

export function createMediaContentRouter(content,module) {
  const router=Router({mergeParams:true});
  const section='Content';
  const fail=(res,status,message)=>res.status(status).render('admin/request-error',{title:'Media content',message});
  router.use(requireAdmin);
  router.use((req,res,next)=>content?next():fail(res,503,'Media content is not configured.'));
  if(module.program) router.use('/:parentId/images',createMediaContentRouter(content,mediaModules.programImage));
  if(module.service) {
    router.use('/:parentId/images',createMediaContentRouter(content,mediaModules.serviceImage));
    router.use('/:parentId/features',createMediaContentRouter(content,mediaModules.serviceFeature));
  } else if(['news','galleryAlbum'].includes(module.model)) router.use('/:parentId/images',createMediaContentRouter(content,module.news?mediaModules.newsImage:mediaModules.galleryImage));
  router.use(async(req,res,next)=> {
    if(module.parent) {
      req.mediaParentId=positiveId(req.params.parentId);
      req.mediaParent=req.mediaParentId?await content.read(mediaModules[module.parent],req.mediaParentId):null;
      if(!req.mediaParent) return fail(res,404,'Parent record not found.');
    }
    req.mediaPath=module.parent?mediaModules[module.parent].path+'/'+req.mediaParentId+'/'+(module.childPath||'images'):module.path;
    if(module.service) res.locals.serviceCategories=await content.list(mediaModules.serviceCategories);
    next();
  });
  if(module===mediaModules.galleryImage) {
    const batchUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:galleryBatchLimit,fields:20,parts:20+galleryBatchLimit,fieldSize:60000}}).array('photos',galleryBatchLimit);
    const renderBatch=(req,res,values={},errors=[])=>res.render('admin/gallery-upload',{title:'Add Album Images',section,path:req.mediaPath,album:req.mediaParent,values,errors,module,galleryBatchLimit});
    router.get('/add',csrfProtection,(req,res)=> {
      const nextOrder=req.mediaParent.images.reduce((next,image)=>Math.max(next,image.display_order+1),0);
      renderBatch(req,res,{alt_text_en:req.mediaParent.title_en,alt_text_ne:req.mediaParent.title_ne,display_order:nextOrder});
    });
    router.post('/batch',(req,res,next)=>batchUpload(req,res,error=>error?fail(res,400,`Upload rejected. Choose up to ${galleryBatchLimit} PNG, JPEG or WebP images, each up to 10 MB.`):next()),csrfProtection,async(req,res)=> {
      const {values,errors}=validateMediaContent(module,req.body);
      if(req.body?.clear_photo!==undefined) errors.push({key:'photos',message:'Image removal is not available during batch upload.'});
      if(errors.length) return renderBatch(req,res.status(400),values,errors);
      try {await content.addGalleryImages(req.mediaParentId,values,req.body,req.files);} catch(error) {if(!(error instanceof AssetError)) throw error;return renderBatch(req,res.status(error.status),values,[{key:'photos',message:error.message}]);}
      res.redirect(303,req.mediaPath+'?saved=1');
    });
  }
  const fieldLimit=module.service?32:20;
  const richForm=module.service || module.program;
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:module.asset?1:0,fields:fieldLimit,parts:fieldLimit+1,fieldSize:richForm?800000:60000}}).single('photo');
  router.use(urlencoded({extended:false,limit:richForm?'2mb':'512kb',parameterLimit:fieldLimit}));
  router.use((req,res,next)=>req.method==='POST'?upload(req,res,error=>error?fail(res,400,'Upload rejected. Use one PNG, JPEG or WebP image up to 10 MB.'):next()):next());
  router.use(csrfProtection);
  router.param('id',(req,res,next,value)=>{req.mediaId=positiveId(value);req.mediaId?next():fail(res,404,'Record not found.');});
  if(module===mediaModules.galleryImage) router.post('/:id/order',async(req,res)=> {
    if(typeof req.body.display_order!=='string' || !/^(0|[1-9]\d{0,5})$/.test(req.body.display_order) || typeof req.body.revision!=='string' || !/^[1-9]\d{0,9}$/.test(req.body.revision) || Number(req.body.revision)>2147483647) return fail(res,400,'Use an order from 0 to 999999 and reload if the image changed.');
    try {await content.reorderGalleryImage(req.mediaId,req.mediaParentId,Number(req.body.display_order),req.body);} catch(error) {if(!(error instanceof AssetError)) throw error;return fail(res,error.status,error.message);}
    res.redirect(303,req.mediaPath+'?saved=1');
  });
  const read=req=>content.read(module,req.mediaId,req.mediaParentId);
  const render=(req,res,row,values=row||{},errors=[],revision=row?.revision||0)=>res.render('admin/media-form',{title:module.label,section,module,path:req.mediaPath,row:row||{},values:module.program?{description_format:'HTML',...values}:values,errors,revision,assetUrl,dateInput,sanitizeActivityHtml});
  if(module.program) router.get('/:id/view',async(req,res)=>{const row=await read(req);return row?res.render('admin/program-view',{title:'View Our Work',section,row,path:req.mediaPath,assetUrl,activityDescription}):fail(res,404,'Record not found.');});
  router.get('/',async(req,res)=>res.render('admin/media-list',{title:module.label,section,module,path:req.mediaPath,rows:await content.list(module,false,req.mediaParentId),assetUrl,dateInput,saved:req.query.saved==='1',parentPath:module.parent?mediaModules[module.parent].path+'/'+req.mediaParentId+'/edit':null}));
  router.get('/new',(req,res)=>render(req,res,null));
  router.get('/:id/edit',async(req,res)=>{const row=await read(req);return row?render(req,res,row):fail(res,404,'Record not found.');});
  router.get('/:id/delete',async(req,res)=>{const row=await read(req);return row?res.render('admin/media-delete',{title:'Delete '+module.label,section,module,path:req.mediaPath,row}):fail(res,404,'Record not found.');});
  router.post('/:id/delete',async(req,res)=> {
    if(typeof req.body.revision!=='string' || !/^[1-9]\d{0,9}$/.test(req.body.revision) || Number(req.body.revision)>2147483647) return fail(res,400,'Reload the deletion confirmation.');
    try {await content.delete(module,req.mediaId,req.body,req.mediaParentId);} catch(error) {if(!(error instanceof AssetError)) throw error;return fail(res,error.status,error.message);}
    res.redirect(303,req.mediaPath+'?saved=1');
  });
  router.post(['/', '/:id'],async(req,res)=> {
    const row=req.mediaId?await read(req):null;
    if(req.mediaId && !row) return fail(res,404,'Record not found.');
    const {values,errors}=validateMediaContent(module,req.body);
    if(errors.length) return render(req,res.status(400),row,values,errors,req.body.revision);
    try {await content.save(module,req.mediaId,values,req.body,req.file,req.mediaParentId);} catch(error) {if(!(error instanceof AssetError)) throw error;return render(req,res.status(error.status),row,values,[{key:module.news?'slug':'photo',message:error.message}],req.body.revision);}
    res.redirect(303,req.mediaPath+'?saved=1');
  });
  return router;
}
