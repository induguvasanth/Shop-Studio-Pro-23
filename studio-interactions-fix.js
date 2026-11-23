/* Shop Studio 23 — single, accessible crop layer and document previews.
   Preserves the Smart Card editor. No extra external dependencies. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const cropDefs=[
  {section:'scanner',canvas:'scanCanvas',start:'scanCropBtn',apply:'applyScanCrop',cancel:null,name:'document'},
  {section:'photo',canvas:'photoCanvas',start:'photoCropBtn',apply:'applyPhotoCrop',cancel:null,name:'passport'},
  {section:'resize',canvas:'resizeCanvas',start:'resizeCropNew',apply:'resizeApplyCropNew',cancel:'resizeCancelCropNew',name:'photo/signature'}
];
function status(el,text){
 let note=el.querySelector('.studio-crop-status');if(!note){note=document.createElement('div');note.className='studio-crop-status';note.setAttribute('role','status');el.append(note);}note.textContent=text;
}
function editor(def){
 const section=$(def.section),canvas=$(def.canvas);if(!section||!canvas)return;
 const stage=canvas.parentElement;stage.style.position='relative';
 const layer=document.createElement('div');layer.className='studio-selection-box';layer.hidden=true;
 for(const corner of ['nw','n','ne','e','se','s','sw','w']){const handle=document.createElement('span');handle.className='studio-crop-handle handle-'+corner;handle.dataset.handle=corner;layer.append(handle);}
 stage.append(layer);
 let active=false,rect={x:.12,y:.1,w:.76,h:.8},drag=null;
 const legacy=def.section==='scanner'?$('scanCropLayer'):def.section==='photo'?$('photoCropBox'):null;
 function toggleLegacy(enabled){if(legacy){if(enabled){legacy.dataset.studioCropPreviousDisplay=legacy.style.display;legacy.style.display='none';}else{legacy.style.display=legacy.dataset.studioCropPreviousDisplay||'';}}}
 function getCanvas(){const cr=canvas.getBoundingClientRect(),pr=stage.getBoundingClientRect();return {x:cr.left-pr.left,y:cr.top-pr.top,w:cr.width,h:cr.height};}
 function paint(){const c=getCanvas();layer.style.left=(c.x+rect.x*c.w)+'px';layer.style.top=(c.y+rect.y*c.h)+'px';layer.style.width=(rect.w*c.w)+'px';layer.style.height=(rect.h*c.h)+'px';layer.hidden=!active;}
 function stop(){active=false;layer.hidden=true;toggleLegacy(false);status(section,'');}
 function begin(){
  if(!canvas.width||!canvas.height){status(section,'Upload an image first.');return;}
  active=true;toggleLegacy(true);rect={x:.12,y:.1,w:.76,h:.8};paint();status(section,'Drag inside the crop box to move it; drag a handle to resize, then Apply Crop.');
 }
 layer.addEventListener('pointerdown',e=>{if(!active)return;e.preventDefault();e.stopPropagation();const c=getCanvas();drag={x:e.clientX,y:e.clientY,rect:{...rect},mode:e.target.dataset.handle||'move',cw:c.w||1,ch:c.h||1};layer.setPointerCapture(e.pointerId);});
 layer.addEventListener('pointermove',e=>{if(!drag)return;e.preventDefault();const dx=(e.clientX-drag.x)/drag.cw,dy=(e.clientY-drag.y)/drag.ch,r=drag.rect;let x=r.x,y=r.y,w=r.w,h=r.h;const m=drag.mode;
 if(m==='move'){x=clamp(r.x+dx,0,1-r.w);y=clamp(r.y+dy,0,1-r.h);}
 else {const l=clamp(r.x+(m.includes('w')?dx:0),0,r.x+r.w-.04),t=clamp(r.y+(m.includes('n')?dy:0),0,r.y+r.h-.04),right=clamp(r.x+r.w+(m.includes('e')?dx:0),l+.04,1),bottom=clamp(r.y+r.h+(m.includes('s')?dy:0),t+.04,1);x=l;y=t;w=right-l;h=bottom-t;}
 rect={x,y,w,h};paint();});
 layer.addEventListener('pointerup',()=>{drag=null;});layer.addEventListener('pointercancel',()=>{drag=null;});
 function makeImage(c){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=c.toDataURL('image/png');});}
 async function apply(){if(!active){begin();return;}if(!canvas.width||!canvas.height)return;
 const out=document.createElement('canvas');out.width=Math.max(1,Math.round(canvas.width*rect.w));out.height=Math.max(1,Math.round(canvas.height*rect.h));out.getContext('2d').drawImage(canvas,rect.x*canvas.width,rect.y*canvas.height,rect.w*canvas.width,rect.h*canvas.height,0,0,out.width,out.height);
 try{const img=await makeImage(out);
  if(def.section==='scanner'){
   state.scanImg=img;
   const idx=Number(state.scanCurrentIndex)||0;
   if(state.scanPages&&state.scanPages[idx]){state.scanPages[idx].img=img;state.scanPages[idx].edited=null;}
   const rotate=$('scanRotate');if(rotate)rotate.value='0';const filter=$('scanFilter');if(filter)filter.value='original';
   if(typeof drawScan==='function')drawScan();else canvas.getContext('2d').drawImage(img,0,0);
   window.dispatchEvent(new CustomEvent('shopstudio:scan-cropped',{detail:{index:idx}}));
  } else if(def.section==='photo'){
   state.photoImg=img;state.photoOriginal=img;
   if(typeof drawPhoto==='function')drawPhoto();else {canvas.width=out.width;canvas.height=out.height;canvas.getContext('2d').drawImage(img,0,0);}
  } else {
   state.resizeImg=img;state.v11ResizeOriginal=img;
   if(typeof drawResizePreview==='function')drawResizePreview();else{canvas.width=out.width;canvas.height=out.height;canvas.getContext('2d').drawImage(img,0,0);}
  }
  stop();status(section,'Crop applied successfully.');
 }catch(err){console.error('Crop failed',err);status(section,'Crop failed: '+(err.message||String(err)));}}
 // Capture-phase click handling prevents legacy competing onclick listeners.
 const first=$(def.start),applyBtn=$(def.apply);if(first)first.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();begin();},true);
 if(applyBtn)applyBtn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();void apply();},true);
 if(def.cancel&&$(def.cancel))$(def.cancel).addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();stop();},true);
 const inputId={scanner:'scanInput',photo:'photoInput',resize:'resizeInput'}[def.section];
 // Reset selection when a new image arrives, without interrupting existing import logic.
 $(inputId)?.addEventListener('change',()=>stop(),true);
 const observer=new ResizeObserver(()=>{if(active)paint();});observer.observe(canvas);observer.observe(stage);
}
async function pdfCover(file){
 if(file.type.startsWith('image/')||/\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name)){
   const url=URL.createObjectURL(file);try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});const c=document.createElement('canvas');const scale=Math.min(1,220/Math.max(img.width,img.height));c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.8);}finally{URL.revokeObjectURL(url);}
 }
 if(!window.pdfjsLib)return null;
 const data=new Uint8Array(await file.arrayBuffer()),doc=await pdfjsLib.getDocument({data}).promise;
 try{const page=await doc.getPage(1),vp=page.getViewport({scale:1}),scale=Math.min(1,200/Math.max(vp.width,vp.height)),viewport=page.getViewport({scale});const c=document.createElement('canvas');c.width=Math.ceil(viewport.width);c.height=Math.ceil(viewport.height);await page.render({canvasContext:c.getContext('2d'),viewport}).promise;return c.toDataURL('image/jpeg',.75);}finally{await doc.destroy();}
}
function pdfPreviews(){
 const ids=['mergePdfInput','imagesPdfInput','splitPdfInput','rotatePdfInput','pdfToImageInput','reorderPdfInput','imposePdfInput','pdfEditInput','pdfEditImage'];
 for(const id of ids){const input=$(id);if(!input)continue;
  const target=input.closest('.utility-card, .pdf-imposition-panel, .pdf-editor-panel')||input.parentElement;
  let place=target.querySelector('[data-preview-for="'+id+'"]');if(!place){place=document.createElement('div');place.className='studio-file-previews';place.dataset.previewFor=id;target.append(place);}
  let serial=0;
  input.addEventListener('change',async()=>{
    const gen=++serial,files=[...(input.files||[])];place.replaceChildren();
    for(const file of files){if(gen!==serial)return;const box=document.createElement('div');box.className='studio-file-preview';
     const thumb=document.createElement('div');thumb.className='studio-file-thumbnail';thumb.textContent='Loading…';
     const name=document.createElement('span');name.className='studio-file-name';name.textContent=file.name;
     box.append(thumb,name);place.append(box);
     try{const src=await pdfCover(file);if(gen!==serial)return;thumb.textContent='';if(src){const image=document.createElement('img');image.src=src;image.alt='First page preview of '+file.name;thumb.append(image);}else{thumb.textContent='PDF preview unavailable';}}
     catch(err){console.warn('Preview failed',file.name,err);thumb.textContent='Preview unavailable';}
    }
  });
 }
}
function qrOwnerRestored(){
 const frame=$('qrOwnerFrame');if(frame){frame.src=new URL('Owner.html',location.href).href;frame.title='Owner print orders';}
 const input=$('qrScriptUrl');const key='shopstudio_qr_script_url';if(input)input.value=localStorage.getItem(key)||window.SHOPSTUDIO_CONFIG?.appsScriptUrl||'';
 $('qrSaveUrl')?.addEventListener('click',e=>{e.stopImmediatePropagation();const value=(input?.value||'').trim();if(!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(value)){alert('Enter a valid Apps Script /exec URL');return;}localStorage.setItem(key,value);alert('URL saved for this browser.');},true);
 $('qrOpenOwner')?.addEventListener('click',e=>{e.stopImmediatePropagation();window.open(new URL('Owner.html',location.href).href,'_blank','noopener');},true);
 $('qrOpenCustomer')?.addEventListener('click',e=>{e.stopImmediatePropagation();window.open(new URL('Customer.html',location.href).href,'_blank','noopener');},true);
}
function init(){cropDefs.forEach(editor);pdfPreviews();qrOwnerRestored();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
