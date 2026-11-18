import {modules, contentText, contentLabels} from '../config/fixed-content.js';
import {assetUrl} from '../services/organization-settings.js';
import {youtubeVideo} from '../config/youtube.js';
export function fixedContentController(content,key) {
  return async(req,res)=> {
    const module=modules[key];
    const row=module.singleton && content ? await content.read(module,1,true) : null;
    const vision=key==='about' && content ? await content.read(modules.vision) : null;
    const rows=!module.singleton && key!=='committee' && content ? await content.list(module,true) : [];
    const branches=key==='committee' && content ? await content.committeeBranches() : [];
    const lifeMembers=key==='committee' && content ? await content.list(modules.lifeMembers,true) : [];
    const heading=key==='about'?contentText(row,'heading',res.locals.locale)||res.locals.t.organization:res.locals.t[key];
    if(key==='about') res.set('Content-Security-Policy',"default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; frame-src https://www.youtube-nocookie.com; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    res.render('public/organization-content',{title:`${heading} | ${res.locals.organization.name}`,heading,key,row,rows,branches,lifeMembers,vision,video:youtubeVideo(row?.youtube_url),contentText,assetUrl,labels:contentLabels[res.locals.locale]});
  };
}
