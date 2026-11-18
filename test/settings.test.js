import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import sharp from 'sharp';
import {validateSettings} from '../src/config/organization-fields.js';
import {decodeAsset, publicOrganization} from '../src/services/organization-settings.js';

test('settings reject repeated field values and unsafe URLs while allowing international phones',()=>{
  assert.ok(validateSettings({revision:'0',name_en:['one','two']}).errors.length);
  assert.ok(validateSettings({revision:'0',facebook_url:'data:text/html,test'}).errors.length);
  const result=validateSettings({revision:'0',phone:'+44 (20) 1234-5678',account_number:'00001234'});
  assert.deepEqual(result.errors,[]); assert.equal(result.values.account_number,'00001234');
});
test('shared entity uses requested translation with a fallback and omits unconfigured links',()=>{
  const row={name_en:'Organization',name_ne:'संस्था',footer_description_en:'English footer'};
  assert.equal(publicOrganization(row,'ne').name,'संस्था');
  assert.equal(publicOrganization(row,'ne').footer_description,'English footer');
  assert.deepEqual(publicOrganization(row).socials,[]);
  assert.equal(publicOrganization(row).hasDonation,false);
  assert.equal(publicOrganization(row).primary_logo,null);
});
test('images are decoded and re-encoded with bounded dimensions and QR pixels preserved',async()=>{
  const buffer=await sharp({create:{width:3000,height:10,channels:3,background:'#fff'}}).jpeg().toBuffer();
  const file={originalname:'photo.jpg',mimetype:'image/jpeg',size:buffer.length,buffer};
  const logo=await decodeAsset(file,{key:'primary_logo',label:'Primary logo'});
  assert.equal(logo.metadata.width,2400); assert.equal((await sharp(logo.data).metadata()).format,'png');
  const qr=await decodeAsset(file,{key:'donation_qr',label:'QR'}); assert.equal(qr.metadata.width,3000);
  const webp=await sharp(buffer).webp().toBuffer();
  assert.equal((await decodeAsset({originalname:'logo.webp',mimetype:'image/webp',size:webp.length,buffer:webp},{key:'favicon',label:'Favicon'})).metadata.width,256);
});
test('decoded image pixel limit rejects oversized dimensions',async()=>{
  const buffer=await sharp({create:{width:4001,height:4000,channels:3,background:'#fff'}}).png().toBuffer();
  await assert.rejects(decodeAsset({originalname:'large.png',mimetype:'image/png',size:buffer.length,buffer},{key:'primary_logo',label:'Logo'}),/16 megapixels/);
});
test('images between 2 and 10 MB are accepted and normalized',async()=>{
  const width=1200,height=1200,raw=randomBytes(width*height*3);
  const buffer=await sharp(raw,{raw:{width,height,channels:3}}).png().toBuffer();
  assert.ok(buffer.length>2*1024*1024 && buffer.length<=10*1024*1024);
  const result=await decodeAsset({originalname:'high-resolution.png',mimetype:'image/png',size:buffer.length,buffer},{key:'primary_logo',label:'Primary logo'});
  assert.equal(result.metadata.width,1200);
  assert.equal(result.metadata.height,1200);
  assert.equal((await sharp(result.data).metadata()).format,'png');
});
