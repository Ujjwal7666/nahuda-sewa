import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {mediaModules,validateMediaContent,safeSlug,parseEditorialDate,dateInput} from '../src/config/media-content.js';
import ejs from 'ejs';
import {contentText} from '../src/config/fixed-content.js';

test('News editorial cards and articles adapt to optional media and bilingual plain text',()=> {
  const card=readFileSync(new URL('../src/views/public/news/news-card.ejs',import.meta.url),'utf8');
  const article=readFileSync(new URL('../src/views/public/news/news-detail.ejs',import.meta.url),'utf8');
  for(const locale of ['en','ne']) for(const photo of [false,true]) {
    const row={id:8,slug:'news-example',title_en:'A headline <script>',title_ne:'लामो नेपाली समाचार शीर्षक '.repeat(5),summary_en:'Summary',summary_ne:'समाचारको सारांश',content_en:'Body <script>',content_ne:'',published_date:new Date('2026-10-02T00:00:00Z'),featured_image:photo?{width:800,height:1200}:null,images:[]};
    const locals={row,news:row,locale,localePrefix:locale==='ne'?'/ne':'',contentText,assetUrl:()=>'/fixture.png',dateInput,formatDate:value=>new Intl.DateTimeFormat(locale==='ne'?'ne-NP':'en-GB',{dateStyle:'long',timeZone:'UTC'}).format(value),labels:{read:'Read',published:'Published',images:'Images',back:'Back'}};
    const html=ejs.render(card,locals),detail=ejs.render(article,locals);
    assert.ok(html.includes(`href="${locals.localePrefix}/news/news-example"`));
    assert.ok(html.includes('datetime="2026-10-02"'));assert.match(html,/aria-labelledby="news-title-8"/);
    assert.equal(html.includes('news-card-media'),photo);assert.equal(detail.includes('news-article-cover'),photo);
    assert.equal(detail.includes('news-article-body'),locale==='en');assert.ok(!detail.includes('news-article-gallery'));
    assert.ok(!html.includes('<script>'));assert.ok(!detail.includes('<script>'));
    assert.ok(html.includes(locale==='ne'?row.title_ne:'A headline &lt;script&gt;'));
  }
});
const fields=module=>Object.fromEntries(module.fields.map(field=>[field.key,field.optional?'':'Test '+field.key]));
test('News, Services and category slug suggestions preserve manual, existing and locked URLs',()=> {
  const script=readFileSync(new URL('../public/assets/js/news-slug.js',import.meta.url),'utf8');
  function form(titleValue,slugValue='',locked=false,source='title') {
    const make=(value,readOnly=false)=>({value,readOnly,listeners:{},addEventListener(event,listener){this.listeners[event]=listener;}});
    const title=make(titleValue),slug=make(slugValue,locked);
    runInNewContext(script,{document:{querySelector:selector=>selector==='#'+source+'_en'?title:selector==='#slug'?slug:null}});
    return {title,slug,typeTitle(value){title.value=value;title.listeners.input?.();},typeSlug(value){slug.value=value;slug.listeners.input?.();}};
  }
  const fresh=form('Land Secured: Panauti Senior Care Center!');
  assert.equal(fresh.slug.value,'land-secured-panauti-senior-care-center');
  fresh.typeTitle('Café & Community — 2026');assert.equal(fresh.slug.value,'cafe-community-2026');
  fresh.typeSlug('my-custom-url');fresh.typeTitle('Changed title');assert.equal(fresh.slug.value,'my-custom-url');
  fresh.typeSlug('');fresh.typeTitle('New title');assert.equal(fresh.slug.value,'new-title');
  fresh.typeTitle('a'.repeat(119)+' words');assert.equal(fresh.slug.value,'a'.repeat(119));
  fresh.typeTitle('नेपाली');assert.equal(fresh.slug.value,'');
  const existing=form('Original title','original-title');existing.typeTitle('Edited title');assert.equal(existing.slug.value,'original-title');
  const locked=form('Published title','published-title',true);locked.typeTitle('Edited title');assert.equal(locked.slug.value,'published-title');
  for(const name of ['Personalized Care Services','Care & Support']) {
    const service=form(name,'',false,'name');assert.equal(service.slug.value,name.toLowerCase().replace(/[^a-z0-9]+/g,'-'));
    service.typeTitle('Health & Wellness');assert.equal(service.slug.value,'health-wellness');
    service.typeSlug('custom-service');service.typeTitle('Changed name');assert.equal(service.slug.value,'custom-service');
    service.typeSlug('');service.typeTitle('New name');assert.equal(service.slug.value,'new-name');
    const saved=form(name,'saved-slug',false,'name');saved.typeTitle('Changed name');assert.equal(saved.slug.value,'saved-slug');
  }
});
test('Media validation requires paired core fields while optional translations are independent',()=> {
  for(const module of Object.values(mediaModules)) {
    const body={...fields(module),revision:'0',...(module.news||module.service||module.slug?{slug:'valid-content'}:{})};
    assert.deepEqual(validateMediaContent(module,body).errors,[]);
    for(const field of module.fields) {
      assert.equal(validateMediaContent(module,{...body,[field.key]:''}).errors.length,field.optional?0:1);
      assert.ok(validateMediaContent(module,{...body,[field.key]:['repeated']}).errors.length);
      assert.ok(validateMediaContent(module,{...body,[field.key]:'x'.repeat(field.max+1)}).errors.length);
    }
    assert.ok(validateMediaContent(module,{...body,revision:['0','1']}).errors.length);
  }
});
test('Strict shared slugs, publication dates, states and order reject malformed inputs',()=> {
  for(const slug of ['UPPER','../bad','a/b','bad--slug','-bad','bad-','a%2fb','नेपाली','x'.repeat(121),'', ['slug']]) assert.equal(safeSlug(slug),false);
  for(const slug of ['news','123','our-new-update']) assert.equal(safeSlug(slug),true);
  for(const date of ['2026-02-29','2026-13-01','2026-04-31','2026-1-01','1899-01-01',['2026-01-01']]) assert.equal(parseEditorialDate(date),null);
  assert.equal(dateInput(parseEditorialDate('2024-02-29')),'2024-02-29');
  const module=mediaModules.news,body={...fields(module),revision:'0',slug:'test',status:'PUBLISHED'};
  assert.ok(validateMediaContent(module,body).errors.some(error=>error.key==='published_date'));
  assert.deepEqual(validateMediaContent(module,{...body,published_date:'2099-01-01'}).errors,[]);
  assert.ok(validateMediaContent(module,{...body,status:['DRAFT']}).errors.length);
  for(const data of [{display_order:'-1'},{display_order:'1.5'},{is_active:['1']},{clear_photo:['1']}]) assert.ok(validateMediaContent(mediaModules.testimonials,{...fields(mediaModules.testimonials),revision:'0',...data}).errors.length);
});
