import {youtubeVideo} from './youtube.js';
export const statisticKinds = {community_reach:'Community Reach',families_supported:'Families Supported',projects_completed:'Projects Completed',active_volunteers:'Active Volunteers'};
const pairs = (entries) => entries.flatMap(([key, label, max]) => ['en', 'ne'].map(lang => ({key: `${key}_${lang}`, label: `${label} ${lang === 'en' ? 'EN' : 'नेपाली'}`, lang, max, multiline: max > 200})));
export const modules = {
  about: {model: 'aboutOrganization', label: 'About Organization', path: '/admin/organization/about', publicPath: '/about', singleton: true, hero: true, fields: pairs([['heading','Page / Hero heading',200],['introduction','Introduction',10000],['background_history','Background / History',10000],['objectives','Objectives',10000],['core_values','Core Values',10000]])},
  vision: {model: 'visionMission', label: 'Vision & Mission', path: '/admin/vision-mission', publicPath: '/about#vision-mission', singleton: true, fields: pairs([['vision','Vision',10000],['mission','Mission',10000]])},
  team: {model: 'teamMember', label: 'Team', path: '/admin/team', publicPath: '/about/team', fields: pairs([['name','Name',200],['designation','Designation',200],['introduction','Introduction',10000]]), photo: true},
  committee: {model: 'committeeMember', label: 'Committee', path: '/admin/committee', publicPath: '/about/committee', fields: pairs([['name','Name',200],['position','Position',200],['committee_role','Committee Role',200],['introduction','Introduction',10000]]), photo: true},
  committeeBranch: {model:'committeeBranch',label:'Committee branch',path:'/admin/committee/branches',publicPath:'/about/committee',visibility:true,fields:pairs([['name','Branch name',200],['description','Short description',1000]])},
  lifeMembers: {model:'lifeMember',label:'Life Members',path:'/admin/life-members',publicPath:'/about/committee',visibility:true,fields:pairs([['name','Member Name',200]])},
  image: {model: 'aboutImage', label: 'About image', path: '/admin/organization/about/images', fields: pairs([['alt_text','Image description',500]]), image: true},
  statistic: {model:'aboutStatistic',label:'About statistic',path:'/admin/organization/about/statistics',publicPath:'/about#statistics',statistic:true,visibility:true,fields:[...pairs([['label','Label',100]]),{key:'value',label:'Value',max:40,multiline:false}]},
};
for (const key of ['team','committee']) modules[key].fields.forEach(field => { if(field.key.startsWith('introduction_')) field.optional=true; });
modules.committee.fields.forEach(field => { if(!field.key.startsWith('name_')) field.optional=true; });
modules.committeeBranch.fields.forEach(field => { if(field.key.startsWith('description_')) field.optional=true; });
export const positiveId = value => typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value) && Number(value) <= 2147483647 ? Number(value) : null;
export function validateContent(module, body = {}) {
  const values = {}, errors = [];
  if(module === modules.committee) {
    values.branch_id=positiveId(body.branch_id);
    if(!values.branch_id) errors.push({key:'branch_id',message:'Choose a committee branch.'});
  }
  for (const field of module.fields) {
    const input = body[field.key];
    values[field.key] = typeof input === 'string' ? (field.preserveWhitespace?input:input.trim()) : '';
    if ((!field.optional && !values[field.key]) || (input !== undefined && typeof input !== 'string') || [...values[field.key]].length > field.max || Buffer.byteLength(values[field.key]) > (field.maxBytes || 60000) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(values[field.key])) errors.push({key: field.key, message: `${field.label}: ${field.optional ? 'optional' : 'required'}, maximum ${field.max} characters; no control characters.`});
  }
  if (!module.singleton) {
    const order = body.display_order ?? '0';
    values.display_order = typeof order === 'string' && /^(0|[1-9]\d{0,5})$/.test(order) ? Number(order) : 0;
    if (typeof order !== 'string' || !/^(0|[1-9]\d{0,5})$/.test(order)) errors.push({key:'display_order',message:'Display Order: use an integer from 0 to 999999.'});
  }
  if (module.photo || module.visibility) {
    values.is_active = body.is_active === '1';
    if (body.is_active !== undefined && !['0','1'].includes(body.is_active)) errors.push({key:'is_active',message:'Choose Active or Inactive.'});
  }
  if (body.clear_photo !== undefined && !['0','1'].includes(body.clear_photo)) errors.push({key:'photo',message:'Invalid image removal option.'});
  if (!module.photo && !module.hero && body.clear_photo !== undefined) errors.push({key:'photo',message:'Image removal is not available on this form.'});
  if(module.hero) {
    const input=body.youtube_url;
    const video=typeof input==='string' && input.trim() ? youtubeVideo(input.trim()) : null;
    values.youtube_url=typeof input==='string' && input.trim() ? video?.watch || input.trim() : null;
    if(input !== undefined && (typeof input !== 'string' || (input.trim() && !video))) errors.push({key:'youtube_url',message:'Use a valid HTTPS YouTube watch, short, shorts, live or embed URL.'});
  }
  if(module.statistic) {
    values.kind=typeof body.kind==='string'?body.kind:'';
    if(!Object.hasOwn(statisticKinds,values.kind)) errors.push({key:'kind',message:'Choose one of the four statistic categories.'});
    // A short display value is stored verbatim; it is never parsed or calculated.
    if(typeof body.value==='string') values.value=body.value;
    if(typeof body.value !== 'string' || [...body.value].length > 40 || /[\u0000-\u001f\u007f]/.test(body.value)) errors.push({key:'value',message:'Use a single-line value, up to 40 characters, without control characters.'});
  }
  if (typeof body.revision !== 'string' || !/^(0|[1-9]\d{0,9})$/.test(body.revision) || Number(body.revision) > 2147483647) errors.push({key:'revision',message:'Invalid form revision. Reload before saving.'});
  return {values, errors};
}
export const contentText = (row, key, locale) => row?.[`${key}_${locale}`] || '';
export const contentLabels = {
  en: {history:'Background / History', objectives:'Objectives', core_values:'Core Values', vision:'Vision', mission:'Mission', introduction:'About our organization',video:'Our story on video',watch:'Watch on YouTube',statistics:'Our community in numbers',empty:'Information will be available here soon.'},
  ne: {history:'पृष्ठभूमि / इतिहास', objectives:'उद्देश्यहरू', core_values:'मूल मान्यताहरू', vision:'दृष्टि', mission:'लक्ष्य', introduction:'हाम्रो संस्थाको परिचय',video:'भिडियोमा हाम्रो कथा',watch:'युट्युबमा हेर्नुहोस्',statistics:'हाम्रो समुदायका तथ्याङ्क',empty:'थप जानकारी यहाँ चाँडै उपलब्ध हुनेछ।'},
};
