import sanitizeHtml from 'sanitize-html';

// Only normalized uploads from the existing media pipeline may appear inline.
const mediaPath=/^\/media\/[a-zA-Z0-9_-]+\.png$/;
export const safeActivityImage=value=>typeof value==='string' && mediaPath.test(value);
export function sanitizeActivityHtml(value='') {
  return sanitizeHtml(value,{
    allowedTags:['p','br','h2','h3','h4','strong','b','em','i','u','ul','ol','li','blockquote','a','img'],
    allowedAttributes:{a:['href','title'],img:['src','alt','loading','decoding']},
    allowedSchemes:['https','http','mailto','tel'],allowProtocolRelative:false,
    exclusiveFilter:frame=>frame.tag==='img' && !safeActivityImage(frame.attribs.src),
    transformTags:{div:'p',img:(_tag,attributes)=>({tagName:'img',attribs:{src:attributes.src,alt:attributes.alt||'',loading:'lazy',decoding:'async'}})},
  });
}
export function activityDescription(value='',format='PLAIN') {
  // Trim editor-generated blank blocks only at the display boundary, never in storage.
  if(format==='HTML') return sanitizeActivityHtml(value).replace(/(?:\s|<br\s*\/?>|<p>(?:\s|&nbsp;|<br\s*\/?>|<\/?(?:strong|b|em|i|u)>)*<\/p>)+$/gi,'');
  return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/\r?\n/g,'<br>');
}
export function activityDescriptionText(value='',format='PLAIN') {
  return format==='HTML'?sanitizeHtml(value,{allowedTags:[],allowedAttributes:{}}):value;
}
export function hasActivityDescription(value='',format='PLAIN') {
  if(format!=='HTML') return Boolean(value.trim());
  const safe=sanitizeActivityHtml(value);
  return /<img\s/.test(safe) || Boolean(activityDescriptionText(safe,'HTML').replace(/&(?:nbsp|#160|#x0*a0);/gi,' ').trim());
}
