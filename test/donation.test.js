import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReceipt,receiptCookie,currencies} from '../src/config/donation.js';
import {PrismaSessionStore} from '../src/services/session-store.js';

const valid={full_name:'A donor',email:'DONOR@example.test',donation_date:'2024-02-29',donation_amount:'100.25',currency:'NPR'};
test('receipt validation accepts chosen currencies, exact decimals and optional international phone',()=>{
  for(const currency of currencies) {
    const result=validateReceipt({...valid,currency,phone:'+977 (1) 123-4567'},'2026-10-01');
    assert.deepEqual(result.errors,[]); assert.equal(result.data.currency,currency);assert.equal(result.data.donation_amount,'100.25');assert.equal(result.data.email,'donor@example.test');
  }
});
test('receipt validation rejects malformed dates, amounts, repeated fields and excessive inputs',()=>{
  for(const [key,value] of [['email','bad'],['donation_date','2023-02-29'],['donation_date','2027-01-01'],['donation_date','1899-12-31'],['donation_amount','0'],['donation_amount','-1'],['donation_amount','1e3'],['donation_amount','1.123'],['donation_amount','1000000000'],['currency','XXX'],['full_name',['one','two']],['full_name','a'.repeat(101)],['message','a'.repeat(2001)],['phone','invalid']]) assert.ok(validateReceipt({...valid,[key]:value},'2026-10-01').errors.includes(key),key+':'+value);
  assert.equal(validateReceipt({},'2026-10-01').errors.length,5);
});
test('donor cookies are secure in production and store namespace cannot collide with Admin',()=>{
  assert.deepEqual(receiptCookie({nodeEnv:'production'}),{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:1800000});
  assert.equal(receiptCookie({nodeEnv:'test'}).secure,false);
  const admin=new PrismaSessionStore({},1800000),donor=new PrismaSessionStore({},1800000,'donation');
  assert.notEqual(admin.key('same signed session'),donor.key('same signed session'));
});
