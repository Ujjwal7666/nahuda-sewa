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
import {serviceModules as modules} from '../src/config/services.js';

test('Dynamic Services on isolated MySQL',{skip:!process.env.AUTH_TEST_DATABASE_URL},async t=> {
  const url=new URL(process.env.AUTH_TEST_DATABASE_URL);assert.match(url.pathname,/^\/nahuda_auth_test_[a-f0-9]{16}$/);
  const directory=await mkdtemp(join(tmpdir(),'nahuda-services-')),db=createDatabase(url.href);
  const config=readConfig({NODE_ENV:'test',DATABASE_URL:url.href,SESSION_SECRET:randomBytes(32).toString('hex'),PUBLIC_ORIGIN:'http://127.0.0.1:3000'});
  const content=mediaContentService(db,directory),settings=organizationSettingsService(db,directory);
  const password=randomBytes(24).toString('hex');
  const admin=await db.adminUser.create({data:{name:'Services QA',email:'services@example.test',password_hash:await hashPassword(password)}});
  const app=createApp(config,{auth:authenticationService(db,config),store:new PrismaSessionStore(db,config.sessionLifetimeMs),settings,mediaContent:content});
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  let cookie='',token='',service,category;
  const png=await sharp({create:{width:100,height:80,channels:4,background:'#008fd5'}}).png().toBuffer();
  async function request(path,body,anonymous=false) {
    const response=await fetch(base+path,{method:body?'POST':'GET',body,headers:anonymous?{}:{cookie},redirect:'manual'});
    if(!anonymous && response.headers.get('set-cookie')) cookie=response.headers.get('set-cookie').split(';')[0];
    const html=await response.text();if(!anonymous) token=/name="_csrf" value="([a-f0-9]+)"/.exec(html)?.[1]||token;
    return {status:response.status,html,response};
  }
  const fields=(module,prefix='Fixture')=>Object.fromEntries(module.fields.map(f=>[f.key,f.optional?'':`${prefix} ${f.key}${f.lang==='ne'?' नेपाली':''}`]));
  const pathFor=(module,parent)=>module.parent?modules[module.parent].path+'/'+parent+'/'+module.childPath:module.path;
  async function save(module,data,options={}) {
    const form=new FormData();form.set('_csrf',options.token??token);form.set('revision',String(options.revision??0));
    for(const [key,value] of Object.entries(data)) form.set(key,String(value));
    if(options.file) form.set('photo',new Blob([options.file],{type:options.type||'image/png'}),options.filename||'photo.png');
    if(options.duplicate) form.append(options.duplicate,'duplicate');
    return request(pathFor(module,options.parent)+(options.id?'/'+options.id:''),form,options.anonymous);
  }
  const deleteRow=(module,row,parent)=>request(pathFor(module,parent)+'/'+row.id+'/delete',new URLSearchParams({_csrf:token,revision:String(row.revision)}));
  const refresh=async()=>service=await content.read(modules.services,service.id);
  try {
    await t.test('public empty routes, localized 404s, protected CRUD and CSRF',async()=> {
      for(const prefix of ['','/ne']) {assert.equal((await request(prefix+'/services',undefined,true)).status,200);assert.equal((await request(prefix+'/services/missing',undefined,true)).status,404);}
      for(const path of ['/admin/services','/admin/services/new','/admin/services/1/edit','/admin/service-categories','/admin/services/1/features','/admin/services/1/images']) assert.equal((await request(path)).status,303);
      assert.equal((await save(modules.services,{...fields(modules.services),slug:'fixture'},{anonymous:true,file:png})).status,303);
      await request('/admin/login');assert.equal((await request('/admin/login',new URLSearchParams({_csrf:token,email:admin.email,password}))).status,303);
      for(const path of ['/admin/services/new','/admin/service-categories/new']) {
        const page=await request(path);assert.equal(page.status,200);assert.match(page.html,/src="\/assets\/js\/news-slug.js"/);assert.match(page.html,/Automatically filled from the English name/);
      }
      assert.equal((await save(modules.services,{...fields(modules.services),slug:'fixture'},{token:'bad',file:png})).status,403);
      assert.equal(await db.service.count(),0);
    });
    await t.test('category and service CRUD, validation, unique slugs, featured and active ordering',async()=> {
      const m=modules.services,c=modules.serviceCategories,data={...fields(m),slug:'fixture'};
      for(const invalid of [{name_ne:''},{slug:'../bad'},{category_id:'-1'},{is_featured:'BAD'},{is_active:'BAD'},{display_order:'1.5'}]) assert.equal((await save(m,{...data,...invalid})).status,400);
      assert.equal((await save(m,data,{duplicate:'name_en'})).status,400);
      assert.equal((await save(c,{...fields(c),slug:'care',is_active:'1'})).status,303);
      category=(await content.list(c))[0];
      assert.equal((await save(m,{...data,category_id:'2147483647'})).status,400);
      assert.equal((await save(m,{...data,category_id:category.id},{file:png})).status,303);
      service=(await content.list(m))[0];assert.equal(service.is_active,false);
      assert.equal((await request('/services/fixture',undefined,true)).status,404);
      assert.equal((await save(m,data)).status,409);
      assert.equal((await save(m,{...data,is_active:'1',is_featured:'1',display_order:'20',category_id:category.id,short_description_en:'English summary <script>',full_description_en:'English body',who_is_it_for_en:'Adults',availability_en:'Ask us',location_en:'Supplied location'},{id:service.id,revision:service.revision})).status,303);
      await refresh();assert.equal((await content.featuredServices()).length,1);
      assert.equal((await save(m,{...data,is_active:'1',slug:'first',name_en:'First name',display_order:'1'})).status,303);
      assert.equal((await save(m,{...data,slug:'hidden',name_en:'Hidden name',is_featured:'1'})).status,303);
      assert.equal((await save(m,{...data,is_active:'1',slug:'tie',name_en:'Tie name',display_order:'1'})).status,303);
      const list=await content.activeServices();assert.deepEqual(list.map(r=>r.slug),['first','tie','fixture']);
      assert.deepEqual((await content.featuredServices()).map(r=>r.slug),['fixture']);
      const edit=await request('/admin/services/'+service.id+'/edit');assert.equal(edit.status,200);assert.match(edit.html,/Manage features|Featured on Homepage/);
      for(const prefix of ['','/ne']) {const page=await request(prefix+'/services/fixture',undefined,true);assert.equal(page.status,200);assert.ok(page.html.includes(`href="${prefix?'':'/ne'}/services/fixture"`));assert.match(page.html,/rel="canonical"/);assert.match(page.html,/hreflang="ne"/);assert.ok(!page.html.includes('id="service-features"'));assert.ok(!page.html.includes('id="service-gallery"'));}
      const english=(await request('/services/fixture',undefined,true)).html;assert.ok(!english.includes('<p class="preserve-lines activity-summary">'));assert.ok(!english.includes('activity-overview-copy'));assert.match((await request('/services',undefined,true)).html,/English summary &lt;script&gt;/);assert.match(english,/id="service-who_is_it_for"/);
      const nepali=(await request('/ne/services/fixture',undefined,true)).html;assert.ok(!nepali.includes('English summary'));for(const key of ['who_is_it_for','availability','location']) assert.ok(!nepali.includes(`id="service-${key}"`));
      assert.equal((await request('/services/hidden',undefined,true)).status,404);assert.equal((await request('/services/a%2Fb',undefined,true)).status,404);
    });
    await t.test('structured activity articles, image settings, legacy preservation and sidebar relationships',async()=> {
      const original=service.full_description_en;
      assert.equal(service.description_format,'PLAIN');assert.equal(service.image_position,'DEFAULT');
      const baseData={...Object.fromEntries(modules.services.fields.map(f=>[f.key,service[f.key]||''])),slug:service.slug,is_active:'1',category_id:category.id,is_featured:'1',display_order:String(service.display_order)};
      assert.equal((await save(modules.services,{...baseData,image_position:'LEFT'},{id:service.id,revision:service.revision})).status,303);await refresh();
      assert.equal(service.full_description_en,original);assert.equal(service.description_format,'PLAIN');
      const sibling=await db.service.create({data:{...fields(modules.services),slug:'same-group',name_en:'Same group sibling',name_ne:'उही समूह',category_id:category.id,is_active:true}});
      await db.service.create({data:{...fields(modules.services),slug:'hidden-sibling',category_id:category.id,is_active:false}});
      const article='<h2>Structured heading</h2><p>'+ 'Long article '.repeat(1800)+'</p><ul><li>One</li></ul><a href="javascript:alert(1)">Unsafe</a><script>bad()</script>';
      for(const position of ['LEFT','RIGHT','TOP','FULL','DEFAULT']) {
        const data={...baseData,description_format:'HTML',image_position:position,full_description_en:article,full_description_ne:'<h2>विवरण</h2><p>नेपाली लेख</p>',who_is_it_for_en:'Adults'};
        assert.equal((await save(modules.services,data,{id:service.id,revision:service.revision})).status,303);await refresh();
        assert.equal(service.image_position,position);assert.ok(!service.full_description_en.includes('<script>'));
        const html=(await request('/services/fixture',undefined,true)).html;
        assert.ok(html.includes('activity-image-'+position.toLowerCase()));assert.match(html,/<h2>Structured heading<\/h2>/);
        assert.match(html,/activity-related/);assert.match(html,/id="service-who_is_it_for"/);assert.ok(html.includes('/services/same-group'));assert.ok(!html.includes('/services/hidden-sibling'));
        const related=html.slice(html.indexOf('class="activity-info-card activity-related"'));assert.ok(!related.includes('href="/services/fixture"'));
      }
      const edit=(await request('/admin/services/'+service.id+'/edit')).html;
      assert.match(edit,/data-activity-editor/);assert.match(edit,/rows="18"/);assert.match(edit,/value="DEFAULT" checked/);assert.match(edit,/name="description_format" value="HTML"/);
      for(const invalid of [{image_position:'BAD'},{description_format:'BAD'}]) assert.equal((await save(modules.services,{...baseData,...invalid},{id:service.id,revision:service.revision})).status,400);
      assert.equal((await save(modules.services,{...baseData,description_format:'HTML',full_description_en:'<p>Preserved body</p>',who_is_it_for_en:'',availability_en:'',location_en:''},{id:service.id,revision:service.revision})).status,303);await refresh();
      const noInfo=(await request('/services/fixture',undefined,true)).html;assert.match(noInfo,/activity-related/);assert.ok(!noInfo.includes('id="service-who_is_it_for"'));
      await db.service.update({where:{id:sibling.id},data:{is_active:false}});
      assert.ok(!(await request('/services/fixture',undefined,true)).html.includes('activity-related-heading'));
    });
    await t.test('unlimited repeatable features, scoped IDs, edit/order/delete and stale parent protection',async()=> {
      const m=modules.serviceFeature;
      assert.equal((await request(`/admin/services/${service.id}/features/new`)).status,200);
      for(let index=0;index<10;index++) assert.equal((await save(m,{...fields(m,'Feature '+index),display_order:10-index},{parent:service.id})).status,303);
      await refresh();assert.equal(service.features.length,10);assert.equal(service.features[0].title_en,'Feature 9 title_en');
      let feature=service.features[0];
      assert.equal((await request(`/admin/services/2147483647/features/${feature.id}/edit`)).status,404);
      const other=(await content.activeServices()).find(r=>r.slug==='first');assert.equal((await request(`/admin/services/${other.id}/features/${feature.id}/edit`)).status,404);
      assert.equal((await save(m,{...fields(m,'Edited'),display_order:'99'},{parent:service.id,id:feature.id,revision:feature.revision})).status,303);
      assert.equal((await save(modules.services,{...fields(modules.services),slug:'fixture'},{id:service.id,revision:2})).status,409);
      feature=await content.read(m,feature.id,service.id);assert.equal((await request(`/admin/services/${service.id}/features/${feature.id}/delete`)).status,200);assert.equal((await deleteRow(m,feature,service.id)).status,303);
      await refresh();const html=(await request('/services/fixture',undefined,true)).html;assert.match(html,/id="service-features"/);assert.ok(html.indexOf('Feature 8 title_en')<html.indexOf('Feature 0 title_en'));
    });
    await t.test('featured/gallery upload validation, optional alt/caption, order and shared media cleanup',async()=> {
      const m=modules.serviceImage;
      const supportingForm=await request(`/admin/services/${service.id}/images/new`);assert.equal(supportingForm.status,200);assert.match(supportingForm.html,/Supporting image/);
      for(const options of [{file:Buffer.from('bad')},{file:png,type:'image/jpeg',filename:'photo.jpg'},{file:png,filename:'photo.svg'},{file:Buffer.alloc(10*1024*1024+1)}]) assert.equal((await save(m,fields(m),{parent:service.id,...options})).status,400);
      assert.equal((await save(m,fields(m),{parent:service.id})).status,400);
      assert.equal((await save(m,{...fields(m),display_order:'2',caption_en:'Second image'},{parent:service.id,file:png})).status,303);
      assert.equal((await save(m,{...fields(m),display_order:'1',caption_en:'First image',alt_text_en:'Actual image description'},{parent:service.id,file:png})).status,303);
      await refresh();assert.equal(service.images.length,2);const editor=(await request('/admin/services/'+service.id+'/edit')).html;assert.match(editor,/Add supporting image/);assert.match(editor,/optional EN\/NE caption and alt text/);
      const imageList=(await request(`/admin/services/${service.id}/images`)).html;assert.match(imageList,/View full image/);assert.match(imageList,/Supporting images appear after the activity article/);
      const en=(await request('/services/fixture',undefined,true)).html,ne=(await request('/ne/services/fixture',undefined,true)).html;
      assert.ok(en.indexOf('First image')<en.indexOf('Second image'));assert.match(en,/alt="Actual image description"/);assert.ok(!ne.includes('<figcaption'));assert.ok(ne.includes(`alt="${service.name_ne}"`));
      let image=service.images[0];const old=image.image;
      assert.equal((await save(m,{...fields(m),display_order:'8'},{parent:service.id,id:image.id,revision:image.revision,file:png})).status,303);
      assert.equal(await db.mediaAsset.findUnique({where:{id:old.id}}),null);
      image=await content.read(m,image.id,service.id);assert.equal((await deleteRow(m,image,service.id)).status,303);
      await refresh();const oldFeatured=service.featured_image;
      // A second owner prevents file/metadata deletion when the service releases it.
      const member=await db.teamMember.create({data:{name_en:'QA',name_ne:'परीक्षण',designation_en:'QA',designation_ne:'परीक्षण',introduction_en:'',introduction_ne:'',photo_id:oldFeatured.id}});
      const data={...fields(modules.services),slug:'fixture',is_active:'1',clear_photo:'1'};
      assert.equal((await save(modules.services,data,{id:service.id,revision:service.revision})).status,303);
      assert.ok(await db.mediaAsset.findUnique({where:{id:oldFeatured.id}}));await db.teamMember.delete({where:{id:member.id}});
      await refresh();assert.equal(service.featured_image,null);
      assert.equal((await save(modules.services,{...data,clear_photo:'0'},{id:service.id,revision:service.revision,file:png})).status,303);await refresh();
      assert.equal((await request('/media/'+service.featured_image.storage_key,undefined,true)).status,200);
    });
    await t.test('dynamic contact CTA, deactivate/reactivate and category removal preserves service',async()=> {
      const before=await settings.read();
      if(before) await db.organizationSettings.update({where:{id:1},data:{primary_email:'services-contact@example.test'}});else await db.organizationSettings.create({data:{id:1,primary_email:'services-contact@example.test'}});
      assert.match((await request('/services/fixture',undefined,true)).html,/href="mailto:services-contact@example.test"/);
      let data={...fields(modules.services),slug:'fixture',category_id:category.id,is_featured:'1'};
      assert.equal((await save(modules.services,data,{id:service.id,revision:service.revision})).status,303);await refresh();assert.equal((await request('/services/fixture',undefined,true)).status,404);assert.equal((await content.featuredServices()).length,0);
      assert.equal((await save(modules.services,{...data,is_active:'1'},{id:service.id,revision:service.revision})).status,303);await refresh();
      assert.equal((await deleteRow(modules.serviceCategories,category)).status,303);await refresh();assert.equal(service.category_id,null);
      if(before) await db.organizationSettings.update({where:{id:1},data:{primary_email:before.primary_email}});else await db.organizationSettings.delete({where:{id:1}});
    });
    await t.test('transactional deletion removes child records/media, stale deletes and logout guard',async()=> {
      await refresh();const featured=service.featured_image,remainingImage=service.images[0].image;
      assert.equal((await deleteRow(modules.services,{...service,revision:1})).status,409);
      assert.equal((await request('/admin/services/'+service.id+'/delete')).status,200);
      assert.equal((await deleteRow(modules.services,service)).status,303);
      assert.equal(await db.serviceFeature.count({where:{service_id:service.id}}),0);assert.equal(await db.serviceImage.count({where:{service_id:service.id}}),0);
      for(const asset of [featured,remainingImage]) {assert.equal(await db.mediaAsset.findUnique({where:{id:asset.id}}),null);assert.ok(!(await readdir(directory)).includes(asset.storage_key));}
      assert.equal((await request('/services/fixture',undefined,true)).status,404);
      assert.equal((await request('/admin/logout',new URLSearchParams({_csrf:token}))).status,303);assert.equal((await request('/admin/services')).status,303);
    });
    await t.test('category listing, scoped bilingual pages and all active Home activities',async()=> {
      const a=await db.serviceCategory.create({data:{...fields(modules.serviceCategories),name_en:'Category Alpha',name_ne:'श्रेणी एक',slug:'alpha',description_en:'Category description',display_order:1,is_active:true}});
      const b=await db.serviceCategory.create({data:{...fields(modules.serviceCategories),name_en:'Category Beta',name_ne:'श्रेणी दुई',slug:'beta',display_order:2,is_active:true}});
      await db.serviceCategory.create({data:{...fields(modules.serviceCategories),name_en:'Empty category',name_ne:'खाली',slug:'empty-category',is_active:true}});
      const hidden=await db.serviceCategory.create({data:{...fields(modules.serviceCategories),name_en:'Private category',name_ne:'निजी',slug:'private-category',is_active:false}});
      for(const [slug,category_id,is_featured,is_active] of [['alpha-one',a.id,true,true],['alpha-two',a.id,false,true],['beta-one',b.id,true,true],['alpha-hidden',a.id,true,false],['orphan-visible',hidden.id,true,true]]) await db.service.create({data:{...fields(modules.services),name_en:slug,name_ne:'सेवा '+slug,slug,category_id,is_featured,is_active}});
      const listing=(await request('/services',undefined,true)).html;assert.ok(listing.indexOf('id="category-alpha"')<listing.indexOf('id="category-beta"'));assert.ok(listing.includes('Empty category'));assert.ok(listing.includes('/services/category/empty-category'));assert.match(listing,/service-card-link/);assert.ok(!listing.includes('Private category'));assert.match(listing,/orphan-visible/);
      assert.match(listing,/Core Activities/);assert.match(listing,/activity-section-nav/);assert.match(listing,/href="#category-alpha-heading"/);
      const page=await request('/services/category/alpha',undefined,true);assert.equal(page.status,200);assert.match(page.html,/alpha-one/);assert.match(page.html,/alpha-two/);assert.ok(!page.html.includes('beta-one'));assert.ok(!page.html.includes('alpha-hidden'));assert.ok(page.html.includes('/ne/services/category/alpha'));assert.match(page.html,/Category description/);
      assert.match(page.html,/activity-child-nav/);
      const detail=(await request('/services/alpha-one',undefined,true)).html;assert.equal((detail.match(/<h1>/g)||[]).length,1);assert.ok(detail.indexOf('activity-section-nav')<detail.indexOf('class="activity-hero'));assert.match(detail,/<p class="eyebrow activity-hero-chip"><span aria-hidden="true"><\/span>Category Alpha<\/p>/);assert.match(detail,/activity-breadcrumb/);assert.ok(!detail.includes('activity-child-nav'));assert.match(detail,/activity-related/);assert.ok(!detail.includes('href="/services/alpha-one"'));assert.match(detail,/alpha-two/);assert.ok(!detail.includes('alpha-hidden'));
      const ne=await request('/ne/services/category/alpha',undefined,true);assert.equal(ne.status,200);assert.match(ne.html,/श्रेणी एक/);assert.ok(!ne.html.includes('Category description'));
      for(const slug of ['private-category','missing']) assert.equal((await request('/services/category/'+slug,undefined,true)).status,404);
      for(const path of ['/','/ne']) {const home=(await request(path,undefined,true)).html;assert.match(home,/home-services-heading/);assert.match(home,/alpha-one/);assert.match(home,/alpha-two/);assert.match(home,/beta-one/);assert.ok(!home.includes('alpha-hidden'));assert.ok(!home.includes('Private category'));assert.ok(home.includes('services/category/alpha'));}
    });
  } finally {
    await new Promise(resolve=>server.close(resolve));await db.serviceFeature.deleteMany();await db.serviceImage.deleteMany();await db.service.deleteMany();await db.serviceCategory.deleteMany();await db.mediaAsset.deleteMany({where:{storage_key:{in:await readdir(directory)}}});await db.adminUser.delete({where:{id:admin.id}});await db.$disconnect();await rm(directory,{recursive:true,force:true});
  }
});

