import { Router } from 'express';

// Mounted after the central Admin authentication and CSRF middleware.
export function createReceiptAdminRouter(receipts) {
  const router=Router();
  router.use((req,res,next)=>{
    if (!receipts) return res.status(503).render('admin/request-error',{title:'Receipts unavailable',message:'Receipt management is not configured.'});
    next();
  });
  router.get('/',async(req,res)=>{
    const page=/^[1-9]\d{0,4}$/.test(req.query.page||'1')?Number(req.query.page||1):1;
    const status=['NEW','REVIEWED'].includes(req.query.status)?req.query.status:'';
    res.render('admin/donation-receipts',{title:'Donation Receipts | Nahuda Sewa',section:'Messages',...await receipts.list(page,status),page,status});
  });
  router.param('id',async(req,res,next,value)=>{
    if (!/^[1-9]\d{0,9}$/.test(value)||Number(value)>2147483647) return res.sendStatus(404);
    req.receipt=await receipts.find(Number(value));
    if (!req.receipt) return res.sendStatus(404);
    next();
  });
  router.get('/:id', (req,res)=>res.render('admin/donation-receipt',{title:'Donation Receipt | Nahuda Sewa',section:'Messages',receipt:req.receipt,saved:req.query.saved==='1'}));
  router.get('/:id/file',(req,res)=>{
    if (!receipts.safeKey(req.receipt.receipt_key)) return res.sendStatus(404);
    res.type('png').set('Content-Disposition',`${req.query.download==='1'?'attachment':'inline'}; filename="donation-receipt.png"`);
    res.sendFile(req.receipt.receipt_key,{root:receipts.root,dotfiles:'deny',cacheControl:false},error=>{if(error&&!res.headersSent)res.sendStatus(404);});
  });
  router.post('/:id/status',async(req,res)=>{
    if (!['NEW','REVIEWED'].includes(req.body.status)) return res.status(400).render('admin/request-error',{title:'Invalid status',message:'Choose New or Reviewed.'});
    if (!await receipts.status(req.receipt.id,req.body.status)) return res.sendStatus(404);
    res.redirect(303,`/admin/messages/donation-receipts/${req.receipt.id}?saved=1`);
  });
  return router;
}
