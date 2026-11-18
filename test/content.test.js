import test from 'node:test';
import assert from 'node:assert/strict';
import ejs from 'ejs';
import {readFile} from 'node:fs/promises';
import {modules, validateContent, positiveId, contentText} from '../src/config/fixed-content.js';
test('Phase 4 requires complete paired plain text and validates scalar controls',()=> {
  for(const module of Object.values(modules)) {
    const body={revision:'0',...(module===modules.committee?{branch_id:'1'}:{}),...(module.statistic?{kind:'community_reach'}:{}),...Object.fromEntries(module.fields.map(f=>[f.key,f.lang==='ne'?'परीक्षण':'Text']))};
    assert.deepEqual(validateContent(module,body).errors,[]);
    for(const field of module.fields) {
      for(const value of [...(field.optional?[]:['',undefined]),['duplicate'], 'x'.repeat(field.max+1), 'bad\u0000text']) assert.ok(validateContent(module,{...body,[field.key]:value}).errors.some(e=>e.key===field.key));
    }
    for(const revision of [undefined,['0'],'-1','2147483648']) assert.ok(validateContent(module,{...body,revision}).errors.some(e=>e.key==='revision'));
    if(!module.singleton) for(const display_order of ['-1','1.5','1000000',['1'],'bad']) assert.ok(validateContent(module,{...body,display_order}).errors.some(e=>e.key==='display_order'));
    if(module.photo) for(const is_active of ['true',['1'],'2']) assert.ok(validateContent(module,{...body,is_active}).errors.some(e=>e.key==='is_active'));
  }
  assert.equal(positiveId('2147483647'),2147483647);
  for(const id of ['0','-1','01','1a','2147483648',['1']]) assert.equal(positiveId(id),null);
  assert.equal(contentText({name_en:'English'},'name','ne'),'');
  for(const key of ['team','committee']) {
    const module=modules[key],body={revision:'0',...(key==='committee'?{branch_id:'1'}:{}),...Object.fromEntries(module.fields.filter(f=>!f.optional).map(f=>[f.key,'Text']))};
    for(const fields of [{},{introduction_en:'',introduction_ne:''},{introduction_en:'English only'},{introduction_ne:'नेपाली मात्र'}]) assert.deepEqual(validateContent(module,{...body,...fields}).errors,[]);
    assert.equal(validateContent(module,body).values.introduction_en,'');
  }
});

test('Committee requires a branch and paired names but accepts optional roles, position and photo',()=> {
  const body={revision:'0',branch_id:'1',name_en:'Name',name_ne:'नाम'};
  const result=validateContent(modules.committee,body);
  assert.deepEqual(result.errors,[]);
  for(const field of ['position_en','position_ne','committee_role_en','committee_role_ne','introduction_en','introduction_ne']) assert.equal(result.values[field],'');
  for(const branch_id of [undefined,'','0','01',['1'],'2147483648']) assert.ok(validateContent(modules.committee,{...body,branch_id}).errors.some(e=>e.key==='branch_id'));
  assert.ok(validateContent(modules.committee,{...body,name_ne:''}).errors.some(e=>e.key==='name_ne'));
  assert.deepEqual(validateContent(modules.committeeBranch,{revision:'0',name_en:'Branch',name_ne:'शाखा'}).errors,[]);
});

