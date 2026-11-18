import test from 'node:test';
import assert from 'node:assert/strict';
import ejs from 'ejs';
import {fileURLToPath} from 'node:url';
import {programModule,programLabels,programExcerpt,programInformationRows} from '../src/config/programs.js';
import {validateMediaContent,dateInput} from '../src/config/media-content.js';
import {activityDescription,sanitizeActivityHtml} from '../src/config/activity-rich-text.js';
import {contentText} from '../src/config/fixed-content.js';
import {localeMiddleware} from '../src/middleware/locale.js';
const fields={title_en:'Program',title_ne:'कार्यक्रम',full_description_en:'<h2>Heading</h2><p>Body</p>',full_description_ne:'<p>विवरण</p>',slug:'program',revision:'0'};
const assetUrl=asset=>asset?'/media/'+asset.storage_key:null;
function locals(path){const res={locals:{}};localeMiddleware({path},res,()=>{});return res.locals;}

test('Programs require bilingual titles and meaningful descriptions and validate optional information pairs',()=>{
  const valid=validateMediaContent(programModule,fields);assert.deepEqual(valid.errors,[]);assert.equal(valid.values.description_format,'HTML');assert.equal(valid.values.is_active,false);assert.equal(valid.values.additional_heading_ne,'');
  for(const input of [{title_en:''},{title_ne:''},{full_description_en:''},{full_description_ne:'<p><br></p>'},{full_description_en:'<script>bad()</script>'},{full_description_en:' '.repeat(10)},{title_en:['duplicate']},{description_format:['HTML']},{additional_heading_en:'Heading'},{additional_content_ne:'Body only'},{is_active:'PUBLISHED'},{display_order:'-1'},{slug:'../bad'},{full_description_en:'a'.repeat(200001)}]) assert.ok(validateMediaContent(programModule,{...fields,...input}).errors.length,JSON.stringify(input).slice(0,80));
  const optional=validateMediaContent(programModule,{...fields,additional_heading_en:'Who can join?',additional_content_en:'Supplied information'});assert.deepEqual(optional.errors,[]);assert.equal(optional.values.additional_content_ne,'');
  const sanitized=validateMediaContent(programModule,{...fields,full_description_en:'<h2 onclick="bad()">Heading</h2><p>Body</p><script>bad()</script><a href="javascript:bad()">Link</a>'});assert.deepEqual(sanitized.errors,[]);assert.doesNotMatch(sanitized.values.full_description_en,/script|onclick|javascript/);
  assert.deepEqual(validateMediaContent(programModule,{...fields,full_description_ne:'<p>'+'नेपाली '.repeat(14000)+'</p>'}).errors,[]);
});

test('Programs derive concise readable excerpts without markup or broken entity/grapheme output',()=>{
  assert.equal(programExcerpt('<h2>One &amp; two</h2><p>&lt;safe&gt;</p><script>hidden()</script>','HTML'),'One & two <safe>');
  assert.equal(programExcerpt('Plain <literal>\ntext','PLAIN'),'Plain <literal> text');
  const text=programExcerpt('<p>'+'सहयोग कार्यक्रम '.repeat(100)+'</p>','HTML','ne',80);assert.ok(text.endsWith('…'));assert.ok([...text].length<=81);assert.ok(!text.includes('<p>'));
});

