import {activityDescriptionText,hasActivityDescription,sanitizeActivityHtml} from './activity-rich-text.js';
import {homeExcerpt} from './home.js';

const pairs=(key,label,max,optional,group,richText=false)=>['en','ne'].map(lang=>({key:`${key}_${lang}`,label:`${label} ${lang.toUpperCase()}`,lang,max,optional,group,multiline:max>500,...(richText?{richText:true,preserveWhitespace:true,maxBytes:800000}:{})}));
export const programModule={model:'program',label:'Our Work',path:'/admin/programs',publicPath:'/programs',program:true,slug:true,visibility:true,ordered:true,asset:'featured_image',fields:[
  ...pairs('title','Title',200,false,'Basic information'),
  ...pairs('full_description','Full description',200000,false,'Detailed content',true),
  ...pairs('additional_heading','Additional information heading',200,true,'Additional information'),
  ...pairs('additional_content','Additional information content',20000,true,'Additional information'),
]};
export function validateProgram(values,body,errors) {
  values.description_format=body.description_format??'HTML';
  if(!['HTML','PLAIN'].includes(values.description_format)) errors.push({key:'description_format',message:'Choose a valid description format.'});
  values.additional_format=body.additional_format??'PLAIN';
  if(!['HTML','PLAIN'].includes(values.additional_format)) errors.push({key:'additional_format',message:'Choose a valid additional information format.'});
  for(const lang of ['en','ne']) {
    const key=`full_description_${lang}`;
    if(values.description_format==='HTML') values[key]=sanitizeActivityHtml(values[key]);
    if(!hasActivityDescription(values[key],values.description_format) && !errors.some(error=>error.key===key)) errors.push({key,message:`Full description ${lang.toUpperCase()}: enter meaningful content.`});
    if(values.additional_format==='HTML') {
      const content=sanitizeActivityHtml(values['additional_content_'+lang]);
      values['additional_content_'+lang]=hasActivityDescription(content,'HTML')?content:'';
    }
    if(values.additional_format!=='HTML' && Boolean(values[`additional_heading_${lang}`])!==Boolean(values[`additional_content_${lang}`])) errors.push({key:`additional_heading_${lang}`,message:`Additional information ${lang.toUpperCase()}: supply both heading and content, or leave both empty.`});
  }
}
// Decode only entities emitted by the existing sanitizer; the result is always EJS-escaped.
export function programExcerpt(value='',format='HTML',locale='en',limit=220) {
  const spaced=format==='HTML'?value.replace(/<\/?(?:p|div|h[1-6]|li|ul|ol|blockquote|br)\b[^>]*>/gi,' '):value;
  const text=activityDescriptionText(spaced,format).replace(/&(amp|lt|gt);/g,(_match,key)=>({amp:'&',lt:'<',gt:'>'}[key])).replace(/\s+/gu,' ').trim();
  return homeExcerpt(text,limit,locale);
}
export function programInformationRows(value='') {
  return String(value).replace(/\r\n?/g,'\n').split('\n').map(line=>line.trim()).filter(Boolean).map(line=>{
    const separator=line.indexOf(':');
    return separator>0?{label:line.slice(0,separator).trim(),value:line.slice(separator+1).trim()}:{label:'',value:line};
  });
}
export const programLabels={
  en:{other:'Other Our Work',heading:'Our Work',intro:'Explore our work and core activities.',empty:'Our work information will be available here soon.',read:'Learn more',back:'All Our Work',breadcrumb:'Breadcrumb',about:'About Our Work'},
  ne:{other:'हाम्रा अन्य कामहरू',heading:'हाम्रो काम',intro:'हाम्रो काम र मुख्य गतिविधिहरूबारे थप जान्नुहोस्।',empty:'हाम्रो कामबारे जानकारी यहाँ चाँडै उपलब्ध हुनेछ।',read:'थप जान्नुहोस्',back:'हाम्रा सबै कामहरू',breadcrumb:'पृष्ठ मार्ग',about:'हाम्रो कामको बारेमा'},
};