test('Committee template renders branches before ordered bilingual Life Members and hides an empty Life Members section',async()=> {
  const template=await readFile(new URL('../src/views/public/committee-content.ejs',import.meta.url),'utf8');
  for(const locale of ['en','ne']) {
    const branch={id:1,name_en:'Branch <script>',name_ne:'लामो नेपाली शाखा',description_en:'Description',description_ne:'',members:[{name_en:'Alex Example',name_ne:'नेपाली सदस्य',position_en:'',position_ne:'',photo:null}]};
    const lifeMembers=[{name_en:'Later order',name_ne:'पछि',display_order:30},{name_en:'Earlier <script>',name_ne:'पहिले',display_order:5}].sort((a,b)=>a.display_order-b.display_order);
    const html=ejs.render(template,{branches:[branch,{...branch,id:2,members:[]}],lifeMembers,locale,contentText,labels:{empty:'Empty'},assetUrl:()=>'/photo.png'});
    assert.ok(html.includes(locale==='en'?'Branch &lt;script&gt;':'लामो नेपाली शाखा'));
    assert.ok(html.includes(locale==='en'?'AE':'नेस'));
    assert.ok(html.includes('Empty'));assert.ok(!html.includes('<img'));assert.ok(!html.includes('member-position'));assert.ok(!html.includes('<script>'));
    assert.ok(html.includes(locale==='en'?'aria-label="Committee branches"':'aria-label="समितिका शाखाहरू"'));
    assert.ok(html.indexOf('committee-sections')<html.indexOf('life-members-section'));
    assert.ok(html.includes(locale==='en'?'Life Members':'आजीवन सदस्य'));
    assert.ok(html.indexOf(locale==='en'?'Earlier &lt;script&gt;':'पहिले')<html.indexOf(locale==='en'?'Later order':'पछि'));
    assert.ok(!html.includes('<script>'));
    for(const id of [1,2]) {
      assert.ok(html.includes(`href="#committee-branch-${id}"`));
      assert.ok(html.includes(`id="committee-branch-${id}" tabindex="-1"`));
    }
  }
  const empty=ejs.render(template,{branches:[],lifeMembers:[],locale:'en',labels:{empty:'Empty'}});
  assert.ok(!empty.includes('<nav'));assert.ok(!empty.includes('life-members-section'));
});

test('Life Members are bilingual name-only records with display order and visibility',()=> {
  const module=modules.lifeMembers;
  assert.deepEqual(module.fields.map(field=>field.key),['name_en','name_ne']);
  const valid=validateContent(module,{revision:'0',name_en:'Member',name_ne:'सदस्य',display_order:'2',is_active:'1'});
  assert.deepEqual(valid.errors,[]);assert.equal(valid.values.is_active,true);assert.equal(valid.values.display_order,2);
  for(const field of ['name_en','name_ne']) assert.ok(validateContent(module,{revision:'0',name_en:'Member',name_ne:'सदस्य',display_order:'0',[field]:''}).errors.some(error=>error.key===field));
  assert.ok(validateContent(module,{revision:'0',name_en:'Member',name_ne:'सदस्य',display_order:'1000000'}).errors.some(error=>error.key==='display_order'));
});

test('About composition keeps statistics last and video beside history with localized photo fallback',async()=> {
  const template=await readFile(new URL('../src/views/public/about-content.ejs',import.meta.url),'utf8');
  for(const locale of ['en','ne']) for(const withVideo of [false,true]) for(const withPhoto of [false,true]) {
    const row={images:withPhoto?[{media:{width:800,height:600},alt_text_en:'Organization photo',alt_text_ne:'संस्थाको फोटो'}]:[],statistics:[{label_en:'Reach',label_ne:'पहुँच',value:'1,200+'}]};
    for(const field of ['introduction','background_history','objectives','core_values']) row[field+'_'+locale]=field;
    const html=ejs.render(template,{row,locale,heading:'About',localePrefix:locale==='ne'?'/ne':'',t:{about:'About',organization:'Organization',vision:'Vision',team:'Team',committee:'Committee'},labels:{introduction:'Introduction',history:'History',objectives:'Objectives',core_values:'Values',vision:'Vision',mission:'Mission',video:'Video',watch:'Watch',statistics:'Statistics',empty:'Empty'},vision:{vision_en:'Vision',vision_ne:'दृष्टि',mission_en:'Mission',mission_ne:'लक्ष्य'},video:withVideo?{watch:'https://www.youtube.com/watch?v=M7lc1UVf-VE',embed:'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE'}:null,organization:{primary_logo:'/logo.png',name:'Organization',tagline:'Tagline'},assetUrl:()=>'/photo.png',contentText});
    assert.ok(html.indexOf('about-history organization-card')<html.indexOf('id="vision-mission"'));
    assert.ok(html.indexOf('id="vision-mission"')<html.indexOf('about-principles'));
    assert.ok(html.indexOf('about-principles')<html.indexOf('id="statistics"'));
    assert.equal(html.includes('<iframe'),withVideo);
    assert.equal(html.includes('about-history-with-video'),withVideo);
    assert.equal(html.includes('about-lead-visual'),withPhoto);
    assert.equal(html.includes('about-brand-visual'),!withPhoto);
    assert.ok(html.includes('1,200+'));
  }
});
