import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {mkdtemp,readdir,rm,readFile} from 'node:fs/promises';
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
import {donationReceiptService} from '../src/services/donation-receipts.js';
import {receiptLifetimeMs} from '../src/config/donation.js';

test('Donation receipts against isolated MySQL',{skip:!process.env.AUTH_TEST_DATABASE_URL},async(t)=>{
  const url=new URL(process.env.AUTH_TEST_DATABASE_URL);assert.match(url.pathname,/^\/nahuda_auth_test_[a-f0-9]{16}$/);
  const directory=await mkdtemp(join(tmpdir(),'nahuda-receipts-'));
  const db=createDatabase(url.href);
  const config=readConfig({NODE_ENV:'test',DATABASE_URL:url.href,SESSION_SECRET:randomBytes(32).toString('hex'),RECEIPT_IP_MAX:'100',RECEIPT_EMAIL_MAX:'100'});
  const receipts=donationReceiptService(db,config,directory);
  const password=randomBytes(24).toString('hex');
  const admin=await db.adminUser.create({data:{name:'Receipt QA',email:'receipt-admin@example.test',password_hash:await hashPassword(password)}});
  const app=createApp(config,{auth:authenticationService(db,config),store:new PrismaSessionStore(db,config.sessionLifetimeMs),settings:organizationSettingsService(db),receipts,receiptStore:new PrismaSessionStore(db,receiptLifetimeMs,'donation')});
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  const donor={cookie:'',csrf:'',submission:''},staff={cookie:'',csrf:''};
  async function request(path,body,jar=donor) {
    const response=await fetch(base+path,{method:body?'POST':'GET',headers:jar?{cookie:jar.cookie}:{},body,redirect:'manual'});
    const html=await response.text();
    if(jar) {if(response.headers.get('set-cookie'))jar.cookie=response.headers.get('set-cookie').split(';')[0];jar.csrf=/name="_csrf" value="([a-f0-9]+)"/.exec(html)?.[1]||jar.csrf;jar.submission=/name="_submission" value="([a-f0-9]+)"/.exec(html)?.[1]||jar.submission;}
    return {response,status:response.status,html};
  }
  const png=await sharp({create:{width:120,height:80,channels:4,background:'#2463ab'}}).png().toBuffer();
  const fields={full_name:'Receipt donor <script>',email:'donor@example.test',donation_date:'2024-02-29',donation_amount:'1250.25',currency:'USD',phone:'+977 123456789',transaction_reference:'QA-ONLY',message:'Receipt note <script>alert(1)</script>'};
  function form(changes={},file={data:png,type:'image/png',name:'receipt.png'}) {
    const f=new FormData();for(const[k,v]of Object.entries({_csrf:donor.csrf,_submission:donor.submission,website:'',...fields,...changes}))f.set(k,v);
    if(file)f.set('receipt',new Blob([file.data],{type:file.type}),file.name);return f;
  }
  const submit=(changes={},file)=>request('/donate',form(changes,file));
  try {
    await t.test('public EN/NE routes, empty donation state and real header/footer links',async()=>{
      for(const path of ['/donate','/ne/donate']) {
        const result=await request(path);assert.equal(result.status,200);assert.match(result.html,/name="currency"/);assert.ok(!result.html.includes('class="donation-qr"'));assert.ok(!result.html.includes('class="bank-details"'));
        assert.ok(result.html.includes(`href="${path}" aria-current="page"`));assert.ok(result.html.includes(path==='/donate'?'Submit your donation receipt':'सहयोगको रसिद पठाउनुहोस्'));
      }
      assert.match(donor.cookie,/^nahuda.donation.sid=/);
      const other=await request('/donate',undefined,{cookie:''});assert.match(other.response.headers.get('set-cookie'),/HttpOnly/);assert.match(other.response.headers.get('set-cookie'),/SameSite=Lax/);assert.match(other.response.headers.get('set-cookie'),/Path=\//);
      assert.equal((await request('/')).response.headers.get('set-cookie'),null);
    });
    await t.test('honeypot and minimum form time block simple automated submission',async()=>{
      assert.equal((await submit()).status,400);
      await new Promise(resolve=>setTimeout(resolve,2100));
      assert.equal((await submit({website:'spam'})).status,400);
    });
    await t.test('CSRF, foreign session and missing submission token are rejected before storage',async()=>{
      assert.equal((await submit({_csrf:'bad'})).status,403);
      assert.equal((await submit({_submission:'bad'})).status,403);
      assert.equal((await request('/donate',form(),null)).status,403);
      assert.equal(await db.donationReceiptSubmission.count(),0);assert.deepEqual(await readdir(directory),[]);
    });
    await t.test('required fields, email, amount, date, currency and excessive input enforced',async()=>{
      for(const [key,value]of [['full_name',''],['email','bad'],['donation_amount','-5'],['donation_date','2025-02-29'],['currency','XXX'],['message','x'.repeat(2001)]])assert.equal((await submit({[key]:value})).status,400,key);
      assert.equal((await submit({},null)).status,400);
    });
    await t.test('unsupported, spoofed, corrupt, oversized and extra uploads rejected',async()=>{
      for(const file of [{data:png,type:'image/svg+xml',name:'evil.svg'},{data:Buffer.from('%PDF-1.7'),type:'application/pdf',name:'receipt.pdf'},{data:png,type:'image/jpeg',name:'receipt.jpg'},{data:Buffer.from('bad'),type:'image/png',name:'receipt.png'},{data:Buffer.alloc(10*1024*1024+1),type:'image/png',name:'large.png'}])assert.equal((await submit({},file)).status,400);
      const extra=form();extra.set('unexpected',new Blob([png],{type:'image/png'}),'bad.png');assert.equal((await request('/donate',extra)).status,400);
      assert.deepEqual(await readdir(directory),[]);
    });
    let row;
    await t.test('parallel valid submissions persist one private receipt with exact amount and currency',async()=>{
      const results=await Promise.all([submit(),submit()]);assert.deepEqual(results.map(r=>r.status),[303,303]);
      assert.equal(await db.donationReceiptSubmission.count(),1);row=await db.donationReceiptSubmission.findFirst();
      assert.equal(row.currency,'USD');assert.equal(row.donation_amount.toFixed(2),'1250.25');assert.equal(row.email,fields.email);assert.equal(row.status,'NEW');assert.equal(row.donation_date.toISOString().slice(0,10),fields.donation_date);
      assert.deepEqual(await readdir(directory),[row.receipt_key]);assert.equal((await sharp(await readFile(join(directory,row.receipt_key))).metadata()).format,'png');assert.equal(await db.mediaAsset.count(),0);
      const success=await request('/donate');assert.match(success.html,/receipt has been submitted successfully/);assert.ok(!success.html.includes(row.receipt_key));assert.ok(!success.html.includes(fields.email));
      assert.ok(!(await request('/donate')).html.includes('receipt has been submitted successfully'));
    });
    await t.test('receipt data and files require Admin; public media cannot expose receipt keys',async()=>{
      for(const path of ['/admin/messages/donation-receipts',`/admin/messages/donation-receipts/${row.id}`,`/admin/messages/donation-receipts/${row.id}/file`])assert.equal((await request(path,undefined,null)).status,303);
      for(const path of [`/media/${row.receipt_key}`,`/storage/receipts/${row.receipt_key}`])assert.equal((await request(path,undefined,null)).status,404);
      assert.equal((await request(`/admin/messages/donation-receipts/${row.id}/status`,new URLSearchParams({status:'REVIEWED'}),null)).status,403);
      assert.equal((await db.donationReceiptSubmission.findUnique({where:{id:row.id}})).status,'NEW');
    });
    await t.test('Admin lists, reads escaped details, downloads and changes status with CSRF',async()=>{
      await request('/admin/login',undefined,staff);assert.equal((await request('/admin/login',new URLSearchParams({_csrf:staff.csrf,email:admin.email,password}),staff)).status,303);
      assert.equal((await request('/admin/messages/donation-receipts',undefined,staff)).status,200);
      const detail=await request(`/admin/messages/donation-receipts/${row.id}`,undefined,staff);assert.equal(detail.status,200);assert.match(detail.html,/USD 1250.25/);assert.ok(detail.html.includes('&lt;script&gt;'));assert.ok(!detail.html.includes('<script>alert(1)</script>'));assert.ok(!detail.html.includes(row.receipt_key));assert.equal(detail.response.headers.get('cache-control'),'no-store');
      const file=await fetch(base+`/admin/messages/donation-receipts/${row.id}/file?download=1`,{headers:{cookie:staff.cookie}});assert.equal(file.status,200);assert.equal(file.headers.get('content-type'),'image/png');assert.equal(file.headers.get('cache-control'),'no-store');assert.match(file.headers.get('content-disposition'),/^attachment/);await file.arrayBuffer();
      assert.equal((await request(`/admin/messages/donation-receipts/${row.id}/status`,new URLSearchParams({_csrf:'bad',status:'REVIEWED'}),staff)).status,403);
      assert.equal((await request(`/admin/messages/donation-receipts/${row.id}/status`,new URLSearchParams({_csrf:staff.csrf,status:'PAID'}),staff)).status,400);
      for(const status of ['REVIEWED','NEW']){assert.equal((await request(`/admin/messages/donation-receipts/${row.id}/status`,new URLSearchParams({_csrf:staff.csrf,status}),staff)).status,303);assert.equal((await db.donationReceiptSubmission.findUnique({where:{id:row.id}})).status,status);}
      assert.equal((await request('/admin/messages/donation-receipts/2147483648',undefined,staff)).status,404);
      await request('/admin/logout',new URLSearchParams({_csrf:staff.csrf}),staff);assert.equal((await request(`/admin/messages/donation-receipts/${row.id}/file`,undefined,staff)).status,303);
    });
    await t.test('database-backed IP/email limits are independent and survive new service instances',async()=>{
      const small={...config,receiptIpMax:2,receiptEmailMax:1};
      const a=donationReceiptService(db,small,directory),b=donationReceiptService(db,small,directory);
      assert.equal((await a.limit('ip','qa-ip')).allowed,true);assert.equal((await b.limit('ip','qa-ip')).allowed,true);const limit=await a.limit('ip','qa-ip');assert.equal(limit.allowed,false);assert.ok(limit.retryAfter>0);
      assert.equal((await a.limit('email','limit@example.test')).allowed,true);assert.equal((await b.limit('email','limit@example.test')).allowed,false);
      for(let i=0;i<101;i++)await receipts.limit('ip','127.0.0.1');const blocked=await submit();assert.equal(blocked.status,429);assert.ok(Number(blocked.response.headers.get('retry-after'))>0);
    });
  } finally {
    await new Promise(resolve=>server.close(resolve));await db.donationReceiptSubmission.deleteMany();await db.adminUser.delete({where:{id:admin.id}});await db.$disconnect();assert.ok(directory.startsWith(join(tmpdir(),'nahuda-receipts-')));await rm(directory,{recursive:true,force:true});
  }
});
