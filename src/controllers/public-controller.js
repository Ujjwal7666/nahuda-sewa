import {serviceShowcase} from '../services/service-showcase.js';
import {contentText} from '../config/fixed-content.js';
import {serviceLabels} from '../config/services.js';
import {assetUrl} from '../services/organization-settings.js';
import {contactText} from '../config/contact.js';
import {homeLabels,homeExcerpt} from '../config/home.js';
import {dateInput} from '../config/media-content.js';
import {programExcerpt,programLabels} from '../config/programs.js';

export function showFoundation(content,fixedContent) {
  return async(req,res)=> {
    const [serviceGroups,about,highlights,ourWork]=await Promise.all([
      serviceShowcase(content),
      fixedContent?fixedContent.homeAbout():null,
      content?.homeHighlights?content.homeHighlights():{news:[],albums:[],testimonials:[]},
      content?.homePrograms?content.homePrograms():[],
    ]);
    const {locale,publicOrigin,organization}=res.locals;
    res.render('public/foundation',{serviceGroups,about,...highlights,ourWork,home:homeLabels[locale],homeExcerpt,programExcerpt,programLabels:programLabels[locale],
      serviceLabels:serviceLabels[locale],contactLabels:contactText[locale],contentText,assetUrl,dateInput,
      title:organization.site_title||organization.name,
      seo:{description:organization.site_description||homeExcerpt(contentText(about,'introduction',locale),160,locale),canonical:publicOrigin+(locale==='ne'?'/ne':'/'),en:publicOrigin+'/',ne:publicOrigin+'/ne'},
      formatDate:value=>value?new Intl.DateTimeFormat(locale==='ne'?'ne-NP':'en-GB',{dateStyle:'long',timeZone:'UTC'}).format(value):'',
    });
  };
}
