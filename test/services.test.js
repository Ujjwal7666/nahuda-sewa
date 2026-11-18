import {activityDescription,sanitizeActivityHtml,hasActivityDescription} from '../src/config/activity-rich-text.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {serviceModules} from '../src/config/services.js';
import {validateMediaContent} from '../src/config/media-content.js';
import {groupServices} from '../src/services/service-showcase.js';
import ejs from 'ejs';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {contentText} from '../src/config/fixed-content.js';
import {serviceLabels} from '../src/config/services.js';

test('Activity cards keep complete bilingual titles, safe links and intentional missing-photo artwork',async()=> {
  const template=await readFile(new URL('../src/views/public/services/service-card.ejs',import.meta.url),'utf8');
  for(const locale of ['en','ne']) for(const withImage of [false,true]) {
    const category={name_en:'Category',name_ne:'गतिविधिको वर्ग',is_active:true};
    const service={id:7,slug:'dynamic-activity',name_en:'Long activity <script> title',name_ne:'लामो नेपाली गतिविधिको शीर्षक '.repeat(5),short_description_en:'Long summary '.repeat(60),short_description_ne:'लामो नेपाली परिचय '.repeat(40),category,featured_image:withImage?{width:600,height:1200}:null};
    const html=ejs.render(template,{service,category:null,locale,localePrefix:locale==='ne'?'/ne':'',cardHeadingLevel:3,contentText,labels:serviceLabels[locale],assetUrl:asset=>asset?'/fixture.png':null});
    assert.ok(html.includes(`href="${locale==='ne'?'/ne':''}/services/dynamic-activity"`));
    assert.ok(html.includes(locale==='en'?'Long activity &lt;script&gt; title':service.name_ne));
    assert.equal(html.includes('<img'),withImage);assert.equal(html.includes('activity-card-art'),!withImage);
    assert.match(html,/aria-labelledby="service-title-7"/);assert.ok(!html.includes('<script>'));
    assert.ok(html.includes(contentText(category,'name',locale)));
  }
});

