import { Router } from 'express';
import session from 'express-session';
import multer from 'multer';
import { randomBytes } from 'node:crypto';
import { validCsrf, sessionAction } from '../middleware/admin-auth.js';
import { donationText, currencies, receiptCookie, receiptLifetimeMs, validateReceipt, todayInNepal } from '../config/donation.js';
import { AssetError } from '../services/image-assets.js';

export function createDonateRouter(config, {receipts, receiptStore} = {}) {
  const router = Router();
  const paths = ['/donate','/ne/donate'];
  const ready = Boolean(receipts && receiptStore && config.sessionSecret);
  const render = (req,res,options={}) => res.render('public/donate', {
    title:`${donationText[res.locals.locale].title} | ${res.locals.name}`, d:donationText[res.locals.locale], currencies,
    ready, values:{currency:'NPR'}, errors:[], message:'', success:false, csrfToken:req.session?.csrfToken||'',
    submissionToken:req.session?.submissionToken||'', today:todayInNepal(), ...options,
  });
  router.all(paths, (req,res,next) => {res.set('Cache-Control','no-store');next();});
  if (ready) router.all(paths, session({name:'nahuda.donation.sid',secret:config.sessionSecret,store:receiptStore,
    resave:false,saveUninitialized:false,rolling:false,cookie:receiptCookie(config)}));
  router.get(paths, async (req,res) => {
    if (!ready) return render(req,res);
    const success = req.session.receiptSubmitted === true;
    if (!req.session.issuedAt || Date.now()-req.session.issuedAt >= receiptLifetimeMs) await sessionAction(req,'regenerate');
    if (!req.session.csrfToken) req.session.csrfToken=randomBytes(32).toString('hex');
    if (!req.session.submissionToken || success) {
      req.session.submissionToken=randomBytes(32).toString('hex'); req.session.issuedAt=Date.now();
    }
    delete req.session.receiptSubmitted;
    render(req,res,{success});
  });
  const parse=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:1,fields:12,parts:14,fieldSize:8000}}).single('receipt');
  router.post(paths, async (req,res,next) => {
    if (!ready) return render(req,res.status(503),{message:donationText[res.locals.locale].unavailable});
    const limit=await receipts.limit('ip',req.ip);
    if (!limit.allowed) {res.set('Retry-After',String(limit.retryAfter));return render(req,res.status(429),{message:donationText[res.locals.locale].limited});}
    next();
  }, (req,res,next) => parse(req,res,(error) => {
    if (error) return render(req,res.status(400),{message:donationText[res.locals.locale].fileError});
    next();
  }), async (req,res) => {
    const d=donationText[res.locals.locale];
    if (!validCsrf(req) || !req.session.issuedAt || Date.now()-req.session.issuedAt >= receiptLifetimeMs || typeof req.body?._submission !== 'string' || req.body._submission !== req.session.submissionToken) return render(req,res.status(403),{message:d.expired});
    const {values,errors,data}=validateReceipt(req.body);
    if (req.body.website || Date.now()-req.session.issuedAt<2000) return render(req,res.status(400),{values,message:d.slow});
    if (!req.file) errors.push('file');
    if (errors.length) return render(req,res.status(400),{values,errors});
    const limit=await receipts.limit('email',data.email);
    if (!limit.allowed) {res.set('Retry-After',String(limit.retryAfter));return render(req,res.status(429),{values,message:d.limited});}
    try {await receipts.save(data,req.file,req.session.submissionToken);}
    catch(error) {
      if (!(error instanceof AssetError)) throw error;
      return render(req,res.status(400),{values,message:d.fileError});
    }
    req.session.receiptSubmitted=true;
    await sessionAction(req,'save');
    res.redirect(303,res.locals.donateUrl+'#receipt');
  });
  return router;
}
