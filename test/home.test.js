import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {homeExcerpt} from '../src/config/home.js';

test('Home excerpts preserve words, Devanagari graphemes and short content',()=> {
  assert.equal(homeExcerpt(' Exact value '),'Exact value');
  assert.equal(homeExcerpt('A clear introduction for everyone',15),'A clear…');
  const text='नेपालीसमुदायकोपरिचय'.repeat(20),result=homeExcerpt(text,30,'ne');
  assert.ok([...result].length<=31);
  const boundaries=[...new Intl.Segmenter('ne',{granularity:'grapheme'}).segment(text)].map(s=>s.index);
  assert.ok(boundaries.includes(result.length-1));
});

function motionHarness(reduced=false,supported=true) {
  const sections=[{animate(){const animation={finished:new Promise(()=>{}),cancel(){this.cancelled=true;},finish(){this.finishedNow=true;}};animations.push(animation);return animation;}}];
  const animations=[],observed=[],unobserved=[],events={};let callback,disconnected=false;
  const motion={matches:reduced,addEventListener(type,fn){events.change=fn;}};
  const root={querySelectorAll:selector=>selector==='.home-category-details'?[]:sections,addEventListener(type,fn){events[type]=fn;}};
  const window={matchMedia:()=>motion};
  class Observer {constructor(fn){callback=fn;}observe(node){observed.push(node);}unobserve(node){unobserved.push(node);}disconnect(){disconnected=true;}}
  if(supported) window.IntersectionObserver=Observer;
  runInNewContext(readFileSync(new URL('../public/assets/js/home.js',import.meta.url),'utf8'),{document:{querySelector:()=>root},window,IntersectionObserver:Observer});
  return {sections,animations,observed,unobserved,events,motion,enter:()=>callback([{isIntersecting:true,target:sections[0]}]),disconnected:()=>disconnected};
}
test('Home reveals once; reduced motion, preference changes and focus override animation',()=> {
  const normal=motionHarness();assert.equal(normal.observed.length,1);normal.enter();assert.equal(normal.unobserved.length,1);assert.equal(normal.animations.length,1);
  normal.events.focusin();assert.equal(normal.animations[0].finishedNow,true);
  normal.motion.matches=true;normal.events.change();assert.ok(normal.disconnected());assert.equal(normal.animations[0].cancelled,true);
  const reduced=motionHarness(true);assert.equal(reduced.observed.length,0);
  assert.equal(motionHarness(false,false).observed.length,0);
});