test('Programs list/detail render both languages, optional information and photos safely',async()=>{
  const filename=fileURLToPath(new URL('../src/views/public/programs.ejs',import.meta.url));
  for(const locale of ['en','ne'])for(const photo of [false,true])for(const info of [false,true]){
    const prefix=locale==='ne'?'/ne':'';
    const row={id:1,...fields,title_en:'Program <script>',featured_image:photo?{storage_key:'fixture.png',width:600,height:400}:null,description_format:'HTML',additional_heading_en:info?'Who can join?':'',additional_content_en:info?'Actual <script> text':'',additional_heading_ne:info?'कसका लागि?':'',additional_content_ne:info?'जानकारी':''};
    const shared={...locals(prefix+'/programs/program'),title:'Programs',heading:contentText(row,'title',locale),labels:programLabels[locale],contentText,programExcerpt,programInformationRows,activityDescription,assetUrl};
    const detail=await ejs.renderFile(filename,{...shared,row,rows:[]});assert.equal((detail.match(/<h1>/g)||[]).length,1);assert.equal(detail.includes('class="program-featured"'),photo);assert.equal(detail.includes('id="program-information-heading"'),info);assert.ok(!detail.includes('<script>'));assert.ok(detail.includes(`href="${prefix}/programs"`));assert.ok(detail.includes(contentText(row,'title',locale).replace(/</g,'&lt;').replace(/>/g,'&gt;')));
    const listing=await ejs.renderFile(filename,{...shared,heading:programLabels[locale].heading,row:null,rows:[row]});assert.equal(listing.includes('class="program-card-image"'),photo);assert.ok(listing.includes(`href="${prefix}/programs/program"`));assert.ok(!listing.includes('<script>'));
    const empty=await ejs.renderFile(filename,{...shared,heading:programLabels[locale].heading,row:null,rows:[]});assert.ok(empty.includes(programLabels[locale].empty));assert.ok(!empty.includes('program-card-copy'));
  }
});

test('Programs admin reuses required article editors, shared image controls and a single stable slug',async()=>{
  const filename=fileURLToPath(new URL('../src/views/admin/media-form.ejs',import.meta.url));
  const html=await ejs.renderFile(filename,{...locals('/admin/programs/new'),title:'Programs',section:'Content',csrfToken:'fixture',module:programModule,path:'/admin/programs',row:{},values:{...fields,description_format:'HTML'},errors:[],revision:0,assetUrl,dateInput,sanitizeActivityHtml});
  assert.equal((html.match(/name="slug"/g)||[]).length,1);assert.equal((html.match(/data-activity-editor /g)||[]).length,4);assert.match(html,/Full description EN \*/);assert.match(html,/Full description NE \*/);assert.match(html,/name="description_format" value="HTML"/);assert.match(html,/activity-editor.js/);assert.match(html,/news-slug.js/);assert.ok(!html.includes('Featured on Homepage'));assert.ok(!html.includes('image_position'));assert.ok(!html.includes('Manage features'));
});

test('Our Work combined additional information round trips bilingual legacy fields without schema changes',()=>{
  const result=validateMediaContent(programModule,{...fields,additional_combined_en:'Who can join?\r\nEveryone\r\nContact us.',additional_combined_ne:'कसका लागि?\nसबैका लागि'});
  assert.deepEqual(result.errors,[]);
  assert.equal(result.values.additional_heading_en,'Who can join?');
  assert.equal(result.values.additional_content_en,'Everyone\nContact us.');
  assert.equal(result.values.additional_heading_ne,'कसका लागि?');
  assert.equal(result.values.additional_content_ne,'सबैका लागि');
  assert.ok(validateMediaContent(programModule,{...fields,additional_combined_en:['bad','duplicate']}).errors.length);
  assert.ok(validateMediaContent(programModule,{...fields,additional_combined_en:'Heading only'}).errors.length);
  assert.deepEqual(validateMediaContent(programModule,{...fields,additional_combined_en:''}).errors,[]);
});

test('Our Work stays separate from Core Activities while detail retains its contact CTA',async()=>{
  const filename=fileURLToPath(new URL('../src/views/public/programs.ejs',import.meta.url));
  for(const locale of ['en','ne']) {
    const prefix=locale==='ne'?'/ne':'';
    const row={id:1,...fields,description_format:'HTML',additional_heading_en:'Information',additional_content_en:'Body'};
    const activity={id:2,name_en:'Community activity',name_ne:'सामुदायिक गतिविधि',slug:'community',short_description_en:'Summary',short_description_ne:'सारांश'};
    const other={id:3,title_en:'Other work',title_ne:'अन्य काम',slug:'other'};
    const shared={...locals(prefix+'/programs/program'),title:'Our Work',heading:contentText(row,'title',locale),labels:programLabels[locale],contentText,programExcerpt,programInformationRows,activityDescription,assetUrl,activities:[activity],otherWork:[other]};
    const detail=await ejs.renderFile(filename,{...shared,row,rows:[]});
    assert.ok(!detail.includes(`href="${prefix}/services/community"`));
    const sidebar=detail.slice(detail.indexOf('class="program-sidebar"'),detail.indexOf('</aside>'));
    assert.ok(!sidebar.includes('/services/'));
    assert.ok(!sidebar.includes(contentText(activity,'name',locale)));
    assert.ok(detail.includes(`href="${prefix}/programs/other"`));
    assert.ok(detail.includes(`href="${prefix}/contact"`));
    assert.ok(detail.includes(programLabels[locale].other));
    const listing=await ejs.renderFile(filename,{...shared,row:null,rows:[]});
    assert.ok(!listing.includes(contentText(activity,'name',locale)));
    assert.ok(!listing.includes(`href="${prefix}/services/community"`));
    assert.ok(!listing.includes('our-work-activities'));
  }
});

