import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { validateContact } from '../src/config/contact.js';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config/env.js';

const valid={name:'नाम <script>',email:'Visitor@Example.test',phone:'+977 (01) 123-4567',subject:'विषय',message:' पहिलो पङ्क्ति\n<script>alert(1)</script>\n अन्तिम पङ्क्ति '};
test('Contact validates bounded scalars while preserving original bilingual text',()=>{
  const result=validateContact(valid);assert.deepEqual(result.errors,{});assert.deepEqual(result.data,valid);
  assert.equal(validateContact({...valid,phone:''}).data.phone,null);
  for(const key of ['name','email','subject','message']) assert.ok(validateContact({...valid,[key]:'   '}).errors[key]);
  for(const [key,value] of [['name',['duplicate']],['email','bad'],['phone','call me'],['subject','x'.repeat(201)],['message','x'.repeat(5001)],['message','bad\u0000text'],['name','line\nline'],['phone','123']]) assert.ok(validateContact({...valid,[key]:value}).errors[key],key);
  assert.equal(validateContact({...valid,name:'😀'.repeat(100)}).errors.name,undefined);
  const result2=validateContact({...valid,status:'READ',submitted_at:'2000-01-01',id:'99'});
  assert.deepEqual(result2.data,valid);
});
test('Contact pages and Home feedback CTA work in both languages without submission configuration',async()=>{
  const app=createApp(readConfig({NODE_ENV:'test'})),server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    for(const prefix of ['','/ne']) {
      const response=await fetch(base+prefix+'/contact'),html=await response.text();
      assert.equal(response.status,200);assert.match(html,/id="feedback"/);assert.equal(response.headers.get('set-cookie'),null);
      assert.equal(response.headers.get('cache-control'),'no-store');assert.ok(html.includes(prefix?contactNepali:'Contact Us'));
      assert.ok(html.includes(`href="${prefix}/contact" aria-current="page"`));assert.match(html,/rel="canonical"/);
      const home=await (await fetch(base+(prefix||'/'))).text();assert.ok(home.includes(`href="${prefix}/contact#feedback"`));assert.ok(!home.includes('name="message"'));
      assert.equal((await fetch(base+prefix+'/contact',{method:'POST',body:new URLSearchParams(valid)})).status,503);
    }
    assert.equal((await fetch(base+'/feedback')).status,404);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
const contactNepali='सम्पर्क गर्नुहोस्';
