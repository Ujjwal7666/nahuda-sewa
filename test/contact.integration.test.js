import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config/env.js';
import { createDatabase } from '../src/services/database.js';
import { hashPassword } from '../src/services/passwords.js';
import { authenticationService } from '../src/services/authentication.js';
import { PrismaSessionStore } from '../src/services/session-store.js';
import { organizationSettingsService } from '../src/services/organization-settings.js';
import { contactSubmissionService } from '../src/services/contact-submissions.js';
import { contactLifetimeMs } from '../src/config/contact.js';

test('Contact / Feedback on isolated MySQL',{skip:!process.env.AUTH_TEST_DATABASE_URL},async t=>{
  const url=new URL(process.env.AUTH_TEST_DATABASE_URL);assert.match(url.pathname,/^\/nahuda_auth_test_[a-f0-9]{16}$/);
  const db=createDatabase(url.href),config=readConfig({NODE_ENV:'test',DATABASE_URL:url.href,SESSION_SECRET:randomBytes(32).toString('hex'),CONTACT_IP_MAX:'100',CONTACT_EMAIL_MAX:'100'});
  const messages=contactSubmissionService(db,config),password=randomBytes(24).toString('hex');
  const admin=await db.adminUser.create({data:{name:'Contact QA',email:'contact-admin@example.test',password_hash:await hashPassword(password)}});
  const settings=organizationSettingsService(db);
  const app=createApp(config,{auth:authenticationService(db,config),store:new PrismaSessionStore(db,config.sessionLifetimeMs),settings,messages,contactStore:new PrismaSessionStore(db,contactLifetimeMs,'contact')});
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  const visitor={cookie:'',csrf:'',token:''},staff={cookie:'',csrf:''};
  async function request(path,body,jar=visitor) {
    const response=await fetch(base+path,{method:body?'POST':'GET',body,headers:jar?{cookie:jar.cookie}:{},redirect:'manual'}),html=await response.text();
    if(jar) {if(response.headers.get('set-cookie'))jar.cookie=response.headers.get('set-cookie').split(';')[0];jar.csrf=/name="_csrf" value="([a-f0-9]+)"/.exec(html)?.[1]||jar.csrf;jar.token=/name="_submission" value="([a-f0-9]+)"/.exec(html)?.[1]||jar.token;}
    return {response,status:response.status,html};
  }
  const fields={name:'नाम <script>',email:'Visitor@Example.test',phone:'+977 (01) 123-4567',subject:'Contact QA <img>',message:' पहिलो पङ्क्ति\n<script>alert(1)</script>\n अन्तिम पङ्क्ति '};
  const form=(changes={})=>new URLSearchParams({_csrf:visitor.csrf,_submission:visitor.token,website:'',...fields,...changes});
  const submit=(changes={},path='/contact')=>request(path,form(changes));
  let row;
  try {
    await t.test('global shared contacts, bilingual address, SEO, Home CTA and cookie isolation',async()=>{
      await db.organizationSettings.create({data:{id:1,name_en:'Contact organization',name_ne:'सम्पर्क संस्था',primary_email:'office@example.test',secondary_email:'other@example.test',phone:'+977 123456789',whatsapp:'+977 987654321',address_en:'English address',address_ne:'नेपाली ठेगाना',city_en:'City EN',city_ne:'शहर',country_en:'Nepal',country_ne:'नेपाल',map_url:'https://maps.google.com/?q=Nepal'}});
      for(const prefix of ['','/ne']) {
        const result=await request(prefix+'/contact');assert.equal(result.status,200);assert.match(result.html,/office@example.test/);assert.match(result.html,/other@example.test/);assert.match(result.html,/https:\/\/wa.me\/977987654321/);assert.match(result.html,/https:\/\/maps.google.com/);
        assert.ok(result.html.includes(prefix?'नेपाली ठेगाना':'English address'));assert.ok(!result.html.includes(prefix?'English address':'नेपाली ठेगाना'));
        assert.ok(result.html.includes(`action="${prefix}/contact#feedback"`));assert.ok(result.html.includes(`href="${prefix?'/contact':'/ne/contact'}"`));
        assert.equal(result.response.headers.get('cache-control'),'no-store');assert.match(result.html,/id="feedback"/);
        const home=await request(prefix||'/');assert.ok(home.html.includes(`href="${prefix}/contact#feedback"`));assert.equal(home.response.headers.get('set-cookie'),null);
      }
      assert.match(visitor.cookie,/^nahuda.contact.sid=/);
      const other=await request('/contact',undefined,{cookie:''});assert.match(other.response.headers.get('set-cookie'),/HttpOnly/);assert.match(other.response.headers.get('set-cookie'),/SameSite=Lax/);
      assert.equal((await request('/contact',form(),{cookie:visitor.cookie.replace('nahuda.contact.sid','nahuda.donation.sid')})).status,403);
    });
    await t.test('CSRF, form expiry, honeypot, timing and foreign-session requests reject safely',async()=>{
      assert.equal((await submit({_csrf:'bad'})).status,403);assert.equal((await submit({_submission:'bad'})).status,403);
      assert.equal((await request('/contact',form(),null)).status,403);
      const fresh={cookie:'',csrf:'',token:''};await request('/contact',undefined,fresh);
      assert.equal((await request('/contact',new URLSearchParams({...fields,_csrf:fresh.csrf,_submission:fresh.token}),fresh)).status,400);
      await new Promise(resolve=>setTimeout(resolve,2100));
      assert.equal((await submit({website:'bot'})).status,400);
      const sessionRow=(await db.adminSession.findMany()).find(r=>JSON.parse(r.data).submissionToken===fresh.token);
      const value=JSON.parse(sessionRow.data);value.issuedAt=Date.now()-contactLifetimeMs-1;
      await db.adminSession.update({where:{id:sessionRow.id},data:{data:JSON.stringify(value)}});
      assert.equal((await request('/contact',new URLSearchParams({...fields,_csrf:fresh.csrf,_submission:fresh.token}),fresh)).status,403);
      assert.equal(await db.contactSubmission.count(),0);
    });
    await t.test('required/email/phone/length/control/repeated validation preserves escaped values and localizes errors',async()=>{
      for(const [key,value] of [['name',''],['email','invalid'],['phone','phone'],['subject',''],['message',''],['message','x'.repeat(5001)],['name','x'.repeat(101)],['subject','bad\u0000value']]) assert.equal((await submit({[key]:value})).status,400,key);
      const repeated=form();repeated.append('name','second');assert.equal((await request('/contact',repeated)).status,400);
      const result=await submit({email:'bad'},'/ne/contact');assert.match(result.html,/तोकिएको सीमाभित्र/);assert.match(result.html,/aria-describedby="contact-email-error"/);assert.ok(result.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));assert.ok(!result.html.includes('<script>alert(1)</script>'));
      assert.ok(result.html.includes(fields.message.replaceAll('<','&lt;').replaceAll('>','&gt;')));
      const excessive=form({message:'x'.repeat(70000)});assert.equal((await request('/ne/contact',excessive)).status,413);
      assert.equal(await db.contactSubmission.count(),0);
    });
    await t.test('parallel submission stores one exact private message with server date and New status',async()=>{
      const before=new Date();const results=await Promise.all([submit({status:'READ',submitted_at:'1900-01-01'}),submit()]);assert.deepEqual(results.map(r=>r.status),[303,303]);
      assert.equal(await db.contactSubmission.count(),1);row=await db.contactSubmission.findFirst();
      for(const [key,value] of Object.entries(fields)) assert.equal(row[key],value,key);
      assert.equal(row.status,'NEW');assert.ok(row.submitted_at>=before);assert.equal(results[0].response.headers.get('location'),'/contact#feedback');
      const success=await request('/contact');assert.match(success.html,/message has been submitted successfully/);assert.ok(!success.html.includes(row.submission_key));assert.ok(!success.html.includes(fields.email));
      assert.ok(!(await request('/contact')).html.includes('message has been submitted successfully'));
      await new Promise(resolve=>setTimeout(resolve,2100));assert.equal((await submit({phone:'',email:'ne@example.test'},'/ne/contact')).status,303);
      assert.equal((await db.contactSubmission.findFirst({where:{email:'ne@example.test'}})).phone,null);
      assert.match((await request('/ne/contact')).html,/सन्देश सफलतापूर्वक/);
    });
    await t.test('Admin authentication, escaped detail, predictable GET and CSRF-only read action preserve content',async()=>{
      for(const path of ['/admin/messages/contact-feedback',`/admin/messages/contact-feedback/${row.id}`]) assert.equal((await request(path,undefined,null)).status,303);
      assert.equal((await request(`/admin/messages/contact-feedback/${row.id}/status`,new URLSearchParams({status:'READ'}),null)).status,403);
      await request('/admin/login',undefined,staff);assert.equal((await request('/admin/login',new URLSearchParams({_csrf:staff.csrf,email:admin.email,password}),staff)).status,303);
      const detail=await request(`/admin/messages/contact-feedback/${row.id}`,undefined,staff);assert.equal(detail.status,200);assert.match(detail.html,/Mark as Read/);assert.ok(detail.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));assert.ok(!detail.html.includes('<script>alert(1)</script>'));assert.equal(detail.response.headers.get('cache-control'),'no-store');
      assert.equal((await messages.find(row.id)).status,'NEW');
      for(const changes of [{_csrf:'bad',status:'READ'},{_csrf:staff.csrf,status:'DELETED'},{_csrf:staff.csrf,status:['READ','NEW']}]) {
        const body=new URLSearchParams();for(const [key,value] of Object.entries(changes))for(const item of Array.isArray(value)?value:[value])body.append(key,item);
        assert.equal((await request(`/admin/messages/contact-feedback/${row.id}/status`,body,staff)).status,changes._csrf==='bad'?403:400);
      }
      assert.equal((await request(`/admin/messages/contact-feedback/${row.id}/status`,new URLSearchParams({_csrf:staff.csrf,status:'READ',name:'overwrite',message:'overwrite'}),staff)).status,303);
      const read=await messages.find(row.id);assert.deepEqual({...read,status:'NEW'},row);assert.equal(read.status,'READ');
      assert.match((await request(`/admin/messages/contact-feedback/${row.id}`,undefined,staff)).html,/Read/);
      for(const id of ['0','-1','abc','2147483648','2147483647'])assert.equal((await request('/admin/messages/contact-feedback/'+id,undefined,staff)).status,404);
      assert.equal((await request('/feedback',undefined,null)).status,404);
    });
    await t.test('persistence failures return localized recoverable errors without losing entered text or claiming success',async()=>{
      const originalSave=messages.save,count=await db.contactSubmission.count();
      messages.save=async()=>{throw Error('Private database failure detail');};
      try {
        await new Promise(resolve=>setTimeout(resolve,2100));
        const result=await submit({},'/ne/contact');assert.equal(result.status,503);assert.match(result.html,/अहिले सन्देश पठाउन सकिँदैन/);
        assert.ok(result.html.includes(fields.message.replaceAll('<','&lt;').replaceAll('>','&gt;')));assert.ok(!result.html.includes('Private database failure detail'));assert.ok(!result.html.includes('सन्देश सफलतापूर्वक'));
        assert.equal(await db.contactSubmission.count(),count);
      } finally {messages.save=originalSave;}
      assert.equal((await submit({},'/ne/contact')).status,303);
      await db.contactSubmission.deleteMany({where:{id:{gt:row.id},email:fields.email}});
    });
    await t.test('newest-first list, New/Read filters, pagination and Messages navigation',async()=>{
      await db.contactSubmission.createMany({data:Array.from({length:21},(_,i)=>({...fields,name:`QA ${i}`,subject:`Message ${i}`,submission_key:randomBytes(32).toString('hex'),submitted_at:new Date(Date.now()+i*1000)}))});
      const listing=await request('/admin/messages/contact-feedback',undefined,staff);assert.match(listing.html,/23 messages/);assert.match(listing.html,/Next →/);assert.ok(!listing.html.includes('QA 0</dd>'));
      assert.ok(listing.html.indexOf('Message 20 →')<listing.html.indexOf('Message 19 →'));
      const second=await request('/admin/messages/contact-feedback?page=2',undefined,staff);assert.match(second.html,/Previous/);assert.match(second.html,/Contact QA &lt;img&gt;/);
      const read=await request('/admin/messages/contact-feedback?status=READ',undefined,staff);assert.match(read.html,/1 messages/);
      assert.match((await request('/admin/messages/contact-feedback?status=NEW',undefined,staff)).html,/22 messages/);
      assert.match((await request('/admin/messages',undefined,staff)).html,/Open Contact \/ Feedback/);
    });
    await t.test('persistent independent IP/email limits, normalized email and localized HTTP 429',async()=>{
      const small=contactSubmissionService(db,{...config,contactIpMax:2,contactEmailMax:1});
      assert.equal((await small.limit('ip','qa-ip')).allowed,true);assert.equal((await small.limit('ip','qa-ip')).allowed,true);assert.equal((await small.limit('ip','qa-ip')).allowed,false);
      assert.equal((await small.limit('email','Case@Example.test')).allowed,true);
      assert.equal((await contactSubmissionService(db,{...config,contactEmailMax:1}).limit('email','case@example.test')).allowed,false);
      const buckets=await db.authRateLimit.findMany();assert.ok(!JSON.stringify(buckets).includes('case@example.test'));
      for(let i=0;i<101;i++)await messages.limit('ip','127.0.0.1');const blocked=await submit({},'/ne/contact');assert.equal(blocked.status,429);assert.ok(Number(blocked.response.headers.get('retry-after'))>0);assert.match(blocked.html,/धेरै पटक प्रयास/);
    });
  } finally {
    await new Promise(resolve=>server.close(resolve));await db.contactSubmission.deleteMany();await db.organizationSettings.deleteMany();await db.adminUser.delete({where:{id:admin.id}});await db.$disconnect();
  }
});
