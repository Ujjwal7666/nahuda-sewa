import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {mkdtemp,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {createApp} from '../src/app.js';
import {readConfig} from '../src/config/env.js';
import {createDatabase} from '../src/services/database.js';
import {hashPassword} from '../src/services/passwords.js';
import {authenticationService} from '../src/services/authentication.js';
import {PrismaSessionStore} from '../src/services/session-store.js';
import {organizationSettingsService} from '../src/services/organization-settings.js';
import {fixedContentService} from '../src/services/fixed-content.js';
import {modules} from '../src/config/fixed-content.js';

test('Phase 4 content against isolated MySQL',{skip:!process.env.AUTH_TEST_DATABASE_URL},async t=> {
  const url=new URL(process.env.AUTH_TEST_DATABASE_URL);
  assert.match(url.pathname,/^\/nahuda_auth_test_[a-f0-9]{16}$/);
  const directory=await mkdtemp(join(tmpdir(),'nahuda-content-'));
  const db=createDatabase(url.href);
  const config=readConfig({NODE_ENV:'test',DATABASE_URL:url.href,SESSION_SECRET:randomBytes(32).toString('hex')});
  const settings=organizationSettingsService(db,directory), content=fixedContentService(db,directory);
  const password=randomBytes(24).toString('hex');
  const admin=await db.adminUser.create({data:{name:'Content QA',email:'content@example.test',password_hash:await hashPassword(password)}});
  const app=createApp(config,{auth:authenticationService(db,config),store:new PrismaSessionStore(db,config.sessionLifetimeMs),settings,content});
  const server=app.listen(0,'127.0.0.1'); await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  let cookie='',token='',branchId;
  async function request(path,body,anonymous=false) {
    const response=await fetch(base+path,{method:body?'POST':'GET',body,headers:anonymous?{}:{cookie},redirect:'manual'});
    if(!anonymous && response.headers.get('set-cookie')) cookie=response.headers.get('set-cookie').split(';')[0];
    const html=await response.text();
    if(!anonymous) token=/name="_csrf" value="([a-f0-9]+)"/.exec(html)?.[1]||token;
    return {status:response.status,html,response};
  }
  const fields=(module,prefix='Fixture')=>Object.fromEntries(module.fields.map(f=>[f.key,`${prefix} ${f.key} ${f.lang==='ne'?'परीक्षण':''}`]));
  const png=await sharp({create:{width:32,height:48,channels:4,background:'#008fd5'}}).png().toBuffer();
  async function save(module,data={},options={}) {
    const form=new FormData(); form.set('_csrf',options.token??token); form.set('revision',String(options.revision??0));
    if(module===modules.committee && branchId) form.set('branch_id',String(branchId));
    for(const [key,value] of Object.entries(data)) form.set(key,String(value));
    if(options.file) form.set('photo',new Blob([options.file.data],{type:options.file.type||'image/png'}),options.file.name||'photo.png');
    if(options.duplicate) form.append(options.duplicate,'duplicate');
    return request(module.path+(options.id?'/'+options.id:''),form,options.anonymous);
  }
  const all=['about','vision','team','committee'];
  const ids={};
  try {
    await t.test('public empty pages and equivalents work; all admin forms are protected',async()=> {
      for(const key of all) {
        const module=modules[key];
        for(const prefix of ['','/ne']) {
          const page=await request(prefix+module.publicPath,undefined,true);
          assert.equal(page.status,200); assert.match(page.html,/Information will be available|थप जानकारी/);
          assert.ok(page.html.includes(`href="${prefix?'':'/ne'}${module.publicPath.split('#')[0]}"`));
        }
        assert.equal((await request(module.path)).status,303);
        assert.equal((await save(module,fields(module),{anonymous:true,file:{data:png}})).status,303);
        assert.equal(await db[module.model].count(),0);
      }
      assert.deepEqual(await readdir(directory),[]);
      await request('/admin/login');
      assert.equal((await request('/admin/login',new URLSearchParams({_csrf:token,email:admin.email,password}))).status,303);
    });
    await t.test('CSRF, required pairs, repeated values, order and state reject without writes',async()=> {
      for(const key of all) {
        const module=modules[key];
        assert.equal((await request(module.path)).status,200);
        assert.equal((await save(module,fields(module),{token:'bad',...(module.photo||module.hero?{file:{data:png}}:{})})).status,403);
        assert.equal((await save(module)).status,400);
        assert.equal((await save(module,{...fields(module),[module.fields[1].key]:''})).status,400);
        assert.equal((await save(module,fields(module),{duplicate:module.fields[0].key})).status,400);
        if(module.singleton && !module.hero) assert.equal((await save(module,fields(module),{file:{data:png}})).status,400);
        if(module.photo) for(const bad of [{display_order:'-1'},{display_order:'1.2'},{is_active:'invalid'}]) assert.equal((await save(module,{...fields(module),...bad})).status,400);
        assert.equal(await db[module.model].count(),0);
      }
      assert.deepEqual(await readdir(directory),[]);
    });
    await t.test('fixed singletons persist both languages and escaped multiline text; stale saves fail',async()=> {
      for(const key of ['about','vision']) {
        const module=modules[key], data=fields(module);
        data[module.fields[0].key]='<script>alert(1)</script>\nSecond line';
        assert.equal((await save(module,data)).status,303);
        const row=await content.read(module); assert.equal(row.id,1); assert.equal(row.revision,1);
        await assert.rejects(db[module.model].create({data:{id:2,...data}}));
        const page=await request(module.path); assert.equal(page.status,200); assert.match(page.html,/&lt;script&gt;/);
        assert.equal((await save(module,fields(module,'Changed'),{revision:1})).status,303);
        assert.equal((await save(module,data,{revision:1})).status,409);
        for(const prefix of ['','/ne']) {
          const publicPage=await request(prefix+module.publicPath,undefined,true); assert.equal(publicPage.status,200);
          assert.ok(publicPage.html.includes(`Changed ${module.fields[prefix?1:0].key}`));
        }
      }
    });
    branchId=(await db.committeeBranch.create({data:{name_en:'QA branch',name_ne:'परीक्षण शाखा',description_en:'',description_ne:'',is_active:true}})).id;
    await t.test('optional member introductions save independently and new members appear dynamically',async()=> {
      for(const key of ['team','committee']) {
        const module=modules[key],data={...fields(module,'Optional'),introduction_en:'',introduction_ne:'',is_active:'1',display_order:'7'};
        assert.equal((await save(module,data)).status,303);
        const row=(await content.list(module))[0];
        assert.equal(row.introduction_en,''); assert.equal(row.introduction_ne,'');
        for(const prefix of ['','/ne']) {
          const page=await request(prefix+module.publicPath,undefined,true);
          assert.ok(page.html.includes('Optional name_'+(prefix?'ne':'en')));
          assert.ok(page.html.includes('member-photo-fallback'));
          assert.ok(!page.html.includes('member-introduction'));
        }
        assert.equal((await save(module,{...data,introduction_ne:'नेपाली परिचय'},{id:row.id,revision:row.revision})).status,303);
        assert.ok((await request('/ne'+module.publicPath,undefined,true)).html.includes('नेपाली परिचय'));
        assert.ok(!(await request(module.publicPath,undefined,true)).html.includes('member-introduction'));
        const form=await request(module.path+`/${row.id}/edit`);
        assert.match(form.html,/name="introduction_en"[^>]*maxlength/);
        assert.doesNotMatch(form.html,/name="introduction_en"[^>]*required/);
        const current=await content.read(module,row.id);
        assert.equal((await request(module.path+`/${row.id}/delete`,new URLSearchParams({_csrf:token,revision:String(current.revision)}))).status,303);
      }
    });
    await t.test('both member types create one paired record with optional photo and separate committee fields',async()=> {
      for(const key of ['team','committee']) {
        const module=modules[key];
        assert.equal((await request(module.path+'/new')).status,200);
        assert.equal((await save(module,fields(module),{file:{data:png,name:'../../photo.png'}})).status,303);
        const row=(await content.list(module))[0]; ids[key]=row.id;
        assert.equal(row.is_active,false); assert.equal(row.display_order,0); assert.ok(row.photo);
        assert.match(row.photo.storage_key,/^[a-f0-9-]{36}\.png$/);
        assert.equal((await request(module.path+`/${row.id}/edit`)).status,200);
        assert.ok(!(await request(module.publicPath,undefined,true)).html.includes('Fixture name_en'));
        if(key==='committee') assert.notEqual(row.position_en,row.committee_role_en);
        assert.equal((await request(module.path+'/0/edit')).status,404);
        assert.equal((await request(module.path+'/2147483647/edit')).status,404);
      }
    });
    await t.test('active filtering, ascending order and ID ties apply to EN/NE; edits and stale revisions work',async()=> {
      for(const key of ['team','committee']) {
        const module=modules[key],id=ids[key];
        const data={...fields(module,'Last'),is_active:'1',display_order:'20'};
        assert.equal((await save(module,data,{id,revision:1})).status,303);
        const filesBefore=await readdir(directory);
        assert.equal((await save(module,data,{id,revision:1,file:{data:png}})).status,409);
        assert.deepEqual(await readdir(directory),filesBefore);
        for(const [name,order,active] of [['First',1,'1'],['Tie',1,'1'],['Hidden',0,'0']]) assert.equal((await save(module,{...fields(module,name),display_order:String(order),is_active:active})).status,303);
        for(const prefix of ['','/ne']) {
          const page=await request(prefix+module.publicPath,undefined,true),lang=prefix?'ne':'en';
          assert.equal(page.status,200);
          const positions=['First','Tie','Last'].map(name=>page.html.indexOf(`${name} name_${lang}`));
          assert.ok(positions[0]>=0&&positions[0]<positions[1]&&positions[1]<positions[2]);
          assert.ok(!page.html.includes('Hidden name_')); assert.ok(!page.html.includes(`First name_${lang==='en'?'ne':'en'}`));
          if(key==='committee') for(const field of ['position','committee_role']) assert.ok(page.html.includes(`First ${field}_${lang}`));
        }
        assert.equal((await save(module,{...fields(module,'Last'),is_active:'0'},{id,revision:2})).status,303);
        assert.ok(!(await request(module.publicPath,undefined,true)).html.includes('Last name_en'));
      }
    });
    await t.test('all upload owners reject unsafe, corrupt, spoofed and oversized images before persistence',async()=> {
      for(const module of [modules.team,modules.committee,modules.image]) {
        const before=await readdir(directory),count=await db[module.model].count();
        for(const file of [{data:png,name:'evil.svg',type:'image/svg+xml'},{data:png,name:'evil.php'},{data:png,name:'fake.jpg',type:'image/jpeg'},{data:Buffer.from('broken')},{data:Buffer.alloc(10*1024*1024+1)}]) assert.equal((await save(module,fields(module),{file})).status,400);
        assert.deepEqual(await readdir(directory),before); assert.equal(await db[module.model].count(),count);
      }
    });
    await t.test('About images support bilingual descriptions, ordering, replacement and deletion',async()=> {
      const module=modules.image;
      assert.equal((await request(module.path+'/new')).status,200);
      assert.equal((await save(module,fields(module))).status,400);
      for(const [name,order] of [['Second image',2],['First image',1]]) assert.equal((await save(module,{...fields(module,name),display_order:String(order)},{file:{data:png}})).status,303);
      let images=(await content.read(modules.about)).images; assert.equal(images.length,2);
      assert.match(images[0].alt_text_en,/First image/);
      const old=images[0].media.storage_key;
      for(const prefix of ['','/ne']) {
        const page=await request(prefix+'/about',undefined,true),lang=prefix?'ne':'en';
        assert.ok(page.html.indexOf(`First image alt_text_${lang}`)<page.html.indexOf(`Second image alt_text_${lang}`));
      }
      assert.equal((await save(module,fields(module,'Replacement'),{id:images[0].id,revision:1,file:{data:png}})).status,303);
      assert.equal((await request('/media/'+old,undefined,true)).status,404); assert.ok(!(await readdir(directory)).includes(old));
      images=(await content.read(modules.about)).images;
      for(const image of images) {
        assert.equal((await request(module.path+`/${image.id}/delete`)).status,200);
        assert.equal((await request(module.path+`/${image.id}/delete`,new URLSearchParams({_csrf:token,revision:String(image.revision)}))).status,303);
        assert.equal((await request('/media/'+image.media.storage_key,undefined,true)).status,404);
      }
      assert.equal((await content.read(modules.about)).images.length,0);
    });
    await t.test('shared media remains referenced when either organization settings or content replaces it',async()=> {
      const team=await content.read(modules.team,ids.team);
      await db.organizationSettings.create({data:{id:1,primary_logo_id:team.photo.id}});
      await settings.save({}, {revision:'1',clear_primary_logo:'1'});
      assert.ok(await db.mediaAsset.findUnique({where:{id:team.photo.id}}));
      assert.equal((await request('/media/'+team.photo.storage_key,undefined,true)).status,200);
      await db.organizationSettings.update({where:{id:1},data:{primary_logo_id:team.photo.id}});
      assert.equal((await save(modules.team,fields(modules.team),{id:team.id,revision:team.revision,file:{data:png}})).status,303);
      assert.ok(await db.mediaAsset.findUnique({where:{id:team.photo.id}}));
      const settingsRow=await settings.read();
      await settings.save({}, {revision:String(settingsRow.revision),clear_primary_logo:'1'});
      assert.equal((await request('/media/'+team.photo.storage_key,undefined,true)).status,404);
    });
    await t.test('photo display/replace/remove and member deletion clean assets and reject stale deletes',async()=> {
      for(const key of ['team','committee']) {
        const module=modules[key],id=ids[key];
        let row=await content.read(module,id),old=row.photo.storage_key;
        const image=await fetch(base+'/media/'+old); assert.equal(image.status,200); assert.equal(image.headers.get('content-type'),'image/png');
        assert.equal((await save(module,{...fields(module),clear_photo:'1'},{id,revision:row.revision,file:{data:png}})).status,400);
        assert.equal((await save(module,fields(module),{id,revision:row.revision,file:{data:png}})).status,303);
        assert.equal((await request('/media/'+old,undefined,true)).status,404);
        row=await content.read(module,id); old=row.photo.storage_key;
        assert.equal((await save(module,{...fields(module),clear_photo:'1'},{id,revision:row.revision})).status,303);
        assert.equal((await content.read(module,id)).photo,null); assert.equal((await request('/media/'+old,undefined,true)).status,404);
        assert.equal((await request(module.path+`/${id}/delete`)).status,200);
        assert.equal((await request(module.path+`/${id}/delete`,new URLSearchParams({_csrf:token,revision:'1'}))).status,409);
        row=await content.read(module,id);
        assert.equal((await request(module.path+`/${id}/delete`,new URLSearchParams({_csrf:'bad',revision:String(row.revision)}))).status,403);
        assert.equal((await request(module.path+`/${id}/delete`,new URLSearchParams({_csrf:token,revision:String(row.revision)}))).status,303);
        assert.equal(await content.read(module,id),null);
      }
    });
    await t.test('About hero upload, fallback, replacement and removal preserve existing text and secure media',async()=> {
      let row=await content.read(modules.about);
      const page=await request('/about',undefined,true); assert.match(page.html,/about-hero-default/); assert.ok(!page.html.includes('about-hero-background'));
      for(const file of [{data:Buffer.from('bad')},{data:png,name:'bad.svg',type:'image/svg+xml'},{data:Buffer.alloc(10*1024*1024+1)}]) assert.equal((await save(modules.about,fields(modules.about),{revision:row.revision,file})).status,400);
      assert.equal((await save(modules.about,fields(modules.about),{revision:row.revision,file:{data:png}})).status,303);
      row=await content.read(modules.about); let old=row.hero_image.storage_key;
      for(const prefix of ['','/ne']) { const result=await request(prefix+'/about',undefined,true);assert.match(result.html,/about-hero-with-image/);assert.ok(result.html.includes('/media/'+old)); }
      assert.equal((await save(modules.about,fields(modules.about),{revision:row.revision-1,file:{data:png}})).status,409);
      assert.equal((await save(modules.about,fields(modules.about),{revision:row.revision,file:{data:png}})).status,303);
      assert.equal((await request('/media/'+old,undefined,true)).status,404);
      row=await content.read(modules.about);old=row.hero_image.storage_key;
      assert.equal((await save(modules.about,{...fields(modules.about),clear_photo:'1'},{revision:row.revision})).status,303);
      assert.equal((await request('/media/'+old,undefined,true)).status,404);
      assert.match((await request('/ne/about',undefined,true)).html,/about-hero-default/);
    });
    await t.test('YouTube URL validates and clears; fixed embeds and Vision/Mission appear only inside About',async()=> {
      let row=await content.read(modules.about);
      assert.ok(!(await request('/about',undefined,true)).html.includes('<iframe'));
      for(const youtube_url of ['javascript:alert(1)','https://youtube.com.evil.test/watch?v=abcdefghijk','https://user:pass@youtube.com/watch?v=abcdefghijk','<iframe></iframe>']) assert.equal((await save(modules.about,{...fields(modules.about),youtube_url},{revision:row.revision})).status,400);
      assert.equal((await save(modules.about,{...fields(modules.about),youtube_url:'https://youtu.be/abcdefghijk?si=ignored'},{revision:row.revision})).status,303);
      row=await content.read(modules.about);assert.equal(row.youtube_url,'https://www.youtube.com/watch?v=abcdefghijk');
      for(const prefix of ['','/ne']) {
        const page=await request(prefix+'/about',undefined,true);assert.match(page.html,/src="https:\/\/www.youtube-nocookie.com\/embed\/abcdefghijk"/); assert.match(page.html,/id="vision-mission"/);assert.ok(page.html.includes(`Changed vision_${prefix?'ne':'en'}`));
        assert.match(page.response.headers.get('content-security-policy'),/frame-src https:\/\/www.youtube-nocookie.com/);
        const redirect=await request(prefix+'/about/vision-mission',undefined,true);assert.equal(redirect.status,308);assert.equal(redirect.response.headers.get('location'),prefix+'/about#vision-mission');
      }
      assert.ok(!(await request('/',undefined,true)).response.headers.get('content-security-policy').includes('frame-src'));
      assert.equal((await save(modules.about,{...fields(modules.about),youtube_url:''},{revision:row.revision})).status,303);
      assert.ok(!(await request('/about',undefined,true)).html.includes('<iframe'));
    });
    await t.test('four statistics support protected CRUD, exact values, bilingual labels, active filtering and order',async()=> {
      const module=modules.statistic;
      assert.equal((await request(module.path,undefined,true)).status,303);
      assert.equal((await request(module.path)).status,200);assert.equal((await request(module.path+'/new')).status,200);
      const data={label_en:'Community <script>',label_ne:'समुदाय पहुँच',value:'1,200+',kind:'community_reach',display_order:'20',is_active:'1'};
      assert.equal((await save(module,data,{token:'bad'})).status,403);
      for(const bad of [{label_ne:''},{kind:'unknown'},{value:'x'.repeat(41)},{value:'1\n2'},{display_order:'-1'},{is_active:'true'}]) assert.equal((await save(module,{...data,...bad})).status,400);
      assert.equal((await save(module,data)).status,303);
      assert.equal((await save(module,data)).status,409);
      const first=(await content.list(module))[0];assert.equal(first.value,'1,200+');
      assert.equal((await request(module.path+`/${first.id}/edit`)).status,200);
      for(const [kind,label,order,active] of [['families_supported','Families',1,'1'],['projects_completed','Projects',1,'1'],['active_volunteers','Hidden volunteers',0,'0']]) assert.equal((await save(module,{...data,kind,label_en:label,label_ne:label+' नेपाली',display_order:String(order),is_active:active})).status,303);
      for(const prefix of ['','/ne']) {
        const page=await request(prefix+'/about',undefined,true);
        assert.match(page.html,/id="statistics"/);assert.ok(!page.html.includes('Hidden volunteers'));assert.ok(page.html.indexOf('Families')<page.html.indexOf('Projects'));
        assert.ok(page.html.includes('1,200+'));assert.ok(page.html.includes(prefix?'समुदाय पहुँच':'Community &lt;script&gt;'));
      }
      assert.equal((await save(module,{...data,value:' 2,000+ ',is_active:'0'},{id:first.id,revision:1})).status,303);
      assert.equal((await content.read(module,first.id)).value,' 2,000+ ');
      assert.equal((await save(module,data,{id:first.id,revision:1})).status,409);
      for(const stat of await content.list(module)) {
        assert.equal((await request(module.path+`/${stat.id}/delete`)).status,200);
        assert.equal((await request(module.path+`/${stat.id}/delete`,new URLSearchParams({_csrf:token,revision:String(stat.revision)}))).status,303);
      }
      assert.equal(await db.aboutStatistic.count(),0);assert.ok(!(await request('/about',undefined,true)).html.includes('id="statistics"'));
    });
    await t.test('Committee branch CRUD, filtering, required associations and safe deletion',async()=> {
      const module=modules.committeeBranch;
      for(const path of [module.path,module.path+'/new',module.path+'/1/edit',module.path+'/1/delete']) assert.equal((await request(path,undefined,true)).status,303);
      assert.equal((await request(module.path)).status,200);
      const data={name_en:'Dynamic branch <script>',name_ne:'गतिशील समिति',display_order:'2',is_active:'1'};
      assert.equal((await save(module,data,{token:'bad'})).status,403);
      for(const bad of [{name_ne:''},{display_order:'-1'},{is_active:'true'}]) assert.equal((await save(module,{...data,...bad})).status,400);
      assert.equal((await save(module,data,{duplicate:'name_en'})).status,400);
      assert.equal((await save(module,data,{file:{data:png}})).status,400);
      assert.equal((await save(module,data)).status,303);
      const branch=(await content.list(module)).find(row=>row.name_en===data.name_en);
      assert.equal((await request(module.path+'/'+branch.id+'/edit')).status,200);
      assert.equal((await save(module,{...data,name_en:'Edited branch',description_en:'English only'},{id:branch.id,revision:1})).status,303);
      assert.equal((await save(module,data,{id:branch.id,revision:1})).status,409);
      assert.match((await request('/about/committee',undefined,true)).html,/English only/);
      assert.doesNotMatch((await request('/ne/about/committee',undefined,true)).html,/English only/);
      assert.equal((await save(module,{...data,name_en:'Edited branch',is_active:'0'},{id:branch.id,revision:2})).status,303);
      assert.doesNotMatch((await request('/about/committee',undefined,true)).html,/Edited branch/);
      assert.equal((await save(module,{...data,name_en:'Edited branch',display_order:'0'},{id:branch.id,revision:3})).status,303);
      const memberData={name_en:'Names Only',name_ne:'नाम मात्र',branch_id:String(branch.id),is_active:'0'};
      for(const branch_id of ['', '2147483647']) assert.equal((await save(modules.committee,{...memberData,branch_id})).status,400);
      assert.equal((await save(modules.committee,memberData)).status,303);
      let member=(await content.list(modules.committee)).find(row=>row.name_en==='Names Only');
      assert.equal(member.branch_id,branch.id);assert.equal(member.position_en,'');assert.equal(member.photo,null);
      const filtered=await request('/admin/committee?branch='+branch.id);assert.equal(filtered.status,200);assert.match(filtered.html,/Names Only/);assert.doesNotMatch(filtered.html,/First name_en/);
      assert.equal((await request('/admin/committee?branch=')).status,200);
      assert.equal((await request('/admin/committee?branch=bad')).status,400);
      assert.match((await request('/admin/committee/new?branch='+branch.id)).html,new RegExp('value="'+branch.id+'" selected'));
      const del=()=>request(module.path+'/'+branch.id+'/delete',new URLSearchParams({_csrf:token,revision:'4'}));
      assert.match((await request(module.path+'/'+branch.id+'/delete')).html,/1 members/);
      assert.equal((await del()).status,409);assert.ok(await content.read(modules.committee,member.id));
      await assert.rejects(db.committeeBranch.delete({where:{id:branch.id}}));
      assert.equal((await save(modules.committee,{...memberData,branch_id:String(branchId)},{id:member.id,revision:1})).status,303);
      assert.equal((await content.read(modules.committee,member.id)).branch_id,branchId);
      assert.equal((await save(modules.committee,memberData,{id:member.id,revision:1})).status,409);
      assert.equal((await del()).status,303);assert.ok(await content.read(modules.committee,member.id));
      member=await content.read(modules.committee,member.id);
      await content.delete(modules.committee,member.id,{revision:String(member.revision)});
    });
    await t.test('Committee public branches and members order independently, hide inactive content and switch language',async()=> {
      const data={description_en:'',description_ne:'',is_active:true};
      const first=await db.committeeBranch.create({data:{...data,name_en:'Branch Alpha',name_ne:'पहिलो शाखा',display_order:1}});
      const last=await db.committeeBranch.create({data:{...data,name_en:'Branch Omega',name_ne:'अन्तिम शाखा',display_order:9}});
      const hidden=await db.committeeBranch.create({data:{...data,name_en:'Secret branch',name_ne:'गोप्य शाखा',display_order:0,is_active:false}});
      const memberData={name_en:'One Name',name_ne:'पहिलो सदस्य',position_en:'',position_ne:'',committee_role_en:'',committee_role_ne:'',introduction_en:'',introduction_ne:'',is_active:true};
      const one=await db.committeeMember.create({data:{...memberData,branch_id:first.id,display_order:2}});
      await db.committeeMember.create({data:{...memberData,name_en:'Earlier Member',name_ne:'अगाडिको सदस्य',branch_id:first.id,display_order:1}});
      await db.committeeMember.create({data:{...memberData,name_en:'Hidden member',name_ne:'लुकेको सदस्य',branch_id:first.id,is_active:false}});
      await db.committeeMember.create({data:{...memberData,name_en:'Hidden by branch',name_ne:'लुकेको शाखाको सदस्य',branch_id:hidden.id}});
      // Nullable FK is exclusively the migration compatibility state, never allowed by CMS validation.
      const legacy=await db.committeeMember.create({data:{...memberData,name_en:'Legacy unassigned',name_ne:'पुरानो सदस्य',branch_id:null}});
      const before={...legacy};
      assert.match((await request('/admin/committee?branch=unassigned')).html,/Legacy unassigned/);
      for(const prefix of ['','/ne']) {
        const page=await request(prefix+'/about/committee',undefined,true);assert.equal(page.status,200);
        const html=page.html;assert.ok(html.indexOf(prefix?'पहिलो शाखा':'Branch Alpha')<html.indexOf(prefix?'अन्तिम शाखा':'Branch Omega'));
        assert.ok(html.indexOf(prefix?'अगाडिको सदस्य':'Earlier Member')<html.indexOf(prefix?'पहिलो सदस्य':'One Name'));
        for(const hiddenText of ['Secret branch','गोप्य शाखा','Hidden member','लुकेको सदस्य','Hidden by branch','लुकेको शाखाको सदस्य','Legacy unassigned','पुरानो सदस्य']) assert.ok(!html.includes(hiddenText));
        assert.ok(html.includes(prefix?'थप जानकारी':'Information will be available'));assert.match(html,/committee-initials/);
        assert.ok(html.includes('href="'+(prefix?'':'/ne')+'/about/committee"'));
      }
      assert.deepEqual(await db.committeeMember.findUnique({where:{id:legacy.id}}),before);
      assert.equal((await save(modules.committee,{...memberData,branch_id:String(last.id),is_active:'1'},{id:legacy.id,revision:1})).status,303);
      assert.match((await request('/about/committee',undefined,true)).html,/One Name/);
      await db.committeeMember.deleteMany({where:{branch_id:{in:[first.id,last.id,hidden.id]}}});
      await db.committeeBranch.deleteMany({where:{id:{in:[first.id,last.id,hidden.id]}}});
    });
    await t.test('Life Members CRUD is protected; active names follow all Committee branches in both languages',async()=> {
      const module=modules.lifeMembers;
      assert.equal((await request(module.path,undefined,true)).status,303);
      assert.equal((await request(module.path)).status,200);
      const values={name_en:'Second life member',name_ne:'दोस्रो आजीवन सदस्य',display_order:'20',is_active:'1'};
      assert.equal((await save(module,values,{token:'bad'})).status,403);
      assert.equal((await save(module,{...values,name_ne:''})).status,400);
      assert.equal((await save(module,{...values,display_order:'1000000'})).status,400);
      assert.equal((await save(module,values)).status,303);
      const second=(await content.list(module))[0];
      assert.equal((await request(module.path+`/${second.id}/edit`)).status,200);
      assert.equal((await save(module,{...values,name_en:'Second life member edited',name_ne:'सम्पादित दोस्रो आजीवन सदस्य'},{revision:second.revision,id:second.id})).status,303);
      assert.equal((await save(module,values,{revision:second.revision,id:second.id})).status,409);
      assert.equal((await save(module,{...values,name_en:'First life member',name_ne:'पहिलो आजीवन सदस्य',display_order:'2'})).status,303);
      assert.equal((await save(module,{...values,name_en:'Inactive life member',display_order:'0',is_active:'0'})).status,303);
      const branch=await db.committeeBranch.create({data:{name_en:'Final dynamic branch',name_ne:'अन्तिम गतिशील शाखा',description_en:'',description_ne:'',display_order:999,is_active:true}});
      await db.committeeMember.create({data:{name_en:'Final dynamic committee member',name_ne:'अन्तिम गतिशील समिति सदस्य',position_en:'',position_ne:'',committee_role_en:'',committee_role_ne:'',introduction_en:'',introduction_ne:'',branch_id:branch.id,display_order:999,is_active:true}});
      for(const prefix of ['','/ne']) {
        const page=await request(prefix+'/about/committee',undefined,true), html=page.html;
        const dynamic=html.indexOf(prefix?'अन्तिम गतिशील समिति सदस्य':'Final dynamic committee member');
        const heading=html.indexOf(prefix?'आजीवन सदस्य':'Life Members');
        const first=html.indexOf(prefix?'पहिलो आजीवन सदस्य':'First life member');
        const secondName=html.indexOf(prefix?'सम्पादित दोस्रो आजीवन सदस्य':'Second life member edited');
        assert.ok(dynamic>=0&&dynamic<heading&&heading<first&&first<secondName);
        assert.ok(!html.includes(prefix?'Inactive life member':'Inactive life member'));
      }
      const saved=await content.read(module,second.id);
      assert.equal((await request(module.path+`/${second.id}/delete`)).status,200);
      assert.equal((await request(module.path+`/${second.id}/delete`,new URLSearchParams({_csrf:token,revision:String(saved.revision)}))).status,303);
      assert.equal(await content.read(module,second.id),null);
      await db.lifeMember.deleteMany();
      await db.committeeMember.deleteMany({where:{branch_id:branch.id}});
      await db.committeeBranch.delete({where:{id:branch.id}});
      assert.doesNotMatch((await request('/about/committee',undefined,true)).html,/life-members-section/);
    });
    await t.test('stored scripts stay escaped and long bilingual content renders; logout protects mutations',async()=> {
      const module=modules.team;
      const data={...fields(module,'Escaped'),name_en:'<script>alert(1)</script>',introduction_ne:'लामो नेपाली परिचय\n'.repeat(500),is_active:'1'};
      assert.equal((await save(module,data)).status,303);
      const en=await request(module.publicPath,undefined,true),ne=await request('/ne'+module.publicPath,undefined,true);
      assert.match(en.html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/); assert.ok(!en.html.includes('<script>alert(1)</script>')); assert.match(ne.html,/लामो नेपाली परिचय/);
      assert.equal((await request('/admin/logout',new URLSearchParams({_csrf:token}))).status,303);
      assert.equal((await save(module,fields(module))).status,303);
      assert.equal((await request(module.path+`/${ids.team}/delete`,new URLSearchParams({_csrf:token,revision:'1'}))).status,303);
    });
  } finally {
    await new Promise(resolve=>server.close(resolve));
    await db.aboutStatistic.deleteMany(); await db.aboutImage.deleteMany(); await db.teamMember.deleteMany(); await db.committeeMember.deleteMany(); await db.committeeBranch.deleteMany();
    await db.aboutOrganization.deleteMany(); await db.visionMission.deleteMany(); await db.organizationSettings.deleteMany(); await db.mediaAsset.deleteMany();
    await db.adminUser.delete({where:{id:admin.id}}); await db.$disconnect();
    assert.ok(directory.startsWith(join(tmpdir(),'nahuda-content-'))); await rm(directory,{recursive:true,force:true});
  }
});
