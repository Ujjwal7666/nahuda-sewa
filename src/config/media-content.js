import {programModule,validateProgram} from './programs.js';
import {sanitizeActivityHtml} from './activity-rich-text.js';
import {validateContent, positiveId} from './fixed-content.js';
import {serviceModules} from './services.js';
export {positiveId};
const pairs = entries => entries.flatMap(([key,label,max,optional=false]) => ['en','ne'].map(lang=>({key:`${key}_${lang}`,label:`${label} ${lang.toUpperCase()}`,lang,max,optional,multiline:max>500})));
export const mediaModules = {
  programs:programModule,
  programImage:{model:'programImage',label:'Our Work images',parent:'programs',parentKey:'program_id',childPath:'images',asset:'image',requiredImage:true,ordered:true,fields:pairs([['caption','Caption',1000,true],['alt_text','Image description (falls back to Our Work title)',500,true]])},
  news:{model:'news',label:'News & Updates',path:'/admin/news',publicPath:'/news',news:true,asset:'featured_image',date:'published_date',fields:pairs([['title','Title',200],['summary','Summary',1000],['content','Content',10000,true]])},
  gallery:{model:'galleryAlbum',label:'Gallery albums',path:'/admin/gallery',publicPath:'/gallery',visibility:true,asset:'cover_image',date:'date',fields:pairs([['title','Title',200],['description','Description',10000,true]])},
  testimonials:{model:'testimonial',label:'Testimonials',path:'/admin/testimonials',publicPath:'/testimonials',visibility:true,ordered:true,asset:'photo',fields:pairs([['name','Name',200],['position_organization','Position / Organization',200,true],['testimonial','Testimonial',10000]])},
  newsImage:{model:'newsImage',label:'Additional news image',parent:'news',parentKey:'news_id',asset:'media',requiredImage:true,ordered:true,fields:pairs([['alt_text','Image description',500]])},
  galleryImage:{model:'galleryImage',label:'Album image',parent:'gallery',parentKey:'album_id',asset:'image',requiredImage:true,ordered:true,fields:pairs([['caption','Caption',1000,true],['alt_text','Image description',500],['credit','Credit / Source',200,true]])},
};
export const galleryBatchLimit=5;
Object.assign(mediaModules,serviceModules);
export const safeSlug = value => typeof value==='string' && value.length<=120 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
export const dateInput = value => value instanceof Date ? value.toISOString().slice(0,10) : typeof value==='string'?value:'';
export function parseEditorialDate(value) {
  if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value<'1900-01-01' || value>'9999-12-31') return null;
  const date=new Date(value+'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && dateInput(date)===value ? date : null;
}
export function validateMediaContent(module,body={}) {
  if(module.program) {
    body={...body};
    for(const lang of ['en','ne']) {
      const combined=body['additional_combined_'+lang];
      if(combined!==undefined) {
        const rich=body.additional_format==='HTML';
        const lines=typeof combined==='string'?combined.replace(/\r\n/g,'\n').split('\n'):null;
        body['additional_heading_'+lang]=rich?'':lines?lines.shift():combined;
        body['additional_content_'+lang]=rich?combined:lines?lines.join('\n'):combined;
      }
    }
  }
  const {values,errors}=validateContent({...module,singleton:!module.ordered},body);
  if(module.service || module.slug) {
    values.slug=typeof body.slug==='string'?body.slug:'';
    if(!safeSlug(values.slug)) errors.push({key:'slug',message:'Use a unique lowercase slug with letters, numbers and single hyphens (maximum 120).'});
  }
  if(module.service) {
    if(body.description_format!==undefined) {
      values.description_format=body.description_format;
      if(!['PLAIN','HTML'].includes(body.description_format)) errors.push({key:'description_format',message:'Choose a valid description format.'});
    }
    if(body.image_position!==undefined) {
      values.image_position=body.image_position;
      if(!['DEFAULT','LEFT','RIGHT','TOP','FULL'].includes(body.image_position)) errors.push({key:'image_position',message:'Choose a valid image position.'});
    }
    if(values.description_format==='HTML') for(const lang of ['en','ne']) values['full_description_'+lang]=sanitizeActivityHtml(values['full_description_'+lang]);
    values.is_featured=body.is_featured==='1';
    if(body.is_featured!==undefined && !['0','1'].includes(body.is_featured)) errors.push({key:'is_featured',message:'Choose Yes or No for Featured.'});
    values.category_id=body.category_id===undefined || body.category_id===''?null:positiveId(body.category_id);
    if(body.category_id!==undefined && body.category_id!=='' && !values.category_id) errors.push({key:'category_id',message:'Choose a valid service category.'});
  }
  if(module.program) validateProgram(values,body,errors);
  if(!module.asset && body.clear_photo!==undefined) errors.push({key:'photo',message:'This form has no image.'});
  if(module.news) {
    values.slug=typeof body.slug==='string'?body.slug:'';
    if(!safeSlug(values.slug)) errors.push({key:'slug',message:'Slug: use lowercase ASCII letters, numbers and single separating hyphens (maximum 120).'});
    values.status=body.status??'DRAFT';
    if(!['DRAFT','PUBLISHED'].includes(values.status)) errors.push({key:'status',message:'Choose Draft or Published.'});
  }
  if(module.date) {
    const input=body[module.date]??'';
    values[module.date]=input===''?null:parseEditorialDate(input);
    if((input!=='' && !values[module.date]) || (module.news && values.status==='PUBLISHED' && !values[module.date])) errors.push({key:module.date,message:'Use a valid Gregorian date (YYYY-MM-DD); Published news requires a date.'});
  }
  if(body.clear_photo!==undefined && !['0','1'].includes(body.clear_photo)) errors.push({key:'photo',message:'Invalid image removal option.'});
  if(module.requiredImage && body.clear_photo==='1') errors.push({key:'photo',message:'Replace or delete this image entry; its image is required.'});
  // All these forms accept an image, using the existing upload/removal field names.
  return {values,errors:errors.filter(error=>!(error.key==='photo' && error.message==='Image removal is not available on this form.'))};
}
