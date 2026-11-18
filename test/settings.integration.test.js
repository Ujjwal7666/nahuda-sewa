import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {mkdtemp, readdir, rm} from 'node:fs/promises';
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

test('Organization Settings against isolated MySQL', {skip: !process.env.AUTH_TEST_DATABASE_URL}, async (t) => {
  const url = new URL(process.env.AUTH_TEST_DATABASE_URL);
  assert.match(url.pathname, /^\/nahuda_auth_test_[a-f0-9]{16}$/);
  const directory = await mkdtemp(join(tmpdir(), 'nahuda-settings-'));
  const db = createDatabase(url.href);
  const config = readConfig({NODE_ENV:'test', DATABASE_URL:url.href, SESSION_SECRET:randomBytes(32).toString('hex')});
  const settings = organizationSettingsService(db,directory);
  const password = randomBytes(24).toString('hex');
  const admin = await db.adminUser.create({data:{name:'Settings QA',email:'settings@example.test',password_hash:await hashPassword(password)}});
  let reads = 0;
  const app = createApp(config,{auth:authenticationService(db,config),store:new PrismaSessionStore(db,config.sessionLifetimeMs),settings:{...settings,read:async()=>{reads++;return settings.read();}}});
  const server=app.listen(0,'127.0.0.1'); await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  let cookie='', token='', revision='0';
  async function request(path, body, anonymous=false) {
    const headers=anonymous?{}:{cookie};
    const response=await fetch(base+path,{method:body?'POST':'GET',headers,body,redirect:'manual'});
    if(!anonymous && response.headers.get('set-cookie')) cookie=response.headers.get('set-cookie').split(';')[0];
    const html=await response.text();
    if(!anonymous) {token=/name="_csrf" value="([a-f0-9]+)"/.exec(html)?.[1] || token; revision=/name="revision" value="(\d+)"/.exec(html)?.[1] || revision;}
    return {status:response.status,html,response};
  }
  const page=()=>request('/admin/organization/settings');
  async function save(fields={},files={},options={}) {
    const form=new FormData(); form.set('_csrf',options.token??token); form.set('revision',options.revision??revision);
    for(const [key,value] of Object.entries(fields)) form.set(key,value);
    for(const [key,file] of Object.entries(files)) form.set(key,new Blob([file.data],{type:file.type||'image/png'}),file.name||'image.png');
    return request('/admin/organization/settings',form,options.anonymous);
  }
  const png=await sharp({create:{width:32,height:32,channels:4,background:'#2463ab'}}).png().toBuffer();
  try {
    await t.test('anonymous reads and writes redirect without creating records or files',async()=>{
      assert.equal((await page()).status,303); assert.equal((await save({}, {primary_logo:{data:png}}, {anonymous:true})).status,303);
      assert.equal(await db.organizationSettings.count(),0); assert.deepEqual(await readdir(directory),[]);
    });
    await t.test('public empty state and authenticated settings page render',async()=>{
      assert.equal((await request('/',undefined,true)).status,200);
      await request('/admin/login');
      assert.equal((await request('/admin/login',new URLSearchParams({_csrf:token,email:admin.email,password}))).status,303);
      const result=await page(); assert.equal(result.status,200); assert.match(result.html,/Organization Settings/); assert.equal(revision,'0');
    });
    await t.test('multipart CSRF rejects uploads without persistence',async()=>{
      assert.equal((await save({}, {primary_logo:{data:png}}, {token:'bad'})).status,403);
      assert.equal(await db.mediaAsset.count(),0); assert.deepEqual(await readdir(directory),[]);
    });
    await t.test('empty save creates exactly one global record; database rejects another id',async()=>{
      assert.equal((await save()).status,303); await page(); assert.equal(revision,'1');
      await assert.rejects(db.organizationSettings.create({data:{id:2}}));
      assert.equal(await db.organizationSettings.count(),1);
      assert.equal((await request('/',undefined,true)).status,200);
    });
    await t.test('invalid email, URL, map HTML, length and phone rejected',async()=>{
      for(const fields of [{primary_email:'bad'},{facebook_url:'javascript:alert(1)'},{instagram_url:'https://user:secret@example.com'},{map_url:'<iframe></iframe>'},{map_url:'https://evil.example/maps'},{name_en:'x'.repeat(201)},{phone:'abc'},{swift_code:'123'}]) assert.equal((await save(fields)).status,400,JSON.stringify(fields));
      assert.equal((await settings.read()).revision,1);
    });
    await t.test('executable, spoofed, corrupt, oversized and unexpected uploads rejected',async()=>{
      for(const file of [{data:png,name:'evil.svg',type:'image/svg+xml'},{data:png,name:'evil.php',type:'image/png'},{data:png,name:'a.jpg',type:'image/jpeg'},{data:Buffer.from('not a png')},{data:Buffer.alloc(10*1024*1024+1)}]) assert.equal((await save({}, {primary_logo:file})).status,400);
      assert.equal((await save({}, {unknown:{data:png}})).status,400);
      assert.equal(await db.mediaAsset.count(),0); assert.deepEqual(await readdir(directory),[]);
    });
    const fields={name_en:'QA Organization <script>',name_ne:'परीक्षण संस्था',short_name_en:'QA short',short_name_ne:'परीक्षण',tagline_en:'Serving together',tagline_ne:'सँगै सेवा',primary_email:'contact@example.test',secondary_email:'other@example.test',phone:'+977 (1) 123-4567',whatsapp:'+977 9812345678',address_en:'Test address',address_ne:'परीक्षण ठेगाना',city_en:'Test city',country_en:'Test country',map_url:'https://maps.google.com/?q=Nepal',facebook_url:'https://facebook.com/example',footer_description_en:'Footer EN <script>alert(1)</script>',footer_description_ne:'फुटर विवरण',copyright_en:'© QA',copyright_ne:'© परीक्षण',donation_intro_en:'Donation EN',donation_intro_ne:'सहयोग विवरण',bank_name:'QA bank',account_name:'QA account',account_number:'00001234',branch:'QA branch',swift_code:'AAAANPKA',donation_instructions_en:'Instructions EN',site_title_en:'QA Site Title',site_title_ne:'परीक्षण शीर्षक',site_description_en:'QA description',site_description_ne:'परीक्षण विवरण'};
    await t.test('save all five assets and bilingual values; reload persists them',async()=>{
      const files=Object.fromEntries(['primary_logo','footer_logo','favicon','donation_qr','sharing_image'].map(key=>[key,{data:png,name:'../../unsafe.png'}]));
      assert.equal((await save(fields,files)).status,303); const result=await page(); assert.equal(result.status,200); assert.match(result.html,/QA Site Title/);
      assert.equal(await db.mediaAsset.count(),5); assert.equal((await settings.read()).account_number,'00001234');
      for(const key of await readdir(directory)) assert.match(key,/^[a-f0-9-]{36}\.png$/);
    });
    await t.test('EN/NE public settings, all assets, donation, contact, social and SEO propagate',async()=>{
      const row=await settings.read();
      for(const [path,title,description,footer,donation] of [['/','QA Site Title','QA description','Footer EN &lt;script&gt;','Donation EN'],['/ne','परीक्षण शीर्षक','परीक्षण विवरण','फुटर विवरण','सहयोग विवरण']]) {
        const before=reads; const result=await request(path,undefined,true); assert.equal(reads-before,1); assert.equal(result.status,200);
        for(const value of [`<title>${title}</title>`,description,footer,'contact@example.test','https://facebook.com/example']) assert.ok(result.html.includes(value),value);
        for(const key of ['primary_logo','footer_logo','favicon','sharing_image']) assert.ok(result.html.includes('/media/'+row[key].storage_key),key);
        assert.ok(!result.html.includes('00001234'));
        const donate=await request(path==='/'?'/donate':'/ne/donate',undefined,true);
        for (const value of [donation,'00001234','Instructions EN','QA bank','/media/'+row.donation_qr.storage_key]) assert.ok(donate.html.includes(value),value);
        assert.ok(!result.html.includes('<script>alert(1)</script>')); assert.match(result.html,/aria-current="page"/);
        assert.ok(result.html.includes(`content="${config.publicOrigin}/media/${row.sharing_image.storage_key}"`));
      }
      const image=await fetch(base+'/media/'+row.primary_logo.storage_key); assert.equal(image.status,200); assert.equal(image.headers.get('content-type'),'image/png');
      assert.equal((await fetch(base+'/storage/uploads/'+row.primary_logo.storage_key)).status,404);
      assert.equal((await fetch(base+'/media/not-valid.png')).status,404);
    });
    await t.test('stale saves do not overwrite settings or leave uploaded files',async()=>{
      const before=await readdir(directory);
      assert.equal((await save({name_en:'stale'},{primary_logo:{data:png}},{revision:'0'})).status,409);
      assert.deepEqual(await readdir(directory),before); assert.equal((await settings.read()).name_en,fields.name_en); await page();
    });
    await t.test('replacement and clearing remove obsolete assets and update public output',async()=>{
      const old=(await settings.read()).primary_logo.storage_key;
      assert.equal((await save({...fields,name_en:'Updated name'}, {primary_logo:{data:png}})).status,303); await page();
      assert.equal((await fetch(base+'/media/'+old)).status,404); assert.equal((await readdir(directory)).includes(old),false);
      assert.equal((await save({name_en:'Updated name',footer_description_en:'Updated footer',clear_primary_logo:'1',clear_footer_logo:'1',clear_favicon:'1',clear_donation_qr:'1',clear_sharing_image:'1'})).status,303);
      await page(); assert.equal(await db.mediaAsset.count(),0); assert.deepEqual(await readdir(directory),[]);
      const result=await request('/ne',undefined,true); assert.match(result.html,/Updated name/); assert.match(result.html,/Updated footer/); assert.ok(!result.html.includes('wa.me')); assert.ok(!result.html.includes('facebook.com')); assert.ok(!result.html.includes('donation-summary'));
    });
    await t.test('logout removes permission to save',async()=>{
      assert.equal((await request('/admin/logout',new URLSearchParams({_csrf:token}))).status,303);
      assert.equal((await save({name_en:'Unauthorized'})).status,303); assert.equal((await settings.read()).name_en,'Updated name');
    });
  } finally {
    await new Promise(resolve=>server.close(resolve)); await db.organizationSettings.deleteMany(); await db.mediaAsset.deleteMany(); await db.adminUser.delete({where:{id:admin.id}}); await db.$disconnect();
    assert.ok(directory.startsWith(join(tmpdir(),'nahuda-settings-'))); await rm(directory,{recursive:true,force:true});
  }
});
