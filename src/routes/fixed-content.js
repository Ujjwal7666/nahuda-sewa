import {Router, urlencoded} from 'express';
import multer from 'multer';
import {requireAdmin, csrfProtection} from '../middleware/admin-auth.js';
import {modules, positiveId, validateContent, statisticKinds} from '../config/fixed-content.js';
import {ContentError} from '../services/fixed-content.js';
import {assetUrl} from '../services/organization-settings.js';

export function createFixedContentRouter(content, module) {
  const router = Router();
  router.use(requireAdmin);
  router.use((req,res,next)=>content ? next() : res.status(503).render('admin/request-error',{title:'Content unavailable',message:'Organization content is not configured.'}));
  if(module === modules.about) router.use('/images',createFixedContentRouter(content,modules.image));
  if(module === modules.about) router.use('/statistics',createFixedContentRouter(content,modules.statistic));
  if(module === modules.committee) router.use('/branches',createFixedContentRouter(content,modules.committeeBranch));
  const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:1,fields:20,parts:21,fieldSize:60000}});
  const parse = module.photo || module.image || module.hero ? upload.single('photo') : upload.none();
  router.use(urlencoded({extended:false,limit:'512kb',parameterLimit:20}));
  router.use((req,res,next)=> {
    if(req.method !== 'POST') return next();
    parse(req,res,error=>error ? res.status(400).render('admin/request-error',{title:'Upload rejected',message:'Use one PNG, JPEG or WebP image, up to 10 MB. Return to the form and choose the file again.'}) : next());
  });
  router.use(csrfProtection);
  const render = async (res,row,values=row||{},errors=[],saved=false,revision=row?.revision||0,images=[]) => res.render('admin/content-form',{title:module.label,section:'Organization',module,row:row||{},values,errors,saved,revision,assetUrl,images,statisticKinds,branches:module===modules.committee?await content.list(modules.committeeBranch):[]});
  const loadImages = async () => module === modules.about ? (await content.read(module))?.images || [] : [];
  if(module.singleton) {
    router.get('/',async(req,res)=>render(res,await content.read(module),undefined,[],req.query.saved==='1',undefined,await loadImages()));
  } else {
    router.get('/',async(req,res)=> {
      if(module.image) return res.redirect(303,modules.about.path);
      if(module===modules.committee) {
        const filter=req.query.branch;
        const branchId=filter==='unassigned'?null:filter===undefined || filter===''?undefined:positiveId(filter);
        if(filter!==undefined && filter!=='' && filter!=='unassigned' && !branchId) return res.status(400).render('admin/request-error',{title:'Invalid branch',message:'Choose a valid branch filter.'});
        return res.render('admin/committee',{title:'Committee',section:'Organization',module,branches:await content.list(modules.committeeBranch),rows:await content.list(module,false,branchId),filter:filter||'',saved:req.query.saved==='1',assetUrl});
      }
      return res.render('admin/content-list',{title:module.label,section:'Organization',module,rows:await content.list(module),assetUrl,saved:req.query.saved==='1'});
    });
    router.get('/new',(req,res)=>render(res,null,module===modules.committee?{branch_id:positiveId(req.query.branch)}:{}));
  }
  router.param('id',(req,res,next,value)=> {
    req.contentId=positiveId(value);
    return req.contentId ? next() : res.status(404).render('admin/request-error',{title:'Not found',message:'Record not found.'});
  });
  if(!module.singleton) {
    router.get('/:id/edit',async(req,res)=> {
      const row = await content.read(module,req.contentId);
      if(!row) return res.status(404).render('admin/request-error',{title:'Not found',message:'Record not found.'});
      return render(res,row);
    });
    router.get('/:id/delete',async(req,res)=> {
      const row=await content.read(module,req.contentId);
      if(!row) return res.status(404).render('admin/request-error',{title:'Not found',message:'Record not found.'});
      res.render('admin/content-delete',{title:'Delete '+module.label,section:'Organization',module,row});
    });
    router.post('/:id/delete',async(req,res)=> {
      if(typeof req.body.revision !== 'string' || !/^[1-9]\d{0,9}$/.test(req.body.revision)) return res.status(400).render('admin/request-error',{title:'Invalid form',message:'Reload the deletion confirmation before trying again.'});
      try {await content.delete(module,req.contentId,req.body);}
      catch(error) {if(!(error instanceof ContentError)) throw error; return res.status(error.status).render('admin/request-error',{title:'Unable to delete',message:error.message});}
      res.redirect(303,(module.image ? modules.about.path : module.path)+'?saved=1');
    });
  }
  router.post(module.singleton ? '/' : ['/', '/:id'],async(req,res)=> {
    const id=module.singleton?1:req.contentId;
    const {values,errors}=validateContent(module,req.body);
    const row=id?await content.read(module,id):null;
    if(id && !row && !module.singleton) return res.status(404).render('admin/request-error',{title:'Not found',message:'Record not found.'});
    if(errors.length) return render(res.status(400),row,values,errors,false,req.body.revision,await loadImages());
    try {await content.save(module,id,values,req.body,req.file);}
    catch(error) {
      if(!(error instanceof ContentError)) throw error;
      return render(res.status(error.status),row,values,[{key:module===modules.committee?'branch_id':module.statistic?'kind':module===modules.committeeBranch?'name_en':'photo',message:error.message}],false,req.body.revision,await loadImages());
    }
    res.redirect(303,(module.image?modules.about.path:module.path)+'?saved=1');
  });
  return router;
}
