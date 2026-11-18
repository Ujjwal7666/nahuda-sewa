import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createDatabase} from '../src/services/database.js';
import {createApp} from '../src/app.js';
import {readConfig} from '../src/config/env.js';
import {fixedContentService} from '../src/services/fixed-content.js';
import {mediaContentService} from '../src/services/media-content.js';
import {organizationSettingsService} from '../src/services/organization-settings.js';
import {modules} from '../src/config/fixed-content.js';
import {mediaModules} from '../src/config/media-content.js';

const fields=module=>Object.fromEntries(module.fields.map(f=>[f.key,f.optional?'':f.lang==='ne'?'नेपाली '+f.key:'English '+f.key]));
test('Home aggregation on isolated MySQL',{skip:!process.env.AUTH_TEST_DATABASE_URL},async t=> {
  const url=new URL(process.env.AUTH_TEST_DATABASE_URL);assert.match(url.pathname,/^\/nahuda_auth_test_[a-f0-9]{16}$/);
  const db=createDatabase(url.href),config=readConfig({NODE_ENV:'test',PUBLIC_ORIGIN:'http://127.0.0.1:3000'});
  const app=createApp(config,{content:fixedContentService(db),mediaContent:mediaContentService(db),settings:organizationSettingsService(db)});
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  const page=async path=>{const response=await fetch(base+path);assert.equal(response.status,200);return response.text();};
  try {
    await t.test('empty Home remains usable in both languages without invented facts',async()=> {
      for(const prefix of ['','/ne']) {const html=await page(prefix||'/');assert.ok(!html.includes('home-impact-heading'));assert.match(html,/home-news-heading/);assert.match(html,/home-gallery-heading/);assert.match(html,/home-testimonials-heading/);assert.ok(html.includes(`href="${prefix}/contact#feedback"`));assert.ok(html.includes(`href="${prefix}/donate"`));assert.ok(!html.includes('home-program'));}
    });
    const about=await db.aboutOrganization.create({data:{id:1,...fields(modules.about),introduction_en:'Existing About <script>alert(1)</script>',introduction_ne:'संस्थाको विद्यमान परिचय'}});
    await db.aboutStatistic.createMany({data:[{about_id:about.id,kind:'community_reach',label_en:'Actual reach',label_ne:'वास्तविक पहुँच',value:'1,200+',is_active:true,display_order:2},{about_id:about.id,kind:'families_supported',label_en:'Actual families',label_ne:'वास्तविक परिवार',value:' 42 ',is_active:true,display_order:1},{about_id:about.id,kind:'active_volunteers',label_en:'Private statistic',label_ne:'निजी तथ्याङ्क',value:'999999',is_active:false}]});
    for(let i=0;i<5;i++) {
      await db.news.create({data:{...fields(mediaModules.news),title_en:'Home story '+i,title_ne:'गृह समाचार '+i,slug:'home-story-'+i,status:'PUBLISHED',published_date:new Date(`2026-10-0${i+1}T00:00:00Z`)}});
      await db.galleryAlbum.create({data:{...fields(mediaModules.gallery),title_en:'Home album '+i,title_ne:'गृह एल्बम '+i,is_active:true,date:new Date(`2026-10-0${i+1}T00:00:00Z`)}});
      await db.testimonial.create({data:{...fields(mediaModules.testimonials),name_en:'Home person '+i,name_ne:'गृह व्यक्ति '+i,is_active:true,display_order:i}});
    }
    await db.news.create({data:{...fields(mediaModules.news),title_en:'Private draft',slug:'home-private',status:'DRAFT'}});
    await db.galleryAlbum.create({data:{...fields(mediaModules.gallery),title_en:'Private album'}});
    await db.testimonial.create({data:{...fields(mediaModules.testimonials),name_en:'Private person'}});
    const category=await db.serviceCategory.create({data:{...fields(mediaModules.serviceCategories),name_en:'Existing category',name_ne:'विद्यमान श्रेणी',slug:'home-category',is_active:true}});
    for(const [slug,active,featured] of [['home-featured',true,true],['home-not-featured',true,false],['home-hidden',false,true]]) await db.service.create({data:{...fields(mediaModules.services),slug,name_en:slug,name_ne:'सेवा '+slug,is_active:active,is_featured:featured,category_id:category.id}});
    for(let i=0;i<5;i++) await db.program.create({data:{title_en:'Home work '+i,title_ne:'गृहकार्य '+i,slug:'home-work-'+i,full_description_en:'Description for work '+i,full_description_ne:'कामको विवरण '+i,additional_heading_en:'',additional_heading_ne:'',additional_content_en:'',additional_content_ne:'',display_order:i,is_active:i<4}});
    await t.test('bounded selections enforce status, chronological/order rules and separate Our Work and Core Activities data',async()=> {
      const result=await mediaContentService(db).homeHighlights();assert.deepEqual(result.news.map(n=>n.slug),['home-story-4','home-story-3','home-story-2']);assert.equal(result.albums.length,4);assert.equal(result.albums[0].title_en,'Home album 4');assert.deepEqual(result.testimonials.map(n=>n.name_en),['Home person 0','Home person 1','Home person 2']);
      for(const [prefix,language] of [['','en'],['/ne','ne']]) {
        const html=await page(prefix||'/');assert.match(html,new RegExp(`<html lang="${language}">`));
        assert.equal((html.match(/id="home-services-heading"/g)||[]).length,1);assert.match(html,/home-featured/);assert.match(html,/home-not-featured/);assert.ok(!html.includes('home-hidden'));
        assert.equal((html.match(/class="home-work-card"/g)||[]).length,4);assert.match(html,/home-work-0/);assert.ok(!html.includes('home-work-4'));assert.ok(html.includes(language==='en'?'Our Work':'हाम्रो काम'));assert.ok(html.includes(language==='en'?'गृहकार्य 0':'Home work 0')===false);
        assert.ok(html.includes(language==='en'?'Home work 0':'गृहकार्य 0'));assert.ok(html.includes(`href="${prefix}/programs"`));assert.ok(html.includes(`href="${prefix}/services/home-featured"`));assert.ok(html.includes(`href="${prefix}/services/category/home-category"`));
        for(const privateText of ['Private draft','Private album','Private person','Private statistic','999999']) assert.ok(!html.includes(privateText));
        assert.match(html,/1,200\+/);assert.match(html,/> 42 </);assert.ok(html.indexOf('> 42 <')<html.indexOf('>1,200+<'));
        const ids=['welcome-heading','home-about-heading','home-services-heading','home-work-heading','home-impact-heading','home-news-heading','home-gallery-heading','home-testimonials-heading','home-feedback-heading','home-donate-heading'];
        for(let i=1;i<ids.length;i++) assert.ok(html.indexOf(`id="${ids[i-1]}"`)<html.indexOf(`id="${ids[i]}"`));
        assert.ok(html.includes(`href="${prefix}/news/home-story-4"`));assert.match(html,/rel="canonical"/);assert.match(html,/hreflang="ne"/);assert.ok(!html.includes('<script>alert(1)</script>'));
        assert.ok(html.includes(language==='en'?'Existing About &lt;script&gt;':'संस्थाको विद्यमान परिचय'));if(language==='ne')assert.ok(!html.includes('Existing About'));
      }
      assert.equal((await fetch(base+'/programs')).status,200);assert.equal((await fetch(base+'/ne/programs')).status,200);
    });
  } finally {
    await new Promise(resolve=>server.close(resolve));
    await db.service.deleteMany();await db.serviceCategory.deleteMany();await db.program.deleteMany();await db.aboutStatistic.deleteMany();await db.aboutOrganization.deleteMany();await db.news.deleteMany();await db.galleryAlbum.deleteMany();await db.testimonial.deleteMany();await db.$disconnect();
  }
});
