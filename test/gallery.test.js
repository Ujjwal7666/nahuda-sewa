import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

// Exercise actual event handlers without relying on a browser automation dependency.
function lightbox(count) {
  let document;
  const element=()=>({hidden:false,style:{},dataset:{},attrs:{},events:{},classList:{add(){},remove(){}},addEventListener(name,fn){this.events[name]=fn;},setAttribute(key,value){this.attrs[key]=value;},getAttribute(key){return this.attrs[key]??null;},scrollIntoView(){},focus(){document.activeElement=this;}});
  const nodes=Object.fromEntries(['image','fallback','caption','credit','counter','prev','next','close'].map(key=>[key,element()]));
  const thumbs=Array.from({length:count},element),stage=element(),dialog=element();
  dialog.querySelector=selector=>selector==='.gallery-lightbox-stage'?stage:nodes[selector.replace('[data-lightbox-','').replace(']','')];
  dialog.querySelectorAll=selector=>selector==='[data-lightbox-thumb]'?thumbs:[nodes.close,nodes.prev,nodes.next,...thumbs].filter(node=>!node.hidden);
  dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;dialog.events.close();};
  const links=Array.from({length:count},(_,index)=>{const link=element();link.href='/media/'+index+'.png';link.dataset={caption:index?'':'Caption',credit:index?'':'Credit'};link.querySelector=()=>({alt:'Photo '+index});return link;});
  const body=element();
  document={body,documentElement:{clientWidth:1000},activeElement:null,querySelector:()=>dialog,querySelectorAll:selector=>selector==='[data-gallery-photo]'?links:[]};
  const window={scrollY:100,innerWidth:1015,scrollTo(x,y){this.restoredScroll=y;},matchMedia:()=>({matches:false}),setTimeout:fn=>fn()};
  runInNewContext(readFileSync(new URL('../public/assets/js/gallery.js',import.meta.url),'utf8'),{document,window,Image:class {},getComputedStyle:()=>({paddingRight:'0'})});
  const click=index=>links[index].events.click({preventDefault(){}});
  const key=(key,shiftKey=false)=>dialog.events.keydown({key,shiftKey,preventDefault(){}});
  return {nodes,thumbs,stage,dialog,links,document,window,click,key};
}
test('Lightbox navigation, empty metadata, focus cycle, swipe, failure and scroll restoration',()=> {
  const box=lightbox(50);box.click(0);assert.equal(box.dialog.open,true);assert.equal(box.nodes.counter.textContent,'1 / 50');assert.equal(box.document.activeElement,box.nodes.close);assert.equal(box.document.body.style.position,'fixed');
  box.key('ArrowLeft');assert.equal(box.nodes.counter.textContent,'50 / 50');assert.equal(box.nodes.caption.hidden,true);assert.equal(box.nodes.credit.hidden,true);
  box.key('ArrowRight');assert.equal(box.nodes.caption.textContent,'Caption');
  box.key('Tab',true);assert.equal(box.document.activeElement,box.thumbs[49]);box.key('Tab');assert.equal(box.document.activeElement,box.nodes.close);
  box.thumbs[6].events.click();assert.equal(box.nodes.counter.textContent,'7 / 50');assert.equal(box.thumbs[6].attrs['aria-pressed'],'true');
  box.stage.events.touchstart({touches:[{clientX:200,clientY:100}]});box.stage.events.touchend({changedTouches:[{clientX:100,clientY:110}]});assert.equal(box.nodes.counter.textContent,'8 / 50');
  box.nodes.image.events.error();assert.equal(box.nodes.image.hidden,true);assert.equal(box.nodes.fallback.hidden,false);
  box.key('Escape');assert.equal(box.dialog.open,false);assert.equal(box.document.body.attrs.style,'');assert.equal(box.window.restoredScroll,100);assert.equal(box.document.activeElement,box.links[0]);
});
test('A single-photo lightbox hides arrows, and modified clicks retain the full-image link',()=> {
  const box=lightbox(1);assert.equal(box.nodes.prev.hidden,true);assert.equal(box.nodes.next.hidden,true);
  box.links[0].events.click({ctrlKey:true,preventDefault(){throw Error('Modified click intercepted');}});assert.ok(!box.dialog.open);
  box.click(0);box.key('ArrowRight');assert.equal(box.nodes.counter.textContent,'1 / 1');box.nodes.close.events.click();assert.equal(box.dialog.open,false);
});