test('Additional Information accepts sanitized rich text independently of the article format',()=>{
  const result=validateMediaContent(programModule,{...fields,description_format:'PLAIN',full_description_en:'Plain article <literal>',full_description_ne:'पुरानो साधारण लेख',additional_format:'HTML',additional_combined_en:'<h2>Facts</h2><p><strong>85 cases</strong></p><ul><li>Local ward</li></ul><script>bad()</script>',additional_combined_ne:'<h2>तथ्याङ्क</h2><ol><li>स्थानीय वडा</li></ol>'});
  assert.deepEqual(result.errors,[]);assert.equal(result.values.description_format,'PLAIN');assert.equal(result.values.full_description_en,'Plain article <literal>');
  assert.equal(result.values.additional_format,'HTML');assert.equal(result.values.additional_heading_en,'');assert.match(result.values.additional_content_en,/<strong>85 cases<\/strong>/);assert.doesNotMatch(result.values.additional_content_en,/<script>/);assert.match(result.values.additional_content_ne,/<ol>/);
  for(const bad of [{additional_format:'BAD'},{additional_format:['HTML']},{additional_combined_en:['bad']}])assert.ok(validateMediaContent(programModule,{...fields,...bad}).errors.length);
  assert.equal(validateMediaContent(programModule,{...fields,additional_format:'HTML',additional_combined_en:'<p><br></p>'}).values.additional_content_en,'');
});

test('Our Work rich additional panel and ordered supporting photos render bilingually without mixing activities',async()=>{
  const filename=fileURLToPath(new URL('../src/views/public/programs.ejs',import.meta.url));
  for(const locale of ['en','ne']) {
    const prefix=locale==='ne'?'/ne':'';
    const photo={storage_key:'fixture.png',width:600,height:400};
    const row={id:1,...fields,description_format:'HTML',additional_format:'HTML',additional_content_en:'<h2>Facts</h2><p><strong>85 cases</strong></p><ul><li>Local ward</li></ul>',additional_content_ne:'<h2>तथ्याङ्क</h2><ol><li>स्थानीय वडा</li></ol>',featured_image:photo,images:[{image:photo,caption_en:'First caption',caption_ne:'पहिलो विवरण',alt_text_en:'First image',alt_text_ne:'पहिलो तस्बिर'},{image:photo,caption_en:'Second caption',caption_ne:'दोस्रो विवरण',alt_text_en:'',alt_text_ne:''}]};
    const html=await ejs.renderFile(filename,{...locals(prefix+'/programs/program'),title:'Our Work',heading:contentText(row,'title',locale),labels:programLabels[locale],contentText,programExcerpt,programInformationRows,activityDescription,assetUrl,row,rows:[],activities:[],otherWork:[]});
    assert.ok(html.includes(locale==='en'?'<h2>Facts</h2>':'<h2>तथ्याङ्क</h2>'));
    assert.ok(html.includes(locale==='en'?'<strong>85 cases</strong>':'<ol><li>स्थानीय वडा</li></ol>'));
    assert.ok(html.includes('class="program-featured"'));assert.ok(html.includes('class="activity-gallery '));
    assert.ok(html.indexOf(locale==='en'?'First caption':'पहिलो विवरण')<html.indexOf(locale==='en'?'Second caption':'दोस्रो विवरण'));
    assert.ok(html.includes('alt="'+(locale==='en'?'First image':'पहिलो तस्बिर')+'"'));
  }
});
