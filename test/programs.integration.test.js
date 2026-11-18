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
import {programModule as module} from '../src/config/programs.js';
import {serviceModules} from '../src/config/services.js';

test('Programs CMS and public pages on isolated MySQL',{skip:!process.env.AUTH_TEST_DATABASE_URL},async t=>{
  const url=new URL(process.env.AUTH_TEST_DATABASE_URL);assert.match(url.pathname,/^\/nahuda_auth_test_[a-f0-9]{16}$/);
  const db=createDatabase(url.href),directory=await mkdtemp(join(tmpdir(),'nahuda-programs-'));
  const config=readConfig({NODE_ENV:'test',DATABASE_URL:url.href,SESSION_SECRET:randomBytes(32).toString('hex'),PUBLIC_ORIGIN:'http://127.0.0.1:3000'});
  const content=mediaContentService(db,directory),settings=organizationSettingsService(db,directory);
  const password=randomBytes(24).toString('hex');
  const admin=await db.adminUser.create({data:{name:'Program QA',email:'programs@example.test',password_hash:await hashPassword(password)}});
  const app=createApp(config,{auth:authenticationService(db,config),store:new PrismaSessionStore(db,config.sessionLifetimeMs),settings,mediaContent:content});
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  let cookie='',token='',program,sharedService;
  const png=await sharp({create:{width:100,height:80,channels:3,background:'#0054a7'}}).png().toBuffer();
  const fields={title_en:'Program fixture',title_ne:'परीक्षण कार्यक्रम',full_description_en:'<h2>Article heading</h2><p>Actual body &amp; text</p>',full_description_ne:'<h2>शीर्षक</h2><p>नेपाली विवरण</p>',description_format:'HTML',slug:'program-fixture'};
  async function request(path,body,anonymous=false){
    const response=await fetch(base+path,{method:body?'POST':'GET',body,headers:anonymous?{}:{cookie},redirect:'manual'});
    if(!anonymous&&response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
    const html=await response.text();if(!anonymous)token=/name="_csrf" value="([a-f0-9]+)"/.exec(html)?.[1]||token;
    return {status:response.status,html,response};
  }
  async function save(data=fields,options={}){
    const form=new FormData();form.set('_csrf',options.token??token);form.set('revision',String(options.revision??0));
    for(const [key,value] of Object.entries(data))form.set(key,String(value));
    if(options.duplicate)form.append(options.duplicate,'duplicate');
    if(options.file)form.set('photo',new Blob([options.file],{type:options.type||'image/png'}),options.filename||'image.png');
    return request('/admin/programs'+(options.id?'/'+options.id:''),form,options.anonymous);
  }
  const refresh=async()=>program=await content.read(module,program.id);
  try{
    await t.test('empty bilingual listings, protected management, login and CSRF',async()=>{
      for(const prefix of ['','/ne']){const page=await request(prefix+'/programs',undefined,true);assert.equal(page.status,200);assert.match(page.html,/program-empty/);assert.ok(page.html.includes(`href="${prefix}/programs"`));assert.equal((await request(prefix+'/programs/missing',undefined,true)).status,404);}
      for(const path of ['/admin/programs','/admin/programs/new','/admin/programs/1/edit','/admin/programs/1/view','/admin/programs/1/delete'])assert.equal((await request(path)).status,303);
      assert.equal((await save(fields,{anonymous:true})).status,303);
      await request('/admin/login');assert.equal((await request('/admin/login',new URLSearchParams({_csrf:token,email:admin.email,password}))).status,303);
      const editor=await request('/admin/programs/new');assert.equal(editor.status,200);assert.match(editor.html,/Full description EN \*/);assert.match(editor.html,/data-activity-editor/);assert.match(editor.html,/name="description_format" value="HTML"/);
      for(const path of ['/admin/programs','/admin/services','/admin/service-categories']) {
        const page=await request(path);assert.equal(page.status,200);
        assert.match(page.html,/<details class="admin-nav-group" open>\s*<summary class="admin-nav-heading">Content<\/summary>/);
        assert.ok(!page.html.includes('<summary class="admin-nav-heading">Our Work</summary>'));
        assert.ok(!page.html.includes('/admin/our%20work'));assert.ok(!page.html.includes('/admin/our work'));
        assert.match(page.html,/href="\/admin\/content">Section overview<\/a>/);
        assert.match(page.html,/href="\/admin\/programs">Our Work<\/a>/);
        assert.match(page.html,/href="\/admin\/services">Core Activities<\/a>/);
      }
      assert.equal((await save(fields,{token:'bad'})).status,403);assert.equal(await db.program.count(),0);
    });
    await t.test('required pairs, rich-text emptiness, optional heading/content and repeated values reject safely',async()=>{
      for(const invalid of [{title_en:''},{title_ne:''},{full_description_en:''},{full_description_ne:'<p><br></p>'},{full_description_en:'<script>bad()</script>'},{additional_heading_en:'Only heading'},{additional_content_ne:'Only body'},{is_active:'PUBLISHED'},{display_order:'1.5'},{slug:'../unsafe'},{description_format:'BAD'}])assert.equal((await save({...fields,...invalid})).status,400);
      assert.equal((await save(fields,{duplicate:'full_description_en'})).status,400);assert.equal(await db.program.count(),0);
      assert.equal((await save(fields)).status,303);program=(await content.list(module))[0];assert.equal(program.is_active,false);
      assert.equal((await request('/programs/program-fixture',undefined,true)).status,404);
      const preview=await request(`/admin/programs/${program.id}/view`);assert.equal(preview.status,200);assert.match(preview.html,/Inactive — visible only in Admin/);assert.match(preview.html,/<h2>Article heading<\/h2>/);assert.match(preview.html,/नेपाली विवरण/);
    });
    await t.test('create/update active pages, safe rich text, localized links and optional information',async()=>{
      assert.equal((await save({...fields,is_active:'1',display_order:'10',full_description_en:fields.full_description_en+'<script>bad()</script><a href="javascript:bad()">Unsafe</a>',additional_heading_en:'Who can join?',additional_content_en:'Actual <script> supplied text'},{id:program.id,revision:program.revision})).status,303);await refresh();
      assert.equal(program.description_format,'HTML');assert.ok(!program.full_description_en.includes('<script>'));assert.equal(program.additional_heading_ne,'');
      const en=(await request('/programs/program-fixture',undefined,true)).html;assert.match(en,/<h2>Article heading<\/h2>/);assert.ok(!en.includes('javascript:'));assert.match(en,/Who can join\?/);assert.match(en,/Actual &lt;script&gt; supplied text/);assert.ok(en.includes('/ne/programs/program-fixture'));assert.match(en,/rel="canonical"/);assert.ok(!en.includes('class="program-featured"'));
      const ne=(await request('/ne/programs/program-fixture',undefined,true)).html;assert.match(ne,/नेपाली विवरण/);assert.ok(!ne.includes('Who can join?'));assert.ok(!ne.includes('program-information-heading'));
      const list=(await request('/programs',undefined,true)).html;assert.match(list,/Actual body &amp; text/);assert.ok(!list.includes('Actual body &amp;amp; text'));assert.match(list,/program-card-text/);
      assert.equal((await save({...fields,is_active:'1'},{id:program.id,revision:1})).status,409);assert.equal((await save(fields)).status,409);
    });
    await t.test('Our Work and Core Activities keep independent lists, routes, forms and child management',async()=>{
      const before=await content.read(module,program.id);
      const main=html=>html.slice(html.indexOf('<main'),html.indexOf('</main>'));
      let activity;
      try {
        await request('/admin/services/new');
        const data={...Object.fromEntries(serviceModules.services.fields.map(field=>[field.key,''])),name_en:'Independent Core Activity',name_ne:'स्वतन्त्र मुख्य गतिविधि',slug:program.slug,is_active:'1',full_description_en:'Independent activity body',full_description_ne:'स्वतन्त्र गतिविधिको विवरण'};
        const created=await request('/admin/services',new URLSearchParams({...data,_csrf:token,revision:'0'}));
        assert.equal(created.status,303);assert.equal(created.response.headers.get('location'),'/admin/services?saved=1');
        activity=await db.service.findUnique({where:{slug:program.slug}});assert.ok(activity);
        const activityPath='/admin/services/'+activity.id,workPath='/admin/programs/'+program.id;
        const overview=await request('/admin/content');assert.equal(overview.status,200);
        for(const path of ['/admin/programs','/admin/services','/admin/service-categories'])assert.ok(overview.html.includes('href="'+path+'"'));
        const workList=main((await request('/admin/programs')).html),activityList=main((await request('/admin/services')).html);
        assert.ok(workList.includes(fields.title_en));assert.ok(!workList.includes(data.name_en));assert.ok(workList.includes('href="/admin/programs/'+program.id+'/images"'));assert.ok(!workList.includes('/admin/services/'));assert.ok(!workList.includes('Manage features'));
        assert.ok(activityList.includes(data.name_en));assert.ok(!activityList.includes(fields.title_en));
        for(const suffix of ['/edit','/delete','/features','/images'])assert.ok(activityList.includes('href="'+activityPath+suffix+'"'));
        for(const suffix of ['/edit','/delete','/view'])assert.ok(workList.includes('href="'+workPath+suffix+'"'));
        for(const [path,action] of [[workPath+'/edit',workPath],[activityPath+'/edit',activityPath],[activityPath+'/features/new',activityPath+'/features'],[activityPath+'/images/new',activityPath+'/images']]) {
          const form=await request(path);assert.equal(form.status,200);assert.ok(main(form.html).includes('action="'+action+'"'));
        }
        assert.equal((await request(workPath+'/features')).status,404);assert.equal((await request(workPath+'/images')).status,200);
        const feature=await request(activityPath+'/features',new URLSearchParams({_csrf:token,revision:'0',title_en:'Independent feature',title_ne:'स्वतन्त्र सुविधा',description_en:'Feature body',description_ne:'सुविधाको विवरण',display_order:'1'}));
        assert.equal(feature.status,303);assert.equal(feature.response.headers.get('location'),activityPath+'/features?saved=1');
        const imageForm=new FormData();
        for(const [key,value] of Object.entries({_csrf:token,revision:'0',caption_en:'Independent caption',caption_ne:'स्वतन्त्र विवरण',alt_text_en:'Independent image',alt_text_ne:'स्वतन्त्र तस्बिर',display_order:'1'}))imageForm.set(key,value);
        imageForm.set('photo',new Blob([png],{type:'image/png'}),'independent.png');
        const image=await request(activityPath+'/images',imageForm);assert.equal(image.status,303);assert.equal(image.response.headers.get('location'),activityPath+'/images?saved=1');
        activity=await content.read(serviceModules.services,activity.id);
        for(const [child,rows] of [['features',activity.features],['images',activity.images]]) {
          const childPath=activityPath+'/'+child+'/'+rows[0].id;
          const list=main((await request(activityPath+'/'+child)).html);
          for(const suffix of ['/edit','/delete'])assert.ok(list.includes('href="'+childPath+suffix+'"'));
          for(const suffix of ['/edit','/delete']) {const page=await request(childPath+suffix);assert.equal(page.status,200);assert.ok(main(page.html).includes('action="'+childPath+(suffix==='/delete'?'/delete':'')+'"'));}
        }
        for(const prefix of ['','/ne']) {
          const work=await request(prefix+'/programs/'+program.slug,undefined,true),page=await request(prefix+'/services/'+activity.slug,undefined,true);
          assert.equal(work.status,200);assert.equal(page.status,200);
          assert.ok(page.html.includes(prefix?data.name_ne:data.name_en));assert.ok(page.html.includes(prefix?'स्वतन्त्र सुविधा':'Independent feature'));assert.ok(page.html.includes(prefix?'स्वतन्त्र विवरण':'Independent caption'));
        }
        const deleted=await request(activityPath+'/delete',new URLSearchParams({_csrf:token,revision:String(activity.revision)}));assert.equal(deleted.status,303);assert.equal(deleted.response.headers.get('location'),'/admin/services?saved=1');activity=null;
        assert.deepEqual(await content.read(module,program.id),before);
        assert.equal((await request('/programs/'+program.slug,undefined,true)).status,200);
        assert.equal((await request('/services/'+program.slug,undefined,true)).status,404);
      } finally {
        if(activity) {const current=await content.read(serviceModules.services,activity.id);if(current)await content.delete(serviceModules.services,current.id,{revision:String(current.revision)});}
      }
    });
    await t.test('combined Additional Information saves and redisplays both languages without changing existing storage',async()=>{
      const combined={...fields,is_active:'1',additional_combined_en:'Browser heading\nSupporting body',additional_combined_ne:'परीक्षण शीर्षक\nनेपाली विवरण'};
      assert.equal((await save(combined,{id:program.id,revision:program.revision})).status,303);await refresh();
      assert.equal(program.additional_heading_en,'Browser heading');assert.equal(program.additional_content_en,'Supporting body');
      assert.equal(program.additional_heading_ne,'परीक्षण शीर्षक');assert.equal(program.additional_content_ne,'नेपाली विवरण');
      for(const prefix of ['','/ne']) {
        const page=await request(prefix+'/programs/program-fixture',undefined,true);assert.equal(page.status,200);
        assert.ok(page.html.includes(prefix?'परीक्षण शीर्षक':'Browser heading'));
        assert.ok(page.html.includes('href="'+prefix+'/contact"'));
        if(prefix)assert.match(page.html,/हाम्रो कामको बारेमा/);
      }
    });
    await t.test('rich Additional Information stores safe formatting independently in both languages',async()=>{
      const articleBefore=program.full_description_en;
      const rich={...fields,is_active:'1',additional_format:'HTML',additional_combined_en:'<h2>Facts and figures</h2><p><strong>85 cases</strong></p><ul><li>Local ward</li></ul><script>bad()</script><a href="javascript:bad()">Unsafe</a>',additional_combined_ne:'<h2>तथ्याङ्क</h2><ol><li>स्थानीय वडा</li></ol>'};
      assert.equal((await save(rich,{id:program.id,revision:program.revision})).status,303);await refresh();
      assert.equal(program.additional_format,'HTML');assert.equal(program.additional_heading_en,'');assert.equal(program.full_description_en,articleBefore);assert.ok(!program.additional_content_en.includes('script'));
      for(const prefix of ['','/ne']) {
        const page=await request(prefix+'/programs/'+program.slug,undefined,true);assert.equal(page.status,200);
        assert.ok(page.html.includes(prefix?'<h2>तथ्याङ्क</h2>':'<h2>Facts and figures</h2>'));
        assert.ok(page.html.includes(prefix?'<ol><li>स्थानीय वडा</li></ol>':'<strong>85 cases</strong>'));assert.ok(!page.html.includes('javascript:'));
      }
      assert.match((await request('/admin/programs/'+program.id+'/view')).html,/<strong>85 cases<\/strong>/);
      assert.equal((await save({...rich,additional_format:'BAD'},{id:program.id,revision:program.revision})).status,400);
    });
    await t.test('long bilingual articles, ordering, active filtering, deactivation and category independence',async()=>{
      const long={...fields,is_active:'1',display_order:'10',full_description_en:'<p>'+'Long article '.repeat(1700)+'</p>',full_description_ne:'<p>'+'नेपाली लेख '.repeat(10000)+'</p>'};
      assert.equal((await save(long,{id:program.id,revision:program.revision})).status,303);await refresh();assert.ok(program.full_description_ne.length>60000);
      for(const [slug,order,active] of [['early',0,true],['tie',0,true],['hidden',1,false]])await db.program.create({data:{...Object.fromEntries(module.fields.map(f=>[f.key,f.optional?'':fields[f.key]])),description_format:'HTML',slug,title_en:slug,display_order:order,is_active:active}});
      assert.deepEqual((await content.list(module,true)).map(row=>row.slug),['early','tie','program-fixture']);
      const listing=(await request('/programs',undefined,true)).html;assert.ok(listing.indexOf('/programs/early')<listing.indexOf('/programs/tie'));assert.ok(!listing.includes('/programs/hidden'));
      for(const path of ['/programs/hidden','/ne/programs/hidden','/programs/a%2Fb'])assert.equal((await request(path,undefined,true)).status,404);
      assert.equal((await save({...long,is_active:'0'},{id:program.id,revision:program.revision})).status,303);await refresh();assert.equal((await request('/programs/program-fixture',undefined,true)).status,404);
      assert.equal((await save({...fields,is_active:'1'},{id:program.id,revision:program.revision})).status,303);await refresh();
    });
    await t.test('optional featured image upload, unsafe files, replacement and shared ownership preservation',async()=>{
      for(const options of [{file:Buffer.from('bad')},{file:png,type:'image/jpeg',filename:'image.jpg'},{file:png,filename:'image.svg'},{file:Buffer.alloc(10*1024*1024+1)}])assert.equal((await save({...fields,is_active:'1'},{id:program.id,revision:program.revision,...options})).status,400);
      assert.equal((await save({...fields,is_active:'1'},{id:program.id,revision:program.revision,file:png})).status,303);await refresh();const first=program.featured_image;
      assert.equal((await request('/media/'+first.storage_key,undefined,true)).status,200);assert.match((await request('/programs/program-fixture',undefined,true)).html,/class="program-featured"/);
      assert.equal((await save({...fields,is_active:'1'},{id:program.id,revision:program.revision,file:png})).status,303);await refresh();assert.equal(await db.mediaAsset.findUnique({where:{id:first.id}}),null);
      const shared=program.featured_image;
      sharedService=await db.service.create({data:{...Object.fromEntries(serviceModules.services.fields.map(f=>[f.key,f.optional?'':'Shared fixture'])),slug:'program-shared-media',featured_image_id:shared.id}});
      assert.equal((await save({...fields,is_active:'1',clear_photo:'1'},{id:program.id,revision:program.revision})).status,303);await refresh();assert.equal(program.featured_image,null);assert.ok(await db.mediaAsset.findUnique({where:{id:shared.id}}));
      await db.program.update({where:{id:program.id},data:{featured_image_id:shared.id}});
      await content.delete(serviceModules.services,sharedService.id,{revision:String(sharedService.revision)});sharedService=null;assert.ok(await db.mediaAsset.findUnique({where:{id:shared.id}}));await refresh();
    });
    await t.test('Our Work supporting images upload, order, scope, replace and remove independently',async()=>{
      const path='/admin/programs/'+program.id+'/images';
      const featured=program.featured_image_id,oldParentRevision=program.revision;
      const data={caption_en:'First photo',caption_ne:'पहिलो तस्बिर विवरण',alt_text_en:'Blue photo',alt_text_ne:'नीलो तस्बिर',display_order:'20'};
      const imageSave=async(values,id,revision=0,file=png)=>{
        const form=new FormData();for(const [key,value] of Object.entries({...values,_csrf:token,revision:String(revision)}))form.set(key,value);
        if(file)form.set('photo',new Blob([file],{type:'image/png'}),'photo.png');return request(path+(id?'/'+id:''),form);
      };
      assert.equal((await request(path+'/new')).status,200);
      assert.equal((await imageSave(data,null,0,Buffer.from('invalid image'))).status,400);
      assert.equal((await imageSave(data,null,0,null)).status,400);
      assert.equal((await imageSave(data)).status,303);
      assert.equal((await imageSave({...data,caption_en:'Second photo',caption_ne:'दोस्रो तस्बिर विवरण',display_order:'10'})).status,303);await refresh();
      assert.equal(program.images.length,2);assert.equal(program.featured_image_id,featured);assert.ok(program.revision>oldParentRevision);
      const first=program.images[0],other=await db.program.findUnique({where:{slug:'early'}});
      assert.equal((await request('/admin/programs/'+other.id+'/images/'+first.id+'/edit')).status,404);
      for(const prefix of ['','/ne']) {
        const html=(await request(prefix+'/programs/'+program.slug,undefined,true)).html;
        assert.ok(html.indexOf(prefix?'दोस्रो तस्बिर विवरण':'Second photo')<html.indexOf(prefix?'पहिलो तस्बिर विवरण':'First photo'));
        assert.ok(html.includes('alt="'+(prefix?'नीलो तस्बिर':'Blue photo')+'"'));
      }
      assert.equal((await imageSave({...data,display_order:'30'},first.id,first.revision)).status,303);await refresh();assert.equal(program.images[0].caption_en,'First photo');
      assert.equal((await imageSave(data,first.id,first.revision)).status,409);
      const current=program.images[0],oldKey=current.image.storage_key;
      assert.equal((await imageSave({...data,display_order:'5'},current.id,current.revision)).status,303);await refresh();assert.ok(!(await readdir(directory)).includes(oldKey));
      const removing=program.images[0];assert.equal((await request(path+'/'+removing.id+'/delete')).status,200);
      assert.equal((await request(path+'/'+removing.id+'/delete',new URLSearchParams({_csrf:token,revision:String(removing.revision)}))).status,303);await refresh();assert.equal(program.images.length,1);assert.equal(program.featured_image_id,featured);
      assert.equal((await request('/admin/programs/'+program.id+'/delete',new URLSearchParams({_csrf:token,revision:String(oldParentRevision)}))).status,409);
      assert.match((await request('/admin/programs/'+program.id+'/edit')).html,/Manage images \(1\)/);
    });
    await t.test('admin view/list, confirmation and stale deletion, file cleanup and logout protection',async()=>{
      assert.match((await request('/admin/programs')).html,/View \/ Preview/);
      const preview=await request(`/admin/programs/${program.id}/view`);assert.equal(preview.status,200);assert.match(preview.html,/class="program-preview-photo settings-section"/);
      const supporting=program.images.map(photo=>photo.image);const image=program.featured_image;assert.equal((await request(`/admin/programs/${program.id}/delete`)).status,200);
      assert.equal((await request(`/admin/programs/${program.id}/delete`,new URLSearchParams({_csrf:token,revision:'1'}))).status,409);
      assert.equal((await request(`/admin/programs/${program.id}/delete`,new URLSearchParams({_csrf:token,revision:String(program.revision)}))).status,303);
      assert.equal(await db.programImage.count({where:{program_id:program.id}}),0);for(const asset of supporting){assert.equal(await db.mediaAsset.findUnique({where:{id:asset.id}}),null);assert.ok(!(await readdir(directory)).includes(asset.storage_key));}
      assert.equal(await db.mediaAsset.findUnique({where:{id:image.id}}),null);assert.ok(!(await readdir(directory)).includes(image.storage_key));assert.equal((await request('/programs/program-fixture',undefined,true)).status,404);
      assert.equal((await request('/admin/logout',new URLSearchParams({_csrf:token}))).status,303);assert.equal((await request('/admin/programs')).status,303);assert.equal((await save(fields)).status,303);
    });
  }finally{
    await new Promise(resolve=>server.close(resolve));if(sharedService)await db.service.delete({where:{id:sharedService.id}});await db.program.deleteMany();await db.mediaAsset.deleteMany({where:{storage_key:{in:await readdir(directory)}}});await db.adminUser.delete({where:{id:admin.id}});await db.$disconnect();await rm(directory,{recursive:true,force:true});
  }
});