test('Activity detail adapts to optional text, photos, features and information in either language',async()=> {
  const template=await readFile(new URL('../src/views/public/services/activity-detail.ejs',import.meta.url),'utf8');
  for(const locale of ['en','ne']) for(const populated of [false,true]) for(const photo of [false,true]) {
    const row={name_en:'Activity',name_ne:'गतिविधि',short_description_en:populated?'A short introduction':'',short_description_ne:populated?'छोटो परिचय':'',full_description_en:populated?'Long body <script>':'',full_description_ne:populated?'लामो नेपाली विवरण':'',who_is_it_for_en:populated?'Everyone':'',who_is_it_for_ne:'',featured_image:photo?{width:800,height:1200}:null,features:populated?[{title_en:'Feature',title_ne:'विशेषता',description_en:'',description_ne:''}]:[],images:[],category:null};
    const html=ejs.render(template,{row,locale,localePrefix:locale==='ne'?'/ne':'',contentText,labels:serviceLabels[locale],activityDescription,hasActivityDescription,assetUrl:asset=>asset?'/fixture.png':null,contactUrl:null,organization:{name:'Organization'}},{filename:new URL('../src/views/public/services/activity-detail.ejs',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')});
    assert.equal(html.includes('data-activity-hero-photo'),photo);
    assert.equal(html.includes('activity-main-content'),populated);
    assert.equal(html.includes('id="service-who_is_it_for"'),populated&&locale==='en');
    assert.equal(html.includes('id="service-features"'),populated);
    assert.ok(!html.includes('id="service-gallery"'));assert.ok(!html.includes('service-contact'));assert.ok(!html.includes('<script>'));
    if(populated&&locale==='en')assert.ok(html.includes('&lt;script&gt;'));
  }
});
test('category showcases scope services, preserve ordering and feature eligibility',()=> {
 const categories=[{id:1,slug:'later',display_order:2,is_active:true},{id:2,slug:'first',display_order:1,is_active:true},{id:3,slug:'hidden',display_order:0,is_active:false},{id:4,slug:'empty',display_order:0,is_active:true}];
 const rows=[{id:1,category_id:1,display_order:2,is_active:true,is_featured:true},{id:2,category_id:1,display_order:1,is_active:true,is_featured:false},{id:3,category_id:2,display_order:0,is_active:true,is_featured:true},{id:4,category_id:3,display_order:0,is_active:true,is_featured:true},{id:5,category_id:2,display_order:0,is_active:false,is_featured:true}];
 const before=JSON.stringify({rows,categories});const groups=groupServices(rows,categories);
 assert.deepEqual(groups.map(g=>g.category?.id||null),[4,2,1,null]);assert.deepEqual(groups[2].services.map(s=>s.id),[2,1]);assert.equal(groups[3].services[0].id,4);
 assert.deepEqual(groupServices(rows,categories,true)[1].services.map(s=>s.id),[1]);assert.equal(JSON.stringify({rows,categories}),before);
});
test('Services validates shared settings and relationships without translating optional content',()=> {
  const body={name_en:'Care',name_ne:'हेरचाह',slug:'care',revision:'0'};
  const module=serviceModules.services;
  const valid=validateMediaContent(module,body);assert.deepEqual(valid.errors,[]);assert.equal(valid.values.full_description_ne,'');assert.equal(valid.values.category_id,null);assert.equal(valid.values.is_featured,false);
  for(const data of [{is_featured:['1']},{category_id:['1']},{category_id:'0'},{category_id:'2147483648'},{icon:'a'.repeat(41)}]) assert.ok(validateMediaContent(module,{...body,...data}).errors.length);
  const optional=validateMediaContent(module,{...body,who_is_it_for_en:'Approved supplied text',category_id:'1',is_featured:'1'});assert.deepEqual(optional.errors,[]);assert.equal(optional.values.who_is_it_for_ne,'');assert.equal(optional.values.is_featured,true);assert.equal(optional.values.category_id,1);
  assert.ok(validateMediaContent(serviceModules.serviceFeature,{title_en:'Care',title_ne:'हेरचाह',revision:'0',clear_photo:'1'}).errors.length);
});

test('Activity rich text allows structure and local uploads but removes executable markup',()=> {
  const unsafe='<h2>Heading</h2><p onclick="alert(1)">Text <strong>bold</strong></p><ul><li>One</li></ul><script>alert(2)</script><iframe src="https://bad.test"></iframe><a href="jav&#97;script:alert(1)">Bad</a><img src="https://bad.test/a.png" onerror="alert(1)"><img src="/media/content_fixture.png" alt="Photo"><a href="/contact">Contact</a>';
  assert.equal(hasActivityDescription('<p><br></p><p>&nbsp;</p>','HTML'),false);
  assert.equal(hasActivityDescription('<script>bad()</script>','HTML'),false);
  assert.equal(hasActivityDescription('<img src="/media/fixture.png">','HTML'),true);
  assert.equal(activityDescription('<p>Last text</p><p><br></p><p>&nbsp;</p><p><strong><br></strong></p><p></p>','HTML'),'<p>Last text</p>');
  assert.equal(activityDescription('<p>First</p><p><br></p><p>Last</p>','HTML'),'<p>First</p><p><br /></p><p>Last</p>');
  assert.match(activityDescription('<p>Text</p><p><img src="/media/fixture.png"></p><p><br></p>','HTML'),/<img[^>]+><\/p>$/);
  const safe=sanitizeActivityHtml(unsafe);
  assert.match(safe,/<h2>Heading<\/h2>/);assert.match(safe,/<strong>bold<\/strong>/);assert.match(safe,/<ul><li>One<\/li><\/ul>/);
  assert.match(safe,/src="\/media\/content_fixture.png"/);assert.match(safe,/href="\/contact"/);
  assert.doesNotMatch(safe,/script|iframe|onclick|onerror|bad.test/);
  for(const src of ['//bad.test/x.png','data:image/svg+xml,evil','/media/../assets/x.png','/media/x.png?bad','javascript:alert(1)']) assert.ok(!sanitizeActivityHtml(`<img src="${src}">`).includes('<img'));
  assert.equal(activityDescription('  <h2>Literal</h2>\nनेपाली  '),'  &lt;h2&gt;Literal&lt;/h2&gt;<br>नेपाली  ');
  const body={name_en:'Name',name_ne:'नाम',slug:'name',revision:'0',description_format:'HTML',full_description_en:unsafe};
  const validated=validateMediaContent(serviceModules.services,body);assert.deepEqual(validated.errors,[]);assert.equal(validated.values.full_description_en,safe);
  const long='लेख '.repeat(12000);assert.deepEqual(validateMediaContent(serviceModules.services,{...body,full_description_en:long}).errors,[]);
  assert.ok(validateMediaContent(serviceModules.services,{...body,full_description_en:'a'.repeat(200001)}).errors.length);
  for(const invalid of [{image_position:'BAD'},{image_position:['LEFT']},{description_format:['HTML']},{description_format:'script'}]) assert.ok(validateMediaContent(serviceModules.services,{...body,...invalid}).errors.length);
});

test('Activity detail keeps related links alongside information, omits empty panels and respects image settings',async()=> {
  const filename=fileURLToPath(new URL('../src/views/public/services/activity-detail.ejs',import.meta.url));
  const template=await readFile(filename,'utf8');
  for(const locale of ['en','ne']) for(const position of ['DEFAULT','LEFT','RIGHT','TOP','FULL']) for(const info of [false,true]) for(const siblings of [false,true]) {
    const row={name_en:'Name',name_ne:'नाम',short_description_en:'Tailored introduction',short_description_ne:'छोटो परिचय',full_description_en:'<h2>Article</h2><p>Body</p>',full_description_ne:'<h2>लेख</h2><p>विवरण</p>',description_format:'HTML',image_position:position,who_is_it_for_en:info?'Adults':'',who_is_it_for_ne:info?'वयस्क':'',featured_image:{width:1200,height:800},features:[],images:[],category:null};
    const relatedActivities=siblings?[{slug:'sibling',name_en:'Sibling',name_ne:'अन्य गतिविधि',featured_image:null}]:[];
    const html=ejs.render(template,{row,locale,localePrefix:locale==='ne'?'/ne':'',contentText,labels:serviceLabels[locale],activityDescription,hasActivityDescription,relatedActivities,assetUrl:asset=>asset?'/media/fixture.png':null,contactUrl:info?'/contact':null,organization:{name:'Organization'}},{filename});
    assert.ok(!html.includes('Tailored introduction'));assert.ok(!html.includes('छोटो परिचय'));
    assert.ok(html.includes(`activity-image-${position.toLowerCase()}`));assert.equal((html.match(/class="activity-cover"/g)||[]).length,position==='DEFAULT'?0:1);assert.ok(html.includes('data-activity-hero-photo'));
    assert.equal(html.includes('<aside'),info||siblings);assert.equal(html.includes('activity-related-heading'),siblings);
    assert.equal(html.includes('service-contact'),info);assert.equal(html.includes('id="service-who_is_it_for"'),info);
    assert.match(html,locale==='en'?/<h2>Article<\/h2>/:/<h2>लेख<\/h2>/);
    if(siblings) assert.ok(html.includes(`href="${locale==='ne'?'/ne':''}/services/sibling"`));
    if(info&&siblings)assert.ok(html.indexOf('activity-related-heading')<html.indexOf('service-contact'));
  }
});


test('Activity hero keeps category context, one escaped title and optional supporting visual',async()=> {
  const filename=fileURLToPath(new URL('../src/views/public/services/activity-hero.ejs',import.meta.url));const template=await readFile(filename,'utf8');
  for(const locale of ['en','ne']) for(const activeCategory of [false,true]) for(const photo of [false,true]) {
    const row={name_en:'Long activity <script> title',name_ne:'लामो नेपाली गतिविधिको शीर्षक '.repeat(8),category:{slug:'community',name_en:'Community',name_ne:'समुदाय',is_active:activeCategory},featured_image:photo?{width:800,height:600}:null,image_position:'DEFAULT'};
    const html=ejs.render(template,{row,locale,localePrefix:locale==='ne'?'/ne':'',labels:serviceLabels[locale],contentText,assetUrl:asset=>asset?'/media/fixture.png':null},{filename});
    assert.equal((html.match(/<h1>/g)||[]).length,1);assert.equal(html.includes('data-activity-hero-photo'),photo);assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('href="'+(locale==='ne'?'/ne':'')+'/services"'));
    assert.equal(html.includes('/services/category/community'),activeCategory);
    if(activeCategory)assert.ok(html.indexOf(contentText(row.category,'name',locale))<html.indexOf('<h1>'));
    assert.ok(html.includes(locale==='en'?'Long activity &lt;script&gt; title':row.name_ne));
  }
});

test('Supporting gallery renders zero, one, two or many images after description and before sidebar in both languages',async()=> {
  const filename=fileURLToPath(new URL('../src/views/public/services/activity-detail.ejs',import.meta.url));const template=await readFile(filename,'utf8');
  for(const locale of ['en','ne']) for(const count of [0,1,2,5]) for(const info of [false,true]) {
    const row={name_en:'Activity',name_ne:'गतिविधि',category:null,featured_image:null,features:[],full_description_en:'Article body',full_description_ne:'लेख विवरण',description_format:'PLAIN',who_is_it_for_en:info?'Everyone':'',who_is_it_for_ne:info?'सबैका लागि':'',images:Array.from({length:count},(_,i)=>({image:{storage_key:'ordered-'+i+'.png',width:i%2?600:1200,height:i%2?1200:600},caption_en:i===0?'Caption <script>':'',caption_ne:i===0?'तस्बिर विवरण':'',alt_text_en:'Image '+i,alt_text_ne:'तस्बिर '+i}))};
    const html=ejs.render(template,{row,locale,localePrefix:locale==='ne'?'/ne':'',labels:serviceLabels[locale],contentText,activityDescription,hasActivityDescription,relatedActivities:[],assetUrl:asset=>asset?'/media/'+asset.storage_key:null,contactUrl:info?'/contact':null,organization:{name:'Organization'}},{filename});
    assert.equal(html.includes('id="service-gallery"'),count>0);assert.equal(html.includes('activity-gallery-single'),count===1);assert.equal(html.includes('<aside'),info);
    assert.ok(!html.includes('activity-gallery-heading'));
    if(count)assert.ok(html.includes(`aria-label="${serviceLabels[locale].gallery}"`));
    if(count){assert.ok(html.indexOf('activity-prose')<html.indexOf('id="service-gallery"'));if(info)assert.ok(html.indexOf('id="service-gallery"')<html.indexOf('<aside'));assert.ok(!html.includes('<script>'));}
    for(let i=1;i<count;i++)assert.ok(html.indexOf('ordered-'+(i-1)+'.png')<html.indexOf('ordered-'+i+'.png'));
    assert.equal((html.match(/<figcaption/g)||[]).length,count?1:0);
  }
});
