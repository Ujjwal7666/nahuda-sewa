import {mediaModules,dateInput} from '../config/media-content.js';
import {contentText} from '../config/fixed-content.js';
import {assetUrl} from '../services/organization-settings.js';
import {notFound} from '../middleware/errors.js';
export function mediaContentController(content,key,detail=false) {
  return async(req,res)=> {
    const row=detail && content?await content.publishedNews(req.params.slug):null;
    if(detail && !row) return notFound(req,res);
    const rows=!detail && content?await content.list(mediaModules[key],true):[];
    const formatDate=value=>value?new Intl.DateTimeFormat(res.locals.locale==='ne'?'ne-NP':'en-GB',{dateStyle:'long',timeZone:'UTC'}).format(value):'';
    const heading=detail?contentText(row,'title',res.locals.locale):res.locals.t[key];
    res.render('public/media-content',{title:heading+' | '+res.locals.organization.name,heading,key,row,rows,contentText,assetUrl,dateInput,formatDate,labels:res.locals.locale==='ne'?{intro:'हाम्रो संस्थाका समाचार तथा नयाँ जानकारी।',published:'प्रकाशित',empty:'थप जानकारी यहाँ चाँडै उपलब्ध हुनेछ।',read:'पूरा पढ्नुहोस्',back:'समाचारमा फर्कनुहोस्',images:'तस्बिरहरू',noImages:'यस एल्बममा तस्बिरहरू चाँडै उपलब्ध हुनेछन्।'}:{intro:'Stories and updates from our organization.',published:'Published',empty:'Information will be available here soon.',read:'Read more',back:'Back to news',images:'Images',noImages:'Images will be available in this album soon.'}});
  };
}
