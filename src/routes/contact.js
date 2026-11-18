import { Router, urlencoded } from 'express';
import session from 'express-session';
import { randomBytes } from 'node:crypto';
import { validCsrf, sessionAction } from '../middleware/admin-auth.js';
import { contactText, contactFields, contactLifetimeMs, validateContact } from '../config/contact.js';

export function createContactRouter(config, {messages, contactStore} = {}) {
  const router = Router(), paths = ['/contact','/ne/contact'];
  const ready = Boolean(messages && contactStore && config.sessionSecret);
  const render = (req,res,options={}) => {
    const c = contactText[res.locals.locale], origin = res.locals.publicOrigin;
    return res.render('public/contact',{title:c.title+' | '+res.locals.name,c,fields:contactFields,ready,
      values:{},errors:{},notice:'',success:false,csrfToken:req.session?.csrfToken||'',submissionToken:req.session?.submissionToken||'',
      seo:{canonical:origin+res.locals.localePrefix+'/contact',en:origin+'/contact',ne:origin+'/ne/contact'},...options});
  };
  router.all(paths,(req,res,next)=>{res.set('Cache-Control','no-store');next();});
  if (ready) router.all(paths,session({name:'nahuda.contact.sid',secret:config.sessionSecret,store:contactStore,
    resave:false,saveUninitialized:false,rolling:false,cookie:{httpOnly:true,secure:config.nodeEnv==='production',sameSite:'lax',path:'/',maxAge:contactLifetimeMs}}));
  router.get(paths,async(req,res)=>{
    if (!ready) return render(req,res);
    const success = req.session.contactSubmitted===true;
    if (!req.session.issuedAt || Date.now()-req.session.issuedAt>=contactLifetimeMs) await sessionAction(req,'regenerate');
    if (!req.session.csrfToken) req.session.csrfToken=randomBytes(32).toString('hex');
    if (!req.session.submissionToken || success) {req.session.submissionToken=randomBytes(32).toString('hex');req.session.issuedAt=Date.now();}
    delete req.session.contactSubmitted;
    render(req,res,{success});
  });
  const parse = urlencoded({extended:false,limit:'64kb',parameterLimit:10});
  router.post(paths,async(req,res,next)=>{
    if (!ready) return render(req,res.status(503),{notice:contactText[res.locals.locale].unavailable});
    const limit = await messages.limit('ip',req.ip);
    if (!limit.allowed) {res.set('Retry-After',String(limit.retryAfter));return render(req,res.status(429),{notice:contactText[res.locals.locale].limited});}
    next();
  },(req,res,next)=>parse(req,res,error=>{
    if (error) return render(req,res.status(error.status===413?413:400),{notice:contactText[res.locals.locale].bodyError});
    next();
  }),async(req,res)=>{
    const c = contactText[res.locals.locale];
    if (!validCsrf(req) || !req.session.issuedAt || Date.now()-req.session.issuedAt>=contactLifetimeMs ||
      typeof req.body?._submission!=='string' || req.body._submission!==req.session.submissionToken) return render(req,res.status(403),{notice:c.expired});
    const {values,errors,data}=validateContact(req.body);
    if ((req.body.website!==undefined && req.body.website!=='') || Date.now()-req.session.issuedAt<2000) return render(req,res.status(400),{values,notice:c.slow});
    if (Object.keys(errors).length) return render(req,res.status(400),{values,errors});
    const limit=await messages.limit('email',data.email);
    if (!limit.allowed) {res.set('Retry-After',String(limit.retryAfter));return render(req,res.status(429),{values,notice:c.limited});}
    try { await messages.save(data,req.session.submissionToken); }
    catch {return render(req,res.status(503),{values,notice:c.unavailable});}
    req.session.contactSubmitted=true;
    await sessionAction(req,'save');
    res.redirect(303,res.locals.localePrefix+'/contact#feedback');
  });
  return router;
}
