// Progressive enhancement: the underlying textarea remains the no-JS editor.
const sources=[...document.querySelectorAll('[data-activity-editor]')];
const editors=[];
for(const source of sources) {
  const wrapper=document.createElement('div');wrapper.className='activity-editor';
  const toolbar=document.createElement('div');toolbar.className='activity-editor-toolbar';toolbar.setAttribute('role','group');toolbar.setAttribute('aria-label','Article formatting');
  const editor=document.createElement('div');editor.className='activity-editor-body';editor.contentEditable='true';editor.id=source.id+'-visual';editor.lang=source.lang;
  editor.setAttribute('role','textbox');editor.setAttribute('aria-multiline','true');editor.setAttribute('aria-label',source.closest('.settings-field').querySelector('label')?.textContent||source.name);
  editor.setAttribute('aria-describedby',source.getAttribute('aria-describedby'));editor.setAttribute('spellcheck','true');
  if(source.getAttribute('aria-invalid')) editor.setAttribute('aria-invalid','true');
  // HTML sources were sanitized by the server before being placed in the textarea.
  if(source.dataset.format==='HTML') editor.innerHTML=source.value;
  else if(source.dataset.headingFirst==='true' && source.value) {
    source.value.split(/\r?\n/).forEach((line,index)=>{const block=document.createElement(index===0?'h2':'p');if(line)block.textContent=line;else block.append(document.createElement('br'));editor.append(block);});
  }
  else source.value.split(/\r?\n/).forEach((line,index)=>{if(index)editor.append(document.createElement('br'));editor.append(document.createTextNode(line));});
  const initial=editor.innerHTML;
  let savedRange=null;
  const rememberSelection=()=>{const selection=window.getSelection();if(selection.rangeCount && editor.contains(selection.anchorNode) && editor.contains(selection.focusNode)) savedRange=selection.getRangeAt(0).cloneRange();};
  document.addEventListener('selectionchange',rememberSelection);
  const command=(name,value)=>{
    const scrollTop=editor.scrollTop;
    editor.focus({preventScroll:true});
    if(savedRange && editor.contains(savedRange.commonAncestorContainer)) {const selection=window.getSelection();selection.removeAllRanges();selection.addRange(savedRange);}
    document.execCommand(name,false,value);rememberSelection();editor.scrollTop=scrollTop;update();
  };
  function update() {
    for(const button of toolbar.querySelectorAll('[data-state]')) button.setAttribute('aria-pressed',String(document.queryCommandState(button.dataset.state)));
  }
  for(const [label,name,value] of [['Paragraph','formatBlock','p'],['Heading 2','formatBlock','h2'],['Heading 3','formatBlock','h3'],['Bold','bold'],['Italic','italic'],['Bullet list','insertUnorderedList'],['Numbered list','insertOrderedList'],['Quote','formatBlock','blockquote']]) {
    const button=document.createElement('button');button.type='button';button.textContent=label;
    if(['bold','italic','insertUnorderedList','insertOrderedList'].includes(name)){button.dataset.state=name;button.setAttribute('aria-pressed','false');}
    button.addEventListener('mousedown',event=>event.preventDefault());button.addEventListener('click',()=>command(name,value));toolbar.append(button);
  }
  editor.addEventListener('paste',event=>{event.preventDefault();command('insertText',event.clipboardData.getData('text/plain'));});
  editor.addEventListener('drop',event=>event.preventDefault());
  editor.addEventListener('keyup',update);editor.addEventListener('mouseup',update);editor.addEventListener('input',update);
  wrapper.append(toolbar,editor);source.after(wrapper);source.hidden=true;
  source.closest('.settings-field').querySelector('label').htmlFor=editor.id;
  for(const link of document.querySelectorAll(`#media-errors a[href="#${source.id}"]`)) link.addEventListener('click',event=>{event.preventDefault();editor.focus();});
  editors.push({source,editor,initial});
}
sources[0]?.form.addEventListener('submit',event=>{
  // Description and additional information have independent formats. Convert only changed groups.
  const targets=new Set(editors.map(({source})=>source.dataset.formatTarget||'description_format'));
  for(const target of targets) {
    const group=editors.filter(({source})=>(source.dataset.formatTarget||'description_format')===target);
    if(!group.some(({editor,initial})=>editor.innerHTML!==initial))continue;
    if(group.some(({source,editor})=>[...editor.innerHTML].length>Number(source.maxLength) || new TextEncoder().encode(editor.innerHTML).length>Number(source.dataset.maxBytes||800000))) {
      event.preventDefault();
      let notice=document.getElementById('activity-editor-limit');
      if(!notice){notice=document.createElement('p');notice.id='activity-editor-limit';notice.className='form-alert';notice.setAttribute('role','alert');sources[0].form.prepend(notice);}
      notice.textContent='An article exceeds its character or storage limit. Please shorten it before saving.';notice.tabIndex=-1;notice.focus();return;
    }
  }
  for(const target of targets) {
    const group=editors.filter(({source})=>(source.dataset.formatTarget||'description_format')===target);
    if(!group.some(({editor,initial})=>editor.innerHTML!==initial))continue;
    for(const {source,editor} of group)source.value=editor.innerHTML;
    document.getElementById(target).value='HTML';
  }
});
