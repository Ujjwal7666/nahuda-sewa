import { Router } from 'express';

// Inherits central Admin authentication, bounded parsing and CSRF protection.
export function createContactAdminRouter(messages) {
  const router=Router();
  router.use((req,res,next)=>{
    if (!messages) return res.status(503).render('admin/request-error',{title:'Messages unavailable',message:'Contact / Feedback management is not configured.'});
    next();
  });
  router.get('/',async(req,res)=>{
    const page=typeof req.query.page==='string' && /^[1-9]\d{0,4}$/.test(req.query.page)?Number(req.query.page):1;
    const status=['NEW','READ'].includes(req.query.status)?req.query.status:'';
    res.render('admin/contact-messages',{title:'Contact / Feedback | Nahuda Sewa',section:'Messages',page,status,...await messages.list(page,status)});
  });
  router.param('id',async(req,res,next,value)=>{
    if (!/^[1-9]\d{0,9}$/.test(value) || Number(value)>2147483647) return res.sendStatus(404);
    req.contactMessage=await messages.find(Number(value));
    if (!req.contactMessage) return res.sendStatus(404);
    next();
  });
  router.get('/:id',(req,res)=>res.render('admin/contact-message',{title:'Contact / Feedback message | Nahuda Sewa',section:'Messages',entry:req.contactMessage,saved:req.query.saved==='1'}));
  router.post('/:id/status',async(req,res)=>{
    if (req.body.status!=='READ') return res.status(400).render('admin/request-error',{title:'Invalid status',message:'Use Mark as Read to update this message.'});
    if (!await messages.markRead(req.contactMessage.id)) return res.sendStatus(404);
    res.redirect(303,`/admin/messages/contact-feedback/${req.contactMessage.id}?saved=1`);
  });
  return router;
}
