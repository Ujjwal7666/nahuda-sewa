import {serviceLabels} from '../config/services.js';
import {contentText} from '../config/fixed-content.js';
import {programModule,programLabels,programExcerpt,programInformationRows} from '../config/programs.js';
import {activityDescription} from '../config/activity-rich-text.js';
import {assetUrl} from '../services/organization-settings.js';
import {notFound} from '../middleware/errors.js';

export function programsController(content,detail=false) {
  return async(req,res)=>{
    const row=detail && content?await content.activeProgram(req.params.slug):null;
    if(detail && !row)return notFound(req,res);
    const rows=content?await content.list(programModule,true):[];
    const otherWork=rows.filter(item=>item.id!==row?.id);
    const locale=res.locals.locale,labels=programLabels[locale];
    const heading=row?contentText(row,'title',locale):labels.heading;
    const suffix=row?'/'+row.slug:'';
    const origin=res.locals.publicOrigin,organization=res.locals.organization;
    const description=row?programExcerpt(contentText(row,'full_description',locale),row.description_format,locale,400):labels.intro;
    res.render('public/programs',{title:heading+' | '+organization.name,heading,row,rows,labels,otherWork,activityLabels:serviceLabels[locale],contentText,activityDescription,programExcerpt,programInformationRows,assetUrl,seo:{description,image:assetUrl(row?.featured_image)||organization.sharing_image,canonical:origin+res.locals.localePrefix+'/programs'+suffix,en:origin+'/programs'+suffix,ne:origin+'/ne/programs'+suffix}});
  };
}
