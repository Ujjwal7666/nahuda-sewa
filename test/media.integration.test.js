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
import {mediaContentService} from '../src/services/media-content.js';
import {mediaModules as modules} from '../src/config/media-content.js';

test('Phase 5 Media CMS on isolated MySQL',{skip:!process.env.AUTH_TEST_DATABASE_URL},async t=> {
  const url=new URL(process.env.AUTH_TEST_DATABASE_URL);assert.match(url.pathname,/^\/nahuda_auth_test_[a-f0-9]{16}$/);
  const directory=await mkdtemp(join(tmpdir(),'nahuda-media-')),db=createDatabase(url.href);
  const config=readConfig({NODE_ENV:'test',DATABASE_URL:url.href,SESSION_SECRET:randomBytes(32).toString('hex')});
  const settings=organizationSettingsService(db,directory),mediaContent=mediaContentService(db,directory);
  const password=randomBytes(24).toString('hex');
  const admin=await db.adminUser.create({data:{name:'Media QA',email:'media@example.test',password_hash:await hashPassword(password)}});
  const app=createApp(config,{auth:authenticationService(db,config),store:new PrismaSessionStore(db,config.sessionLifetimeMs),settings,mediaContent});
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  let cookie='',token='';
  const png=await sharp({create:{width:80,height:120,channels:4,background:'#008fd5'}}).png().toBuffer();
  async function request(path,body,anonymous=false) {
    const response=await fetch(base+path,{method:body?'POST':'GET',body,headers:anonymous?{}:{cookie},redirect:'manual'});
    if(!anonymous && response.headers.get('set-cookie')) cookie=response.headers.get('set-cookie').split(';')[0];
    const html=await response.text();if(!anonymous) token=/name="_csrf" value="([a-f0-9]+)"/.exec(html)?.[1]||token;
    return {status:response.status,html,response};
  }
  const fields=(module,prefix='Fixture')=>Object.fromEntries(module.fields.map(f=>[f.key,f.optional?'':`${prefix} ${f.key}${f.lang==='ne'?' नेपाली':''}`]));
  const pathFor=(module,parent)=>module.parent?modules[module.parent].path+'/'+parent+'/images':module.path;
  async function save(module,data,options={}) {
    const form=new FormData();form.set('_csrf',options.token??token);form.set('revision',String(options.revision??0));
    for(const [key,value] of Object.entries(data)) form.set(key,String(value));
    if(options.file) form.set('photo',new Blob([options.file.data],{type:options.file.type||'image/png'}),options.file.name||'photo.png');
    if(options.duplicate) form.append(options.duplicate,'duplicate');
    return request(pathFor(module,options.parent)+(options.id?'/'+options.id:''),form,options.anonymous);
  }
  const deleteRow=async(module,row,parent)=>request(pathFor(module,parent)+'/'+row.id+'/delete',new URLSearchParams({_csrf:token,revision:String(row.revision)}));
  const ids={};
  try {
    await t.test('localized empty pages, equivalents and authentication guard',async()=> {
      for(const key of ['news','gallery','testimonials']) {
        const module=modules[key];
        for(const prefix of ['','/ne']) {const page=await request(prefix+module.publicPath,undefined,true);assert.equal(page.status,200);assert.match(page.html,/Information will be available|थप जानकारी/);assert.ok(page.html.includes(`href="${prefix?'':'/ne'}${module.publicPath}"`));}
        for(const path of [module.path,module.path+'/new',module.path+'/1/edit',module.path+'/1/delete']) assert.equal((await request(path)).status,303);
        assert.equal((await save(module,fields(module),{anonymous:true,file:{data:png}})).status,303);
      }
      await request('/admin/login');assert.equal((await request('/admin/login',new URLSearchParams({_csrf:token,email:admin.email,password}))).status,303);
    });
    await t.test('News CRUD, unique/slash-safe slug, date validation and draft direct-route filtering',async()=> {
      const module=modules.news,data={...fields(module),slug:'our-news'};
      assert.equal((await request(module.path+'/new')).status,200);
      for(const [bad,expected] of [[{title_ne:''},400],[{slug:'../bad'},400],[{published_date:'2026-02-30'},400],[{status:'PUBLISHED'},400],[{status:'BAD'},400]]) assert.equal((await save(module,{...data,...bad})).status,expected);
      assert.equal((await save(module,data,{token:'bad',file:{data:png}})).status,403);
      assert.equal((await save(module,data,{duplicate:'title_en'})).status,400);
      assert.equal((await save(module,data,{file:{data:png}})).status,303);
      const row=(await mediaContent.list(module))[0];ids.news=row.id;assert.equal(row.status,'DRAFT');assert.ok(row.featured_image);
      for(const prefix of ['','/ne']) assert.equal((await request(prefix+'/news/our-news',undefined,true)).status,404);
      assert.equal((await save(module,data,{file:{data:png}})).status,409);
      assert.equal(await db.news.count(),1);assert.equal((await readdir(directory)).length,1);
      assert.equal((await request('/news/a%2Fb',undefined,true)).status,404);
      assert.equal((await request(module.path+'/'+row.id+'/edit')).status,200);
      assert.equal((await save(module,{...data,slug:'changed-draft',status:'PUBLISHED',published_date:'2026-10-02',content_ne:'नेपाली लेख\n'.repeat(100),content_en:'<script>alert(1)</script>'},{id:row.id,revision:1})).status,303);
      const published=await mediaContent.read(module,row.id);assert.equal(published.slug_locked,true);
      for(const prefix of ['','/ne']) {const page=await request(prefix+'/news/changed-draft',undefined,true);assert.equal(page.status,200);assert.ok(page.html.includes(prefix?'नेपाली लेख':'&lt;script&gt;alert(1)&lt;/script&gt;'));assert.ok(page.html.includes(`href="${prefix?'':'/ne'}/news/changed-draft"`));assert.ok(page.html.includes('/media/'+row.featured_image.storage_key));}
      assert.equal((await save(module,{...data,slug:'another',status:'DRAFT'},{id:row.id,revision:2})).status,409);
      assert.equal((await save(module,{...data,slug:'changed-draft',status:'DRAFT'},{id:row.id,revision:2})).status,303);
      assert.equal((await request('/news/changed-draft',undefined,true)).status,404);
      assert.equal((await save(module,{...data,slug:'changed-draft',status:'PUBLISHED',published_date:'2026-10-02'},{id:row.id,revision:3})).status,303);
    });
    await t.test('news chronological ordering and optional body/images',async()=> {
      const module=modules.news;
      for(const [name,date,status] of [['Old','2025-01-01','PUBLISHED'],['Tie','2026-10-02','PUBLISHED'],['Hidden','2099-01-01','DRAFT']]) assert.equal((await save(module,{...fields(module,name),slug:name.toLowerCase(),published_date:date,status})).status,303);
      for(const prefix of ['','/ne']) {const html=(await request(prefix+'/news',undefined,true)).html;assert.ok(!html.includes('Hidden title_'));assert.ok(html.indexOf('Tie title_')<html.indexOf('Fixture title_'));assert.ok(html.indexOf('Fixture title_')<html.indexOf('Old title_'));assert.equal((await request(prefix+'/news/old',undefined,true)).status,200);}
    });
    await t.test('Gallery albums and Testimonials support optional media/text, CRUD, active filtering and stable ordering',async()=> {
      for(const key of ['gallery','testimonials']) {
        const module=modules[key];
        assert.equal((await save(module,fields(module),{file:{data:png}})).status,303);
        let row=(await mediaContent.list(module))[0];ids[key]=row.id;assert.equal(row.is_active,false);
        assert.ok(!(await request(module.publicPath,undefined,true)).html.includes('Fixture '+(key==='gallery'?'title':'name')+'_en'));
        const data={...fields(module),is_active:'1',...(key==='gallery'?{date:'2026-10-02'}:{display_order:'20'})};
        assert.equal((await save(module,data,{id:row.id,revision:1})).status,303);
        assert.equal((await request(module.path+'/'+row.id+'/edit')).status,200);
        for(const [name,order,active] of [['First',1,'1'],['Tie',1,'1'],['Hidden',0,'0']]) assert.equal((await save(module,{...fields(module,name),is_active:active,...(key==='gallery'?{date:order===1?'2026-10-03':''}:{display_order:String(order)})})).status,303);
        for(const prefix of ['','/ne']) {const html=(await request(prefix+module.publicPath,undefined,true)).html,field=key==='gallery'?'title':'name';assert.ok(html.includes(`Fixture ${field}_${prefix?'ne':'en'}`));assert.ok(!html.includes('Hidden '+field));const first=html.indexOf('First '+field),tie=html.indexOf('Tie '+field),last=html.indexOf('Fixture '+field);assert.ok(first>=0&&tie>=0&&first<last&&tie<last);if(key==='testimonials') assert.ok(first<tie);}
        assert.equal((await save(module,{...data,is_active:'0'},{id:row.id,revision:2})).status,303);
        assert.ok(!(await request(module.publicPath,undefined,true)).html.includes('Fixture '+(key==='gallery'?'title':'name')+'_en'));
        assert.equal((await save(module,data,{id:row.id,revision:3})).status,303);
      }
    });
    await t.test('ordered child images, captions and bilingual alt text belong to their parent only',async()=> {
      for(const [childKey,parentKey] of [['newsImage','news'],['galleryImage','gallery']]) {
        const module=modules[childKey],parent=ids[parentKey];
        assert.equal((await request(pathFor(module,parent))).status,200);
        assert.equal((await request(pathFor(module,parent)+'/new')).status,200);
        assert.equal((await request(pathFor(module,2147483647))).status,404);
        assert.equal((await save(module,fields(module),{parent})).status,400);
        for(const [name,order] of [['Second image',2],['First image',1]]) assert.equal((await save(module,{...fields(module,name),display_order:String(order),...(childKey==='galleryImage'?{caption_en:name+' caption',caption_ne:name+' नेपाली क्याप्सन'}:{})},{parent,file:{data:png}})).status,303);
        const images=await mediaContent.list(module,false,parent);assert.equal(images.length,2);assert.match(images[0].alt_text_en,/First image/);
        const other=(await mediaContent.list(modules[parentKey])).find(row=>row.id!==parent);
        assert.equal((await request(pathFor(module,other.id)+'/'+images[0].id+'/edit')).status,404);
        assert.equal((await save(module,fields(module),{parent:other.id,id:images[0].id,revision:images[0].revision})).status,404);
        for(const prefix of ['','/ne']) {const html=(await request(prefix+(parentKey==='news'?'/news/changed-draft':'/gallery/'+parent),undefined,true)).html;assert.ok(html.indexOf('First image alt_text_')<html.indexOf('Second image alt_text_'));if(parentKey==='gallery') assert.ok(html.includes(prefix?'नेपाली क्याप्सन':'First image caption'));}
        let parentRow=await mediaContent.read(modules[parentKey],parent);
        const visibility=parentKey==='news'?{status:'DRAFT'}:{is_active:'0'};
        assert.equal((await save(modules[parentKey],{...fields(modules[parentKey]),...(parentKey==='news'?{slug:'changed-draft',published_date:'2026-10-02'}:{}),...visibility},{id:parent,revision:parentRow.revision})).status,303);
        assert.deepEqual(await mediaContent.list(module,true,parent),[]);
        parentRow=await mediaContent.read(modules[parentKey],parent);
        assert.equal((await save(modules[parentKey],{...fields(modules[parentKey]),...(parentKey==='news'?{slug:'changed-draft',published_date:'2026-10-02',status:'PUBLISHED'}:{is_active:'1'})},{id:parent,revision:parentRow.revision})).status,303);
      }
    });
    await t.test('every media upload flow rejects corrupt, mismatched, oversized and unexpected files',async()=> {
      for(const module of ['news','gallery','testimonials','newsImage','galleryImage'].map(key=>modules[key])) {
        const parent=module.parent?ids[module.parent]:undefined,body={...fields(module),...(module.news?{slug:'unsafe'}:{})};
        const before=await readdir(directory),count=await db[module.model].count();
        for(const file of [{data:Buffer.from('bad')},{data:png,name:'evil.svg',type:'image/svg+xml'},{data:png,name:'evil.php'},{data:png,name:'fake.jpg',type:'image/jpeg'},{data:Buffer.alloc(10*1024*1024+1)}]) assert.equal((await save(module,body,{parent,file})).status,400);
        assert.equal((await save(module,body,{parent,duplicate:module.fields[0].key,file:{data:png}})).status,400);
        assert.equal((await save(module,body,{parent,token:'bad',file:{data:png}})).status,403);
        assert.deepEqual(await readdir(directory),before);assert.equal(await db[module.model].count(),count);
      }
    });
    await t.test('replace/remove, shared reference preservation, parent deletion and stale revision cleanup',async()=> {
      for(const key of ['news','gallery','testimonials','newsImage','galleryImage']) {
        const module=modules[key],parent=module.parent?ids[module.parent]:undefined;
        let row=module.parent?(await mediaContent.list(module,false,parent))[0]:await mediaContent.read(module,ids[key]);
        const body={...fields(module),...(module.news?{slug:'changed-draft',status:'PUBLISHED',published_date:'2026-10-02'}:{})};
        const before=await readdir(directory);
        assert.equal((await save(module,body,{id:row.id,parent,revision:row.revision-1,file:{data:png}})).status,409);assert.deepEqual(await readdir(directory),before);
        const old=row[module.asset];
        await db.organizationSettings.upsert({where:{id:1},create:{id:1,primary_logo_id:old.id},update:{primary_logo_id:old.id}});
        assert.equal((await save(module,body,{id:row.id,parent,revision:row.revision,file:{data:png}})).status,303);
        assert.ok(await db.mediaAsset.findUnique({where:{id:old.id}}));
        let settingsRow=await settings.read();await settings.save({}, {revision:String(settingsRow.revision),clear_primary_logo:'1'});
        assert.equal((await request('/media/'+old.storage_key,undefined,true)).status,404);
        row=await mediaContent.read(module,row.id,parent);
        assert.equal((await request('/media/'+row[module.asset].storage_key,undefined,true)).status,200);
        if(!module.requiredImage) {const oldKey=row[module.asset].storage_key;assert.equal((await save(module,{...body,clear_photo:'1'},{id:row.id,parent,revision:row.revision})).status,303);assert.equal((await request('/media/'+oldKey,undefined,true)).status,404);}
      }
      for(const key of ['news','gallery','testimonials']) {
        const module=modules[key],row=await mediaContent.read(module,ids[key]);
        assert.equal((await request(module.path+'/'+row.id+'/delete')).status,200);
        assert.equal((await request(module.path+'/'+row.id+'/delete',new URLSearchParams({_csrf:'bad',revision:String(row.revision)}))).status,403);
        assert.equal((await request(module.path+'/'+row.id+'/delete',new URLSearchParams({_csrf:token,revision:'1'}))).status,409);
        assert.equal((await deleteRow(module,row)).status,303);assert.equal(await mediaContent.read(module,row.id),null);
      }
      assert.equal(await db.newsImage.count(),0);assert.equal(await db.galleryImage.count(),0);
    });
    await t.test('independently optional translations persist without fallback; cover falls back to first ordered image',async()=> {
      const album=(await mediaContent.list(modules.gallery,true))[0];
      assert.equal((await save(modules.gallery,{...fields(modules.gallery),description_en:'',description_ne:'नेपाली विवरण मात्र',is_active:'1'},{id:album.id,revision:album.revision})).status,303);
      assert.ok(!(await request('/gallery',undefined,true)).html.includes('नेपाली विवरण मात्र'));
      assert.ok((await request('/ne/gallery',undefined,true)).html.includes('नेपाली विवरण मात्र'));
      assert.equal((await save(modules.galleryImage,{...fields(modules.galleryImage),caption_ne:'नेपाली क्याप्सन मात्र'},{parent:album.id,file:{data:png}})).status,303);
      const image=(await mediaContent.list(modules.galleryImage,false,album.id))[0];
      const overview=(await request('/gallery',undefined,true)).html,en=(await request('/gallery/'+album.id,undefined,true)).html,ne=(await request('/ne/gallery/'+album.id,undefined,true)).html;
      assert.ok(overview.includes('src="/media/'+image.image.storage_key));
      assert.ok(!en.includes('नेपाली क्याप्सन मात्र'));assert.ok(ne.includes('नेपाली क्याप्सन मात्र'));
      assert.equal((await deleteRow(modules.galleryImage,image,album.id)).status,303);
      const testimonial=(await mediaContent.list(modules.testimonials,true))[0];
      assert.equal((await save(modules.testimonials,{...fields(modules.testimonials),position_organization_en:'',position_organization_ne:'नेपाली भूमिका मात्र',is_active:'1'},{id:testimonial.id,revision:testimonial.revision})).status,303);
      assert.ok(!(await request('/testimonials',undefined,true)).html.includes('नेपाली भूमिका मात्र'));
      assert.ok((await request('/ne/testimonials',undefined,true)).html.includes('नेपाली भूमिका मात्र'));
    });
    await t.test('Gallery batches are atomic, bounded, bilingual and individually ordered/deleted',async()=> {
      assert.equal((await save(modules.gallery,{...fields(modules.gallery,'Batch event'),is_active:'1'})).status,303);
      const album=(await mediaContent.list(modules.gallery)).find(row=>row.title_en==='Batch event title_en');
      const path=pathFor(modules.galleryImage,album.id);
      async function batch(files,extra={},revision,anonymous=false) {
        const current=await mediaContent.read(modules.gallery,album.id),form=new FormData();
        for(const [key,value] of Object.entries({...fields(modules.galleryImage),display_order:'10',credit_en:'Photo: Community team',credit_ne:'तस्बिर: समुदाय',revision:String(revision??current.revision),_csrf:token,...extra})) form.set(key,value);
        for(const file of files) form.append('photos',new Blob([file.data??png],{type:file.type??'image/png'}),file.name??'event.png');
        return request(path+'/batch',form,anonymous);
      }
      assert.equal((await request(path+'/add')).status,200);
      const landscape=await sharp({create:{width:160,height:80,channels:4,background:'#f00'}}).png().toBuffer();
      const highResolution=await sharp(randomBytes(1200*1200*3),{raw:{width:1200,height:1200,channels:3}}).png().toBuffer();
      assert.ok(highResolution.length>2*1024*1024 && highResolution.length<=10*1024*1024);
      assert.equal((await batch([{data:highResolution}])).status,303);
      let largeUpload=(await mediaContent.list(modules.galleryImage,false,album.id)).find(image=>image.image.width===1200 && image.image.height===1200);
      assert.ok(largeUpload);
      assert.equal((await deleteRow(modules.galleryImage,largeUpload,album.id)).status,303);
      assert.equal((await batch([{data:png},{data:landscape},{}])).status,303);
      let images=await mediaContent.list(modules.galleryImage,false,album.id);assert.equal(images.length,3);assert.deepEqual(images.map(row=>row.display_order),[10,11,12]);
      assert.deepEqual(images.map(row=>[row.image.width,row.image.height]),[[80,120],[160,80],[80,120]]);
      assert.equal((await batch([{},{}],{display_order:'20',credit_en:'',credit_ne:''})).status,303);
      images=await mediaContent.list(modules.galleryImage,false,album.id);assert.equal(images.length,5);
      assert.equal((await request(path+'/'+images[4].id+'/order',new URLSearchParams({_csrf:token,revision:String(images[4].revision),display_order:'0'}))).status,303);
      let ordered=await mediaContent.list(modules.galleryImage,false,album.id);assert.equal(ordered[0].id,images[4].id);
      assert.equal((await request(path+'/'+images[4].id+'/order',new URLSearchParams({_csrf:token,revision:String(images[4].revision),display_order:'1'}))).status,409);
      assert.equal((await request(path+'/'+images[4].id+'/order',new URLSearchParams({_csrf:token,revision:'2',display_order:'-1'}))).status,400);
      for(const prefix of ['','/ne']) {const overview=(await request(prefix+'/gallery',undefined,true)).html,html=(await request(prefix+'/gallery/'+album.id,undefined,true)).html;assert.ok(html.includes('gallery-photo-link'));assert.ok(html.includes(prefix?'तस्बिर: समुदाय':'Photo: Community team'));assert.ok(overview.includes('src="/media/'+ordered[0].image.storage_key));assert.ok(!html.includes('<span class="gallery-credit"></span>'));}
      const before=await readdir(directory),count=await db.galleryImage.count();
      for(const [files,extra,revision,status,anonymous] of [[[],{},undefined,400],[Array.from({length:6},()=>({})),{},undefined,400],[[{}, {data:Buffer.from('bad')}],{},undefined,400],[[{}],{},0,409],[[{}],{credit_en:'x'.repeat(201)},undefined,400],[[{}],{_csrf:'bad'},undefined,403],[[{}],{},undefined,303,true],[[{data:Buffer.alloc(10*1024*1024+1)}],{},undefined,400],[[{name:'fake.jpg',type:'image/jpeg'}],{},undefined,400],[[{},{}],{display_order:'999999'},undefined,400]]) assert.equal((await batch(files,extra,revision,anonymous)).status,status);
      assert.deepEqual(await readdir(directory),before);assert.equal(await db.galleryImage.count(),count);
      assert.equal((await deleteRow(modules.galleryImage,ordered[0],album.id)).status,303);
      ordered=await mediaContent.list(modules.galleryImage,false,album.id);assert.equal(ordered.length,4);
      assert.equal((await request('/media/'+images[4].image.storage_key,undefined,true)).status,404);
      const parent=await mediaContent.read(modules.gallery,album.id);assert.equal((await deleteRow(modules.gallery,parent)).status,303);
      assert.equal(await db.galleryImage.count({where:{album_id:album.id}}),0);
      for(const image of ordered) assert.equal((await request('/media/'+image.image.storage_key,undefined,true)).status,404);
    });
    await t.test('Gallery overview links to active bilingual detail routes without expanding photos',async()=> {
      const album=(await mediaContent.list(modules.gallery,true))[0];
      for(const prefix of ['','/ne']) {
        const overview=await request(prefix+'/gallery',undefined,true);assert.equal(overview.status,200);assert.ok(overview.html.includes('href="'+prefix+'/gallery/'+album.id+'"'));assert.ok(!overview.html.includes('data-gallery-photo'));
        const detail=await request(prefix+'/gallery/'+album.id,undefined,true);assert.equal(detail.status,200);assert.ok(detail.html.includes(prefix?'यस एल्बममा':'Images will be available'));assert.ok(detail.html.includes('href="'+(prefix?'':'/ne')+'/gallery/'+album.id+'"'));assert.ok(detail.html.includes('gallery-breadcrumb'));assert.ok(detail.html.includes('site-footer'));
        for(const id of ['0','-1','01','2147483647','not-an-id']) assert.equal((await request(prefix+'/gallery/'+id,undefined,true)).status,404);
      }
      const hidden=(await mediaContent.list(modules.gallery)).find(row=>!row.is_active);assert.equal((await request('/gallery/'+hidden.id,undefined,true)).status,404);assert.equal((await request('/ne/gallery/'+hidden.id,undefined,true)).status,404);
      assert.equal((await save(modules.galleryImage,fields(modules.galleryImage),{parent:album.id,file:{data:png}})).status,303);
      const detail=await request('/gallery/'+album.id,undefined,true);assert.ok(detail.html.includes('gallery-single'));assert.ok(detail.html.includes('data-gallery-lightbox'));assert.ok(detail.html.includes('data-lightbox-thumb="0"'));assert.ok(!detail.html.includes('<span class="gallery-credit"></span>'));
      const image=(await mediaContent.list(modules.galleryImage,false,album.id))[0];assert.equal((await deleteRow(modules.galleryImage,image,album.id)).status,303);
    });
    await t.test('both child types delete with confirmation/revision checks; safe escaped content stays protected after logout',async()=> {
      for(const key of ['galleryImage','newsImage']) {
        const module=modules[key],parent=(await mediaContent.list(modules[module.parent],true))[0];
        assert.equal((await save(module,{...fields(module),alt_text_en:'<script>alert(1)</script>'},{parent:parent.id,file:{data:png}})).status,303);
        const image=(await mediaContent.list(module,false,parent.id))[0];
        const page=module.parent==='news'?'/news/'+parent.slug:'/gallery/'+parent.id;
        assert.match((await request(page,undefined,true)).html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
        assert.equal((await request(pathFor(module,parent.id)+'/'+image.id+'/delete')).status,200);
        assert.equal((await request(pathFor(module,parent.id)+'/'+image.id+'/delete',new URLSearchParams({_csrf:token,revision:'999'}))).status,409);
        assert.equal((await deleteRow(module,image,parent.id)).status,303);
        assert.equal((await request('/media/'+image[module.asset].storage_key,undefined,true)).status,404);
      }
      assert.equal((await request('/admin/logout',new URLSearchParams({_csrf:token}))).status,303);
      assert.equal((await save(modules.news,{...fields(modules.news),slug:'logged-out'})).status,303);
    });
  } finally {
    await new Promise(resolve=>server.close(resolve));
    await db.newsImage.deleteMany();await db.galleryImage.deleteMany();await db.news.deleteMany();await db.galleryAlbum.deleteMany();await db.testimonial.deleteMany();await db.organizationSettings.deleteMany();await db.mediaAsset.deleteMany();
    await db.adminUser.delete({where:{id:admin.id}});await db.$disconnect();
    assert.ok(directory.startsWith(join(tmpdir(),'nahuda-media-')));await rm(directory,{recursive:true,force:true});
  }
});
