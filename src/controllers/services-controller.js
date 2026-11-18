import {activityDescription,activityDescriptionText,hasActivityDescription} from '../config/activity-rich-text.js';
import {contentText} from '../config/fixed-content.js';
import {serviceLabels} from '../config/services.js';
import {assetUrl} from '../services/organization-settings.js';
import {notFound} from '../middleware/errors.js';
import {serviceShowcase} from '../services/service-showcase.js';

export function servicesController(content,detail=false,categoryPage=false) {
  return async(req,res)=> {
    const row=detail && content?await content.activeService(req.params.slug):null;
    if(detail && !row) return notFound(req,res);
    const category=categoryPage && content?await content.activeServiceCategory(req.params.slug):null;
    if(categoryPage && !category) return notFound(req,res);
    const groups=!detail && !categoryPage?await serviceShowcase(content):[];
    const rows=category?.services||[];
    const navigationCategory=category || (row?.category?.is_active && content ? await content.activeServiceCategory(row.category.slug) : null);
    const labels=serviceLabels[res.locals.locale];
    const heading=detail?contentText(row,'name',res.locals.locale):categoryPage?contentText(category,'name',res.locals.locale):labels.heading;
    const organization=res.locals.organization;
    // Preserve the existing CTA destination derived from organization contact settings.
    const contactUrl=organization.primary_email?`mailto:${organization.primary_email}`:organization.secondary_email?`mailto:${organization.secondary_email}`:organization.phone?`tel:${organization.phone.replace(/[^+\d]/g,'')}`:organization.whatsapp?`https://wa.me/${organization.whatsapp.replace(/\D/g,'')}`:organization.map_url||null;
    const description=(detail?(contentText(row,'short_description',res.locals.locale)||activityDescriptionText(contentText(row,'full_description',res.locals.locale),row.description_format)):category?contentText(category,'description',res.locals.locale):'')||organization.site_description;
    const suffix=row?'/'+row.slug:category?'/category/'+category.slug:'';
    const path=res.locals.localePrefix+'/services'+suffix;
    const origin=res.locals.publicOrigin;
    res.render('public/services',{title:heading+' | '+organization.name,heading,rows,row,category,navigationCategory,groups,labels,contentText,assetUrl,contactUrl,activityDescription,hasActivityDescription,relatedActivities:(navigationCategory?.services||[]).filter(activity=>activity.id!==row?.id),seo:{description:description.slice(0,500),image:assetUrl(row?.featured_image)||organization.sharing_image,canonical:origin+path,en:origin+'/services'+suffix,ne:origin+'/ne/services'+suffix}});
  };
}
