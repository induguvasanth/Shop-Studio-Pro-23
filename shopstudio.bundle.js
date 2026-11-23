/* Shop Studio 23, ordered consolidated bundle. Keep source order to preserve event precedence. */

;
/* BEGIN app-v11.5.0.js */
const $ = (id)=>document.getElementById(id);
const qsa = (sel)=>[...document.querySelectorAll(sel)];

const state = {
  scanImg:null, scanPages:[], scanCurrentIndex:0, photoImg:null, photoOriginal:null,
  resizeImg:null, compressFile:null, printImages:[], ocrFile:null,
  scanCropMode:false, scanCropPts:null, photoCrop:null,
  cardFront:null, cardBack:null,
  cardPdf:null, cardPdfPage:1, cardSourceImg:null,
  cardSourceScale:1, cardSourceType:null,
  cardFrontCrop:null, cardBackCrop:null,
  detectedCards:[], bulkPhotos:[], cardPerspectivePts:null, cardPerspectiveMode:false
};

function addHistory(type, name, detail=""){
  const items = JSON.parse(localStorage.getItem("shopstudio_history")||"[]");
  items.unshift({type,name,detail,time:new Date().toLocaleString()});
  localStorage.setItem("shopstudio_history", JSON.stringify(items.slice(0,30)));
  renderHistory();
}
function renderHistory(){
  const wrap=$("historyList"); if(!wrap) return;
  const items=JSON.parse(localStorage.getItem("shopstudio_history")||"[]");
  wrap.innerHTML=items.length?items.map(x=>`<div class="history-item"><div><strong>${escapeHtml(x.name)}</strong><div><small>${escapeHtml(x.type)}${x.detail?` • ${escapeHtml(x.detail)}`:""}</small></div></div><small>${escapeHtml(x.time)}</small></div>`).join(""):`<div class="notice">No recent jobs on this PC.</div>`;
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

function showSection(id){
  qsa(".section").forEach(s=>s.classList.toggle("active",s.id===id));
  qsa(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.section===id));
  const label = qsa(`.nav-item[data-section="${id}"]`)[0]?.textContent || "Scan Document";
  $("pageTitle").textContent=label;
  window.scrollTo({top:0,behavior:"smooth"});
}
qsa("[data-section]").forEach(b=>b.addEventListener("click",()=>showSection(b.dataset.section)));
qsa("[data-section-jump]").forEach(b=>b.addEventListener("click",()=>showSection(b.dataset.sectionJump)));

async function fileToImage(file){
  return await new Promise((res,rej)=>{
    const img=new Image();
    const url=URL.createObjectURL(file);
    img.onload=()=>{ URL.revokeObjectURL(url); res(img); };
    img.onerror=(e)=>{ URL.revokeObjectURL(url); rej(e); };
    img.src=url;
  });
}
function shopAutoFilename(filename){
  const raw=String(filename||"export"),parts=raw.split("."),ext=(parts.length>1?parts.pop():"png").toLowerCase();
  const base=(parts.join(".")||"export").toLowerCase();
  const section=base.includes("passport")?"passport":base.includes("print")?"print":base.includes("scan")?"scan":base.includes("card")?"card":base.includes("compress")?"compress":base.includes("pdf")?"pdf":base.includes("ocr")?"ocr":"shop";
  const d=new Date(),dd=String(d.getDate()).padStart(2,"0"),mm=String(d.getMonth()+1).padStart(2,"0"),yy=String(d.getFullYear()).slice(-2),hh=String(d.getHours()).padStart(2,"0"),mi=String(d.getMinutes()).padStart(2,"0");
  return `${section}-${dd}${mm}${yy}-${hh}${mi}.${ext}`;
}
window.shopAutoFilename=shopAutoFilename;
function downloadDataURL(dataUrl, filename){
  const a=document.createElement("a"); a.href=dataUrl; a.download=shopAutoFilename(filename); a.click();
}
function canvasToBlob(canvas,type="image/jpeg",quality=.92){
  return new Promise(r=>canvas.toBlob(r,type,quality));
}
function mmToPx(mm,dpi){return Math.round(mm/25.4*dpi)}
function unitToPx(v,unit,dpi){
  v=Number(v); dpi=Number(dpi)||300;
  if(unit==="px") return Math.max(1,Math.round(v));
  if(unit==="mm") return mmToPx(v,dpi);
  if(unit==="cm") return mmToPx(v*10,dpi);
  if(unit==="in") return Math.round(v*dpi);
  return Math.round(v);
}
function fitContain(ctx,img,x,y,w,h){
  const s=Math.min(w/img.width,h/img.height); const dw=img.width*s, dh=img.height*s;
  ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
}
function fitCover(ctx,img,x,y,w,h){
  const s=Math.max(w/img.width,h/img.height); const sw=w/s, sh=h/s;
  const sx=(img.width-sw)/2, sy=(img.height-sh)/2;
  ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h);
}



function applyPreviewZoom(canvasId, sliderId, labelId, rerender){
  const canvas=$(canvasId), slider=$(sliderId), label=$(labelId);
  if(!canvas || !slider) return;
  const z=(Number(slider.value)||100)/100;
  canvas.style.transform=`scale(${z})`;
  if(label) label.textContent=`${Math.round(z*100)}%`;
  if(typeof rerender==="function") requestAnimationFrame(rerender);
}
function cropCanvasWhitespace(canvas, threshold=250, padding=10){
  const ctx=canvas.getContext("2d"), data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  let minX=canvas.width, minY=canvas.height, maxX=-1, maxY=-1;
  for(let y=0;y<canvas.height;y++){
    for(let x=0;x<canvas.width;x++){
      const i=(y*canvas.width+x)*4, a=data[i+3], avg=(data[i]+data[i+1]+data[i+2])/3;
      if(a>10 && avg<threshold){
        if(x<minX)minX=x; if(x>maxX)maxX=x;
        if(y<minY)minY=y; if(y>maxY)maxY=y;
      }
    }
  }
  if(maxX<minX || maxY<minY) return canvas;
  minX=Math.max(0,minX-padding); minY=Math.max(0,minY-padding);
  maxX=Math.min(canvas.width-1,maxX+padding); maxY=Math.min(canvas.height-1,maxY+padding);
  const out=document.createElement("canvas");
  out.width=maxX-minX+1; out.height=maxY-minY+1;
  out.getContext("2d").drawImage(canvas,minX,minY,out.width,out.height,0,0,out.width,out.height);
  return out;
}
function upscaleAndSharpen(canvas, factor=2){
  const out=document.createElement("canvas");
  out.width=Math.max(1,Math.round(canvas.width*factor));
  out.height=Math.max(1,Math.round(canvas.height*factor));
  const octx=out.getContext("2d");
  octx.imageSmoothingEnabled=true;
  octx.imageSmoothingQuality="high";
  octx.drawImage(canvas,0,0,out.width,out.height);

  const img=octx.getImageData(0,0,out.width,out.height), d=img.data;
  const copy=new Uint8ClampedArray(d);
  const w=out.width, h=out.height;
  const kernel=[0,-1,0,-1,5,-1,0,-1,0];
  for(let y=1;y<h-1;y++){
    for(let x=1;x<w-1;x++){
      for(let c=0;c<3;c++){
        let sum=0, ki=0;
        for(let ky=-1;ky<=1;ky++){
          for(let kx=-1;kx<=1;kx++){
            const idx=((y+ky)*w+(x+kx))*4+c;
            sum += copy[idx]*kernel[ki++];
          }
        }
        d[(y*w+x)*4+c] = Math.max(0,Math.min(255,sum));
      }
    }
  }
  octx.putImageData(img,0,0);
  return out;
}
function canvasToImage(canvas){
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.src=canvas.toDataURL("image/png");
  });
}
function setCropBoxFromRect(boxId, canvasId, rect){
  const box=$(boxId), c=$(canvasId).getBoundingClientRect(), host=box.parentElement.getBoundingClientRect();
  box.style.display="block"; box.style.visibility="visible";
  box.style.left=(c.left-host.left+rect.x)+"px";
  box.style.top=(c.top-host.top+rect.y)+"px";
  box.style.width=rect.w+"px"; box.style.height=rect.h+"px";
}
function getBoxRectRelative(boxId,canvasId){
  const b=$(boxId).getBoundingClientRect(),c=$(canvasId).getBoundingClientRect();
  return {x:b.left-c.left,y:b.top-c.top,w:b.width,h:b.height};
}

// SCANNER
$("scanInput").addEventListener("change",async e=>{
  const files=[...e.target.files]; if(!files.length) return;
  state.scanPages=[];
  for(const f of files){ const img=await fileToImage(f); state.scanPages.push({img,name:f.name}); }
  state.scanCurrentIndex=0; state.scanImg=state.scanPages[0].img; drawScan(); renderScanThumbs(); addHistory("Scanner","Imported pages",`${files.length} page(s)`);
});
$("cameraInput").addEventListener("change",async e=>{ const f=e.target.files[0]; if(!f)return; state.scanImg=await fileToImage(f); state.scanPages.push({img:state.scanImg,name:f.name}); state.scanCurrentIndex=state.scanPages.length-1; drawScan();renderScanThumbs();});
$("cameraScanBtn").addEventListener("click",()=> $("cameraInput").click());

function renderScanThumbs(){
  $("scanPages").innerHTML=state.scanPages.map((p,i)=>`<img class="page-thumb" data-i="${i}" src="${p.img.src}" title="${escapeHtml(p.name||("Page "+(i+1)))}">`).join("");
  qsa(".page-thumb").forEach(t=>t.onclick=()=>{state.scanCurrentIndex=+t.dataset.i;state.scanImg=state.scanPages[state.scanCurrentIndex].img; drawScan();});
}
function drawScan(){
  if(!state.scanImg) return;
  $("scanEmpty").style.display="none";
  const img=state.scanImg, rot=+$("scanRotate").value; const c=$("scanCanvas"),ctx=c.getContext("2d");
  const swap=rot===90||rot===270; c.width=swap?img.height:img.width; c.height=swap?img.width:img.height;
  ctx.save(); ctx.translate(c.width/2,c.height/2); ctx.rotate(rot*Math.PI/180);
  let filter="none"; const f=$("scanFilter").value;
  if(f==="vibrant") filter="contrast(1.12) saturate(1.25)";
  if(f==="soft") filter="brightness(1.06) contrast(.94) saturate(.92)";
  if(f==="document") filter="grayscale(.15) contrast(1.35) brightness(1.08)";
  if(f==="bw") filter="grayscale(1) contrast(1.65)";
  const sh=+$("shadowStrength").value/100;
  if(sh>0 && f!=="bw") filter += ` brightness(${1+sh*.08}) contrast(${1+sh*.08})`;
  ctx.filter=filter;
  ctx.drawImage(img,-img.width/2,-img.height/2); ctx.restore();
  const sharp=(+$("ocrSharpen").value||0)/100;
  if(sharp>0){
    sharpenCanvas(c, sharp*0.45);
  }
  if(state.scanCropMode) renderScanPerspectiveOverlay();
}
["scanFilter","scanRotate","shadowStrength","ocrSharpen"].forEach(id=>$(id).addEventListener("input",drawScan));

$("scanZoom").addEventListener("input",()=>applyPreviewZoom("scanCanvas","scanZoom","scanZoomValue",renderScanPerspectiveOverlay));

$("deskewBtn").onclick=async()=>{
  if(!state.scanImg) return alert("Upload a document first.");
  if(typeof cv==="undefined" || !cv.Mat) return alert("OpenCV is still loading. Try again in a few seconds.");
  try{
    const srcCanvas=document.createElement("canvas"); srcCanvas.width=state.scanImg.width; srcCanvas.height=state.scanImg.height;
    srcCanvas.getContext("2d").drawImage(state.scanImg,0,0);
    const src=cv.imread(srcCanvas), gray=new cv.Mat(), blur=new cv.Mat(), edge=new cv.Mat(), contours=new cv.MatVector(), hierarchy=new cv.Mat();
    cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY); cv.GaussianBlur(gray,blur,new cv.Size(5,5),0); cv.Canny(blur,edge,50,160);
    cv.findContours(edge,contours,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
    let best=null,bestScore=-Infinity; const imageArea=src.cols*src.rows;
    const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    for(let i=0;i<contours.size();i++){
      const cnt=contours.get(i), peri=cv.arcLength(cnt,true), approx=new cv.Mat(); cv.approxPolyDP(cnt,approx,0.018*peri,true);
      const area=cv.contourArea(approx), ratio=area/imageArea;
      if(approx.rows===4 && ratio>.10 && ratio<.98 && cv.isContourConvex(approx)){
        const p=[]; for(let j=0;j<4;j++){const q=approx.intPtr(j,0);p.push({x:q[0],y:q[1]});}
        const sides=[dist(p[0],p[1]),dist(p[1],p[2]),dist(p[2],p[3]),dist(p[3],p[0])];
        const rectangularity=Math.min(...sides)/Math.max(...sides);
        const score=ratio*2.5+rectangularity*1.4;
        if(score>bestScore){if(best)best.delete();best=approx;bestScore=score;}else approx.delete();
      } else approx.delete();
      cnt.delete();
    }
    if(!best){[src,gray,blur,edge,hierarchy].forEach(m=>m.delete());contours.delete();return alert("Could not detect a clear document boundary. Use Perspective Crop for manual selection.");}
    const pts=[];for(let i=0;i<4;i++){const q=best.intPtr(i,0);pts.push({x:q[0],y:q[1]});}
    const sums=pts.map(p=>p.x+p.y),diffs=pts.map(p=>p.x-p.y);
    const ordered=[pts[sums.indexOf(Math.min(...sums))],pts[diffs.indexOf(Math.max(...diffs))],pts[sums.indexOf(Math.max(...sums))],pts[diffs.indexOf(Math.min(...diffs))]];
    const srcTri=cv.matFromArray(4,1,cv.CV_32FC2,ordered.flatMap(p=>[p.x,p.y]));
    const dist2=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y); const outW=Math.max(1,Math.round(Math.max(dist2(ordered[0],ordered[1]),dist2(ordered[3],ordered[2])))); const outH=Math.max(1,Math.round(Math.max(dist2(ordered[0],ordered[3]),dist2(ordered[1],ordered[2]))));
    const dstTri=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,outW-1,0,outW-1,outH-1,0,outH-1]),M=cv.getPerspectiveTransform(srcTri,dstTri),dst=new cv.Mat();
    cv.warpPerspective(src,dst,M,new cv.Size(outW,outH),cv.INTER_CUBIC,cv.BORDER_REPLICATE,new cv.Scalar());
    const out=document.createElement("canvas");out.width=dst.cols;out.height=dst.rows;cv.imshow(out,dst);
    state.scanImg=await canvasToImage(out);state.scanCropMode=false;state.scanCropPts=null;drawScan();addHistory("Scanner","Auto document correction",`${out.width} × ${out.height}px`);
    [src,gray,blur,edge,hierarchy,best,srcTri,dstTri,M,dst].forEach(m=>m&&m.delete&&m.delete());contours.delete();
  }catch(err){console.error(err);alert("Auto correction failed. Use Perspective Crop to select the document corners manually.");}
};

function syncScanCropLayer(){
  const canvas=$("scanCanvas"),stage=$("scanCropStage"),layer=$("scanCropLayer");
  if(!canvas||!canvas.width||!layer||!stage)return;
  const cr=canvas.getBoundingClientRect(),sr=stage.getBoundingClientRect();
  layer.style.left=(cr.left-sr.left)+"px";layer.style.top=(cr.top-sr.top)+"px";layer.style.width=cr.width+"px";layer.style.height=cr.height+"px";
}
function renderScanPerspectiveOverlay(){
  const layer=$("scanCropLayer"),poly=$("scanPolygon");
  if(!layer||!state.scanCropPts||!$("scanCanvas")?.width)return;
  syncScanCropLayer();layer.style.display=state.scanCropMode?"block":"none";if(!state.scanCropMode)return;
  poly.setAttribute("points",state.scanCropPts.map(p=>`${p.x*100},${p.y*100}`).join(" "));
  qsa("#scanCropLayer .scan-point").forEach((el,i)=>{el.style.left=(state.scanCropPts[i].x*100)+"%";el.style.top=(state.scanCropPts[i].y*100)+"%";});
}
function initScanCropBox(){
  if(!$("scanCanvas").width)return alert("Upload or scan a document first.");
  state.scanCropPts=[{x:.07,y:.07},{x:.93,y:.07},{x:.93,y:.93},{x:.07,y:.93}];state.scanCropMode=true;renderScanPerspectiveOverlay();
}
$("scanManualCropBtn").onclick=initScanCropBox;
let scanPointDrag=null;
qsa("#scanCropLayer .scan-point").forEach(pt=>{
  pt.addEventListener("pointerdown",e=>{if(!state.scanCropMode)return;e.preventDefault();pt.setPointerCapture(e.pointerId);scanPointDrag={idx:+pt.dataset.point};});
  pt.addEventListener("pointermove",e=>{if(!scanPointDrag)return;const cr=$("scanCanvas").getBoundingClientRect();state.scanCropPts[scanPointDrag.idx]={x:Math.max(0,Math.min(1,(e.clientX-cr.left)/cr.width)),y:Math.max(0,Math.min(1,(e.clientY-cr.top)/cr.height))};renderScanPerspectiveOverlay();});
  pt.addEventListener("pointerup",()=>scanPointDrag=null);pt.addEventListener("pointercancel",()=>scanPointDrag=null);
});
async function perspectiveCropCanvas(sourceCanvas,pts){
  if(typeof cv==="undefined"||!cv.Mat)throw new Error("OpenCV is still loading. Please wait a moment and try again.");
  const W=sourceCanvas.width,H=sourceCanvas.height,p=pts.map(q=>({x:q.x*W,y:q.y*H})),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const outW=Math.max(1,Math.round(Math.max(dist(p[0],p[1]),dist(p[3],p[2])))),outH=Math.max(1,Math.round(Math.max(dist(p[0],p[3]),dist(p[1],p[2]))));
  const src=cv.imread(sourceCanvas),srcPts=cv.matFromArray(4,1,cv.CV_32FC2,p.flatMap(q=>[q.x,q.y])),dstPts=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,outW-1,0,outW-1,outH-1,0,outH-1]),M=cv.getPerspectiveTransform(srcPts,dstPts),dst=new cv.Mat();
  cv.warpPerspective(src,dst,M,new cv.Size(outW,outH),cv.INTER_CUBIC,cv.BORDER_REPLICATE,new cv.Scalar());
  const out=document.createElement("canvas");out.width=dst.cols;out.height=dst.rows;cv.imshow(out,dst);[src,srcPts,dstPts,M,dst].forEach(m=>m.delete());return out;
}
$("applyScanCrop").onclick=async()=>{
  if(!$("scanCanvas").width)return alert("Upload or scan a document first.");
  if(!state.scanCropMode||!state.scanCropPts)return alert("Choose Perspective Crop first.");
  try{const out=await perspectiveCropCanvas($("scanCanvas"),state.scanCropPts);state.scanImg=await canvasToImage(out);state.scanCropMode=false;state.scanCropPts=null;drawScan();addHistory("Scanner","Perspective crop applied",`${out.width} × ${out.height}px`);}
  catch(err){console.error(err);alert(err.message||"Perspective crop failed.");}
};

$("downloadScanImage").onclick=()=>{ if(!$("scanCanvas").width)return; downloadDataURL($("scanCanvas").toDataURL("image/png"),"scanned-document.png");addHistory("Scanner","Downloaded PNG");};

$("downloadOcrScan").onclick=()=>{
  if(!$("scanCanvas").width)return;
  const src=$("scanCanvas"),out=document.createElement("canvas"),ctx=out.getContext("2d");
  out.width=src.width;out.height=src.height;
  ctx.drawImage(src,0,0);
  // OCR-friendly: grayscale + contrast + sharpen
  const img=ctx.getImageData(0,0,out.width,out.height),p=img.data;
  for(let i=0;i<p.length;i+=4){
    const g=.299*p[i]+.587*p[i+1]+.114*p[i+2];
    const v=Math.max(0,Math.min(255,(g-128)*1.45+128));
    p[i]=p[i+1]=p[i+2]=v;
  }
  ctx.putImageData(img,0,0);
  sharpenCanvas(out,.55);
  downloadDataURL(out.toDataURL("image/png"),"ocr-optimized-scan.png");
  addHistory("Scanner","Downloaded OCR-optimized PNG");
};

$("addScanToPdf").onclick=async()=>{ if(!$("scanCanvas").width)return; const img=await canvasToImage($("scanCanvas")); state.scanPages.push({img,name:`Processed page ${state.scanPages.length+1}`}); state.scanCurrentIndex=state.scanPages.length-1; state.scanImg=img; renderScanThumbs(); addHistory("Scanner","Added processed page",`${state.scanPages.length} page(s)`);};
$("exportScanPdf").onclick=async()=>{
  if(!state.scanPages.length) return alert("Add at least one scanned page.");
  const pdf=await PDFLib.PDFDocument.create();
  for(let i=0;i<state.scanPages.length;i++){
    const p=state.scanPages[i], tmp=document.createElement("canvas");
    if(i===state.scanCurrentIndex && $("scanCanvas").width){tmp.width=$("scanCanvas").width;tmp.height=$("scanCanvas").height;tmp.getContext("2d").drawImage($("scanCanvas"),0,0);}
    else {tmp.width=p.img.width;tmp.height=p.img.height;tmp.getContext("2d").drawImage(p.img,0,0);}
    const bytes=await (await canvasToBlob(tmp,"image/jpeg",.9)).arrayBuffer();
    const jpg=await pdf.embedJpg(bytes); const page=pdf.addPage([jpg.width,jpg.height]); page.drawImage(jpg,{x:0,y:0,width:jpg.width,height:jpg.height});
  }
  const out=await pdf.save(); downloadBytes(out,"scanned-pages.pdf","application/pdf");addHistory("Scanner","Exported multi-page PDF",`${state.scanPages.length} pages`);
};
$("scannerBridgeBtn").onclick=async()=>{
  const btn=$("scannerBridgeBtn"), old=btn.textContent;
  btn.textContent="Finding scanners..."; btn.disabled=true;
  try{
    const r=await fetch("http://127.0.0.1:17899/scanners",{signal:AbortSignal.timeout(5000)});
    const ctype=(r.headers.get("content-type")||"").toLowerCase();
    if(!r.ok) throw new Error("Scanner bridge not responding.");
    if(!ctype.includes("application/json")){
      const txt=(await r.text()).slice(0,120);
      throw new Error(`Scanner bridge returned invalid data instead of JSON. Response preview: ${txt}`);
    }
    const data=await r.json(), scanners=data.scanners||[];
    if(!scanners.length) throw new Error("No WIA/TWAIN scanner detected. Check the scanner driver and NAPS2.");
    const choices=scanners.map((s,i)=>`${i+1}. [${String(s.driver).toUpperCase()}] ${s.name}`).join("\n");
    let pick=prompt(`Connected scanners:\n\n${choices}\n\nEnter scanner number:`,`1`);
    if(pick===null)return;
    const idx=Math.max(0,Math.min(scanners.length-1,(parseInt(pick)||1)-1)), s=scanners[idx];
    const dpi=prompt("Scan DPI (150 / 300 / 600):","300")||"300";
    const bitdepth=prompt("Color mode: color / gray / bw","color")||"color";
    const source=prompt("Source: glass / feeder / duplex","glass")||"glass";

    btn.textContent="Scanning...";
    const url=`http://127.0.0.1:17899/scan?driver=${encodeURIComponent(s.driver)}&device=${encodeURIComponent(s.name)}&dpi=${encodeURIComponent(dpi)}&bitdepth=${encodeURIComponent(bitdepth)}&source=${encodeURIComponent(source)}&deskew=true`;
    const sr=await fetch(url,{signal:AbortSignal.timeout(180000)});
    if(!sr.ok){
      const sctype=(sr.headers.get("content-type")||"").toLowerCase();
      let msg="Scan failed.";
      try{
        if(sctype.includes("application/json")) msg=(await sr.json()).error||msg;
        else msg=(await sr.text()).slice(0,180) || msg;
      }catch{}
      throw new Error(msg);
    }
    const blob=await sr.blob(), img=new Image();
    img.onload=()=>{
      state.scanImg=img; state.scanPages.push({img,name:`${s.name} scan`});
      drawScan(); renderScanThumbs(); addHistory("Scanner","Scanned from device",`${s.driver.toUpperCase()} • ${s.name}`);
      URL.revokeObjectURL(img.src);
    };
    img.src=URL.createObjectURL(blob);
  }catch(e){
    alert(`${e.message||"Scanner bridge not detected."}

Install/start the Windows Scanner Bridge from the windows-scanner-bridge folder.`);
  }finally{btn.textContent=old;btn.disabled=false;}
};

// PHOTO
$("photoInput").onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  state.photoImg=await fileToImage(f); state.photoOriginal=state.photoImg;
  drawPhoto(); initPhotoCrop(); addHistory("Photo Studio","Opened photo",f.name);
};

$("bulkPhotoInput").onchange=async e=>{
  state.bulkPhotos=[];
  for(const f of [...e.target.files]){
    try{state.bulkPhotos.push({name:f.name,img:await fileToImage(f)});}catch{}
  }
  $("photoAiStatus").textContent=state.bulkPhotos.length?`${state.bulkPhotos.length} bulk photo(s) ready.`:"No bulk photos selected.";
};

$("bulkPassportExport").onclick=()=>{
  if(!state.bulkPhotos.length)return alert("Choose Bulk Photos first.");
  state.bulkPhotos.forEach((item,i)=>{
    const c=document.createElement("canvas"),ctx=c.getContext("2d"),dpi=300;
    c.width=6*dpi;c.height=4*dpi;ctx.fillStyle="#fff";ctx.fillRect(0,0,c.width,c.height);
    // one exact 6x4 layout per person using current template
    const temp=$("printCanvas"),oldW=temp.width,oldH=temp.height;
    buildDuplicateSheet(item.img,+$("passportCopies").value,"6x4",+$("passportBorder").value);
    c.width=$("printCanvas").width;c.height=$("printCanvas").height;
    c.getContext("2d").drawImage($("printCanvas"),0,0);
    downloadDataURL(c.toDataURL("image/png"),`passport-sheet-${i+1}-${item.name.replace(/\.[^.]+$/,"")}.png`);
  });
  addHistory("Photo Studio","Bulk passport export",`${state.bulkPhotos.length} sheet(s)`);
};


function drawPhoto(){
  if(!state.photoImg)return; $("photoEmpty").style.display="none";
  const img=state.photoImg,c=$("photoCanvas"),ctx=c.getContext("2d"); c.width=img.width;c.height=img.height;
  ctx.fillStyle="#fff";ctx.fillRect(0,0,c.width,c.height);
  ctx.filter=`brightness(${$("brightness").value}%) contrast(${$("contrast").value}%)`;
  ctx.drawImage(img,0,0);
  applyPreviewZoom("photoCanvas","photoZoom","photoZoomValue",null);
}
["brightness","contrast"].forEach(id=>$(id).oninput=()=>drawPhoto());

function initPhotoCrop(){
  if(!$("photoCanvas").width)return;
  const c=$("photoCanvas").getBoundingClientRect(),ratio=$("passportRatio").value;
  let w=c.width*.65,h=c.height*.75;
  if(ratio!=="free" && $("passportCropLock").value==="locked") h=w/Number(ratio);
  if(h>c.height*.85){h=c.height*.85;w=ratio==="free"?c.width*.65:h*Number(ratio);}
  state.photoCrop={x:(c.width-w)/2,y:(c.height-h)/2,w,h};
  setCropBoxFromRect("photoCropBox","photoCanvas",state.photoCrop);
}
$("photoCropBtn").onclick=initPhotoCrop;
$("passportRatio").onchange=initPhotoCrop;

$("passportCropLock").onchange=initPhotoCrop;
$("photoZoom").addEventListener("input",()=>applyPreviewZoom("photoCanvas","photoZoom","photoZoomValue",initPhotoCrop));
function updateHeadGuide(){
  const v=+$("headGuidePercent").value||70;
  $("headGuideValue").textContent=`${v}%`;
  const oval=$("headOval");
  if(oval){
    oval.style.height=`${v}%`;
    oval.style.top=`${Math.max(8,(100-v)/2-4)}%`;
  }
}
$("headGuidePercent").addEventListener("input",updateHeadGuide);
updateHeadGuide();


let photoCropDrag=null;
$("photoCropBox").addEventListener("pointerdown",e=>{
  e.preventDefault(); $("photoCropBox").setPointerCapture(e.pointerId);
  photoCropDrag={sx:e.clientX,sy:e.clientY,start:{...state.photoCrop},handle:e.target.dataset.h||"move"};
});
$("photoCropBox").addEventListener("pointermove",e=>{
  if(!photoCropDrag)return;
  const c=$("photoCanvas").getBoundingClientRect(),dx=e.clientX-photoCropDrag.sx,dy=e.clientY-photoCropDrag.sy,s=photoCropDrag.start,h=photoCropDrag.handle;
  let n={...s};
  if(h==="move"){n.x=s.x+dx;n.y=s.y+dy;}
  else{
    if(h.includes("e"))n.w=Math.max(40,s.w+dx);
    if(h.includes("s"))n.h=Math.max(50,s.h+dy);
    if(h.includes("w")){n.x=s.x+dx;n.w=Math.max(40,s.w-dx);}
    if(h.includes("n")){n.y=s.y+dy;n.h=Math.max(50,s.h-dy);}
    const ratio=$("passportRatio").value;
    if(ratio!=="free" && $("passportCropLock").value==="locked") n.h=n.w/Number(ratio);
  }
  n.x=Math.max(0,Math.min(n.x,c.width-n.w));n.y=Math.max(0,Math.min(n.y,c.height-n.h));
  state.photoCrop=n;setCropBoxFromRect("photoCropBox","photoCanvas",n);
});
$("photoCropBox").addEventListener("pointerup",()=>photoCropDrag=null);

$("applyPhotoCrop").onclick=async()=>{
  if(!state.photoImg)return alert("Upload a photo first.");
  const c=$("photoCanvas"),r=getBoxRectRelative("photoCropBox","photoCanvas"),cr=c.getBoundingClientRect();
  if(r.w<=0||r.h<=0)return alert("Set crop area first.");
  const sx=r.x*c.width/cr.width, sy=r.y*c.height/cr.height, sw=r.w*c.width/cr.width, sh=r.h*c.height/cr.height;
  const out=document.createElement("canvas");out.width=Math.round(sw);out.height=Math.round(sh);
  out.getContext("2d").drawImage(c,sx,sy,sw,sh,0,0,out.width,out.height);
  state.photoImg=await canvasToImage(out); state.photoCrop=null; drawPhoto(); hide("photoCropBox"); $("photoAiStatus").textContent="Photo cropped successfully • crop overlay closed."; addHistory("Photo Studio","Applied crop");
};

$("whiteBgBtn").onclick=async()=>{
  if(!state.photoImg)return alert("Upload a photo first.");
  const status=$("photoAiStatus"),btn=$("whiteBgBtn"),old=btn.textContent;btn.disabled=true;btn.textContent="Removing…";status.textContent="Preparing AI background removal…";
  try{
    const source=document.createElement("canvas");source.width=state.photoImg.width;source.height=state.photoImg.height;source.getContext("2d").drawImage(state.photoImg,0,0);
    const blob=await canvasToBlob(source,"image/png",1),mod=await import(/* webpackIgnore: true */ "https://esm.sh/@imgly/background-removal@1.7.0?bundle"),removeBackground=mod.default||mod.removeBackground;if(!removeBackground)throw new Error("AI engine unavailable");
    const result=await removeBackground(blob,{model:"medium",proxyToWorker:false,publicPath:"https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/",output:{format:"image/png",quality:1},progress:(key,current,total)=>{if(total)status.textContent=`Removing background • ${Math.round(current/total*100)}%`;}});
    const cutout=await fileToImage(result),out=document.createElement("canvas");out.width=cutout.width;out.height=cutout.height;const ctx=out.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,out.width,out.height);ctx.drawImage(cutout,0,0);
    state.photoImg=await canvasToImage(out);drawPhoto();initPhotoCrop();status.textContent="Background removed • white background applied.";addHistory("Photo Studio","Background removed","AI + white background");
  }catch(err){console.error(err);status.textContent="AI removal unavailable. Original photo preserved.";alert("Background removal could not start. Check internet access and try again. Your original photo is unchanged.");}
  finally{btn.disabled=false;btn.textContent=old;}
};
function enhancePhotoCanvas(source,factor=2){
  const out=document.createElement("canvas");out.width=Math.min(6000,Math.round(source.width*factor));out.height=Math.min(6000,Math.round(source.height*factor));const ctx=out.getContext("2d");ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.filter="brightness(1.02) contrast(1.06) saturate(1.03)";ctx.drawImage(source,0,0,out.width,out.height);ctx.filter="none";return sharpenCanvas(out,.16);
}
$("enhanceBtn").onclick=async()=>{
  if(!state.photoImg)return alert("Upload a photo first.");const status=$("photoAiStatus"),btn=$("enhanceBtn"),old=btn.textContent;btn.disabled=true;btn.textContent="Enhancing…";status.textContent="Upscaling and applying natural detail enhancement…";
  try{const src=document.createElement("canvas");src.width=state.photoImg.width;src.height=state.photoImg.height;src.getContext("2d").drawImage(state.photoImg,0,0);const out=enhancePhotoCanvas(src,2);state.photoImg=await canvasToImage(out);drawPhoto();initPhotoCrop();status.textContent=`Natural enhancement complete • ${out.width} × ${out.height}px`;addHistory("Photo Studio","Enhanced photo","2× natural upscale + sharpen");}
  catch(err){console.error(err);status.textContent="Enhancement failed.";alert("Enhancement failed. The original photo is unchanged.");}
  finally{btn.disabled=false;btn.textContent=old;}
};

$("toggleGuide").onclick=()=> $("faceGuide").classList.toggle("show");
$("downloadPhoto").onclick=()=>{if(!$("photoCanvas").width)return;downloadDataURL($("photoCanvas").toDataURL("image/png"),"passport-photo.png");};

$("makePassportSheet").onclick=()=>{
  if(!state.photoImg)return alert("Upload a photo first.");
  buildDuplicateSheet(state.photoImg,+$("passportCopies").value,$("passportPaper").value,+$("passportBorder").value);
  showSection("print");addHistory("Photo Studio","Created duplicate print layout");
};

function buildDuplicateSheet(img,count,paper,borderPx=2){
  const c=$("printCanvas"),ctx=c.getContext("2d"),dpi=300;
  if(paper==="a4"){c.width=mmToPx(210,dpi);c.height=mmToPx(297,dpi);}
  else {c.width=6*dpi;c.height=4*dpi;}
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
  ctx.fillStyle="#fff";ctx.fillRect(0,0,c.width,c.height);

  const template=$("passportTemplate")?.value||"auto";
  let photoW=null,photoH=null,cols=null,rows=null;
  if(paper==="6x4" && template!=="auto"){
    if(template==="8-35x45"){photoW=mmToPx(35,dpi);photoH=mmToPx(45,dpi);cols=4;rows=2;count=8;}
    if(template==="6-35x45"){photoW=mmToPx(35,dpi);photoH=mmToPx(45,dpi);cols=3;rows=2;count=6;}
    if(template==="8-40x50"){photoW=mmToPx(40,dpi);photoH=mmToPx(50,dpi);cols=4;rows=2;count=8;}
  }

  let gap=mmToPx(2,dpi),margin=mmToPx(3,dpi);
  if(!cols){
    cols=count<=4?2:(count===6?3:(count===9?3:4)); rows=Math.ceil(count/cols);
    photoW=(c.width-margin*2-gap*(cols-1))/cols;
    photoH=(c.height-margin*2-gap*(rows-1))/rows;
  }else{
    const totalW=photoW*cols+gap*(cols-1),totalH=photoH*rows+gap*(rows-1);
    margin=Math.max(mmToPx(1.5,dpi),Math.min((c.width-totalW)/2,(c.height-totalH)/2));
  }

  const gridW=photoW*cols+gap*(cols-1),gridH=photoH*rows+gap*(rows-1);
  const startX=(c.width-gridW)/2,startY=(c.height-gridH)/2;
  const cutLines=$("passportCutLines")?.value!=="no";

  for(let i=0;i<count;i++){
    const col=i%cols,row=Math.floor(i/cols),x=startX+col*(photoW+gap),y=startY+row*(photoH+gap);
    fitCover(ctx,img,x,y,photoW,photoH);
    if(borderPx>0){ctx.save();ctx.strokeStyle="#111";ctx.lineWidth=borderPx;ctx.strokeRect(x+.5,y+.5,photoW-1,photoH-1);ctx.restore();}
    if(cutLines){
      ctx.save();ctx.strokeStyle="#888";ctx.setLineDash([5,4]);ctx.lineWidth=1;
      ctx.strokeRect(x-2,y-2,photoW+4,photoH+4);ctx.restore();
    }
  }
  $("printEmpty").style.display="none";
}

// CARD / PDF MANUAL CROP
state.cardCrop={x:80,y:80,w:320,h:200};
let cropDrag=null;



function sharpenCanvas(canvas, amount=0.35){
  if(amount<=0) return canvas;
  const ctx=canvas.getContext("2d");
  const img=ctx.getImageData(0,0,canvas.width,canvas.height);
  const src=new Uint8ClampedArray(img.data), d=img.data;
  const w=canvas.width,h=canvas.height;
  const a=Math.max(0,Math.min(1,amount));
  for(let y=1;y<h-1;y++){
    for(let x=1;x<w-1;x++){
      const p=(y*w+x)*4;
      for(let c=0;c<3;c++){
        const center=src[p+c];
        const up=src[((y-1)*w+x)*4+c],down=src[((y+1)*w+x)*4+c];
        const left=src[(y*w+x-1)*4+c],right=src[(y*w+x+1)*4+c];
        const sharp=center*(1+4*a)-(up+down+left+right)*a;
        d[p+c]=Math.max(0,Math.min(255,sharp));
      }
    }
  }
  ctx.putImageData(img,0,0);
  return canvas;
}
function normalizeRect(r,w,h){
  return {x:r.x/w,y:r.y/h,w:r.width/w,h:r.height/h};
}
function rectIoU(a,b){
  const ax2=a.x+a.w,ay2=a.y+a.h,bx2=b.x+b.w,by2=b.y+b.h;
  const ix=Math.max(0,Math.min(ax2,bx2)-Math.max(a.x,b.x));
  const iy=Math.max(0,Math.min(ay2,by2)-Math.max(a.y,b.y));
  const inter=ix*iy, union=a.w*a.h+b.w*b.h-inter;
  return union?inter/union:0;
}
function dedupeRects(rects,threshold=.45){
  const out=[];
  for(const r of rects){
    if(!out.some(o=>rectIoU(r,o)>threshold)) out.push(r);
  }
  return out;
}
function getCardRenderScale(){
  const v=parseFloat($("cardRenderQuality")?.value || "5");
  const dpi=parseFloat($("cardExportDpi")?.value || "600");
  // PDF.js uses 72 points/inch. Render PDFs close to the requested export DPI
  // so a 600-DPI PVC export is not created from a low-resolution preview.
  // Limit EDITOR rendering: 8.33x generates enormous canvases and freezes zoom.
  // Export DPI remains independent and unchanged.
  return Math.max(1.5, Math.min(3.5, v));
}
async function renderSourceToCanvas(canvas, source){
  const ctx=canvas.getContext("2d");
  canvas.width=source.width; canvas.height=source.height;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(source,0,0);
}
function getNormalizedCropRect(boxId, canvasId){
  const b=$(boxId).getBoundingClientRect(), c=$(canvasId).getBoundingClientRect();
  return {
    x:(b.left-c.left)/c.width,
    y:(b.top-c.top)/c.height,
    w:b.width/c.width,
    h:b.height/c.height
  };
}
function extractCropFromSourceCanvas(sourceCanvas, normRect){
  const sx=Math.max(0, Math.round(normRect.x*sourceCanvas.width));
  const sy=Math.max(0, Math.round(normRect.y*sourceCanvas.height));
  const sw=Math.max(1, Math.round(normRect.w*sourceCanvas.width));
  const sh=Math.max(1, Math.round(normRect.h*sourceCanvas.height));
  const out=document.createElement("canvas");
  out.width=sw; out.height=sh;
  const ctx=out.getContext("2d");
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="high";
  ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}
function drawCanvasFittedToCanvas(dstCanvas, srcCanvas, dx, dy, dw, dh){
  const ctx=dstCanvas.getContext("2d");
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="high";
  fitCover(ctx, srcCanvas, dx, dy, dw, dh);
}
function downloadCanvas(canvas, filenameBase, format, quality=0.98){
  if(format==="image/png"){
    downloadDataURL(canvas.toDataURL("image/png"), `${filenameBase}.png`);
  }else{
    downloadDataURL(canvas.toDataURL("image/jpeg", quality), `${filenameBase}.jpg`);
  }
}
function getPdfJs(){
  return window.pdfjsLib || null;
}
async function ensurePdfJs(){
  if(window.pdfjsLib) return window.pdfjsLib;
  await new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
    s.type="module";
    s.onload=resolve; s.onerror=reject; document.head.appendChild(s);
  }).catch(()=>{});
  return window.pdfjsLib;
}

async function loadPdfViaModule(file){
  const mod = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs");
  mod.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
  state.cardPdf = await mod.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  state.cardPdfPage=1;
  state.cardSourceType="pdf";
  await renderCardPdfPage();
}
async function renderCardPdfPage(){
  if(!state.cardPdf)return;
  const page=await state.cardPdf.getPage(state.cardPdfPage);
  const scale=getCardRenderScale();
  const viewport=page.getViewport({scale});
  state.cardSourceScale=scale;
  const c=$("cardSourceCanvas"),ctx=c.getContext("2d");
  c.width=Math.round(viewport.width); c.height=Math.round(viewport.height);
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="high";
  await page.render({canvasContext:ctx,viewport}).promise;
  $("cardSourceEmpty").style.display="none";
  $("cardPageLabel").textContent=`Page ${state.cardPdfPage} of ${state.cardPdf.numPages} • render ${scale}×`;
  // Smart Card v19 controls sizing through its own fitted canvas viewport.
  // Smart Card v13 initializes one editable crop overlay when the page is rendered.
}
$("cardPdfInput").onchange=async e=>{const f=e.target.files[0];if(!f)return;await loadPdfViaModule(f);addHistory("Smart Card","Opened PDF",f.name);};
$("cardImageInput").onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  const img=await fileToImage(f);
  state.cardSourceImg=img;
  state.cardSourceType="image";
  const c=$("cardSourceCanvas"),ctx=c.getContext("2d");
  c.width=img.width;c.height=img.height;
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="high";
  ctx.drawImage(img,0,0);
  $("cardSourceEmpty").style.display="none";
  $("cardPageLabel").textContent=`${f.name} • ${img.width}×${img.height}`;
  // Smart Card v19 controls sizing through its own fitted canvas viewport.
  // Smart Card v13 selects its own single crop mode after upload.
};

// --- Smart Card / PVC precision perspective engine v10.2 ---
function cardOrderPoints(points){
  const pts=points.map(p=>({x:p.x,y:p.y}));
  const sums=pts.map(p=>p.x+p.y), diffs=pts.map(p=>p.x-p.y);
  const tl=pts[sums.indexOf(Math.min(...sums))];
  const br=pts[sums.indexOf(Math.max(...sums))];
  const tr=pts[diffs.indexOf(Math.max(...diffs))];
  const bl=pts[diffs.indexOf(Math.min(...diffs))];
  return [tl,tr,br,bl];
}
function cardDistance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function cardDefaultPoints(canvas){
  const ratio=85.6/54;
  const w=canvas.width*.78;
  const h=w/ratio;
  const hh=Math.min(h,canvas.height*.78);
  const ww=hh*ratio;
  const x=(canvas.width-ww)/2,y=(canvas.height-hh)/2;
  return [{x:x/canvas.width,y:y/canvas.height},{x:(x+ww)/canvas.width,y:y/canvas.height},{x:(x+ww)/canvas.width,y:(y+hh)/canvas.height},{x:x/canvas.width,y:(y+hh)/canvas.height}];
}
function syncCardPerspectiveLayer(){
  const canvas=$("cardSourceCanvas"),stage=$("cardPerspectiveStage"),layer=$("cardPerspectiveLayer");
  if(!canvas||!stage||!layer||!canvas.width)return;
  const cr=canvas.getBoundingClientRect(),sr=stage.getBoundingClientRect();
  layer.style.left=(cr.left-sr.left)+"px";
  layer.style.top=(cr.top-sr.top)+"px";
  layer.style.width=cr.width+"px";
  layer.style.height=cr.height+"px";
}
function renderCardPerspectiveOverlay(){
  const layer=$("cardPerspectiveLayer"),poly=$("cardPerspectivePolygon"),canvas=$("cardSourceCanvas");
  if(!layer||!poly||!canvas?.width)return;
  syncCardPerspectiveLayer();
  layer.style.display=state.cardPerspectiveMode?"block":"none";
  if(!state.cardPerspectiveMode||!state.cardPerspectivePts)return;
  poly.setAttribute("points",state.cardPerspectivePts.map(p=>`${p.x*100},${p.y*100}`).join(" "));
  qsa("#cardPerspectiveLayer .card-point").forEach((el,i)=>{
    el.style.left=(state.cardPerspectivePts[i].x*100)+"%";
    el.style.top=(state.cardPerspectivePts[i].y*100)+"%";
  });
}
function enableCardPerspective(){
  const c=$("cardSourceCanvas");
  if(!c?.width)return alert("Open a PDF or image first.");
  state.cardPerspectivePts=cardDefaultPoints(c);
  state.cardPerspectiveMode=true;
  renderCardPerspectiveOverlay();
}
function setCardPerspectivePointsFromPixels(points,canvas){
  state.cardPerspectivePts=cardOrderPoints(points).map(p=>({x:p.x/canvas.width,y:p.y/canvas.height}));
  state.cardPerspectiveMode=true;
  renderCardPerspectiveOverlay();
}
function cardCandidateScore(pts,area,imageArea,canvasW,canvasH){
  const [tl,tr,br,bl]=cardOrderPoints(pts);
  const w=(cardDistance(tl,tr)+cardDistance(bl,br))/2;
  const h=(cardDistance(tl,bl)+cardDistance(tr,br))/2;
  if(!w||!h)return -Infinity;
  const ratio=Math.max(w,h)/Math.max(1,Math.min(w,h));
  const target=85.6/54;
  const ratioErr=Math.abs(ratio-target)/target;
  const sideBalance=Math.min(w,h)/Math.max(w,h);
  const areaRatio=area/imageArea;
  // A common failure is detecting a red/black text box inside an Aadhaar/PAN page.
  // A real card/document boundary normally touches or approaches the photo edge.
  const nearBorder=pts.filter(p=>p.x<canvasW*.08||p.y<canvasH*.08||p.x>canvasW*.92||p.y>canvasH*.92).length;
  const boundaryBonus=nearBorder>=2?2.8:0;
  const innerPenalty=(nearBorder<2 && areaRatio<.58)?Math.min(5.5,(.58-areaRatio)*9):0;
  const sizeBonus=Math.min(2.4,areaRatio*4.5);
  return 3.8-ratioErr*3.0+sideBalance*.9+sizeBonus+boundaryBonus-innerPenalty;
}
function detectCardByLongLines(sourceCanvas,maxResults=5){
  const maxDim=1800,scale=Math.min(1,maxDim/Math.max(sourceCanvas.width,sourceCanvas.height));
  const dc=document.createElement("canvas");dc.width=Math.max(1,Math.round(sourceCanvas.width*scale));dc.height=Math.max(1,Math.round(sourceCanvas.height*scale));
  const ctx=dc.getContext("2d");ctx.drawImage(sourceCanvas,0,0,dc.width,dc.height);
  const src=cv.imread(dc),gray=new cv.Mat(),blur=new cv.Mat(),edges=new cv.Mat();
  const lines=new cv.MatVector();
  try{
    cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);cv.GaussianBlur(gray,blur,new cv.Size(5,5),0);cv.Canny(blur,35,125,edges);
    const raw=new cv.Mat();cv.HoughLinesP(edges,raw,1,Math.PI/180,Math.max(80,Math.round(Math.min(dc.width,dc.height)*.12)),Math.max(250,Math.round(Math.max(dc.width,dc.height)*.45)),25);
    const v=[],h=[];
    for(let i=0;i<raw.rows;i++){
      const q=raw.intPtr(i,0),x1=q[0],y1=q[1],x2=q[2],y2=q[3],dx=Math.abs(x2-x1),dy=Math.abs(y2-y1);
      if(dy>dx*4){const x=(x1+x2)/2,len=dy;v.push({x,len,span:len/dc.height});}
      else if(dx>dy*4){const y=(y1+y2)/2,len=dx;h.push({y,len,span:len/dc.width});}
    }
    const cluster=(arr,key,limit)=>{
      const out=[];for(const item of arr.sort((a,b)=>b.span-a.span)){const hit=out.find(o=>Math.abs(o[key]-item[key])<limit);if(hit){hit[key]=(hit[key]*hit.n+item[key])/(hit.n+1);hit.span=Math.max(hit.span,item.span);hit.n++;}else out.push({...item,n:1});}return out.slice(0,24);
    };
    const xs=cluster(v,"x",Math.max(10,dc.width*.008)).map(x=>({...x,pos:x.x}));
    const ys=cluster(h,"y",Math.max(10,dc.height*.008)).map(y=>({...y,pos:y.y}));
    xs.push({pos:0,span:1,border:true},{pos:dc.width-1,span:1,border:true});
    ys.push({pos:0,span:1,border:true},{pos:dc.height-1,span:1,border:true});
    const target=85.6/54,cands=[];
    for(const a of xs)for(const b of xs)if(b.pos-a.pos>dc.width*.3){
      for(const c of ys)for(const d of ys)if(d.pos-c.pos>dc.height*.3){
        const w=b.pos-a.pos,h=d.pos-c.pos,r=w/h,ratio=Math.max(r,1/r),err=Math.abs(ratio-target)/target;
        if(err>.12)continue;
        const area=(w*h)/(dc.width*dc.height);
        const borders=(a.border?1:0)+(b.border?1:0)+(c.border?1:0)+(d.border?1:0);
        const boundarySpan=(a.span+b.span+c.span+d.span)/4;
        const coverageScore=Math.max(0,1-Math.abs(area-.82)/.32); const score=(1-Math.min(1,err))*6+area*2.0+coverageScore*2.5+boundarySpan*5-(borders>=4?4:0);
        cands.push({score,points:[{x:a.pos/scale,y:c.pos/scale},{x:b.pos/scale,y:c.pos/scale},{x:b.pos/scale,y:d.pos/scale},{x:a.pos/scale,y:d.pos/scale}]});
      }
    }
    cands.sort((a,b)=>b.score-a.score);
    const out=[];
    const iou=(a,b)=>{const ax=Math.min(...a.points.map(p=>p.x)),ay=Math.min(...a.points.map(p=>p.y)),aw=Math.max(...a.points.map(p=>p.x))-ax,ah=Math.max(...a.points.map(p=>p.y))-ay,bx=Math.min(...b.points.map(p=>p.x)),by=Math.min(...b.points.map(p=>p.y)),bw=Math.max(...b.points.map(p=>p.x))-bx,bh=Math.max(...b.points.map(p=>p.y))-by,ix=Math.max(0,Math.min(ax+aw,bx+bw)-Math.max(ax,bx)),iy=Math.max(0,Math.min(ay+ah,by+bh)-Math.max(ay,by)),inter=ix*iy,uni=aw*ah+bw*bh-inter;return uni?inter/uni:0};
    for(const q of cands){if(out.every(o=>iou(q,o)<.55))out.push(q);if(out.length>=maxResults)break;}
    raw.delete();return out;
  }finally{[src,gray,blur,edges].forEach(m=>m.delete());lines.delete();}
}

async function detectCardQuadrilaterals(sourceCanvas,maxResults=10){
  if(typeof cv==="undefined"||!cv.Mat)throw new Error("OpenCV is still loading. Please wait a moment.");
  const maxDim=1800,scale=Math.min(1,maxDim/Math.max(sourceCanvas.width,sourceCanvas.height));
  const dc=document.createElement("canvas");dc.width=Math.max(1,Math.round(sourceCanvas.width*scale));dc.height=Math.max(1,Math.round(sourceCanvas.height*scale));
  const dctx=dc.getContext("2d");dctx.imageSmoothingEnabled=true;dctx.imageSmoothingQuality="high";dctx.drawImage(sourceCanvas,0,0,dc.width,dc.height);
  const src=cv.imread(dc),gray=new cv.Mat(),blur=new cv.Mat(),edges=new cv.Mat(),contours=new cv.MatVector(),hierarchy=new cv.Mat();
  const candidates=[];
  try{
    cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);cv.GaussianBlur(gray,blur,new cv.Size(5,5),0);cv.Canny(blur,35,125,3,false);
    const kernel=cv.getStructuringElement(cv.MORPH_RECT,new cv.Size(3,3));cv.morphologyEx(edges,edges,cv.MORPH_CLOSE,kernel);kernel.delete();
    cv.findContours(edges,contours,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
    const imageArea=dc.width*dc.height;
    for(let i=0;i<contours.size();i++){
      const cnt=contours.get(i),peri=cv.arcLength(cnt,true),approx=new cv.Mat();cv.approxPolyDP(cnt,approx,Math.max(2,0.018*peri),true);
      if(approx.rows===4){
        const area=Math.abs(cv.contourArea(approx)),ratio=area/imageArea;
        if(ratio>.025&&ratio<.96&&cv.isContourConvex(approx)){
          const pts=[];for(let j=0;j<4;j++){const q=approx.intPtr(j,0);pts.push({x:q[0],y:q[1]});}
          const score=cardCandidateScore(pts,area,imageArea,dc.width,dc.height);
          if(Number.isFinite(score))candidates.push({points:cardOrderPoints(pts).map(p=>({x:p.x/scale,y:p.y/scale})),score});
        }
      }
      approx.delete();cnt.delete();
    }
    candidates.sort((a,b)=>b.score-a.score);
    const out=[];
    for(const cand of candidates){
      const bb=(pts)=>{const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}};
      const a=bb(cand.points);
      if(out.every(o=>{const b=bb(o.points);const ix=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x));const iy=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));const inter=ix*iy,uni=a.w*a.h+b.w*b.h-inter;return !uni||inter/uni<.55;}))out.push(cand);
      if(out.length>=maxResults)break;
    }
    return out;
  }finally{[src,gray,blur,edges,hierarchy].forEach(m=>m.delete());contours.delete();}
}
async function perspectiveCardCanvas(sourceCanvas,pts,dpi=600){
  if(typeof cv==="undefined"||!cv.Mat)throw new Error("OpenCV is still loading. Please wait a moment.");
  const ordered=cardOrderPoints(pts.map(p=>({x:p.x*sourceCanvas.width,y:p.y*sourceCanvas.height})));
  const outW=mmToPx(85.6,dpi),outH=mmToPx(54,dpi);
  const src=cv.imread(sourceCanvas),srcPts=cv.matFromArray(4,1,cv.CV_32FC2,ordered.flatMap(p=>[p.x,p.y])),dstPts=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,outW-1,0,outW-1,outH-1,0,outH-1]),M=cv.getPerspectiveTransform(srcPts,dstPts),dst=new cv.Mat();
  cv.warpPerspective(src,dst,M,new cv.Size(outW,outH),cv.INTER_LANCZOS4,cv.BORDER_REPLICATE,new cv.Scalar());
  const out=document.createElement("canvas");out.width=outW;out.height=outH;cv.imshow(out,dst);
  [src,srcPts,dstPts,M,dst].forEach(m=>m.delete());
  return out;
}
function previewCardCanvas(canvasId,crop){
  const p=$(canvasId);if(!p||!crop)return;
  const maxW=620,maxH=260,s=Math.min(maxW/crop.width,maxH/crop.height,1);
  p.width=Math.max(1,Math.round(crop.width*s));p.height=Math.max(1,Math.round(crop.height*s));
  const ctx=p.getContext("2d");ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.clearRect(0,0,p.width,p.height);ctx.drawImage(crop,0,0,p.width,p.height);
}
async function saveActiveCardPerspective(){
  if(!$('cardSourceCanvas').width)return alert("Open a PDF or image first.");
  if(!state.cardPerspectiveMode||!state.cardPerspectivePts)return alert("Choose 4-Point Perspective first.");
  const dpi=+$('cardExportDpi').value||600;
  const crop=await perspectiveCardCanvas($('cardSourceCanvas'),state.cardPerspectivePts,dpi);
  const action=$('cardCropAction').value;
  if(action==="front")state.cardFrontCrop=crop;else state.cardBackCrop=crop;
  previewCardCanvas(action==="front"?"cardFrontPreview":"cardBackPreview",crop);
  state.cardPerspectiveMode=false;renderCardPerspectiveOverlay();
  addHistory("Smart Card",`Saved ${action} • exact PVC`,`85.6×54 mm • ${dpi} DPI • ${crop.width}×${crop.height}px`);
}

$("autoDetectCardBtn").onclick=async()=>{
  const c=$("cardSourceCanvas");if(!c.width)return alert("Open a PDF page or image first.");
  const btn=$("autoDetectCardBtn"),old=btn.textContent;btn.disabled=true;btn.textContent="Detecting 4 corners…";
  try{
    let found=await detectCardQuadrilaterals(c,5);
    if(!found.length) found=detectCardByLongLines(c,5);
    if(!found.length)throw new Error("No reliable card boundary found. Use 4-Point Perspective.");
    setCardPerspectivePointsFromPixels(found[0].points,c);
    addHistory("Smart Card","Auto detected 4 corners",`${$("cardType").value} • confidence ${Math.round(Math.max(0,Math.min(1,(found[0].score+1)/5))*100)}%`);
  }catch(err){console.error(err);alert(err.message||"Card auto-detection failed.");}
  finally{btn.disabled=false;btn.textContent=old;}
};

$("manualCardPerspectiveBtn").onclick=enableCardPerspective;
$("resetCardCrop").onclick=enableCardPerspective;
// Smart Card v19 zoom input is managed by smart-card-patch.js.
window.addEventListener("resize",()=>{if(state.cardPerspectiveMode)renderCardPerspectiveOverlay();});
let cardPointDrag=null;
qsa("#cardPerspectiveLayer .card-point").forEach(pt=>{
  pt.addEventListener("pointerdown",e=>{if(!state.cardPerspectiveMode)return;e.preventDefault();pt.setPointerCapture(e.pointerId);cardPointDrag={idx:+pt.dataset.point};});
  pt.addEventListener("pointermove",e=>{if(!cardPointDrag)return;const cr=$("cardSourceCanvas").getBoundingClientRect();state.cardPerspectivePts[cardPointDrag.idx]={x:Math.max(0,Math.min(1,(e.clientX-cr.left)/cr.width)),y:Math.max(0,Math.min(1,(e.clientY-cr.top)/cr.height))};renderCardPerspectiveOverlay();});
  pt.addEventListener("pointerup",()=>cardPointDrag=null);pt.addEventListener("pointercancel",()=>cardPointDrag=null);
});

$("saveCardCrop").onclick=saveActiveCardPerspective;
qsa("#cardSideTabs button").forEach(b=>b.addEventListener("click",()=>{qsa("#cardSideTabs button").forEach(x=>x.classList.remove("active"));b.classList.add("active");$("cardCropAction").value=b.dataset.side;}));
$("cardCropAction").addEventListener("change",e=>{qsa("#cardSideTabs button").forEach(x=>x.classList.toggle("active",x.dataset.side===e.target.value));});
$("exportCardCropImage").onclick=async()=>{
  if(!$('cardSourceCanvas').width)return alert("Open a PDF or image first.");
  try{
    const dpi=+$('cardExportDpi').value||600;
    let crop;
    if(state.cardPerspectiveMode&&state.cardPerspectivePts) crop=await perspectiveCardCanvas($('cardSourceCanvas'),state.cardPerspectivePts,dpi);
    else {
      const action=$("cardCropAction").value;crop=action==="front"?state.cardFrontCrop:state.cardBackCrop;
      if(!crop)throw new Error("Set the four corners and apply the Front/Back crop first.");
    }
    const fmt=$("cardOutputFormat").value||"image/png";
    downloadCanvas(crop,`pvc-${$("cardCropAction").value}-${dpi}dpi`,fmt,1);
    addHistory("Smart Card","Exported exact PVC crop",`85.6×54 mm • ${dpi} DPI • ${crop.width}×${crop.height}px`);
  }catch(err){alert(err.message||"PVC export failed.");}
};

$("autoSplitCardsBtn").onclick=async()=>{
  const c=$("cardSourceCanvas");if(!c.width)return alert("Open a PDF page or image first.");
  const btn=$("autoSplitCardsBtn"),old=btn.textContent;btn.disabled=true;btn.textContent="Finding cards…";
  try{
    let found=await detectCardQuadrilaterals(c,10);if(found.length<1) found=detectCardByLongLines(c,10);if(!found.length)throw new Error("No reliable card boundaries found.");
    state.detectedCards=found.map(x=>({points:x.points,score:x.score}));
    const grid=$("detectedCardsGrid"),panel=$("detectedCardsPanel");grid.innerHTML="";panel.hidden=false;
    found.forEach((item,i)=>{
      const crop=perspectiveCardCanvas(c,item.points.map(p=>({x:p.x/c.width,y:p.y/c.height})),+$('cardExportDpi').value||600);
      const wrap=document.createElement("div");wrap.className="detected-card";
      const cvw=document.createElement("canvas");wrap.appendChild(cvw);previewCardCanvasTo(cvw,crop);
      const actions=document.createElement("div");actions.className="detected-card-actions";
      const front=document.createElement("button");front.className="mini-btn";front.textContent="Set Front";
      const back=document.createElement("button");back.className="mini-btn";back.textContent="Set Back";
      const exp=document.createElement("button");exp.className="mini-btn";exp.textContent="Export PVC";
      front.onclick=()=>{state.cardFrontCrop=crop;previewCardCanvas("cardFrontPreview",crop);};
      back.onclick=()=>{state.cardBackCrop=crop;previewCardCanvas("cardBackPreview",crop);};
      exp.onclick=()=>downloadCanvas(crop,`pvc-detected-${i+1}-${$('cardExportDpi').value}dpi`,$('cardOutputFormat').value||"image/png",1);
      actions.append(front,back,exp);wrap.appendChild(actions);grid.appendChild(wrap);
    });
    if(found.length>=2){state.cardFrontCrop=await perspectiveCardCanvas(c,found[0].points.map(p=>({x:p.x/c.width,y:p.y/c.height})),$('cardExportDpi').value||600);state.cardBackCrop=await perspectiveCardCanvas(c,found[1].points.map(p=>({x:p.x/c.width,y:p.y/c.height})),$('cardExportDpi').value||600);previewCardCanvas("cardFrontPreview",state.cardFrontCrop);previewCardCanvas("cardBackPreview",state.cardBackCrop);}
    addHistory("Smart Card","Auto found front/back candidates",`${found.length} quadrilateral(s)`);
  }catch(err){console.error(err);alert(err.message||"Auto split failed.");}
  finally{btn.disabled=false;btn.textContent=old;}
};
function previewCardCanvasTo(canvas,crop){const maxW=420,maxH=180,s=Math.min(maxW/crop.width,maxH/crop.height,1);canvas.width=Math.max(1,Math.round(crop.width*s));canvas.height=Math.max(1,Math.round(crop.height*s));const ctx=canvas.getContext("2d");ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.drawImage(crop,0,0,canvas.width,canvas.height);}
$("clearDetectedCards").onclick=()=>{$("detectedCardsPanel").hidden=true;$("detectedCardsGrid").innerHTML="";state.detectedCards=[];};

$("bulkExportCardsBtn").onclick=async()=>{
  if(!state.detectedCards.length)return alert("Run Find Front + Back first.");
  const dpi=+$('cardExportDpi').value||600,fmt=$('cardOutputFormat').value||"image/png";
  for(let i=0;i<state.detectedCards.length;i++){
    const crop=await perspectiveCardCanvas($('cardSourceCanvas'),state.detectedCards[i].points.map(p=>({x:p.x/$('cardSourceCanvas').width,y:p.y/$('cardSourceCanvas').height})),dpi);
    downloadCanvas(crop,`pvc-card-${i+1}-${dpi}dpi`,fmt,1);
    await new Promise(r=>setTimeout(r,60));
  }
  addHistory("Smart Card","Bulk exported exact PVC cards",`${state.detectedCards.length} card(s) • ${dpi} DPI`);
};

$("prevCardPage").onclick=async()=>{if(state.cardPdf&&state.cardPdfPage>1){state.cardPdfPage--;await renderCardPdfPage();}};
$("nextCardPage").onclick=async()=>{if(state.cardPdf&&state.cardPdfPage<state.cardPdf.numPages){state.cardPdfPage++;await renderCardPdfPage();}};

$("cardAspect").onchange=()=>{ if(state.cardPerspectiveMode) enableCardPerspective(); };

// RESIZE
$("resizeInput").onchange=async e=>{const f=e.target.files[0];if(!f)return;state.resizeImg=await fileToImage(f);drawResizePreview();};
const presets={
  passport:{w:35,h:45,u:"mm",dpi:300}, "ssc-photo":{w:3.5,h:4.5,u:"cm",dpi:300},
  "railway-photo":{w:35,h:45,u:"mm",dpi:200}, signature:{w:6,h:2,u:"cm",dpi:200}
};
$("jobPreset").onchange=()=>{const p=presets[$("jobPreset").value];if(!p)return;$("resizeW").value=p.w;$("resizeH").value=p.h;$("resizeUnit").value=p.u;$("resizeDpi").value=p.dpi;drawResizePreview();};
function drawResizePreview(signatureClean=false){
  if(!state.resizeImg)return; $("resizeEmpty").style.display="none";
  const w=unitToPx($("resizeW").value,$("resizeUnit").value,$("resizeDpi").value),h=unitToPx($("resizeH").value,$("resizeUnit").value,$("resizeDpi").value);
  const c=$("resizeCanvas"),ctx=c.getContext("2d");c.width=w;c.height=h;ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h);fitCover(ctx,state.resizeImg,0,0,w,h);
  if(signatureClean){
    const d=ctx.getImageData(0,0,w,h),p=d.data;
    for(let i=0;i<p.length;i+=4){const g=.299*p[i]+.587*p[i+1]+.114*p[i+2];const v=g>210?255:(g<120?0:g);p[i]=p[i+1]=p[i+2]=v;}ctx.putImageData(d,0,0);
  }
}
$("signatureCleanBtn").onclick=()=>drawResizePreview(true);
$("processResize").onclick=async()=>{
  if(!state.resizeImg)return alert("Upload an image.");
  drawResizePreview($("jobPreset").value==="signature");
  const target=+$("resizeTargetKb").value;
  if(target){const blob=await compressCanvasToTarget($("resizeCanvas"),target,"image/jpeg");downloadBlob(blob,"job-image.jpg");}
  else downloadDataURL($("resizeCanvas").toDataURL("image/jpeg",.95),"job-image.jpg");
  addHistory("Photo & Signature","Resized image",`${ $("resizeW").value }×${ $("resizeH").value } ${ $("resizeUnit").value }`);
};

// COMPRESSOR
$("compressInput").onchange=e=>{state.compressFile=e.target.files[0]||null;$("compressStatus").textContent=state.compressFile?`Selected: ${state.compressFile.name} • ${(state.compressFile.size/1024).toFixed(1)} KB`:"Ready.";};
async function compressCanvasToTarget(canvas,targetKb,type="image/jpeg"){
  const target=targetKb*1024; let lo=.08,hi=.98,best=null;
  for(let i=0;i<12;i++){const q=(lo+hi)/2;const b=await canvasToBlob(canvas,type,q);if(b.size>target)hi=q;else{best=b;lo=q;}}
  return best || await canvasToBlob(canvas,type,.08);
}
$("compressBtn").onclick=async()=>{
  if(!state.compressFile)return alert("Upload an image.");
  const img=await fileToImage(state.compressFile); let w=img.width,h=img.height,maxW=+$("compressMaxW").value;
  if(maxW&&w>maxW){h=Math.round(h*maxW/w);w=maxW;}
  const c=document.createElement("canvas"),ctx=c.getContext("2d");c.width=w;c.height=h;ctx.drawImage(img,0,0,w,h);
  const target=+$("targetKb").value||50,type=$("compressFormat").value; const blob=await compressCanvasToTarget(c,target,type);
  $("compressStatus").textContent=`Output: ${(blob.size/1024).toFixed(1)} KB • ${w}×${h}px`;
  downloadBlob(blob,type==="image/webp"?"compressed.webp":"compressed.jpg");addHistory("Compressor","Compressed image",`${(blob.size/1024).toFixed(1)} KB`);
};

// PRINT
$("printInput").onchange=async e=>{state.printImages=[];for(const f of [...e.target.files])state.printImages.push(await fileToImage(f)); if(state.printImages.length)$("printEmpty").style.display="none";};
$("buildPrintSheet").onclick=()=>{
  if(!state.printImages.length)return alert("Upload images.");
  const c=$("printCanvas"),ctx=c.getContext("2d"),dpi=300,paper=$("printPaper").value,ori=$("printOrientation").value;
  let w,h;if(paper==="a4"){w=mmToPx(210,dpi);h=mmToPx(297,dpi);}else{w=6*dpi;h=4*dpi;}if(ori==="landscape"&&h>w)[w,h]=[h,w];if(ori==="portrait"&&w>h)[w,h]=[h,w];
  c.width=w;c.height=h;ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h);
  const count=+$("printCount").value,cols=count===4?2:count===6?3:count===9?3:4,rows=Math.ceil(count/cols),gap=mmToPx(3,dpi),m=mmToPx(+$("printMargin").value||4,dpi);
  const cw=(w-2*m-gap*(cols-1))/cols,ch=(h-2*m-gap*(rows-1))/rows;
  for(let i=0;i<count;i++){const img=state.printImages[i%state.printImages.length],col=i%cols,row=Math.floor(i/cols);fitCover(ctx,img,m+col*(cw+gap),m+row*(ch+gap),cw,ch);}
  addHistory("Print Studio","Built collage",`${count} images • ${paper}`);
};
$("downloadPrintSheet").onclick=()=>{if(!$("printCanvas").width)return;downloadDataURL($("printCanvas").toDataURL("image/jpeg",.95),"print-sheet.jpg");};
$("browserPrint").onclick=()=>{const url=$("printCanvas").toDataURL("image/png");const w=window.open("");w.document.write(`<img src="${url}" style="max-width:100%;width:100%"><script>onload=()=>print()<\/script>`);};

// PDF
function downloadBytes(bytes,name,type){downloadBlob(new Blob([bytes],{type}),name)}
function downloadBlob(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=shopAutoFilename(name);a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}
$("mergePdfBtn").onclick=async()=>{
  const files=[...$("mergePdfInput").files];if(!files.length)return alert("Select PDFs.");
  const out=await PDFLib.PDFDocument.create();
  for(const f of files){const src=await PDFLib.PDFDocument.load(await f.arrayBuffer());const pages=await out.copyPages(src,src.getPageIndices());pages.forEach(p=>out.addPage(p));}
  downloadBytes(await out.save(),"merged.pdf","application/pdf");addHistory("PDF Tools","Merged PDFs",`${files.length} files`);
};
$("imagesToPdfBtn").onclick=async()=>{
  const files=[...$("imagesPdfInput").files];if(!files.length)return alert("Select images.");
  const pdf=await PDFLib.PDFDocument.create();
  for(const f of files){
    const ab=await f.arrayBuffer();let im;if(f.type==="image/png")im=await pdf.embedPng(ab);else im=await pdf.embedJpg(ab);
    const p=pdf.addPage([im.width,im.height]);p.drawImage(im,{x:0,y:0,width:im.width,height:im.height});
  }
  downloadBytes(await pdf.save(),"images.pdf","application/pdf");addHistory("PDF Tools","Images to PDF",`${files.length} images`);
};


function parsePageSpec(spec,max){
  const out=[]; for(const part of spec.split(",").map(s=>s.trim()).filter(Boolean)){
    if(part.includes("-")){let [a,b]=part.split("-").map(Number);if(a>b)[a,b]=[b,a];for(let i=a;i<=b;i++)if(i>=1&&i<=max)out.push(i-1);}
    else{const n=Number(part);if(n>=1&&n<=max)out.push(n-1);}
  } return [...new Set(out)];
}
$("splitPdfBtn").onclick=async()=>{
  const f=$("splitPdfInput").files[0]; if(!f)return alert("Select a PDF.");
  const src=await PDFLib.PDFDocument.load(await f.arrayBuffer()), idx=parsePageSpec($("splitRange").value,src.getPageCount());
  if(!idx.length)return alert("Enter a valid page range.");
  const out=await PDFLib.PDFDocument.create(),pages=await out.copyPages(src,idx);pages.forEach(p=>out.addPage(p));
  downloadBytes(await out.save(),"extracted-pages.pdf","application/pdf");addHistory("PDF Tools","Split/extracted PDF",`${idx.length} pages`);
};
$("rotatePdfBtn").onclick=async()=>{
  const f=$("rotatePdfInput").files[0]; if(!f)return alert("Select a PDF.");
  const pdf=await PDFLib.PDFDocument.load(await f.arrayBuffer()),deg=+$("pdfRotateAngle").value;
  pdf.getPages().forEach(p=>p.setRotation(PDFLib.degrees((p.getRotation().angle+deg)%360)));
  downloadBytes(await pdf.save(),"rotated.pdf","application/pdf");addHistory("PDF Tools","Rotated PDF",`${deg}°`);
};
$("reorderPdfBtn").onclick=async()=>{
  const f=$("reorderPdfInput").files[0]; if(!f)return alert("Select a PDF.");
  const src=await PDFLib.PDFDocument.load(await f.arrayBuffer());
  const idx=$("reorderSequence").value.split(",").map(x=>Number(x.trim())-1).filter(i=>i>=0&&i<src.getPageCount());
  if(!idx.length)return alert("Enter a valid sequence.");
  const out=await PDFLib.PDFDocument.create(),pages=await out.copyPages(src,idx);pages.forEach(p=>out.addPage(p));
  downloadBytes(await out.save(),"reordered.pdf","application/pdf");addHistory("PDF Tools","Reordered PDF",`${idx.length} pages`);
};
$("pdfToImageBtn").onclick=async()=>{
  const f=$("pdfToImageInput").files[0]; if(!f)return alert("Select a PDF.");
  const mod=await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs");
  mod.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
  const pdf=await mod.getDocument({data:new Uint8Array(await f.arrayBuffer())}).promise;
  for(let i=1;i<=pdf.numPages;i++){
    const page=await pdf.getPage(i),vp=page.getViewport({scale:2});
    const c=document.createElement("canvas"),ctx=c.getContext("2d");c.width=vp.width;c.height=vp.height;
    await page.render({canvasContext:ctx,viewport:vp}).promise;
    await new Promise(r=>setTimeout(r,120));
    downloadDataURL(c.toDataURL("image/jpeg",.92),`page-${String(i).padStart(2,"0")}.jpg`);
  }
  addHistory("PDF Tools","PDF to images",`${pdf.numPages} pages`);
};

// OCR
$("ocrInput").onchange=e=>{state.ocrFile=e.target.files[0]||null;};
$("ocrBtn").onclick=async()=>{
  if(!state.ocrFile)return alert("Upload an image.");
  $("ocrStatus").textContent="Recognizing text...";
  try{
    const r=await Tesseract.recognize(state.ocrFile,"eng",{logger:m=>{if(m.progress)$("ocrStatus").textContent=`${m.status} • ${Math.round(m.progress*100)}%`; }});
    $("ocrText").value=r.data.text;$("ocrStatus").textContent="Done.";addHistory("OCR","Extracted text",state.ocrFile.name);
  }catch(e){$("ocrStatus").textContent="OCR failed. Check internet the first time Tesseract language data loads.";}
};
$("copyOcr").onclick=()=>navigator.clipboard.writeText($("ocrText").value||"");

// HISTORY
$("clearHistory").onclick=()=>{if(confirm("Delete all local recent-job history?")){localStorage.removeItem("shopstudio_history");renderHistory();}};
renderHistory();

// PWA install
let deferredPrompt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("installBtn").hidden=false;});
$("installBtn").onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("installBtn").hidden=true;};


window.addEventListener("resize",()=>{ try{ renderScanPerspectiveOverlay(); }catch(e){} });

window.addEventListener("load",()=>{
  if($("cardExportDpi")) $("cardExportDpi").value="600";
  if($("cardRenderQuality")) $("cardRenderQuality").value="5";
  if($("cardOutputFormat")) $("cardOutputFormat").value="image/png";
});

/* SHOP STUDIO PRO v10.3 — precision workflow overrides */
(function(){
  const v3 = window.ShopStudioV103 = {};
  const el = id => document.getElementById(id);
  const clamp = (v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const setStatus = (id,msg)=>{ const n=el(id); if(n)n.textContent=msg; };
  const hide = id => { const n=el(id); if(n)n.style.display="none"; };
  const show = id => { const n=el(id); if(n)n.style.display="block"; };
  const canvasClone = src => { const c=document.createElement("canvas"); c.width=src.width;c.height=src.height;c.getContext("2d").drawImage(src,0,0);return c; };
  const imageFromCanvas = c => canvasToImage(c);

  // ---------- QUALITY HELPERS ----------
  function drawHighQuality(ctx,img,x,y,w,h){
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
    ctx.drawImage(img,x,y,w,h);
  }
  function exportPNG(canvas,name){
    if(!canvas||!canvas.width)return;
    canvas.toBlob(blob=>downloadBlob(blob,`${name}.png`),"image/png");
  }

  // ---------- CLEAR WORKSPACES ----------
  function clearScanner(){
    state.scanImg=null;state.scanPages=[];state.scanCurrentIndex=0;state.scanCropMode=false;state.scanCropPts=null;
    if(el("scanPages"))el("scanPages").innerHTML="";
    const c=el("scanCanvas");if(c){c.width=1;c.height=1;}
    show("scanEmpty");renderScanPerspectiveOverlay();setStatus("scanStatus","Workspace cleared • no pages loaded.");
  }
  function clearPhoto(){
    state.photoImg=null;state.photoOriginal=null;state.bulkPhotos=[];state.photoCrop=null;
    const c=el("photoCanvas");if(c){c.width=1;c.height=1;}
    hide("photoCropBox");show("photoEmpty");setStatus("photoAiStatus","Workspace cleared • no photos loaded.");
  }
  function clearCards(){
    state.cardFrontCrop=null;state.cardBackCrop=null;state.detectedCards=[];state.cardPerspectivePts=null;state.cardPerspectiveMode=false;
    state.cardSourceImg=null;state.cardSourceOriginal=null;state.cardPdf=null;state.cardPdfPage=1;
    const c=el("cardSourceCanvas");if(c){c.width=1;c.height=1;}
    ["cardFrontPreview","cardBackPreview","cardCanvas"].forEach(id=>{const x=el(id);if(x){x.width=1;x.height=1;}});
    hide("detectedCardsPanel");if(el("detectedCardsGrid"))el("detectedCardsGrid").innerHTML="";
    hide("cardPerspectiveLayer");hide("cardFreeCropLayer");show("cardSourceEmpty");show("cardEmpty");
    if(el("cardPageLabel"))el("cardPageLabel").textContent="No file";
    state.cardSheetLayout=[];hide("cardSheetEditor");setStatus("cardStatus","Workspace cleared • no cards loaded.");
  }
  function clearPrint(){
    state.printImages=[];state.printLayout=[];
    const c=el("printCanvas");if(c){c.width=1;c.height=1;}
    hide("printEditor");show("printEmpty");setStatus("printStatus","Workspace cleared • no images loaded.");
  }
  function addClearButton(parentId,id,handler){
    const p=el(parentId);if(!p||el(id))return;
    const b=document.createElement("button");b.id=id;b.className="ghost-btn compact-clear";b.textContent="Clear";b.title="Clear all images in this workspace";b.onclick=handler;p.appendChild(b);
  }
  addClearButton("scanner","clearScannerBtn",clearScanner);
  addClearButton("photo","clearPhotoBtn",clearPhoto);
  addClearButton("cards","clearCardsBtn",clearCards);
  addClearButton("print","clearPrintBtn",clearPrint);

  // ---------- PASSPORT PRINT SPACING ----------
  function addPassportSpacingControls(){
    const group=qsa("#photo .control-group").find(x=>/Print/i.test(x.querySelector("h4")?.textContent||""));
    if(!group||el("passportMargin")||el("passportGap"))return;
    const frag=document.createDocumentFragment();
    const lm=document.createElement("label");lm.innerHTML='Outer Margin (mm)<input id="passportMargin" type="number" min="1" max="20" step="0.5" value="8">';
    const lg=document.createElement("label");lg.innerHTML='Photo Gap (mm)<input id="passportGap" type="number" min="0" max="12" step="0.5" value="5">';
    frag.append(lm,lg);group.appendChild(frag);
  }
  addPassportSpacingControls();

  // ---------- PHOTO CROP: HIDE BOX AFTER APPLY ----------
  el("applyPhotoCrop").onclick=async()=>{
    if(!state.photoImg)return alert("Upload a photo first.");
    const box=el("photoCropBox");
    const c=el("photoCanvas");if(!box||!c.width)return alert("Choose Crop first.");
    const r=getBoxRectRelative("photoCropBox","photoCanvas"),cr=c.getBoundingClientRect();
    if(r.w<=1||r.h<=1)return alert("Set crop area first.");
    const sx=Math.max(0,r.x*c.width/cr.width),sy=Math.max(0,r.y*c.height/cr.height),sw=Math.min(c.width-sx,r.w*c.width/cr.width),sh=Math.min(c.height-sy,r.h*c.height/cr.height);
    const out=document.createElement("canvas");out.width=Math.max(1,Math.round(sw));out.height=Math.max(1,Math.round(sh));
    const ctx=out.getContext("2d");ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.drawImage(c,sx,sy,sw,sh,0,0,out.width,out.height);
    state.photoImg=await imageFromCanvas(out);hide("photoCropBox");drawPhoto();setStatus("photoAiStatus",`Crop applied • ${out.width} × ${out.height}px`);addHistory("Photo Studio","Applied crop",`${out.width}×${out.height}px`);
  };
  el("photoCropBtn").onclick=()=>{initPhotoCrop();show("photoCropBox");};

  // ---------- LOCAL BACKGROUND FALLBACK ----------
  function localWhiteBackground(sourceCanvas){
    const w=sourceCanvas.width,h=sourceCanvas.height,out=document.createElement("canvas");out.width=w;out.height=h;
    const src=sourceCanvas.getContext("2d").getImageData(0,0,w,h),d=src.data;
    // Estimate background color from a border ring, then flood-fill connected background pixels.
    const samples=[]; const step=Math.max(1,Math.floor(Math.min(w,h)/120));
    for(let x=0;x<w;x+=step){for(const y of [0,h-1])samples.push([d[(y*w+x)*4],d[(y*w+x)*4+1],d[(y*w+x)*4+2]]);}
    for(let y=0;y<h;y+=step){for(const x of [0,w-1])samples.push([d[(y*w+x)*4],d[(y*w+x)*4+1],d[(y*w+x)*4+2]]);}
    const bg=samples.reduce((a,p)=>[a[0]+p[0],a[1]+p[1],a[2]+p[2]],[0,0,0]).map(v=>v/Math.max(1,samples.length));
    const seen=new Uint8Array(w*h),q=[]; const push=(x,y)=>{if(x<0||y<0||x>=w||y>=h)return;const i=y*w+x;if(seen[i])return;seen[i]=1;q.push(i);};
    for(let x=0;x<w;x+=Math.max(1,Math.floor(w/300))){push(x,0);push(x,h-1);}for(let y=0;y<h;y+=Math.max(1,Math.floor(h/300))){push(0,y);push(w-1,y);}
    const threshold=52;
    while(q.length){const i=q.pop(),x=i%w,y=Math.floor(i/w),di=i*4;const dist=Math.hypot(d[di]-bg[0],d[di+1]-bg[1],d[di+2]-bg[2]);if(dist>threshold)continue;d[di]=255;d[di+1]=255;d[di+2]=255;d[di+3]=255;push(x+1,y);push(x-1,y);push(x,y+1);push(x,y-1);}
    const ctx=out.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h);ctx.putImageData(src,0,0);return out;
  }
  // Clean semi-transparent AI matte edges to reduce bright/old-background hair halos.
  function cleanAiCutoutEdges(cutout){
    const c=document.createElement("canvas");c.width=cutout.width;c.height=cutout.height;
    const ctx=c.getContext("2d",{willReadFrequently:true});ctx.drawImage(cutout,0,0);
    const im=ctx.getImageData(0,0,c.width,c.height),d=im.data,w=c.width,h=c.height,alpha=new Uint8ClampedArray(w*h);
    for(let i=0;i<w*h;i++)alpha[i]=d[i*4+3];
    // Only touch the transition band. Preserve opaque hair/face/clothes exactly.
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
      const i=y*w+x,a=alpha[i];if(a===0||a>=250)continue;
      let minA=255,maxA=0,sum=0,n=0;
      for(let yy=y-1;yy<=y+1;yy++)for(let xx=x-1;xx<=x+1;xx++){const q=alpha[yy*w+xx];minA=Math.min(minA,q);maxA=Math.max(maxA,q);sum+=q;n++;}
      // Slight inward matte contraction removes the pale fringe without cutting solid hair.
      if(minA<80&&maxA>150){const avg=sum/n;d[i*4+3]=Math.max(0,Math.min(a,Math.round((a-18)*1.06),Math.round(avg+18)));}
    }
    ctx.clearRect(0,0,w,h);ctx.putImageData(im,0,0);return c;
  }
  function compositeCutout(cutout,bg){
    const cleaned=cleanAiCutoutEdges(cutout),out=document.createElement("canvas");out.width=cleaned.width;out.height=cleaned.height;
    const ctx=out.getContext("2d");ctx.fillStyle=bg;ctx.fillRect(0,0,out.width,out.height);ctx.drawImage(cleaned,0,0);return out;
  }

  // ---------- SCANNER: REMOVE BG + WHITE ----------
  // Uses the exact same AI cutout + white composite pipeline as Passport Photo.
  el("scanWhiteBgBtn").onclick=async()=>{
    if(!state.scanImg)return alert("Upload or scan a document first.");
    const btn=el("scanWhiteBgBtn"),old=btn.textContent;btn.disabled=true;btn.textContent="Removing…";
    try{
      const source=document.createElement("canvas");source.width=state.scanImg.width;source.height=state.scanImg.height;drawHighQuality(source.getContext("2d"),state.scanImg,0,0,source.width,source.height);
      const blob=await canvasToBlob(source,"image/png",1);
      const mod=await import(/* webpackIgnore: true */ "https://esm.sh/@imgly/background-removal@1.7.0?bundle");
      const removeBackground=mod.default||mod.removeBackground;if(!removeBackground)throw new Error("AI engine unavailable");
      const result=await removeBackground(blob,{model:"medium",proxyToWorker:false,publicPath:"https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/",output:{format:"image/png",quality:1}});
      const cutout=await fileToImage(result),out=compositeCutout(cutout,"#fff");
      state.scanImg=await imageFromCanvas(out);
      if(state.scanPages[state.scanCurrentIndex])state.scanPages[state.scanCurrentIndex].img=state.scanImg;
      state.scanCropMode=false;state.scanCropPts=null;hide("scanCropLayer");drawScan();renderScanThumbs();
      addHistory("Scanner","Background removed","AI + white background");
    }catch(err){
      console.warn("Scanner AI background removal unavailable; using local uniform-background fallback.",err);
      try{
        const src=document.createElement("canvas");src.width=state.scanImg.width;src.height=state.scanImg.height;src.getContext("2d").drawImage(state.scanImg,0,0);
        const out=localWhiteBackground(src);state.scanImg=await imageFromCanvas(out);
        if(state.scanPages[state.scanCurrentIndex])state.scanPages[state.scanCurrentIndex].img=state.scanImg;
        state.scanCropMode=false;state.scanCropPts=null;hide("scanCropLayer");drawScan();renderScanThumbs();
        addHistory("Scanner","Background cleanup","Local fallback + white background");
      }catch(fallbackErr){console.error(fallbackErr);alert("Background removal could not be completed. Original image was preserved.");}
    }finally{btn.disabled=false;btn.textContent=old;}
  };
  el("whiteBgBtn").onclick=async()=>{
    if(!state.photoImg)return alert("Upload a photo first.");
    const status=el("photoAiStatus"),btn=el("whiteBgBtn"),old=btn.textContent;btn.disabled=true;btn.textContent="Removing…";status.textContent="Trying high-quality background removal…";
    try{
      const source=document.createElement("canvas");source.width=state.photoImg.width;source.height=state.photoImg.height;drawHighQuality(source.getContext("2d"),state.photoImg,0,0,source.width,source.height);
      const blob=await canvasToBlob(source,"image/png",1);
      const mod=await import(/* webpackIgnore: true */ "https://esm.sh/@imgly/background-removal@1.7.0?bundle");
      const removeBackground=mod.default||mod.removeBackground;if(!removeBackground)throw new Error("AI engine unavailable");
      const result=await removeBackground(blob,{model:"medium",proxyToWorker:false,publicPath:"https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/",output:{format:"image/png",quality:1},progress:(key,current,total)=>{if(total)status.textContent=`Removing background • ${Math.round(current/total*100)}%`;}});
      const cutout=await fileToImage(result),out=compositeCutout(cutout,"#fff");state.photoImg=await imageFromCanvas(out);hide("photoCropBox");drawPhoto();status.textContent="AI background removed • white background applied.";addHistory("Photo Studio","Background removed","AI + white background");
    }catch(err){
      console.warn("AI background removal unavailable; using local uniform-background fallback.",err);
      try{const src=document.createElement("canvas");src.width=state.photoImg.width;src.height=state.photoImg.height;src.getContext("2d").drawImage(state.photoImg,0,0);const out=localWhiteBackground(src);state.photoImg=await imageFromCanvas(out);hide("photoCropBox");drawPhoto();status.textContent="Local background cleanup applied • original subject preserved.";addHistory("Photo Studio","Background cleanup","Local fallback");}
      catch(fallbackErr){status.textContent="Background removal could not be completed; original preserved.";console.error(fallbackErr);}
    }finally{btn.disabled=false;btn.textContent=old;}
  };

  // ---------- NATURAL ENHANCE, HIGH QUALITY ----------
  function highQualityEnhance(source,factor=2){
    const out=document.createElement("canvas"),maxDim=6500,scale=Math.min(factor,maxDim/Math.max(source.width,source.height));
    out.width=Math.max(1,Math.round(source.width*scale));out.height=Math.max(1,Math.round(source.height*scale));
    const ctx=out.getContext("2d");ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.filter="brightness(1.015) contrast(1.025) saturate(1.015)";ctx.drawImage(source,0,0,out.width,out.height);ctx.filter="none";
    return sharpenCanvas(out,.08);
  }
  // ---------- BLUE PASSPORT BACKGROUND ----------
  // Uses the same AI cutout as the white option, then applies a print-friendly studio blue.
  el("blueBgBtn").onclick=async()=>{
    if(!state.photoImg)return alert("Upload a photo first.");
    const status=el("photoAiStatus"),btn=el("blueBgBtn"),old=btn.textContent;btn.disabled=true;btn.textContent="Removing…";status.textContent="Trying high-quality background removal…";
    const blue="#4A90D9";
    try{
      const source=document.createElement("canvas");source.width=state.photoImg.width;source.height=state.photoImg.height;drawHighQuality(source.getContext("2d"),state.photoImg,0,0,source.width,source.height);
      const blob=await canvasToBlob(source,"image/png",1);
      const mod=await import(/* webpackIgnore: true */ "https://esm.sh/@imgly/background-removal@1.7.0?bundle");
      const removeBackground=mod.default||mod.removeBackground;if(!removeBackground)throw new Error("AI engine unavailable");
      const result=await removeBackground(blob,{model:"medium",proxyToWorker:false,publicPath:"https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/",output:{format:"image/png",quality:1},progress:(key,current,total)=>{if(total)status.textContent=`Removing background • ${Math.round(current/total*100)}%`;}});
      const cutout=await fileToImage(result),out=compositeCutout(cutout,blue);state.photoImg=await imageFromCanvas(out);hide("photoCropBox");drawPhoto();status.textContent="AI background removed • blue background applied.";addHistory("Photo Studio","Background removed","AI + blue background");
    }catch(err){
      console.warn("AI background removal unavailable; using local uniform-background fallback.",err);
      try{
        const src=document.createElement("canvas");src.width=state.photoImg.width;src.height=state.photoImg.height;src.getContext("2d").drawImage(state.photoImg,0,0);
        const out=localWhiteBackground(src),ctx=out.getContext("2d"),im=ctx.getImageData(0,0,out.width,out.height),d=im.data;
        const rgb=[74,144,217];for(let i=0;i<d.length;i+=4){if(d[i]>248&&d[i+1]>248&&d[i+2]>248){d[i]=rgb[0];d[i+1]=rgb[1];d[i+2]=rgb[2];}}ctx.putImageData(im,0,0);
        state.photoImg=await imageFromCanvas(out);hide("photoCropBox");drawPhoto();status.textContent="Local background cleanup applied • blue background added.";addHistory("Photo Studio","Background cleanup","Local + blue background");
      }catch(fallbackErr){status.textContent="Background removal could not be completed; original preserved.";console.error(fallbackErr);}
    }finally{btn.disabled=false;btn.textContent=old;}
  };

  el("enhanceBtn").onclick=async()=>{
    if(!state.photoImg)return alert("Upload a photo first.");const status=el("photoAiStatus"),btn=el("enhanceBtn"),old=btn.textContent;btn.disabled=true;btn.textContent="Enhancing…";status.textContent="Upscaling with natural detail preservation…";
    try{const src=document.createElement("canvas");src.width=state.photoImg.width;src.height=state.photoImg.height;src.getContext("2d").drawImage(state.photoImg,0,0);const out=highQualityEnhance(src,2);state.photoImg=await imageFromCanvas(out);hide("photoCropBox");drawPhoto();status.textContent=`Enhancement complete • ${out.width} × ${out.height}px`;addHistory("Photo Studio","Enhanced photo","2× high-quality natural upscale");}
    catch(err){console.error(err);status.textContent="Enhancement failed • original preserved.";}finally{btn.disabled=false;btn.textContent=old;}
  };

  // Rebuild passport sheet with explicit, larger spacing and lossless PNG.
  buildDuplicateSheet=function(img,count,paper,borderPx=2){
    const c=el("printCanvas"),ctx=c.getContext("2d"),dpi=300;
    if(paper==="a4"){c.width=mmToPx(210,dpi);c.height=mmToPx(297,dpi);}else{c.width=6*dpi;c.height=4*dpi;}
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.fillStyle="#fff";ctx.fillRect(0,0,c.width,c.height);
    const template=el("passportTemplate")?.value||"auto";let photoW=null,photoH=null,cols=null,rows=null;
    if(paper==="6x4"&&template!=="auto"){
      if(template==="8-35x45"){photoW=mmToPx(35,dpi);photoH=mmToPx(45,dpi);cols=4;rows=2;count=8;}
      if(template==="6-35x45"){photoW=mmToPx(35,dpi);photoH=mmToPx(45,dpi);cols=3;rows=2;count=6;}
      if(template==="8-40x50"){photoW=mmToPx(40,dpi);photoH=mmToPx(50,dpi);cols=4;rows=2;count=8;}
    }
    let margin=mmToPx(Number(el("passportMargin")?.value||8),dpi),gap=mmToPx(Number(el("passportGap")?.value||5),dpi);
    if(!cols){cols=count<=4?2:(count===6?3:(count===9?3:4));rows=Math.ceil(count/cols);photoW=Math.floor((c.width-2*margin-gap*(cols-1))/cols);photoH=Math.floor((c.height-2*margin-gap*(rows-1))/rows);}
    else {const totalW=photoW*cols+gap*(cols-1),totalH=photoH*rows+gap*(rows-1);if(totalW+2*margin>c.width||totalH+2*margin>c.height){gap=Math.max(0,Math.floor(Math.min((c.width-2*margin-photoW*cols)/(cols-1||1),(c.height-2*margin-photoH*rows)/(rows-1||1))));}}
    const gridW=photoW*cols+gap*(cols-1),gridH=photoH*rows+gap*(rows-1),startX=Math.max(0,(c.width-gridW)/2),startY=Math.max(0,(c.height-gridH)/2),cut=el("passportCutLines")?.value!=="no";
    for(let i=0;i<count;i++){const col=i%cols,row=Math.floor(i/cols),x=startX+col*(photoW+gap),y=startY+row*(photoH+gap);fitCover(ctx,img,x,y,photoW,photoH);if(borderPx>0){ctx.save();ctx.strokeStyle="#111";ctx.lineWidth=borderPx;ctx.strokeRect(x+.5,y+.5,photoW-1,photoH-1);ctx.restore();}if(cut){ctx.save();ctx.strokeStyle="#888";ctx.setLineDash([5,4]);ctx.lineWidth=1;ctx.strokeRect(x-2,y-2,photoW+4,photoH+4);ctx.restore();}}
    hide("photoCropBox");hide("printEditor");hide("printEmpty");
  };

  // ---------- SMART CARD SOURCE / QUALITY ----------
  function rememberCardSource(){const c=el("cardSourceCanvas");if(c?.width)state.cardSourceOriginal=canvasClone(c);}
  function restoreCardSource(){if(!state.cardSourceOriginal)return;const c=el("cardSourceCanvas");c.width=state.cardSourceOriginal.width;c.height=state.cardSourceOriginal.height;c.getContext("2d").drawImage(state.cardSourceOriginal,0,0);state.cardSourceImg=null;hide("cardFreeCropLayer");enableCardPerspective();setStatus("cardStatus","Original source restored.");}
  const oldRenderCardPdfPage=renderCardPdfPage;
  renderCardPdfPage=async function(){await oldRenderCardPdfPage();rememberCardSource();};
  el("cardImageInput").addEventListener("change",()=>setTimeout(rememberCardSource,80));

  // Flexible rectangular crop UI for Smart Card.
  function ensureCardFlexUI(){
    const stage=el("cardPerspectiveStage");if(!stage)return;
    if(!el("cardFreeCropLayer")){
      const layer=document.createElement("div");layer.id="cardFreeCropLayer";layer.className="card-free-crop-layer";
      layer.innerHTML='<div id="cardFreeCropBox" class="crop-box flex-card-box"><span class="crop-handle nw" data-h="nw"></span><span class="crop-handle n" data-h="n"></span><span class="crop-handle ne" data-h="ne"></span><span class="crop-handle e" data-h="e"></span><span class="crop-handle se" data-h="se"></span><span class="crop-handle s" data-h="s"></span><span class="crop-handle sw" data-h="sw"></span><span class="crop-handle w" data-h="w"></span></div>';
      stage.appendChild(layer);
    }
  }
  ensureCardFlexUI();
  state.cardFreeCrop=null;let cardFlexDrag=null;
  function renderCardFreeCrop(){
    const layer=el("cardFreeCropLayer"),box=el("cardFreeCropBox"),c=el("cardSourceCanvas"),stage=el("cardPerspectiveStage");if(!layer||!box||!c?.width)return;
    const cr=c.getBoundingClientRect(),sr=stage.getBoundingClientRect();layer.style.left=(cr.left-sr.left)+"px";layer.style.top=(cr.top-sr.top)+"px";layer.style.width=cr.width+"px";layer.style.height=cr.height+"px";layer.style.display=state.cardFreeCrop?"block":"none";
    if(state.cardFreeCrop){const r=state.cardFreeCrop;box.style.left=(r.x*100)+"%";box.style.top=(r.y*100)+"%";box.style.width=(r.w*100)+"%";box.style.height=(r.h*100)+"%";}
  }
  function startCardFreeCrop(){
    const c=el("cardSourceCanvas");if(!c?.width)return alert("Open a PDF or image first.");state.cardFreeCrop={x:.08,y:.08,w:.84,h:.84};state.cardPerspectiveMode=false;hide("cardPerspectiveLayer");renderCardFreeCrop();setStatus("cardStatus","Flexible crop • drag corners horizontally or vertically, then Apply.");
  }
  el("cardFlexibleCropBtn")?.addEventListener("click",startCardFreeCrop);
  el("restoreCardSourceBtn")?.addEventListener("click",restoreCardSource);
  qsa("#cardFreeCropBox .crop-handle").forEach(h=>{
    h.addEventListener("pointerdown",e=>{if(!state.cardFreeCrop)return;e.preventDefault();h.setPointerCapture(e.pointerId);cardFlexDrag={sx:e.clientX,sy:e.clientY,start:{...state.cardFreeCrop},handle:h.dataset.h};});
    h.addEventListener("pointermove",e=>{if(!cardFlexDrag)return;const c=el("cardSourceCanvas").getBoundingClientRect(),dx=(e.clientX-cardFlexDrag.sx)/c.width,dy=(e.clientY-cardFlexDrag.sy)/c.height,s=cardFlexDrag.start,h=cardFlexDrag.handle,n={...s};if(h.includes("w")){n.x=clamp(s.x+dx,0,.95);n.w=Math.max(.05,s.w-dx);}if(h.includes("e")){n.w=Math.max(.05,s.w+dx);}if(h.includes("n")){n.y=clamp(s.y+dy,0,.95);n.h=Math.max(.05,s.h-dy);}if(h.includes("s")){n.h=Math.max(.05,s.h+dy);}if(n.x+n.w>1)n.w=1-n.x;if(n.y+n.h>1)n.h=1-n.y;state.cardFreeCrop=n;renderCardFreeCrop();});
    h.addEventListener("pointerup",()=>cardFlexDrag=null);h.addEventListener("pointercancel",()=>cardFlexDrag=null);
  });
  el("applyCardFlexibleCrop")?.addEventListener("click",async()=>{
    if(!state.cardFreeCrop)return alert("Choose Flexible Crop first.");const c=el("cardSourceCanvas"),r=state.cardFreeCrop;const out=document.createElement("canvas");out.width=Math.max(1,Math.round(r.w*c.width));out.height=Math.max(1,Math.round(r.h*c.height));const ctx=out.getContext("2d");ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.drawImage(c,r.x*c.width,r.y*c.height,r.w*c.width,r.h*c.height,0,0,out.width,out.height);if(!state.cardSourceOriginal)state.cardSourceOriginal=canvasClone(c);c.width=out.width;c.height=out.height;c.getContext("2d").drawImage(out,0,0);state.cardFreeCrop=null;state.cardPerspectiveMode=false;state.cardPerspectivePts=null;hide("cardFreeCropLayer");hide("cardPerspectiveLayer");setStatus("cardStatus",`Flexible crop applied • ${out.width} × ${out.height}px. Crop overlay closed. Use 4-Point Perspective when ready.`);
  });

  // ---------- BETTER DOCUMENT DETECTION ----------
  function orderQuad(points){
    const pts=points.map(p=>({x:p.x,y:p.y})),sum=pts.map(p=>p.x+p.y),dif=pts.map(p=>p.x-p.y);
    return [pts[sum.indexOf(Math.min(...sum))],pts[dif.indexOf(Math.max(...dif))],pts[sum.indexOf(Math.max(...sum))],pts[dif.indexOf(Math.min(...dif))]];
  }
  async function detectGenericDocument(sourceCanvas){
    if(typeof cv==="undefined"||!cv.Mat)return null;
    const maxDim=2200,scale=Math.min(1,maxDim/Math.max(sourceCanvas.width,sourceCanvas.height));const dc=document.createElement("canvas");dc.width=Math.max(1,Math.round(sourceCanvas.width*scale));dc.height=Math.max(1,Math.round(sourceCanvas.height*scale));const dctx=dc.getContext("2d");dctx.drawImage(sourceCanvas,0,0,dc.width,dc.height);
    const src=cv.imread(dc),gray=new cv.Mat(),blur=new cv.Mat(),edges=new cv.Mat(),contours=new cv.MatVector(),hierarchy=new cv.Mat();let best=null,bestScore=-Infinity;
    try{
      cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);cv.GaussianBlur(gray,blur,new cv.Size(5,5),0);cv.Canny(blur,25,110,edges);const k=cv.getStructuringElement(cv.MORPH_RECT,new cv.Size(5,5));cv.morphologyEx(edges,edges,cv.MORPH_CLOSE,k);k.delete();cv.findContours(edges,contours,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);const areaAll=dc.width*dc.height;
      for(let i=0;i<contours.size();i++){const cnt=contours.get(i),peri=cv.arcLength(cnt,true),approx=new cv.Mat();cv.approxPolyDP(cnt,approx,.025*peri,true);if(approx.rows===4){const area=Math.abs(cv.contourArea(approx)),ar=area/areaAll;if(ar>.06&&ar<.995&&cv.isContourConvex(approx)){const pts=[];for(let j=0;j<4;j++){const q=approx.intPtr(j,0);pts.push({x:q[0],y:q[1]});}const [tl,tr,br,bl]=orderQuad(pts),w=(Math.hypot(tr.x-tl.x,tr.y-tl.y)+Math.hypot(br.x-bl.x,br.y-bl.y))/2,h=(Math.hypot(bl.x-tl.x,bl.y-tl.y)+Math.hypot(br.x-tr.x,br.y-tr.y))/2,ratio=Math.max(w,h)/Math.max(1,Math.min(w,h));const target=1.585,ratioErr=Math.min(1,Math.abs(ratio-target)/target),score=ar*4+(1-ratioErr)*2+(ar>.18?1:0);if(score>bestScore){bestScore=score;best=pts.map(p=>({x:p.x/scale,y:p.y/scale}));}}}approx.delete();cnt.delete();}
      return best;
    }finally{[src,gray,blur,edges,hierarchy].forEach(m=>m.delete());contours.delete();}
  }
  function contentFallbackQuad(c){
    const ctx=c.getContext("2d"),d=ctx.getImageData(0,0,c.width,c.height).data,w=c.width,h=c.height,step=Math.max(1,Math.floor(Math.min(w,h)/700));let minX=w,minY=h,maxX=-1,maxY=-1;
    for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){const i=(y*w+x)*4,avg=(d[i]+d[i+1]+d[i+2])/3;if(avg<245){if(x<minX)minX=x;if(y<minY)minY=y;if(x>maxX)maxX=x;if(y>maxY)maxY=y;}}
    if(maxX<0)return null;const pad=Math.max(4,Math.round(Math.min(w,h)*.01));minX=Math.max(0,minX-pad);minY=Math.max(0,minY-pad);maxX=Math.min(w-1,maxX+pad);maxY=Math.min(h-1,maxY+pad);return [{x:minX,y:minY},{x:maxX,y:minY},{x:maxX,y:maxY},{x:minX,y:maxY}];
  }
  function defaultCardQuad(c){const ratio=85.6/54;let w=c.width*.82,h=w/ratio;if(h>c.height*.82){h=c.height*.82;w=h*ratio;}const x=(c.width-w)/2,y=(c.height-h)/2;return [{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];}
  async function bestDocumentPoints(c,strictCard=true){
    try{
      if(strictCard){
        const found=await detectCardQuadrilaterals(c,12);
        // Only trust a detected card when it is a convincing outer boundary.
        // Otherwise an inner text/red-box rectangle is worse than a manual crop.
        const credible=found.filter(x=>{
          const xs=x.points.map(p=>p.x),ys=x.points.map(p=>p.y),w=Math.max(...xs)-Math.min(...xs),h=Math.max(...ys)-Math.min(...ys),area=(w*h)/(c.width*c.height);
          const near=x.points.filter(p=>p.x<c.width*.08||p.y<c.height*.08||p.x>c.width*.92||p.y>c.height*.92).length;
          return near>=2 || area>=.58;
        });
        if(credible.length)return credible[0].points;
        const lines=detectCardByLongLines(c,12);
        const lineCredible=lines.filter(x=>{
          const xs=x.points.map(p=>p.x),ys=x.points.map(p=>p.y),area=((Math.max(...xs)-Math.min(...xs))*(Math.max(...ys)-Math.min(...ys)))/(c.width*c.height),near=x.points.filter(p=>p.x<c.width*.08||p.y<c.height*.08||p.x>c.width*.92||p.y>c.height*.92).length;
          return near>=2 || area>=.58;
        });
        if(lineCredible.length)return lineCredible[0].points;
      }
      const generic=await detectGenericDocument(c);
      if(generic)return generic;
      const content=contentFallbackQuad(c);
      if(content)return content;
      return defaultCardQuad(c);
    }catch(e){console.warn(e);return contentFallbackQuad(c)||defaultCardQuad(c);}
  }
  el("deskewBtn").onclick=async()=>{
    if(!state.scanImg)return alert("Upload a document first.");
    if(typeof cv==="undefined"||!cv.Mat){setStatus("scanStatus","OpenCV is still loading • Perspective Crop is available now.");initScanCropBox();return;}
    const btn=el("deskewBtn"),old=btn.textContent;btn.disabled=true;btn.textContent="Detecting…";
    try{const src=document.createElement("canvas");src.width=state.scanImg.width;src.height=state.scanImg.height;src.getContext("2d").drawImage(state.scanImg,0,0);const pts=await bestDocumentPoints(src,false);state.scanCropPts=pts.map(p=>({x:p.x/src.width,y:p.y/src.height}));state.scanCropMode=true;renderScanPerspectiveOverlay();setStatus("scanStatus","Document boundary found • review the 4 corners, then Apply Perspective.");}
    catch(e){console.warn(e);initScanCropBox();setStatus("scanStatus","No clear boundary • manual 4-corner Perspective Crop opened.");}
    finally{btn.disabled=false;btn.textContent=old;}
  };
  // Scanner export: preserve lossless quality in PDF and hide crop overlay after apply.
  el("applyScanCrop").onclick=async()=>{if(!el("scanCanvas").width)return alert("Upload or scan a document first.");if(!state.scanCropMode||!state.scanCropPts)return initScanCropBox();try{const out=await perspectiveCropCanvas(el("scanCanvas"),state.scanCropPts);state.scanImg=await imageFromCanvas(out);state.scanCropMode=false;state.scanCropPts=null;hide("scanCropLayer");drawScan();setStatus("scanStatus",`Perspective crop applied • ${out.width} × ${out.height}px`);addHistory("Scanner","Perspective crop applied",`${out.width}×${out.height}px`);}catch(e){console.error(e);setStatus("scanStatus","Crop failed • manual points are still available.");}};
  // Add scanner status if absent.
  if(!el("scanStatus")){const n=document.createElement("div");n.id="scanStatus";n.className="status-inline";n.textContent="Ready • Auto Detect tries multiple document-detection methods.";el("scanner")?.querySelector(".workspace-main")?.prepend(n);}
  if(!el("cardStatus")){const n=document.createElement("div");n.id="cardStatus";n.className="status-inline";n.textContent="Ready • Auto Detect uses multiple passes and never blocks you with a detection alert.";el("cards")?.querySelector(".workspace-main")?.prepend(n);}
  if(!el("printStatus")){const n=document.createElement("div");n.id="printStatus";n.className="status-inline";n.textContent="Upload images to arrange them with drag + resize.";el("print")?.querySelector(".compact-tool")?.insertBefore(n,el("print")?.querySelector(".compact-controls"));}

  // ---------- SMART CARD AUTO DETECT / PERSPECTIVE QUALITY ----------
  perspectiveCardCanvas=async function(sourceCanvas,pts,dpi=600){
    if(typeof cv==="undefined"||!cv.Mat)throw new Error("OpenCV is still loading. Please wait a moment.");
    const ordered=orderQuad(pts.map(p=>({x:p.x*sourceCanvas.width,y:p.y*sourceCanvas.height}))),outW=mmToPx(85.6,dpi),outH=mmToPx(54,dpi);
    const src=cv.imread(sourceCanvas),srcPts=cv.matFromArray(4,1,cv.CV_32FC2,ordered.flatMap(p=>[p.x,p.y])),dstPts=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,outW-1,0,outW-1,outH-1,0,outH-1]),M=cv.getPerspectiveTransform(srcPts,dstPts),dst=new cv.Mat();
    cv.warpPerspective(src,dst,M,new cv.Size(outW,outH),cv.INTER_LANCZOS4,cv.BORDER_CONSTANT,new cv.Scalar(255,255,255,255));
    const out=document.createElement("canvas");out.width=outW;out.height=outH;const ctx=out.getContext("2d");ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";cv.imshow(out,dst);[src,srcPts,dstPts,M,dst].forEach(m=>m.delete());return out;
  };
  el("autoDetectCardBtn").onclick=async()=>{
    const c=el("cardSourceCanvas");if(!c?.width)return alert("Open a PDF page or image first.");const btn=el("autoDetectCardBtn"),old=btn.textContent;btn.disabled=true;btn.textContent="Detecting…";
    try{const pts=await bestDocumentPoints(c,true);setCardPerspectivePointsFromPixels(pts,c);setStatus("cardStatus","Best available 4-corner boundary selected • adjust corners if needed, then Apply & Save.");}
    catch(e){console.warn(e);enableCardPerspective();setStatus("cardStatus","Auto detection could not find a reliable edge • manual Perspective Crop opened.");}
    finally{btn.disabled=false;btn.textContent=old;}
  };
  el("autoSplitCardsBtn").onclick=async()=>{
    const c=el("cardSourceCanvas");if(!c?.width)return alert("Open a PDF page or image first.");const btn=el("autoSplitCardsBtn"),old=btn.textContent;btn.disabled=true;btn.textContent="Finding cards…";
    try{let found=await detectCardQuadrilaterals(c,12);const credible=found.filter(x=>{const xs=x.points.map(p=>p.x),ys=x.points.map(p=>p.y),area=((Math.max(...xs)-Math.min(...xs))*(Math.max(...ys)-Math.min(...ys)))/(c.width*c.height),near=x.points.filter(p=>p.x<c.width*.08||p.y<c.height*.08||p.x>c.width*.92||p.y>c.height*.92).length;return near>=2||area>=.58;});found=credible;if(!found.length){const lines=detectCardByLongLines(c,12);found=lines.filter(x=>{const xs=x.points.map(p=>p.x),ys=x.points.map(p=>p.y),area=((Math.max(...xs)-Math.min(...xs))*(Math.max(...ys)-Math.min(...ys)))/(c.width*c.height),near=x.points.filter(p=>p.x<c.width*.08||p.y<c.height*.08||p.x>c.width*.92||p.y>c.height*.92).length;return near>=2||area>=.58;});}if(!found.length){const one=await detectGenericDocument(c);if(one)found=[{points:one,score:1}];}if(!found.length){found=[{points:[{x:0,y:0},{x:c.width,y:0},{x:c.width,y:c.height},{x:0,y:c.height}],score:.1}];setStatus("cardStatus","No reliable boundary found • using the full image. Adjust the four corners manually if needed.");}else setStatus("cardStatus",`${found.length} document/card candidate(s) found • assign Front or Back below.`);state.detectedCards=found.map(x=>({points:x.points,score:x.score}));const grid=el("detectedCardsGrid"),panel=el("detectedCardsPanel");grid.innerHTML="";panel.hidden=false;
      for(let i=0;i<found.length;i++){const crop=await perspectiveCardCanvas(c,found[i].points.map(p=>({x:p.x/c.width,y:p.y/c.height})),+$('cardExportDpi').value||600),wrap=document.createElement("div");wrap.className="detected-card";const cvw=document.createElement("canvas");wrap.appendChild(cvw);previewCardCanvasTo(cvw,crop);const actions=document.createElement("div");actions.className="detected-card-actions";for(const [txt,fn] of [["Set Front",()=>{state.cardFrontCrop=crop;previewCardCanvas("cardFrontPreview",crop)}],["Set Back",()=>{state.cardBackCrop=crop;previewCardCanvas("cardBackPreview",crop)}],["Export PVC",()=>downloadCanvas(crop,`pvc-detected-${i+1}-${$('cardExportDpi').value}dpi`,$('cardOutputFormat').value||"image/png",1)]]){const b=document.createElement("button");b.className="mini-btn";b.textContent=txt;b.onclick=fn;actions.appendChild(b);}wrap.appendChild(actions);grid.appendChild(wrap);}
      if(found.length>=2){state.cardFrontCrop=await perspectiveCardCanvas(c,found[0].points.map(p=>({x:p.x/c.width,y:p.y/c.height})),$('cardExportDpi').value||600);state.cardBackCrop=await perspectiveCardCanvas(c,found[1].points.map(p=>({x:p.x/c.width,y:p.y/c.height})),$('cardExportDpi').value||600);previewCardCanvas("cardFrontPreview",state.cardFrontCrop);previewCardCanvas("cardBackPreview",state.cardBackCrop);}
    }catch(e){console.warn(e);setStatus("cardStatus","Auto split could not confidently detect both sides • manual Perspective Crop remains available.");}finally{btn.disabled=false;btn.textContent=old;}
  };
  // Restore source button if it exists / create it.
  const cardGroup=qsa("#cards .control-group")[0];if(cardGroup&&!el("restoreCardSourceBtn")){const b=document.createElement("button");b.id="restoreCardSourceBtn";b.className="ghost-btn";b.textContent="Restore Original";b.onclick=restoreCardSource;cardGroup.appendChild(b);}
  // Add flexible crop controls.
  if(cardGroup&&!el("cardFlexibleCropBtn")){const b=document.createElement("button");b.id="cardFlexibleCropBtn";b.className="mini-btn";b.textContent="Flexible Crop";cardGroup.insertBefore(b,el("manualCardPerspectiveBtn"));b.onclick=startCardFreeCrop;}
  if(cardGroup&&!el("applyCardFlexibleCrop")){const b=document.createElement("button");b.id="applyCardFlexibleCrop";b.className="mini-btn";b.textContent="Apply Flexible Crop";cardGroup.insertBefore(b,el("manualCardPerspectiveBtn"));b.onclick=async()=>el("applyCardFlexibleCrop").dispatchEvent(new Event("click"));}
  // The dynamic button above needs a direct handler rather than self-dispatch recursion.
  el("applyCardFlexibleCrop").onclick=async()=>{
    if(!state.cardFreeCrop)return startCardFreeCrop();const c=el("cardSourceCanvas"),r=state.cardFreeCrop,out=document.createElement("canvas");out.width=Math.max(1,Math.round(r.w*c.width));out.height=Math.max(1,Math.round(r.h*c.height));const ctx=out.getContext("2d");ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.drawImage(c,r.x*c.width,r.y*c.height,r.w*c.width,r.h*c.height,0,0,out.width,out.height);if(!state.cardSourceOriginal)state.cardSourceOriginal=canvasClone(c);c.width=out.width;c.height=out.height;c.getContext("2d").drawImage(out,0,0);state.cardFreeCrop=null;state.cardPerspectiveMode=false;state.cardPerspectivePts=null;hide("cardFreeCropLayer");hide("cardPerspectiveLayer");setStatus("cardStatus",`Flexible crop applied • ${out.width} × ${out.height}px. Crop overlay closed. Use 4-Point Perspective when ready.`);
  };
  // Save perspective: always hide overlay after application.
  el("saveCardCrop").onclick=async()=>{try{if(!el("cardSourceCanvas").width)return alert("Open a PDF or image first.");if(!state.cardPerspectiveMode||!state.cardPerspectivePts){enableCardPerspective();return;}const dpi=+$('cardExportDpi').value||600,crop=await perspectiveCardCanvas(el("cardSourceCanvas"),state.cardPerspectivePts,dpi),action=el("cardCropAction").value;if(action==="front")state.cardFrontCrop=crop;else state.cardBackCrop=crop;previewCardCanvas(action==="front"?"cardFrontPreview":"cardBackPreview",crop);state.cardPerspectiveMode=false;hide("cardPerspectiveLayer");setStatus("cardStatus",`${action.toUpperCase()} crop applied • exact PVC 85.6 × 54 mm • ${crop.width} × ${crop.height}px`);addHistory("Smart Card",`Saved ${action} • exact PVC`,`85.6×54 mm • ${dpi} DPI • ${crop.width}×${crop.height}px`);}catch(e){console.error(e);setStatus("cardStatus","Perspective crop failed • original source preserved.");}};
  // Export uses exact saved crop and lossless PNG.
  el("exportCardCropImage").onclick=async()=>{try{const action=el("cardCropAction").value,dpi=+$('cardExportDpi').value||600;let crop=action==="front"?state.cardFrontCrop:state.cardBackCrop;if(state.cardPerspectiveMode&&state.cardPerspectivePts)crop=await perspectiveCardCanvas(el("cardSourceCanvas"),state.cardPerspectivePts,dpi);if(!crop){setStatus("cardStatus","Apply Front/Back crop first.");return;}downloadCanvas(crop,`pvc-${action}-${dpi}dpi`,el("cardOutputFormat").value||"image/png",1);setStatus("cardStatus",`Exported ${action.toUpperCase()} • ${crop.width} × ${crop.height}px • lossless PNG ready.`);}catch(e){console.error(e);setStatus("cardStatus","PVC export failed • source preserved.");}};

  // ---------- GENERIC DRAG/RESIZE LAYOUT EDITOR ----------
  function ensureEditor(id,hostId){
    let ed=el(id);if(ed)return ed;const host=el(hostId);if(!host)return null;ed=document.createElement("div");ed.id=id;ed.className="layout-editor";host.appendChild(ed);return ed;
  }
  function makeLayoutItems(images,mode,paper,orientation,count,marginMm=4,gapMm=3,dpi=300){let W=paper==="a4"?mmToPx(210,dpi):mmToPx(152.4,dpi),H=paper==="a4"?mmToPx(297,dpi):mmToPx(101.6,dpi);if(orientation==="landscape"&&H>W)[W,H]=[H,W];if(orientation==="portrait"&&W>H)[W,H]=[H,W];
    const n=count||images.length,cols=n===4?2:n===6?3:n===9?3:4,rows=Math.ceil(n/cols),m=mmToPx(marginMm,dpi),g=mmToPx(gapMm,dpi),cw=Math.max(1,(W-2*m-g*(cols-1))/cols),ch=Math.max(1,(H-2*m-g*(rows-1))/rows);const items=[];
    for(let i=0;i<n;i++){const col=i%cols,row=Math.floor(i/cols),img=images[i%images.length];let x=m+col*(cw+g),y=m+row*(ch+g),w=cw,h=ch;items.push({img,x:x/W,y:y/H,w:w/W,h:h/H,ratio:img.width/img.height});}return {W,H,items};
  }
  function syncLayoutEditor(editor,canvas){
    if(!editor||!canvas?.width)return;
    const cr=canvas.getBoundingClientRect(),host=editor.parentElement.getBoundingClientRect();
    editor.style.left=(cr.left-host.left)+"px";editor.style.top=(cr.top-host.top)+"px";editor.style.width=cr.width+"px";editor.style.height=cr.height+"px";editor.style.display="block";
  }
  function updateLayoutDom(d,it){
    d.style.left=(it.x*100)+"%";d.style.top=(it.y*100)+"%";d.style.width=(it.w*100)+"%";d.style.height=(it.h*100)+"%";
  }
  function drawLayoutImageContain(ctx,img,x,y,w,h){
    if(!img?.width||!img?.height||w<=0||h<=0)return;
    const s=Math.min(w/img.width,h/img.height);
    const dw=img.width*s, dh=img.height*s;
    const dx=x+(w-dw)/2, dy=y+(h-dh)/2;
    ctx.drawImage(img,0,0,img.width,img.height,dx,dy,dw,dh);
  }
  function renderLayoutPreview(canvas,items){
    if(!canvas?.width)return;
    const ctx=canvas.getContext("2d");ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);
    items.forEach(it=>{const x=it.x*canvas.width,y=it.y*canvas.height,w=it.w*canvas.width,h=it.h*canvas.height,a=+it.rotation||0;if(a){ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate(a*Math.PI/180);drawLayoutImageContain(ctx,it.img,-w/2,-h/2,w,h);ctx.restore();}else drawLayoutImageContain(ctx,it.img,x,y,w,h);});
  }
  function renderLayoutEditor(editor,canvas,items,labelPrefix="IMG"){
    if(!editor||!canvas?.width)return;syncLayoutEditor(editor,canvas);editor.innerHTML="";
    items.forEach((it,i)=>{
      const d=document.createElement("div");d.className="layout-item";d.dataset.i=i;updateLayoutDom(d,it);
      const im=document.createElement("img");im.src=it.img instanceof HTMLCanvasElement?it.img.toDataURL("image/png"):it.img.src;d.appendChild(im);
      const tag=document.createElement("span");tag.className="layout-item-tag";tag.textContent=`${labelPrefix} ${i+1} • DRAG / SCALE`;d.appendChild(tag);
      for(const pos of ["nw","ne","sw","se"]){const h=document.createElement("span");h.className=`layout-resize ${pos}`;h.dataset.handle=pos;d.appendChild(h);}
      // Selection and crop are scoped to one item only; other items are never modified.
      d.tabIndex=0;
      d.setAttribute("aria-label",`${labelPrefix} ${i+1}: select, drag, or crop`);
      const selectOnly=()=>{editor.querySelectorAll('.layout-item.selected').forEach(x=>x.classList.remove('selected'));d.classList.add('selected');editor.dataset.selectedIndex=String(i);};
      d.addEventListener('focus',selectOnly);
      const cropBtn=document.createElement('button');cropBtn.type='button';cropBtn.textContent='Crop selected';cropBtn.className='p6-crop-button';cropBtn.style.cssText='position:absolute;bottom:2px;left:2px;z-index:4;font-size:11px;padding:3px 5px;background:#fff;color:#111;border:1px solid #555;border-radius:4px';
      cropBtn.addEventListener('pointerdown',e=>e.stopPropagation());
      cropBtn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();selectOnly();
        const image=items[i].img;if(!image?.width||!image?.height)return;
        const raw=prompt('Crop ONLY selected image. Enter percentage to keep centered (10–100). Example: 90', '90');
        if(raw===null)return;const pct=Number(raw);if(!Number.isFinite(pct)||pct<10||pct>100){alert('Enter a number from 10 to 100.');return;}
        const temp=document.createElement('canvas');temp.width=Math.max(1,Math.round(image.width*pct/100));temp.height=Math.max(1,Math.round(image.height*pct/100));
        temp.getContext('2d').drawImage(image,(image.width-temp.width)/2,(image.height-temp.height)/2,temp.width,temp.height,0,0,temp.width,temp.height);
        items[i].img=temp;renderLayoutPreview(canvas,items);renderLayoutEditor(editor,canvas,items,labelPrefix);
        const active=editor.querySelector(`[data-i="${i}"]`);active?.focus();
      });d.appendChild(cropBtn);
      editor.appendChild(d);
      d.addEventListener("pointerdown",e=>{
        if(e.target.classList.contains("layout-resize"))return;
        e.preventDefault();selectOnly();const idx=i,base={...items[idx]},sx=e.clientX,sy=e.clientY,rect=canvas.getBoundingClientRect();
        const move=ev=>{items[idx].x=clamp(base.x+(ev.clientX-sx)/rect.width,0,1-base.w);items[idx].y=clamp(base.y+(ev.clientY-sy)/rect.height,0,1-base.h);updateLayoutDom(d,items[idx]);renderLayoutPreview(canvas,items);};
        const up=()=>{document.removeEventListener("pointermove",move);document.removeEventListener("pointerup",up);};document.addEventListener("pointermove",move);document.addEventListener("pointerup",up);
      });
      d.querySelectorAll(".layout-resize").forEach(h=>h.addEventListener("pointerdown",e=>{
        e.preventDefault();e.stopPropagation();selectOnly();const idx=i,base={...items[idx]},sx=e.clientX,sy=e.clientY,rect=canvas.getBoundingClientRect(),handle=h.dataset.handle,ratio=base.ratio||1;
        const move=ev=>{
          const dx=(ev.clientX-sx)/rect.width, dy=(ev.clientY-sy)/rect.height;
          // Proportional resize: every corner scales the image uniformly so it never stretches or squashes.
          const anchorX=handle.includes("w") ? base.x+base.w : base.x;
          const anchorY=handle.includes("n") ? base.y+base.h : base.y;
          const wantedW=handle.includes("w") ? anchorX-(base.x+dx) : (base.x+base.w+dx)-anchorX;
          const wantedH=handle.includes("n") ? anchorY-(base.y+dy) : (base.y+base.h+dy)-anchorY;
          let nw=Math.max(.025, Math.max(wantedW, wantedH*ratio));
          let nh=nw/ratio;
          const maxW=handle.includes("w") ? anchorX : 1-anchorX;
          const maxH=handle.includes("n") ? anchorY : 1-anchorY;
          nw=Math.min(nw,maxW,maxH*ratio);
          nh=nw/ratio;
          const nx=handle.includes("w") ? anchorX-nw : anchorX;
          const ny=handle.includes("n") ? anchorY-nh : anchorY;
          items[idx]={...items[idx],x:clamp(nx,0,1-nw),y:clamp(ny,0,1-nh),w:nw,h:nh};
          updateLayoutDom(d,items[idx]);
          renderLayoutPreview(canvas,items);
        };
        const up=()=>{document.removeEventListener("pointermove",move);document.removeEventListener("pointerup",up);};document.addEventListener("pointermove",move);document.addEventListener("pointerup",up);
      }));
    });
  }
  function buildFromLayout(canvas,items,W,H){canvas.width=W;canvas.height=H;renderLayoutPreview(canvas,items);return canvas;}

  window.shopStudioRemoveLayoutItem=function(kind,index){
    const isCard=kind==='cards',items=isCard?state.cardSheetLayout:state.printLayout;
    if(!items||!Number.isInteger(index)||index<0||index>=items.length)return false;
    items.splice(index,1);
    const canvas=el(isCard?'cardCanvas':'printCanvas'),editor=el(isCard?'cardSheetEditor':'printEditor');
    if(canvas&&editor){renderLayoutPreview(canvas,items);renderLayoutEditor(editor,canvas,items,isCard?'CARD':'IMG');}
    if(isCard){window.shopCardGroupData=items;window.shopCardGroup?.refresh();}
    return true;
  };
  // ---------- PRINT STUDIO ----------
  ensureEditor("printEditor","printCanvas") || ensureEditor("printEditor","printCanvas") || ensureEditor("printEditor","printCanvas");
  // The editor must be a sibling overlay, not a child of canvas; move it to the canvas-wrap host if necessary.
  (function fixPrintEditorHost(){const ed=el("printEditor"),c=el("printCanvas");if(ed&&c&&ed.parentElement!==c.parentElement)c.parentElement.appendChild(ed);})();
  state.printLayout=[];
  function rebuildPrintLayout(){
    if(!state.printImages.length)return;const paper=el("printPaper").value,ori=el("printOrientation").value,count=+$('printCount').value,margin=+$('printMargin').value||6,gap=+$('printGap')?.value||3;const dpi=+$('printDpi')?.value||300;const model=makeLayoutItems(state.printImages,"grid",paper,ori,count,margin,gap,dpi);state.printLayout=model.items;buildFromLayout(el("printCanvas"),state.printLayout,model.W,model.H);hide("printEmpty");renderLayoutEditor(el("printEditor"),el("printCanvas"),state.printLayout,"IMG");setStatus("printStatus","Drag any image to arrange • drag a corner handle to resize. Export uses the current arrangement.");}
  el("printInput").onchange=async e=>{state.printImages=[];for(const f of [...e.target.files]){try{state.printImages.push(await fileToImage(f));}catch{}};if(state.printImages.length)rebuildPrintLayout();else clearPrint();};
  const printControls=el("print")?.querySelector(".compact-controls");if(printControls&&!el("printGap")){const lab=document.createElement("label");lab.innerHTML='Photo Gap (mm)<input id="printGap" type="number" min="0" max="30" step="0.5" value="5">';printControls.appendChild(lab);}
  if(printControls&&!el("printDpi")){const lab=document.createElement("label");lab.innerHTML='Output DPI<select id="printDpi"><option value="300" selected>300 • Print</option><option value="600">600 • Maximum</option></select>';printControls.appendChild(lab);}
  ["printCount","printPaper","printOrientation","printMargin","printGap","printDpi"].forEach(id=>el(id)?.addEventListener("input",()=>{if(state.printImages.length)rebuildPrintLayout();}));
  el("buildPrintSheet").onclick=()=>{if(!state.printImages.length)return alert("Upload images.");rebuildPrintLayout();addHistory("Print Studio","Built editable collage",`${state.printLayout.length} images`);};
  el("downloadPrintSheet").onclick=()=>{if(!el("printCanvas").width||!state.printLayout.length)return;buildFromLayout(el("printCanvas"),state.printLayout,el("printCanvas").width,el("printCanvas").height);exportPNG(el("printCanvas"),"print-studio-sheet");};
  el("browserPrint").onclick=()=>{if(!el("printCanvas").width)return;const url=el("printCanvas").toDataURL("image/png"),w=window.open("");if(w){w.document.write(`<img src="${url}" style="max-width:100%;width:100%"><script>onload=()=>print()<\\/script>`);}};

  // ---------- SMART CARD SHEET EDITOR ----------
  function ensureCardSheetEditor(){const c=el("cardCanvas");if(!c)return;const host=c.parentElement;if(!el("cardSheetEditor")){const d=document.createElement("div");d.id="cardSheetEditor";d.className="layout-editor";host.appendChild(d);}}
  ensureCardSheetEditor();state.cardSheetLayout=[];
  function rebuildCardSheet(){
    const front=state.cardFrontCrop,back=state.cardBackCrop;
    if(!front&&!back){setStatus("cardStatus","Save Front and/or Back first.");return;}
    const paper=el("cardPaper").value,layout=el("cardLayout").value,dpi=+$('cardPrintDpi')?.value||300;
    const W=paper==="a4"?mmToPx(210,dpi):mmToPx(152.4,dpi),H=paper==="a4"?mmToPx(297,dpi):mmToPx(101.6,dpi);
    const dims=state.cardSavedDimensions||{};
    const referencePair=layout==='reference-pair';
    const imgs=[];
    if(referencePair){
      // Reference is approximately 7 × 2.4 inches overall; 4 mm between two equal cards.
      // Back-left/front-right, each 86.9 × 60.96 mm, combined 177.8 mm wide.
      if(front)imgs.push({img:front,mm:[86.9,60.96]});
      if(back)imgs.push({img:back,mm:[86.9,60.96]});
    }else{
      if(front)imgs.push({img:front,mm:dims.front||[85.6,54]});
      if(back)imgs.push({img:back,mm:dims.back||[85.6,54]});
    }
    const margin=mmToPx(Number(el('cardPrintMargin')?.value??8),dpi),gap=mmToPx(referencePair?4:Number(el('cardPrintGap')?.value??7),dpi);
    const maxWidth=Math.max(1,W-2*margin),maxHeight=Math.max(1,H-2*margin);
    const sizes=imgs.map(x=>{const rawW=mmToPx(x.mm[0],dpi),rawH=mmToPx(x.mm[1],dpi),f=Math.min(1,maxWidth/rawW,maxHeight/rawH);return {img:x.img,w:rawW*f,h:rawH*f}});
    let sideBySide=['side-by-side','aadhaar-pair','reference-pair'].includes(layout)&&sizes.length>1;
    if(sideBySide&&(sizes.reduce((t,i)=>t+i.w,0)+gap>maxWidth||sizes.some(x=>x.h>maxHeight)))sideBySide=false;
    const total=sideBySide?sizes.reduce((t,i)=>t+i.w,0)+gap*(sizes.length-1):sizes.reduce((t,i)=>t+i.h,0)+gap*(sizes.length-1);
    const limit=sideBySide?maxWidth:maxHeight, shrink=Math.min(1,limit/Math.max(1,total));
    const items=[];
    const extent=total*shrink;
    let cursor=referencePair?margin:(sideBySide?W:H)/2-extent/2;
    for(const obj of sizes){
      const w=obj.w*shrink,h=obj.h*shrink,x=sideBySide?cursor:(W-w)/2,y=sideBySide?(referencePair?margin:(H-h)/2):cursor;
      items.push({img:obj.img,x:x/W,y:y/H,w:w/W,h:h/H,ratio:w/h});
      cursor+=(sideBySide?w:h)+gap*shrink;
    }
    state.cardSheetLayout=items;
    window.shopCardGroupData=items;
    buildFromLayout(el("cardCanvas"),items,W,H);hide("cardEmpty");
    renderLayoutEditor(el("cardSheetEditor"),el("cardCanvas"),items,"CARD");
    window.shopCardGroup?.refresh();
    setStatus("cardStatus",referencePair?'Reference pair placed at the TOP of A4: front left, back right, small gap. Print at 100% scale.':sideBySide?'Print-size cards placed side by side. Drag to rearrange.':'Print-size cards placed on the sheet. Drag to rearrange.');
  }
  el("buildCardSheet").onclick=()=>{rebuildCardSheet();addHistory("Smart Card","Built editable card sheet",el("cardLayout").value);};
  el("downloadCardSheet").onclick=()=>{if(!state.cardSheetLayout.length)return rebuildCardSheet();buildFromLayout(el("cardCanvas"),state.cardSheetLayout,el("cardCanvas").width,el("cardCanvas").height);exportPNG(el("cardCanvas"),"smart-card-sheet");};
  if(!el("cardPrintDpi")){const g=qsa("#cards .control-group").find(x=>/Print Sheet/i.test(x.querySelector("h4")?.textContent||""));if(g){const l=document.createElement("label");l.innerHTML='Print DPI<select id="cardPrintDpi"><option value="300">300 • Print</option><option value="600" selected>600 • Maximum</option></select>';g.insertBefore(l,g.querySelector("label"));}}

  // ---------- CLEAR / SOURCE EVENTS ----------
  el("clearDetectedCards")?.addEventListener("click",()=>{state.detectedCards=[];el("detectedCardsGrid").innerHTML="";el("detectedCardsPanel").hidden=true;});
  el("downloadScanImage").onclick=()=>{if(!el("scanCanvas").width)return;exportPNG(el("scanCanvas"),"scanned-document");addHistory("Scanner","Downloaded lossless PNG");};
  el("exportScanPdf").onclick=async()=>{if(!state.scanPages.length)return alert("Add at least one scanned page.");const pdf=await PDFLib.PDFDocument.create();for(const p of state.scanPages){const tmp=document.createElement("canvas");tmp.width=p.img.width;tmp.height=p.img.height;tmp.getContext("2d").drawImage(p.img,0,0);const bytes=await(await canvasToBlob(tmp,"image/png",1)).arrayBuffer();const png=await pdf.embedPng(bytes);const page=pdf.addPage([png.width,png.height]);page.drawImage(png,{x:0,y:0,width:png.width,height:png.height});}downloadBytes(await pdf.save({useObjectStreams:false}),"scanned-pages-lossless.pdf","application/pdf");addHistory("Scanner","Exported lossless PDF",`${state.scanPages.length} pages`);};

  // Hide crop overlays whenever source changes or a section is cleared.
  window.addEventListener("resize",()=>{try{renderScanPerspectiveOverlay();renderCardPerspectiveOverlay();renderCardFreeCrop();if(state.printLayout.length)renderLayoutEditor(el("printEditor"),el("printCanvas"),state.printLayout,"IMG");if(state.cardSheetLayout.length){renderLayoutEditor(el("cardSheetEditor"),el("cardCanvas"),state.cardSheetLayout,"CARD");window.shopCardGroup?.refresh();}}catch{}});

  // Version marker.
  document.title="Shop Studio Pro v10.4";
  const meta=document.querySelector('meta[name="shop-build"]');if(meta)meta.content="10.4.0";
  const bs=document.querySelector(".brand-subtitle");if(bs)bs.textContent="PRO TOOLKIT • V10.4";
  const bd=document.querySelector('.brand-subtitle + div');if(bd)bd.textContent="BUILD 10.4.0";
  v3.ready=true;
})();
/* v10.3 header cleanup */
(function(){
  ["scanner","photo","cards","print"].forEach(sec=>{
    const s=document.getElementById(sec),b=document.getElementById(sec==="scanner"?"clearScannerBtn":sec==="photo"?"clearPhotoBtn":sec==="cards"?"clearCardsBtn":"clearPrintBtn");
    if(!s||!b)return;const head=s.querySelector(".workspace-head");if(!head)return;let row=head.querySelector(".button-row");if(!row){row=document.createElement("div");row.className="button-row";head.appendChild(row);}row.appendChild(b);
  });
})();
/* v10.3 lossless PDF -> image export */
(function(){
  const btn=document.getElementById("pdfToImageBtn");
  if(!btn)return;
  btn.onclick=async()=>{
    const f=document.getElementById("pdfToImageInput").files[0];if(!f)return alert("Choose a PDF first.");
    try{const mod=await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs"),pdf=await mod.getDocument({data:new Uint8Array(await f.arrayBuffer())}).promise;
      for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),vp=page.getViewport({scale:3}),c=document.createElement("canvas"),ctx=c.getContext("2d");c.width=Math.round(vp.width);c.height=Math.round(vp.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";await page.render({canvasContext:ctx,viewport:vp}).promise;await new Promise(r=>setTimeout(r,60));exportPNG(c,`page-${String(i).padStart(2,"0")}`);}
      addHistory("PDF Tools","PDF to lossless PNG images",`${pdf.numPages} pages`);
    }catch(e){console.error(e);alert("PDF conversion failed. Please try again.");}
  };
})();
/* v10.3 auto-open editable card layout whenever Front/Back crops become available */
(function(){
  const originalSave=document.getElementById("saveCardCrop");
  if(originalSave){
    const old=originalSave.onclick;
    originalSave.onclick=async function(e){await old.call(this,e);if(state.cardFrontCrop||state.cardBackCrop)try{document.getElementById("buildCardSheet")?.click();}catch{} };
  }
})();

/* SHOP STUDIO PRO v10.5 — ROBUST IMAGE UPLOAD / DROP PATCH
   Fixes file-input reliability, same-file reselect, large-image decode errors,
   drag & drop into workspaces, and stale v10.4 event handlers. */
(function(){
  const E=id=>document.getElementById(id);
  const safe=(fn)=>Promise.resolve().then(fn).catch(err=>{console.error("Shop Studio upload:",err);});

  async function loadImageFile(file){
    if(!file) throw new Error("No file selected.");
    if(!file.type || !file.type.startsWith("image/")) throw new Error(`Unsupported image type: ${file.type||"unknown"}`);
    try { return await fileToImage(file); }
    catch(first){
      // Fallback for browsers that fail object-URL decoding on large/local files.
      return await new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.onerror=()=>reject(first);
        reader.onload=()=>{
          const img=new Image();
          img.onload=()=>resolve(img);
          img.onerror=()=>reject(first);
          img.src=reader.result;
        };
        reader.readAsDataURL(file);
      });
    }
  }

  function resetInput(input){ try{ input.value=""; }catch{} }

  function replaceInput(id, handler){
    const old=E(id); if(!old) return null;
    const input=old.cloneNode(true);
    old.replaceWith(input);
    const label=input.closest("label");
    if(label){
      label.setAttribute("for",id);
      label.addEventListener("click",ev=>{
        if(ev.target===input)return;
        ev.preventDefault(); input.click();
      });
    }
    input.addEventListener("change",async ev=>{
      const files=[...ev.target.files];
      if(!files.length)return;
      try{ await handler(files,ev); }
      catch(err){
        console.error(err);
        const status=E(id.replace("Input","Status"));
        if(status)status.textContent=`Upload failed • ${err.message||"Please choose a JPG/PNG/WebP image."}`;
        else alert(`Could not load image. ${err.message||"Please choose a JPG, PNG or WebP file."}`);
      }finally{ resetInput(input); }
    });
    return input;
  }

  // Remove the older v10.4 listeners by replacing the inputs, then install one
  // reliable handler per image workflow.
  replaceInput("scanInput",async files=>{
    state.scanPages=[];
    for(const f of files){
      const img=await loadImageFile(f);
      state.scanPages.push({img,name:f.name});
    }
    state.scanImg=state.scanPages[0]?.img||null;
    if(state.scanImg){
      drawScan(); renderScanThumbs();
      const n=E("scanStatus"); if(n)n.textContent=`${state.scanPages.length} image${state.scanPages.length>1?"s":""} loaded • ${state.scanImg.width} × ${state.scanImg.height}px`;
      addHistory("Scanner","Imported images",`${state.scanPages.length} image(s)`);
    }
  });

  replaceInput("photoInput",async files=>{
    const f=files[0],img=await loadImageFile(f);
    state.photoImg=img;state.photoOriginal=img;
    drawPhoto();initPhotoCrop();
    const n=E("photoAiStatus");if(n)n.textContent=`Loaded • ${img.width} × ${img.height}px`;
    addHistory("Photo Studio","Opened photo",f.name);
  });

  replaceInput("bulkPhotoInput",async files=>{
    state.bulkPhotos=[];
    for(const f of files){try{state.bulkPhotos.push({name:f.name,img:await loadImageFile(f)});}catch(err){console.warn("Skipping",f.name,err);}}
    const n=E("photoAiStatus");if(n)n.textContent=state.bulkPhotos.length?`${state.bulkPhotos.length} bulk photo(s) ready.`:"No compatible images selected.";
  });

  replaceInput("cardImageInput",async files=>{
    const f=files[0],img=await loadImageFile(f);
    state.cardSourceImg=img;state.cardSourceType="image";
    const c=E("cardSourceCanvas"),ctx=c.getContext("2d");
    c.width=img.width;c.height=img.height;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.drawImage(img,0,0);
    E("cardSourceEmpty").style.display="none";
    E("cardPageLabel").textContent=`${f.name} • ${img.width}×${img.height}`;
    // Smart Card v19 controls sizing through its own fitted canvas viewport.
    enableCardPerspective();
    try{ if(typeof rememberCardSource==="function")rememberCardSource(); }catch{}
  });

  replaceInput("resizeInput",async files=>{
    const f=files[0];state.resizeImg=await loadImageFile(f);drawResizePreview();
  });

  replaceInput("printInput",async files=>{
    state.printImages=[];
    for(const f of files){try{state.printImages.push(await loadImageFile(f));}catch(err){console.warn("Skipping",f.name,err);}}
    if(state.printImages.length){
      if(typeof rebuildPrintLayout==="function")rebuildPrintLayout();
      else E("printEmpty")?.style.setProperty("display","none");
      E("printStatus")&&(E("printStatus").textContent=`${state.printImages.length} image(s) loaded • drag to arrange.`);
    }else { state.printImages=[];state.printLayout=[]; const c=E("printCanvas"); if(c){c.width=1;c.height=1;} E("printEmpty")?.style.removeProperty("display"); E("printStatus")&&(E("printStatus").textContent="No compatible images selected."); }
  });

  replaceInput("compressInput",async files=>{
    const f=files[0];state.compressFile=f;
    const n=E("compressStatus");if(n)n.textContent=`Selected: ${f.name} • ${(f.size/1024).toFixed(1)} KB`;
  });

  replaceInput("ocrInput",async files=>{
    state.ocrFile=files[0];
    const n=E("ocrStatus");if(n)n.textContent=`Loaded • ${files[0].name}`;
  });

  // Reliable drop support for the major image workspaces.
  function makeDrop(stageId,inputId,label){
    const stage=E(stageId),input=E(inputId);if(!stage||!input)return;
    stage.classList.add("upload-drop-ready");
    const hint=document.createElement("div");hint.className="drop-hint";hint.textContent=`Drop ${label} here or use Upload`;
    stage.appendChild(hint);
    ["dragenter","dragover"].forEach(type=>stage.addEventListener(type,e=>{e.preventDefault();e.stopPropagation();stage.classList.add("drag-over");}));
    ["dragleave","drop"].forEach(type=>stage.addEventListener(type,e=>{e.preventDefault();e.stopPropagation();stage.classList.remove("drag-over");}));
    stage.addEventListener("drop",e=>{
      const files=[...e.dataTransfer.files].filter(f=>f.type.startsWith("image/"));
      if(!files.length)return;
      const dt=new DataTransfer();files.forEach(f=>dt.items.add(f));input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));
    });
  }
  makeDrop("scanCropStage","scanInput","document images");
  makeDrop("photoCanvasWrap","photoInput","a photo");
  makeDrop("cardPerspectiveStage","cardImageInput","a card/document image");
  makeDrop("printCanvasWrap","printInput","images");

  // Prevent stale browser/service-worker code from hiding the fact that a file was loaded.
  window.ShopStudioUploadReady=true;
})();

/* SHOP STUDIO PRO v10.7 — precision workspace, PDF export/editor, filenames and navigation polish */
(function(){
  const $id=id=>document.getElementById(id);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function dateSerial(){
    const d=new Date(), day=d.toISOString().slice(0,10).replace(/-/g,'');
    let n=Number(localStorage.getItem('shopstudio_serial_'+day)||0)+1;
    localStorage.setItem('shopstudio_serial_'+day,String(n));
    return `${day}-${String(n).padStart(3,'0')}`;
  }
  function cleanName(s){return String(s||'file').replace(/[^a-z0-9._-]+/gi,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')||'file';}
  window.shopStudioFilename=(base,ext)=>`${cleanName(base)}-${dateSerial()}.${ext}`;

  // Higher workspace zoom for pin-point cropping.
  ['scanZoom','photoZoom','cardZoom'].forEach(id=>{
    const n=$id(id); if(n){n.max=400;n.title='Workspace zoom — use 200–400% for precise corner placement';}
  });

  // Move crop rectangles/polygons without changing their shape.
  function makeBoxMovable(box, getRect, setRect, boundsEl){
    if(!box||box.dataset.moveReady)return; box.dataset.moveReady='1';
    box.addEventListener('pointerdown',e=>{
      if(e.target.closest('.crop-handle,.card-point,.scan-point'))return;
      e.preventDefault();
      const start={x:e.clientX,y:e.clientY,r:{...getRect()}}; const br=boundsEl.getBoundingClientRect();
      box.setPointerCapture?.(e.pointerId);
      const move=ev=>{const dx=(ev.clientX-start.x)/br.width,dy=(ev.clientY-start.y)/br.height;const r=start.r;setRect({...r,x:clamp(r.x+dx,0,1-r.w),y:clamp(r.y+dy,0,1-r.h)});};
      const up=()=>{box.removeEventListener('pointermove',move);box.removeEventListener('pointerup',up);};box.addEventListener('pointermove',move);box.addEventListener('pointerup',up);
    });
  }
  function makePerspectiveMovable(layer, getPts, setPts, boundsEl){
    if(!layer||layer.dataset.moveReady)return;layer.dataset.moveReady='1';
    layer.addEventListener('pointerdown',e=>{
      if(e.target.closest('.card-point,.scan-point,svg'))return;
      e.preventDefault(); const start={x:e.clientX,y:e.clientY,pts:getPts().map(p=>({...p}))};const br=boundsEl.getBoundingClientRect();
      const move=ev=>{const dx=(ev.clientX-start.x)/br.width,dy=(ev.clientY-start.y)/br.height;setPts(start.pts.map(p=>({x:clamp(p.x+dx,0,1),y:clamp(p.y+dy,0,1)})));};
      const up=()=>{layer.removeEventListener('pointermove',move);layer.removeEventListener('pointerup',up);};layer.addEventListener('pointermove',move);layer.addEventListener('pointerup',up);
    });
  }
  document.addEventListener('pointerdown',e=>{
    const box=e.target.closest('#cardFreeCropBox');
    if(!box||e.target.closest('.crop-handle'))return;
    const canvas=$id('cardSourceCanvas'); if(!canvas||!state.cardFreeCrop)return; e.preventDefault();
    const start={x:e.clientX,y:e.clientY,r:{...state.cardFreeCrop}},br=canvas.getBoundingClientRect();
    const move=ev=>{const dx=(ev.clientX-start.x)/br.width,dy=(ev.clientY-start.y)/br.height;state.cardFreeCrop={...start.r,x:clamp(start.r.x+dx,0,1-start.r.w),y:clamp(start.r.y+dy,0,1-start.r.h)};if(typeof renderCardFreeCrop==='function')renderCardFreeCrop();};
    const up=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);};document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);
  },true);

  // Card perspective layer movement.
  const cLayer=$id('cardPerspectiveLayer'), cCanvas=$id('cardSourceCanvas');
  if(cLayer&&cCanvas){makePerspectiveMovable(cLayer,()=>state.cardPerspectivePts||[],pts=>{state.cardPerspectivePts=pts; if(typeof renderCardPerspectiveOverlay==='function')renderCardPerspectiveOverlay();},cCanvas);}
  // Free crop movement.
  const freeBox=$id('cardFreeCropBox');
  if(freeBox&&cCanvas){makeBoxMovable(freeBox,()=>state.cardFreeCrop||{x:0,y:0,w:1,h:1},r=>{state.cardFreeCrop=r; if(typeof renderCardFreeCrop==='function')renderCardFreeCrop();},cCanvas);}
  const photoBox=$id('photoCropBox'), photoCanvas=$id('photoCanvas');
  if(photoBox&&photoCanvas){makeBoxMovable(photoBox,()=>state.photoCrop||{x:.1,y:.1,w:.8,h:.8},r=>{state.photoCrop=r; if(typeof renderPhotoCrop==='function')renderPhotoCrop();},photoCanvas);}
  // Scanner perspective movement: drag the polygon area to move all four points.
  const scanLayer=$id('scanCropLayer'),scanCanvas=$id('scanCanvas');
  if(scanLayer&&scanCanvas){makePerspectiveMovable(scanLayer,()=>state.scanCropPts||[],pts=>{state.scanCropPts=pts; if(typeof renderScanPerspectiveOverlay==='function')renderScanPerspectiveOverlay();},scanCanvas);}

  // Print Sheet PDF export — preserves current arrangement at the selected DPI.
  async function canvasToPdf(canvas,paper,dpi,name){
    if(!canvas?.width||!window.PDFLib)return;
    const pdf=await PDFLib.PDFDocument.create();
    const bytes=await new Promise(r=>canvas.toBlob(async b=>r(await b.arrayBuffer()),'image/png'));
    const img=await pdf.embedPng(bytes);
    const base=paper==='a4'?[595.2756,841.8898]:[432,288];
    const landscape=canvas.width>canvas.height;
    const size=landscape?[Math.max(base[0],base[1]),Math.min(base[0],base[1])]:[Math.min(base[0],base[1]),Math.max(base[0],base[1])];
    pdf.addPage(size).drawImage(img,{x:0,y:0,width:size[0],height:size[1]});
    const out=await pdf.save({useObjectStreams:false});
    downloadBytes(out,window.shopStudioFilename(name,'pdf'),'application/pdf');
  }
  const pPdf=$id('downloadPrintSheetPdf');
  if(pPdf)pPdf.onclick=async()=>{if(!$id('printCanvas')?.width||!state.printLayout?.length){if(typeof rebuildPrintLayout==='function')rebuildPrintLayout();}const c=$id('printCanvas');if(c?.width)await canvasToPdf(c,$id('printPaper').value,$id('printDpi')?.value||300,'print-studio-sheet');};
  const cPdf=$id('downloadCardSheetPdf');
  if(cPdf)cPdf.onclick=async()=>{if(!state.cardSheetLayout?.length&&typeof rebuildCardSheet==='function')rebuildCardSheet();const c=$id('cardCanvas');if(c?.width)await canvasToPdf(c,$id('cardPaper').value,$id('cardPrintDpi')?.value||600,'smart-card-sheet');};

  // -------- PDF text + image layer editor --------
  const pdfState={pdf:null,bytes:null,page:1,scale:1.8,items:[],imageFile:null,imageBytes:null};
  async function loadEditPdf(file){
    pdfState.bytes=new Uint8Array(await file.arrayBuffer());
    const mod=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
    mod.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
    pdfState.pdf=await mod.getDocument({data:pdfState.bytes}).promise;pdfState.page=1;pdfState.items=[];await renderEditPdfPage();
  }
  async function renderEditPdfPage(){
    const c=$id('pdfEditCanvas'),empty=$id('pdfEditEmpty');if(!c||!pdfState.pdf)return;
    const page=await pdfState.pdf.getPage(pdfState.page),vp=page.getViewport({scale:pdfState.scale});c.width=Math.round(vp.width);c.height=Math.round(vp.height);await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;empty.style.display='none';$id('pdfEditPage').value=pdfState.page;$id('pdfEditStatus').textContent=`Page ${pdfState.page} of ${pdfState.pdf.numPages} • add text/images, then export.`;
  }
  $id('pdfEditInput')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{await loadEditPdf(f);}catch(err){console.error(err);$id('pdfEditStatus').textContent='Could not open this PDF.';}});
  $id('pdfEditPrev')?.addEventListener('click',async()=>{if(pdfState.pdf&&pdfState.page>1){pdfState.page--;await renderEditPdfPage();}});
  $id('pdfEditNext')?.addEventListener('click',async()=>{if(pdfState.pdf&&pdfState.page<pdfState.pdf.numPages){pdfState.page++;await renderEditPdfPage();}});
  $id('pdfEditPage')?.addEventListener('change',async e=>{if(pdfState.pdf){pdfState.page=clamp(Number(e.target.value)||1,1,pdfState.pdf.numPages);await renderEditPdfPage();}});
  $id('pdfEditImage')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(f)pdfState.imageFile=f;});
  $id('pdfAddText')?.addEventListener('click',()=>{const text=$id('pdfEditText').value.trim();if(!text)return;$id('pdfEditStatus').textContent=`Text layer ready: “${text}” • click Export Edited PDF to apply.`;pdfState.items.push({type:'text',page:pdfState.page,text,x:Number($id('pdfEditX').value)||40,y:Number($id('pdfEditY').value)||40,size:Number($id('pdfEditFontSize').value)||16});});
  $id('pdfAddImage')?.addEventListener('click',async()=>{if(!pdfState.imageFile){$id('pdfEditStatus').textContent='Choose an image first.';return;}pdfState.imageBytes=new Uint8Array(await pdfState.imageFile.arrayBuffer());pdfState.items.push({type:'image',page:pdfState.page,bytes:pdfState.imageBytes,x:Number($id('pdfEditX').value)||40,y:Number($id('pdfEditY').value)||40,w:Number($id('pdfEditImageW').value)||180,h:Number($id('pdfEditImageH').value)||100});$id('pdfEditStatus').textContent='Image layer added • click Export Edited PDF to apply.';});
  $id('pdfEditExport')?.addEventListener('click',async()=>{if(!pdfState.bytes||!window.PDFLib){$id('pdfEditStatus').textContent='Open a PDF first.';return;}try{const doc=await PDFLib.PDFDocument.load(pdfState.bytes);const font=await doc.embedFont(PDFLib.StandardFonts.Helvetica);for(const it of pdfState.items){const page=doc.getPage(it.page-1);if(it.type==='text')page.drawText(it.text,{x:it.x,y:page.getHeight()-it.y-it.size,size:it.size,font,color:PDFLib.rgb(0,0,0)});else{let im;try{im=await doc.embedPng(it.bytes);}catch{im=await doc.embedJpg(it.bytes);}page.drawImage(im,{x:it.x,y:page.getHeight()-it.y-it.h,width:it.w,height:it.h});}}const out=await doc.save({useObjectStreams:false});downloadBytes(out,window.shopStudioFilename('edited-pdf','pdf'),'application/pdf');$id('pdfEditStatus').textContent=`Exported edited PDF • ${pdfState.items.length} layer(s) applied.`;}catch(err){console.error(err);$id('pdfEditStatus').textContent='PDF export failed. Original PDF remains unchanged.';}});

  // Keep navigation useful: card-style navigation, while removing the large dashboard tool-card wall.
  document.title='Shop Studio Pro v10.7';
  const meta=document.querySelector('meta[name="shop-build"]');if(meta)meta.content='10.7.0';
  const bs=document.querySelector('.brand-subtitle');if(bs)bs.textContent='PRO TOOLKIT • V10.7';
})();

/* SHOP STUDIO PRO v10.8 — SMART CARD CROP REBUILD + ORIGINAL PDF EDIT */
(function(){
  const $=id=>document.getElementById(id), qs=s=>document.querySelector(s), qsa=s=>[...document.querySelectorAll(s)];
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const status=(msg)=>{const n=$("cardStatus");if(n)n.textContent=msg;};
  const hideEl=n=>{if(n)n.style.display="none"};
  const showEl=n=>{if(n)n.style.display="block"};
  const replace=(id)=>{const n=$(id);if(!n)return null;const c=n.cloneNode(true);n.replaceWith(c);return c;};

  // --- Smart Card: one clean, authoritative crop controller ---
  const cardStage=$("cardPerspectiveStage"), canvas=$("cardSourceCanvas");
  if(!cardStage||!canvas)return;
  let freeDrag=null, perspDrag=null, moving=false;
  function layerGeometry(layer){
    if(!layer||!canvas.width)return null;
    const cr=canvas.getBoundingClientRect(), sr=cardStage.getBoundingClientRect();
    layer.style.left=(cr.left-sr.left)+"px";layer.style.top=(cr.top-sr.top)+"px";layer.style.width=cr.width+"px";layer.style.height=cr.height+"px";return {cr,sr};
  }
  function ensureFreeLayer(){
    let layer=$("cardFreeCropLayer");
    if(layer) layer.remove();
    layer=document.createElement("div");layer.id="cardFreeCropLayer";layer.className="card-free-crop-layer";
    layer.innerHTML='<div id="cardFreeCropBox" class="crop-box flex-card-box"><span class="crop-handle nw" data-h="nw"></span><span class="crop-handle n" data-h="n"></span><span class="crop-handle ne" data-h="ne"></span><span class="crop-handle e" data-h="e"></span><span class="crop-handle se" data-h="se"></span><span class="crop-handle s" data-h="s"></span><span class="crop-handle sw" data-h="sw"></span><span class="crop-handle w" data-h="w"></span></div>';
    cardStage.appendChild(layer);return layer;
  }
  function renderFree(){
    const l=$("cardFreeCropLayer"),b=$("cardFreeCropBox");if(!l||!b)return;layerGeometry(l);l.style.display=state.cardFreeCrop?"block":"none";
    if(state.cardFreeCrop){const r=state.cardFreeCrop;b.style.left=(r.x*100)+"%";b.style.top=(r.y*100)+"%";b.style.width=(r.w*100)+"%";b.style.height=(r.h*100)+"%";}
  }
  function startFree(){
    if(!canvas.width)return status("Open a PDF page or image first.");
    state.cardPerspectiveMode=false;state.cardPerspectivePts=null;hideEl($("cardPerspectiveLayer"));
    state.cardFreeCrop={x:.08,y:.08,w:.84,h:.84};renderFree();status("Flexible Crop active • drag corners or the box to move it.");
  }
  function bindFree(){
    const l=ensureFreeLayer(),b=$("cardFreeCropBox");
    qsa("#cardFreeCropBox .crop-handle").forEach(h=>h.addEventListener("pointerdown",e=>{if(!state.cardFreeCrop)return;e.preventDefault();h.setPointerCapture(e.pointerId);freeDrag={type:"resize",sx:e.clientX,sy:e.clientY,start:{...state.cardFreeCrop},handle:h.dataset.h};}));
    b.addEventListener("pointerdown",e=>{if(!state.cardFreeCrop||e.target.classList.contains("crop-handle"))return;e.preventDefault();b.setPointerCapture(e.pointerId);freeDrag={type:"move",sx:e.clientX,sy:e.clientY,start:{...state.cardFreeCrop}};});
    b.addEventListener("pointermove",e=>{
      if(!freeDrag)return;const cr=canvas.getBoundingClientRect(),dx=(e.clientX-freeDrag.sx)/cr.width,dy=(e.clientY-freeDrag.sy)/cr.height,s=freeDrag.start,n={...s};
      if(freeDrag.type==="move"){n.x=clamp(s.x+dx,0,1-s.w);n.y=clamp(s.y+dy,0,1-s.h);}
      else{const h=freeDrag.handle;if(h.includes("w")){const nx=clamp(s.x+dx,0,s.x+s.w-.03);n.w=s.w-(nx-s.x);n.x=nx;}if(h.includes("e"))n.w=clamp(s.w+dx,.03,1-s.x);if(h.includes("n")){const ny=clamp(s.y+dy,0,s.y+s.h-.03);n.h=s.h-(ny-s.y);n.y=ny;}if(h.includes("s"))n.h=clamp(s.h+dy,.03,1-s.y);}
      state.cardFreeCrop=n;renderFree();
    });
    b.addEventListener("pointerup",()=>freeDrag=null);b.addEventListener("pointercancel",()=>freeDrag=null);
  }
  bindFree();

  function bindButton(id,fn){const b=replace(id);if(b)b.addEventListener("click",fn);return b;}
  bindButton("cardFlexibleCropBtn",startFree);
  bindButton("applyCardFlexibleCrop",async()=>{
    if(!state.cardFreeCrop){startFree();return;}
    const r=state.cardFreeCrop,c=canvas,out=document.createElement("canvas");out.width=Math.max(1,Math.round(r.w*c.width));out.height=Math.max(1,Math.round(r.h*c.height));const ctx=out.getContext("2d");ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.drawImage(c,r.x*c.width,r.y*c.height,r.w*c.width,r.h*c.height,0,0,out.width,out.height);
    if(!state.cardSourceOriginal)state.cardSourceOriginal=canvasClone(c); c.width=out.width;c.height=out.height;c.getContext("2d").drawImage(out,0,0);state.cardFreeCrop=null;state.cardPerspectiveMode=false;state.cardPerspectivePts=null;hideEl($("cardFreeCropLayer"));hideEl($("cardPerspectiveLayer"));status(`Flexible crop applied • ${out.width} × ${out.height}px • overlay closed.`);
  });
  bindButton("manualCardPerspectiveBtn",()=>{
    if(!canvas.width)return status("Open a PDF page or image first.");state.cardFreeCrop=null;hideEl($("cardFreeCropLayer"));state.cardPerspectivePts=cardDefaultPoints(canvas);state.cardPerspectiveMode=true;renderCardPerspectiveOverlay();status("4-Point Perspective active • drag corners or drag inside the polygon to move it.");
  });
  bindButton("resetCardCrop",()=>{if(canvas.width){state.cardFreeCrop=null;hideEl($("cardFreeCropLayer"));state.cardPerspectivePts=cardDefaultPoints(canvas);state.cardPerspectiveMode=true;renderCardPerspectiveOverlay();status("Crop reset to a centered PVC frame.");}});
  bindButton("moveCardCropBtn",()=>{if(state.cardPerspectiveMode)status("Drag inside the perspective polygon to move the entire crop.");else if(state.cardFreeCrop)status("Drag inside the flexible crop box to move the entire crop.");else status("Start Flexible Crop or 4-Point Perspective first.");});

  // Rebuild perspective handles and allow moving the entire polygon without changing shape.
  const pl=$("cardPerspectiveLayer");
  if(pl){
    const clean=pl.cloneNode(true);pl.replaceWith(clean);
    const layer=$("cardPerspectiveLayer"),poly=$("cardPerspectivePolygon");
    function render(){layerGeometry(layer);layer.style.display=state.cardPerspectiveMode?"block":"none";if(!state.cardPerspectiveMode||!state.cardPerspectivePts)return;poly.setAttribute("points",state.cardPerspectivePts.map(p=>`${p.x*100},${p.y*100}`).join(" "));qsa("#cardPerspectiveLayer .card-point").forEach((el,i)=>{el.style.left=(state.cardPerspectivePts[i].x*100)+"%";el.style.top=(state.cardPerspectivePts[i].y*100)+"%";});}
    renderCardPerspectiveOverlay=render;
    qsa("#cardPerspectiveLayer .card-point").forEach(pt=>pt.addEventListener("pointerdown",e=>{if(!state.cardPerspectiveMode)return;e.preventDefault();pt.setPointerCapture(e.pointerId);perspDrag={type:"point",idx:+pt.dataset.point,sx:e.clientX,sy:e.clientY,start:state.cardPerspectivePts.map(p=>({...p}))};}));
    layer.addEventListener("pointerdown",e=>{if(!state.cardPerspectiveMode||e.target.classList.contains("card-point"))return;e.preventDefault();layer.setPointerCapture(e.pointerId);perspDrag={type:"move",sx:e.clientX,sy:e.clientY,start:state.cardPerspectivePts.map(p=>({...p}))};});
    layer.addEventListener("pointermove",e=>{if(!perspDrag)return;const cr=canvas.getBoundingClientRect(),dx=(e.clientX-perspDrag.sx)/cr.width,dy=(e.clientY-perspDrag.sy)/cr.height;
      if(perspDrag.type==="move"){const minX=Math.min(...perspDrag.start.map(p=>p.x)),maxX=Math.max(...perspDrag.start.map(p=>p.x)),minY=Math.min(...perspDrag.start.map(p=>p.y)),maxY=Math.max(...perspDrag.start.map(p=>p.y));const ox=clamp(dx,-minX,1-maxX),oy=clamp(dy,-minY,1-maxY);state.cardPerspectivePts=perspDrag.start.map(p=>({x:p.x+ox,y:p.y+oy}));}
      else{const n=perspDrag.start.map(p=>({...p}));n[perspDrag.idx]={x:clamp(n[perspDrag.idx].x+dx),y:clamp(n[perspDrag.idx].y+dy)};state.cardPerspectivePts=n;}render();
    });
    layer.addEventListener("pointerup",()=>perspDrag=null);layer.addEventListener("pointercancel",()=>perspDrag=null);window.addEventListener("resize",render);
  }

  // Auto detect never blocks the operator with an alert; fallback is a usable full-frame/manual crop.
  bindButton("autoDetectCardBtn",async()=>{
    if(!canvas.width){status("Open a PDF page or image first.");return;}const b=$("autoDetectCardBtn");b.disabled=true;b.textContent="Detecting…";
    try{let pts=await bestDocumentPoints(canvas,true);if(!pts)pts=defaultCardQuad(canvas);setCardPerspectivePointsFromPixels(pts,canvas);status("Best document boundary selected • adjust corners if needed, then Apply & Save.");}
    catch(e){console.warn(e);state.cardPerspectivePts=defaultCardQuad(canvas);state.cardPerspectiveMode=true;renderCardPerspectiveOverlay();status("Auto detection used a safe manual frame • adjust the four corners.");}
    finally{b.disabled=false;b.textContent="Auto Detect Corners";}
  });
  bindButton("autoSplitCardsBtn",async()=>{
    if(!canvas.width){status("Open a PDF page or image first.");return;}const b=$("autoSplitCardsBtn");b.disabled=true;b.textContent="Finding…";
    try{let found=await detectCardQuadrilaterals(canvas,12);if(!found.length)found=detectCardByLongLines(canvas,12);if(!found.length){const p=await bestDocumentPoints(canvas,true);if(p)found=[{points:p,score:1}];}
      if(!found.length){found=[{points:[{x:0,y:0},{x:canvas.width,y:0},{x:canvas.width,y:canvas.height},{x:0,y:canvas.height}],score:.1}];status("No clear boundary found • using full image. Adjust manually.");}
      state.detectedCards=found;const grid=$("detectedCardsGrid"),panel=$("detectedCardsPanel");grid.innerHTML="";panel.hidden=false;
      for(let i=0;i<Math.min(found.length,8);i++){const crop=await perspectiveCardCanvas(canvas,found[i].points.map(p=>({x:p.x/canvas.width,y:p.y/canvas.height})),+$('cardExportDpi').value||600),wrap=document.createElement("div");wrap.className="detected-card";const cvw=document.createElement("canvas");wrap.appendChild(cvw);previewCardCanvasTo(cvw,crop);const actions=document.createElement("div");actions.className="detected-card-actions";for(const [txt,fn] of [["Set Front",()=>{state.cardFrontCrop=crop;previewCardCanvas("cardFrontPreview",crop)}],["Set Back",()=>{state.cardBackCrop=crop;previewCardCanvas("cardBackPreview",crop)}],["Use to Edit",()=>{setCardPerspectivePointsFromPixels(found[i].points,canvas);status(`Candidate ${i+1} loaded into the 4-point editor.`)}]]){const x=document.createElement("button");x.className="mini-btn";x.textContent=txt;x.onclick=fn;actions.appendChild(x);}wrap.appendChild(actions);grid.appendChild(wrap);}
      if(found.length>=2){state.cardFrontCrop=await perspectiveCardCanvas(canvas,found[0].points.map(p=>({x:p.x/canvas.width,y:p.y/canvas.height})),+$('cardExportDpi').value||600);state.cardBackCrop=await perspectiveCardCanvas(canvas,found[1].points.map(p=>({x:p.x/canvas.width,y:p.y/canvas.height})),$('cardExportDpi').value||600);previewCardCanvas("cardFrontPreview",state.cardFrontCrop);previewCardCanvas("cardBackPreview",state.cardBackCrop);}
      status(`${found.length} candidate document(s) found • choose Front/Back or Use to Edit.`);
    }catch(e){console.warn(e);status("Auto split could not find two clear boundaries • manual crop remains ready.");}finally{b.disabled=false;b.textContent="Find Front + Back";}
  });
  bindButton("saveCardCrop",async()=>{
    if(!canvas.width){status("Open a PDF page or image first.");return;}if(!state.cardPerspectiveMode||!state.cardPerspectivePts){state.cardPerspectivePts=defaultCardQuad(canvas);state.cardPerspectiveMode=true;renderCardPerspectiveOverlay();status("Perspective crop opened • adjust four corners, then click Apply & Save again.");return;}
    try{const dpi=+$('cardExportDpi').value||600,crop=await perspectiveCardCanvas(canvas,state.cardPerspectivePts,dpi),action=$("cardCropAction").value;if(action==="front")state.cardFrontCrop=crop;else state.cardBackCrop=crop;previewCardCanvas(action==="front"?"cardFrontPreview":"cardBackPreview",crop);state.cardPerspectiveMode=false;state.cardPerspectivePts=null;hideEl($("cardPerspectiveLayer"));status(`${action.toUpperCase()} crop saved • exact PVC 85.6 × 54 mm • ${crop.width} × ${crop.height}px.`);}
    catch(e){console.error(e);status("Perspective crop failed • original source preserved.");}
  });
  bindButton("exportCardCropImage",async()=>{try{const action=$("cardCropAction").value,dpi=+$('cardExportDpi').value||600;let crop=action==="front"?state.cardFrontCrop:state.cardBackCrop;if(state.cardPerspectiveMode&&state.cardPerspectivePts)crop=await perspectiveCardCanvas(canvas,state.cardPerspectivePts,dpi);if(!crop){status("Apply Front/Back crop first.");return;}downloadCanvas(crop,`pvc-${action}-${dpi}dpi`,$("cardOutputFormat").value||"image/png",1);status(`Exported ${action.toUpperCase()} • ${crop.width} × ${crop.height}px • lossless PNG.`);}catch(e){console.error(e);status("PVC export failed • source preserved.");}});

  // Re-render overlays correctly after zoom/resize.
  $("cardZoom")?.addEventListener("input",()=>{applyPreviewZoom("cardSourceCanvas","cardZoom","cardZoomValue",()=>{renderFree();renderCardPerspectiveOverlay();});});
  window.addEventListener("resize",()=>{renderFree();renderCardPerspectiveOverlay();});

  // --- Original PDF editing: add a practical cover/replace operation on the actual PDF page ---
  const pdfEditorToolbar=$("pdfEditExport")?.parentElement;
  if(pdfEditorToolbar && !$("pdfCoverExisting")){
    const b=document.createElement("button");b.id="pdfCoverExisting";b.className="mini-btn";b.textContent="Edit Existing Area";pdfEditorToolbar.insertBefore(b,$("pdfEditExport"));
  }
  // Replace the PDF editor export handler with support for cover + replacement text/image.
  const exp=$("pdfEditExport");if(exp){const clean=exp.cloneNode(true);exp.replaceWith(clean);clean.addEventListener("click",async()=>{
    if(!window.pdfStateForV108?.bytes && !window.__shopPdfState){/* use state exposed below */}
  });}
  // Reuse the existing editor state by exposing it when available; if not, add a safe second editor state.
  // Existing v10.7 closure is private, so we provide a parallel editor state that reads the same input.
  const pe={pdf:null,bytes:null,page:1,scale:2.5,items:[],imageFile:null};
  async function loadPdfForEdit(f){pe.bytes=new Uint8Array(await f.arrayBuffer());const mod=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');mod.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';pe.pdf=await mod.getDocument({data:pe.bytes}).promise;pe.page=1;pe.items=[];await renderPe();}
  async function renderPe(){const c=$("pdfEditCanvas"),empty=$("pdfEditEmpty");if(!c||!pe.pdf)return;const pg=await pe.pdf.getPage(pe.page),vp=pg.getViewport({scale:pe.scale});c.width=Math.round(vp.width);c.height=Math.round(vp.height);await pg.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;if(empty)empty.style.display="none";$("pdfEditPage").value=pe.page;$("pdfEditStatus").textContent=`Original PDF page ${pe.page}/${pe.pdf.numPages} • add text/image or cover existing content.`;}
  const inp=$("pdfEditInput");if(inp){const ci=replace("pdfEditInput");ci.addEventListener("change",async e=>{const f=e.target.files?.[0];if(f)try{await loadPdfForEdit(f)}catch(err){console.error(err);$("pdfEditStatus").textContent="Could not open this PDF.";}});}
  ["pdfEditPrev","pdfEditNext","pdfEditPage","pdfAddText","pdfAddImage","pdfCoverExisting","pdfEditExport"].forEach(rebind=>{const n=$(rebind);if(n){const c=n.cloneNode(true);n.replaceWith(c);}});
  $("pdfEditPrev")?.addEventListener("click",async()=>{if(pe.pdf&&pe.page>1){pe.page--;await renderPe();}});$("pdfEditNext")?.addEventListener("click",async()=>{if(pe.pdf&&pe.page<pe.pdf.numPages){pe.page++;await renderPe();}});$("pdfEditPage")?.addEventListener("change",async e=>{if(pe.pdf){pe.page=Math.max(1,Math.min(pe.pdf.numPages,Number(e.target.value)||1));await renderPe();}});
  $("pdfEditImage")?.addEventListener("change",e=>{pe.imageFile=e.target.files?.[0]||null;});
  $("pdfAddText")?.addEventListener("click",()=>{const t=$("pdfEditText").value.trim();if(!t||!pe.pdf)return;pe.items.push({type:"text",page:pe.page,text:t,x:+$("pdfEditX").value||40,y:+$("pdfEditY").value||40,size:+$("pdfEditFontSize").value||16});$("pdfEditStatus").textContent="Text replacement/addition queued for the original PDF.";});
  $("pdfAddImage")?.addEventListener("click",async()=>{if(!pe.pdf||!pe.imageFile)return;pe.items.push({type:"image",page:pe.page,bytes:new Uint8Array(await pe.imageFile.arrayBuffer()),x:+$("pdfEditX").value||40,y:+$("pdfEditY").value||40,w:+$("pdfEditImageW").value||180,h:+$("pdfEditImageH").value||100});$("pdfEditStatus").textContent="Image replacement/addition queued for the original PDF.";});
  $("pdfCoverExisting")?.addEventListener("click",()=>{if(!pe.pdf)return;pe.items.push({type:"cover",page:pe.page,x:+$("pdfEditCoverX").value||40,y:+$("pdfEditCoverY").value||40,w:+$("pdfEditCoverW").value||180,h:+$("pdfEditCoverH").value||40});$("pdfEditStatus").textContent="Existing PDF area queued for cover/edit. Add replacement text or image, then export.";});
  $("pdfEditExport")?.addEventListener("click",async()=>{if(!pe.bytes||!window.PDFLib){$("pdfEditStatus").textContent="Open the original PDF first.";return;}try{const doc=await PDFLib.PDFDocument.load(pe.bytes),font=await doc.embedFont(PDFLib.StandardFonts.Helvetica);for(const it of pe.items){const pg=doc.getPage(it.page-1);if(it.type==="cover"){pg.drawRectangle({x:it.x,y:pg.getHeight()-it.y-it.h,width:it.w,height:it.h,color:PDFLib.rgb(1,1,1)});}else if(it.type==="text"){pg.drawText(it.text,{x:it.x,y:pg.getHeight()-it.y-it.size,size:it.size,font,color:PDFLib.rgb(0,0,0)});}else{let im;try{im=await doc.embedPng(it.bytes)}catch{im=await doc.embedJpg(it.bytes)}pg.drawImage(im,{x:it.x,y:pg.getHeight()-it.y-it.h,width:it.w,height:it.h});}}const out=await doc.save({useObjectStreams:false});downloadBytes(out,window.shopStudioFilename("edited-original-pdf","pdf"),"application/pdf");$("pdfEditStatus").textContent=`Original PDF exported with ${pe.items.length} edit(s).`;}catch(err){console.error(err);$("pdfEditStatus").textContent="PDF edit failed • original PDF was not changed.";}});

  document.title="Shop Studio Pro v10.8";
  const meta=document.querySelector('meta[name="shop-build"]');if(meta)meta.content="10.8.0";
})();

/* v10.9 focused crop workflow + theme + scanner flip */
(function(){
  const $=id=>document.getElementById(id), clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  let scanMode='perspective', scanFlipped=false, cardMode='perspective';

  // Theme persists locally.
  const themeBtn=$('themeToggle');
  function setTheme(light){document.body.classList.toggle('light-theme',light);if(themeBtn)themeBtn.textContent=light?'☾ Dark':'☀ Light';localStorage.setItem('shopStudioTheme',light?'light':'dark');}
  setTheme(localStorage.getItem('shopStudioTheme')==='light');
  themeBtn?.addEventListener('click',()=>setTheme(!document.body.classList.contains('light-theme')));

  // Horizontal flip belongs beside Rotate and affects scanner preview/export pixels.
  const baseDraw=window.drawScan;
  if(typeof baseDraw==='function') window.drawScan=function(){baseDraw();const c=$('scanCanvas');if(scanFlipped&&c?.width){const t=document.createElement('canvas');t.width=c.width;t.height=c.height;t.getContext('2d').drawImage(c,0,0);const x=c.getContext('2d');x.save();x.clearRect(0,0,c.width,c.height);x.translate(c.width,0);x.scale(-1,1);x.drawImage(t,0,0);x.restore();if(state.scanCropMode)renderScanPerspectiveOverlay();}};
  $('scanFlipHorizontal')?.addEventListener('click',()=>{scanFlipped=!scanFlipped;$('scanFlipHorizontal').classList.toggle('active',scanFlipped);window.drawScan?.();});

  function markMode(prefix,mode){
    if(prefix==='scan'){$('scanCropBtn')?.classList.toggle('active',mode==='crop');$('scanManualCropBtn')?.classList.toggle('active',mode==='perspective');}
    else {$('cardSimpleCropBtn')?.classList.toggle('active',mode==='crop');$('manualCardPerspectiveBtn')?.classList.toggle('active',mode==='perspective');}
  }
  function rectFromPts(pts){const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);return {l:Math.min(...xs),r:Math.max(...xs),t:Math.min(...ys),b:Math.max(...ys)};}
  function rectPts(r){return [{x:r.l,y:r.t},{x:r.r,y:r.t},{x:r.r,y:r.b},{x:r.l,y:r.b}];}
  function normalizeScanRect(){if(state.scanCropPts)state.scanCropPts=rectPts(rectFromPts(state.scanCropPts));renderScanPerspectiveOverlay();}

  // Edge handles for Photoshop-like rectangular crop adjustments.
  const scanLayer=$('scanCropLayer');
  if(scanLayer && !scanLayer.querySelector('.scan-edge')){
    ['top','right','bottom','left'].forEach(side=>{const h=document.createElement('span');h.className='scan-edge '+side;h.dataset.edge=side;scanLayer.appendChild(h);});
  }
  if(scanLayer && !scanLayer.querySelector('.scan-move-surface')){
    const m=document.createElement('span');m.className='scan-move-surface';scanLayer.insertBefore(m,scanLayer.firstChild);
    let move=null;
    m.addEventListener('pointerdown',e=>{if(scanMode!=='crop'||!state.scanCropMode||!state.scanCropPts)return;e.preventDefault();m.setPointerCapture?.(e.pointerId);move={sx:e.clientX,sy:e.clientY,r:rectFromPts(state.scanCropPts)};});
    m.addEventListener('pointermove',e=>{if(!move)return;const cr=$('scanCanvas').getBoundingClientRect(),dx=(e.clientX-move.sx)/cr.width,dy=(e.clientY-move.sy)/cr.height,r=move.r,w=r.r-r.l,h=r.b-r.t;r.l=clamp(r.l+dx,0,1-w);r.r=r.l+w;r.t=clamp(r.t+dy,0,1-h);r.b=r.t+h;state.scanCropPts=rectPts(r);renderScanPerspectiveOverlay();});
    m.addEventListener('pointerup',()=>move=null);m.addEventListener('pointercancel',()=>move=null);
  }
  const baseRender=window.renderScanPerspectiveOverlay;
  if(typeof baseRender==='function') window.renderScanPerspectiveOverlay=function(){baseRender();if(!state.scanCropMode||!state.scanCropPts)return;const r=rectFromPts(state.scanCropPts);scanLayer?.querySelectorAll('.scan-edge').forEach(h=>{const side=h.dataset.edge;if(scanMode!=='crop'){h.style.display='none';return;}h.style.display='block';h.style.left=((side==='left'?r.l:side==='right'?r.r:(r.l+r.r)/2)*100)+'%';h.style.top=((side==='top'?r.t:side==='bottom'?r.b:(r.t+r.b)/2)*100)+'%';});};
  scanLayer?.querySelectorAll('.scan-edge').forEach(h=>{let start=null;h.addEventListener('pointerdown',e=>{if(scanMode!=='crop'||!state.scanCropPts)return;e.preventDefault();e.stopImmediatePropagation();h.setPointerCapture(e.pointerId);start={x:e.clientX,y:e.clientY,r:rectFromPts(state.scanCropPts)};});h.addEventListener('pointermove',e=>{if(!start)return;const cr=$('scanCanvas').getBoundingClientRect(),dx=(e.clientX-start.x)/cr.width,dy=(e.clientY-start.y)/cr.height,r={...start.r};if(h.dataset.edge==='left')r.l=clamp(start.r.l+dx,0,r.r-.02);if(h.dataset.edge==='right')r.r=clamp(start.r.r+dx,r.l+.02,1);if(h.dataset.edge==='top')r.t=clamp(start.r.t+dy,0,r.b-.02);if(h.dataset.edge==='bottom')r.b=clamp(start.r.b+dy,r.t+.02,1);state.scanCropPts=rectPts(r);renderScanPerspectiveOverlay();});h.addEventListener('pointerup',()=>start=null);h.addEventListener('pointercancel',()=>start=null);});

  // In normal Crop, corner motion remains rectangular instead of becoming perspective.
  scanLayer?.querySelectorAll('.scan-point').forEach(pt=>pt.addEventListener('pointermove',e=>{if(scanMode!=='crop'||!state.scanCropMode||!state.scanCropPts||!(e.buttons&1))return;e.stopImmediatePropagation();const cr=$('scanCanvas').getBoundingClientRect(),x=clamp((e.clientX-cr.left)/cr.width),y=clamp((e.clientY-cr.top)/cr.height),i=+pt.dataset.point,r=rectFromPts(state.scanCropPts);if(i===0){r.l=Math.min(x,r.r-.02);r.t=Math.min(y,r.b-.02)}if(i===1){r.r=Math.max(x,r.l+.02);r.t=Math.min(y,r.b-.02)}if(i===2){r.r=Math.max(x,r.l+.02);r.b=Math.max(y,r.t+.02)}if(i===3){r.l=Math.min(x,r.r-.02);r.b=Math.max(y,r.t+.02)}state.scanCropPts=rectPts(r);renderScanPerspectiveOverlay();},true));

  async function openScannerCrop(mode){if(!$('scanCanvas')?.width)return alert('Upload or scan a document first.');scanMode=mode;markMode('scan',mode);$('deskewBtn')?.click();setTimeout(()=>{if(mode==='crop')normalizeScanRect();},180);}
  $('scanCropBtn')?.addEventListener('click',()=>openScannerCrop('crop'));
  $('scanManualCropBtn')?.addEventListener('click',e=>{e.stopImmediatePropagation();openScannerCrop('perspective');},true);

  // Immediately detect after image upload/scan import.
  $('scanInput')?.addEventListener('change',()=>setTimeout(()=>openScannerCrop('perspective'),250));
  $('cameraInput')?.addEventListener('change',()=>setTimeout(()=>openScannerCrop('perspective'),250));

  // Smart Card: only two visible crop choices. Crop uses existing flexible rectangle; perspective auto-detects.
  async function openCardCrop(mode){const c=$('cardSourceCanvas');if(!c?.width)return alert('Open a PDF or image first.');cardMode=mode;markMode('card',mode);if(mode==='crop'){$('cardFlexibleCropBtn')?.click();}else{$('autoDetectCardBtn')?.click();}}
  $('cardSimpleCropBtn')?.addEventListener('click',()=>openCardCrop('crop'));
  $('manualCardPerspectiveBtn')?.addEventListener('click',e=>{e.stopImmediatePropagation();openCardCrop('perspective');},true);
  $('cardImageInput')?.addEventListener('change',()=>setTimeout(()=>openCardCrop('perspective'),350));

  // Enter applies whichever visible crop workspace is active.
  document.addEventListener('keydown',e=>{if(e.key!=='Enter'||e.target?.matches('input,textarea,select'))return;const active=document.querySelector('.section.active')?.id;if(active==='scanner'&&state.scanCropMode){e.preventDefault();$('applyScanCrop')?.click();}if(active==='cards'){if(cardMode==='crop'&&state.cardFreeCrop){e.preventDefault();$('applyCardFlexibleCrop')?.click();}else if(state.cardPerspectiveMode){e.preventDefault();$('saveCardCrop')?.click();}}});

  // Make the card perspective overlay movable without a separate Move button.
  const cardLayer=$('cardPerspectiveLayer'),cardCanvas=$('cardSourceCanvas');let move=null;
  cardLayer?.addEventListener('pointerdown',e=>{if(!state.cardPerspectiveMode||e.target.classList.contains('card-point'))return;e.preventDefault();move={x:e.clientX,y:e.clientY,p:state.cardPerspectivePts.map(p=>({...p}))};cardLayer.setPointerCapture?.(e.pointerId);},true);
  cardLayer?.addEventListener('pointermove',e=>{if(!move)return;const cr=cardCanvas.getBoundingClientRect(),dx=(e.clientX-move.x)/cr.width,dy=(e.clientY-move.y)/cr.height,minx=Math.min(...move.p.map(p=>p.x)),maxx=Math.max(...move.p.map(p=>p.x)),miny=Math.min(...move.p.map(p=>p.y)),maxy=Math.max(...move.p.map(p=>p.y)),adx=clamp(dx,-minx,1-maxx),ady=clamp(dy,-miny,1-maxy);state.cardPerspectivePts=move.p.map(p=>({x:p.x+adx,y:p.y+ady}));renderCardPerspectiveOverlay();},true);cardLayer?.addEventListener('pointerup',()=>move=null,true);cardLayer?.addEventListener('pointercancel',()=>move=null,true);

  document.title='Shop Studio Pro v10.9';document.querySelector('meta[name="shop-build"]')?.setAttribute('content','10.9.0');
})();
/* v10.9.1 crop crosshair guides + Smart Card PDF auto-detect */
(function(){
 const $=id=>document.getElementById(id),layer=$('scanCropLayer');
 if(layer&&!layer.querySelector('.crop-guide-line')){const v=document.createElement('i'),h=document.createElement('i');v.className='crop-guide-line v';h.className='crop-guide-line h';layer.append(v,h);}
 const old=window.renderScanPerspectiveOverlay;if(typeof old==='function')window.renderScanPerspectiveOverlay=function(){old();if(!state.scanCropPts||!state.scanCropMode)return;const xs=state.scanCropPts.map(p=>p.x),ys=state.scanCropPts.map(p=>p.y),l=Math.min(...xs),r=Math.max(...xs),t=Math.min(...ys),b=Math.max(...ys),v=layer?.querySelector('.crop-guide-line.v'),h=layer?.querySelector('.crop-guide-line.h');if(v){v.style.left=((l+r)/2*100)+'%';v.style.top=(t*100)+'%';v.style.bottom=((1-b)*100)+'%';}if(h){h.style.top=((t+b)/2*100)+'%';h.style.left=(l*100)+'%';h.style.right=((1-r)*100)+'%';}};
 // Card PDF auto-detection is triggered after the PDF page actually finishes rendering in loadPdfViaModule().
})();

/* SHOP STUDIO PRO v11.0 — reliable scanner/PDF + flexible crop + print rebuild */
(function(){
  const E=id=>document.getElementById(id), clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  if(!window.state && typeof state==='undefined') return;
  const S=typeof state!=='undefined'?state:window.state;
  const pdfModule=async()=>{const m=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');m.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';return m;};
  const imageFromDataUrl=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});
  const canvasImage=async c=>imageFromDataUrl(c.toDataURL('image/png'));
  const fileImage=async file=>{try{return await fileToImage(file);}catch(e){return await new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=reject;r.onload=()=>imageFromDataUrl(r.result).then(resolve,reject);r.readAsDataURL(file);});}};
  const thumbData=img=>{const c=document.createElement('canvas'), maxW=140,maxH=180,s=Math.min(maxW/img.width,maxH/img.height,1);c.width=Math.max(1,Math.round(img.width*s));c.height=Math.max(1,Math.round(img.height*s));c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.82);};

  // 1) Scanner thumbnails: never use revoked object URLs. Every thumbnail gets a durable data URL.
  window.renderScanThumbs=renderScanThumbs=function(){
    const wrap=E('scanPages');if(!wrap)return;
    wrap.innerHTML='';
    S.scanPages.forEach((p,i)=>{const im=document.createElement('img');im.className='page-thumb';im.dataset.i=i;im.alt=p.name||`Page ${i+1}`;im.title=p.name||`Page ${i+1}`;try{im.src=p.thumb||thumbData(p.img);p.thumb=im.src;}catch{im.src=p.img.src||'';}im.onclick=()=>{S.scanCurrentIndex=i;S.scanImg=p.img;drawScan();};wrap.appendChild(im);});
  };

  async function pdfPagesToImages(file,scale=2){
    const mod=await pdfModule(),pdf=await mod.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise,out=[];
    for(let n=1;n<=pdf.numPages;n++){
      const page=await pdf.getPage(n),vp=page.getViewport({scale}),c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;const img=await canvasImage(c);out.push({img,name:`${file.name} • page ${n}`,thumb:thumbData(img),sourceType:'pdf',sourcePage:n});
    }
    return out;
  }

  // Separate Scanner PDF button, as requested.
  const scanButtons=E('scanner')?.querySelector('.workspace-head .button-row');
  if(scanButtons&&!E('scanPdfInput')){
    const lab=document.createElement('label');lab.className='ghost-btn';lab.textContent='Load PDF';const inp=document.createElement('input');inp.id='scanPdfInput';inp.type='file';inp.accept='application/pdf';inp.hidden=true;lab.appendChild(inp);scanButtons.insertBefore(lab,scanButtons.firstChild?.nextSibling||null);
    inp.addEventListener('change',async()=>{const f=inp.files?.[0];if(!f)return;const st=E('scanStatus');try{if(st)st.textContent='Loading PDF pages…';const pages=await pdfPagesToImages(f,2.2);S.scanPages=pages;S.scanImg=pages[0]?.img||null;if(S.scanImg){drawScan();renderScanThumbs();E('scanEmpty')&&(E('scanEmpty').style.display='none');if(st)st.textContent=`PDF loaded • ${pages.length} page(s) • scanner options work on every page.`;addHistory('Scanner','Loaded PDF',`${pages.length} page(s)`);}}catch(err){console.error(err);if(st)st.textContent='Could not load PDF. Use a modern Chromium browser with internet access for the PDF renderer.';}finally{inp.value='';}});
  }

  // Scanner defaults saved locally; no repeated prompt/dialog.
  const scanSide=E('scanner')?.querySelector('.tool-sidebar');
  if(scanSide&&!E('scannerDefaultsGroup')){
    const g=document.createElement('div');g.className='control-group';g.id='scannerDefaultsGroup';g.innerHTML='<h4>Scanner Settings</h4><div class="v11-settings-note">Saved on this PC and restored automatically for every new job.</div><div class="v11-toolbar"><button class="mini-btn" id="saveScannerDefaults" type="button">Save Default</button><button class="mini-btn" id="resetScannerDefaults" type="button">Reset</button></div><div class="v11-inline-status" id="scannerDefaultsStatus">Auto restore enabled</div>';scanSide.appendChild(g);
  }
  const scanSettingIds=['scanFilter','scanRotate','shadowStrength','ocrSharpen','scanZoom'];
  function currentScannerDefaults(){const o={};scanSettingIds.forEach(id=>{const n=E(id);if(n)o[id]=n.value;});return o;}
  function applyScannerDefaults(){let o={};try{o=JSON.parse(localStorage.getItem('shopstudio_scanner_defaults')||'{}');}catch{}scanSettingIds.forEach(id=>{const n=E(id);if(n&&o[id]!=null)n.value=o[id];});try{drawScan();applyPreviewZoom('scanCanvas','scanZoom','scanZoomValue',renderScanPerspectiveOverlay);}catch{}}
  E('saveScannerDefaults')?.addEventListener('click',()=>{localStorage.setItem('shopstudio_scanner_defaults',JSON.stringify(currentScannerDefaults()));const n=E('scannerDefaultsStatus');if(n)n.textContent='Default scanner settings saved.';});
  E('resetScannerDefaults')?.addEventListener('click',()=>{localStorage.removeItem('shopstudio_scanner_defaults');const base={scanFilter:'original',scanRotate:'0',shadowStrength:'0',ocrSharpen:'0',scanZoom:'100'};Object.entries(base).forEach(([id,v])=>{if(E(id))E(id).value=v;});try{drawScan();}catch{}const n=E('scannerDefaultsStatus');if(n)n.textContent='Defaults reset.';});
  applyScannerDefaults();

  // Generic 8-handle crop controller. Crop rectangle moves as a whole and every edge/corner is draggable.
  function cropController(host,canvas,box){
    let rect={x:.08,y:.08,w:.84,h:.84},drag=null;
    const handles=['nw','n','ne','e','se','s','sw','w'];
    if(!box){box=document.createElement('div');box.className='v11-crop-box';handles.forEach(h=>{const s=document.createElement('span');s.className=`v11-crop-handle ${h}`;s.dataset.h=h;box.appendChild(s);});host.appendChild(box);}
    function geom(){const cr=canvas.getBoundingClientRect(),hr=host.getBoundingClientRect();return {left:cr.left-hr.left+host.scrollLeft,top:cr.top-hr.top+host.scrollTop,w:cr.width,h:cr.height};}
    function render(){const g=geom();box.style.display='block';box.style.left=(g.left+rect.x*g.w)+'px';box.style.top=(g.top+rect.y*g.h)+'px';box.style.width=(rect.w*g.w)+'px';box.style.height=(rect.h*g.h)+'px';}
    function set(r){rect={x:clamp(r.x,0,.98),y:clamp(r.y,0,.98),w:clamp(r.w,.02,1),h:clamp(r.h,.02,1)};if(rect.x+rect.w>1)rect.w=1-rect.x;if(rect.y+rect.h>1)rect.h=1-rect.y;render();}
    box.addEventListener('pointerdown',e=>{e.preventDefault();const h=e.target.dataset.h||'move',g=geom();drag={h,sx:e.clientX,sy:e.clientY,r:{...rect},g};box.setPointerCapture?.(e.pointerId);});
    box.addEventListener('pointermove',e=>{if(!drag)return;const dx=(e.clientX-drag.sx)/drag.g.w,dy=(e.clientY-drag.sy)/drag.g.h,r={...drag.r},h=drag.h,min=.02;if(h==='move'){r.x=clamp(r.x+dx,0,1-r.w);r.y=clamp(r.y+dy,0,1-r.h);}else{if(h.includes('w')){const nx=clamp(r.x+dx,0,r.x+r.w-min);r.w+=r.x-nx;r.x=nx;}if(h.includes('e'))r.w=clamp(r.w+dx,min,1-r.x);if(h.includes('n')){const ny=clamp(r.y+dy,0,r.y+r.h-min);r.h+=r.y-ny;r.y=ny;}if(h.includes('s'))r.h=clamp(r.h+dy,min,1-r.y);}rect=r;render();});
    const up=()=>drag=null;box.addEventListener('pointerup',up);box.addEventListener('pointercancel',up);window.addEventListener('resize',render);
    return {show:(r)=>{if(r)set(r);else render();},hide:()=>box.style.display='none',get:()=>({...rect}),set};
  }
  async function cropImage(img,r){const c=document.createElement('canvas'),sx=Math.round(r.x*img.width),sy=Math.round(r.y*img.height),sw=Math.max(1,Math.round(r.w*img.width)),sh=Math.max(1,Math.round(r.h*img.height));c.width=Math.min(sw,img.width-sx);c.height=Math.min(sh,img.height-sy);c.getContext('2d').drawImage(img,sx,sy,c.width,c.height,0,0,c.width,c.height);return canvasImage(c);}
  function addSourceCrop(sectionId,prefix,title){
    const sec=E(sectionId),panel=sec?.querySelector('.compact-tool');if(!panel)return null;
    const output=panel.querySelector('.canvas-wrap');const host=document.createElement('div');host.className='v11-crop-host';host.id=`${prefix}CropHost`;host.style.display='none';const canvas=document.createElement('canvas');canvas.id=`${prefix}SourceCanvas`;host.appendChild(canvas);panel.insertBefore(host,output);
    const actions=document.createElement('div');actions.className='workspace-actions';actions.id=`${prefix}CropActions`;actions.innerHTML=`<button class="ghost-btn" id="${prefix}CropBtn" type="button">Crop</button><button class="primary-btn" id="${prefix}ApplyCrop" type="button" style="display:none">Apply Crop</button><button class="ghost-btn" id="${prefix}CancelCrop" type="button" style="display:none">Cancel</button>`;panel.insertBefore(actions,host);
    const ctrl=cropController(host,canvas,null);
    return {host,canvas,ctrl,actions,title};
  }

  // 3) PHOTO & SIGNATURE flexible crop.
  const resizeCrop=addSourceCrop('resize','resize','Photo & Signature');
  S.v11ResizeOriginal=null;
  function drawResizeSource(){if(!resizeCrop||!S.resizeImg)return;const c=resizeCrop.canvas,img=S.resizeImg,max=1600,s=Math.min(1,max/Math.max(img.width,img.height));c.width=Math.max(1,Math.round(img.width*s));c.height=Math.max(1,Math.round(img.height*s));c.getContext('2d').drawImage(img,0,0,c.width,c.height);}
  function wireImageInput(id,handler){const old=E(id);if(!old)return;const c=old.cloneNode(true);old.replaceWith(c);c.addEventListener('change',async()=>{const f=c.files?.[0];if(!f)return;try{await handler(f);}catch(err){console.error(err);alert('Could not load this image.');}finally{c.value='';}});}
  wireImageInput('resizeInput',async f=>{S.resizeImg=await fileImage(f);S.v11ResizeOriginal=S.resizeImg;drawResizeSource();drawResizePreview();E('resizeEmpty')&&(E('resizeEmpty').style.display='none');});
  E('resizeCropBtn')?.addEventListener('click',()=>{if(!S.resizeImg)return alert('Upload photo or signature first.');drawResizeSource();resizeCrop.host.style.display='grid';resizeCrop.ctrl.show({x:.05,y:.05,w:.9,h:.9});E('resizeApplyCrop').style.display='inline-flex';E('resizeCancelCrop').style.display='inline-flex';});
  E('resizeApplyCrop')?.addEventListener('click',async()=>{S.resizeImg=await cropImage(S.resizeImg,resizeCrop.ctrl.get());resizeCrop.ctrl.hide();resizeCrop.host.style.display='none';E('resizeApplyCrop').style.display='none';E('resizeCancelCrop').style.display='none';drawResizePreview();});
  E('resizeCancelCrop')?.addEventListener('click',()=>{resizeCrop.ctrl.hide();resizeCrop.host.style.display='none';E('resizeApplyCrop').style.display='none';E('resizeCancelCrop').style.display='none';});

  // 4) TARGET KB flexible crop + preview; compression uses cropped image.
  const compCrop=addSourceCrop('compressor','compress','Target KB');S.v11CompressImg=null;
  function drawCompressSource(){if(!compCrop||!S.v11CompressImg)return;const c=compCrop.canvas,img=S.v11CompressImg,max=1600,s=Math.min(1,max/Math.max(img.width,img.height));c.width=Math.max(1,Math.round(img.width*s));c.height=Math.max(1,Math.round(img.height*s));c.getContext('2d').drawImage(img,0,0,c.width,c.height);}
  wireImageInput('compressInput',async f=>{S.compressFile=f;S.v11CompressImg=await fileImage(f);drawCompressSource();const n=E('compressStatus');if(n)n.textContent=`Selected: ${f.name} • ${(f.size/1024).toFixed(1)} KB • ${S.v11CompressImg.width}×${S.v11CompressImg.height}px`;});
  E('compressCropBtn')?.addEventListener('click',()=>{if(!S.v11CompressImg)return alert('Upload an image first.');drawCompressSource();compCrop.host.style.display='grid';compCrop.ctrl.show({x:.05,y:.05,w:.9,h:.9});E('compressApplyCrop').style.display='inline-flex';E('compressCancelCrop').style.display='inline-flex';});
  E('compressApplyCrop')?.addEventListener('click',async()=>{S.v11CompressImg=await cropImage(S.v11CompressImg,compCrop.ctrl.get());compCrop.ctrl.hide();compCrop.host.style.display='none';E('compressApplyCrop').style.display='none';E('compressCancelCrop').style.display='none';drawCompressSource();const n=E('compressStatus');if(n)n.textContent=`Crop applied • ${S.v11CompressImg.width}×${S.v11CompressImg.height}px`;});
  E('compressCancelCrop')?.addEventListener('click',()=>{compCrop.ctrl.hide();compCrop.host.style.display='none';E('compressApplyCrop').style.display='none';E('compressCancelCrop').style.display='none';});
  const oldCompress=E('compressBtn');if(oldCompress){const b=oldCompress.cloneNode(true);oldCompress.replaceWith(b);b.addEventListener('click',async()=>{if(!S.v11CompressImg)return alert('Upload an image.');let img=S.v11CompressImg,w=img.width,h=img.height,maxW=+E('compressMaxW').value;if(maxW&&w>maxW){h=Math.round(h*maxW/w);w=maxW;}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);const target=+E('targetKb').value||50,type=E('compressFormat').value,blob=await compressCanvasToTarget(c,target,type);E('compressStatus').textContent=`Output: ${(blob.size/1024).toFixed(1)} KB • ${w}×${h}px`;downloadBlob(blob,type==='image/webp'?'compressed.webp':'compressed.jpg');addHistory('Target KB','Compressed image',`${(blob.size/1024).toFixed(1)} KB`);});}

  // 5) PRINT STUDIO complete interaction rebuild: image + PDF load, free move, 8-way resize and per-item crop.
  const printSec=E('print'), printHead=printSec?.querySelector('.workspace-head'), printWrap=E('printCanvasWrap'), printCanvas=E('printCanvas');
  if(printHead){const row=printHead.querySelector('.button-row')||(()=>{const d=document.createElement('div');d.className='button-row';printHead.appendChild(d);return d;})();const oldLabel=printHead.querySelector('label.upload-btn');if(oldLabel){oldLabel.textContent='Load Images';const inp=document.createElement('input');inp.id='printInputV11';inp.type='file';inp.accept='image/*';inp.multiple=true;inp.hidden=true;oldLabel.appendChild(inp);}if(!E('printPdfInputV11')){const lab=document.createElement('label');lab.className='ghost-btn';lab.textContent='Load PDF';const i=document.createElement('input');i.id='printPdfInputV11';i.type='file';i.accept='application/pdf';i.hidden=true;lab.appendChild(i);row.appendChild(lab);}}
  const printControls=printSec?.querySelector('.compact-controls');if(printControls&&!E('printGapV11')){const g=document.createElement('label');g.innerHTML='Gap (mm)<input id="printGapV11" type="number" value="3" min="0" step="0.5">';printControls.appendChild(g);const d=document.createElement('label');d.innerHTML='DPI<select id="printDpiV11"><option value="300" selected>300</option><option value="600">600</option></select>';printControls.appendChild(d);}
  if(printWrap&&!E('printInteractiveLayer')){const l=document.createElement('div');l.id='printInteractiveLayer';l.className='v11-print-layer';printWrap.appendChild(l);}
  const printActions=printSec?.querySelector('.workspace-actions');if(printActions&&!E('cropSelectedPrint')){const b=document.createElement('button');b.id='cropSelectedPrint';b.className='ghost-btn';b.textContent='Crop Selected';printActions.insertBefore(b,printActions.firstChild);const del=document.createElement('button');del.id='deleteSelectedPrint';del.className='ghost-btn';del.textContent='Delete Selected';printActions.insertBefore(del,b.nextSibling);}
  let printCropPanel=null,printCropCanvas=null,printCropCtrl=null;
  if(printWrap&&!E('printCropPanel')){printCropPanel=document.createElement('div');printCropPanel.id='printCropPanel';printCropPanel.className='v11-print-crop-panel';printCropPanel.hidden=true;printCropPanel.innerHTML='<div class="v11-source-title"><strong>Crop selected item</strong><span class="v11-inline-status">Drag rectangle, edges or corners</span></div><div class="v11-crop-host" id="printCropHost"><canvas id="printCropCanvas"></canvas></div><div class="workspace-actions"><button class="primary-btn" id="applyPrintItemCrop">Apply Crop</button><button class="ghost-btn" id="cancelPrintItemCrop">Cancel</button></div>';printWrap.parentElement.insertBefore(printCropPanel,printWrap.nextSibling);printCropCanvas=E('printCropCanvas');printCropCtrl=cropController(E('printCropHost'),printCropCanvas,null);}else{printCropPanel=E('printCropPanel');printCropCanvas=E('printCropCanvas');}
  S.v11PrintItems=[];S.v11PrintSelected=-1;
  function paperSize(){const dpi=+(E('printDpiV11')?.value||300),paper=E('printPaper').value,ori=E('printOrientation').value;let w,h;if(paper==='a4'){w=mmToPx(210,dpi);h=mmToPx(297,dpi);}else{w=6*dpi;h=4*dpi;}if(ori==='landscape'&&h>w)[w,h]=[h,w];if(ori==='portrait'&&w>h)[w,h]=[h,w];return {w,h,dpi};}
  function initialPrintItems(images){const {w,h,dpi}=paperSize(),count=Math.max(images.length,+E('printCount').value||images.length||1),cols=count===4?2:count===6?3:count===9?3:Math.ceil(Math.sqrt(count)),rows=Math.ceil(count/cols),m=mmToPx(+E('printMargin').value||4,dpi),gap=mmToPx(+(E('printGapV11')?.value||3),dpi),cw=(w-2*m-gap*(cols-1))/cols,ch=(h-2*m-gap*(rows-1))/rows;const out=[];for(let i=0;i<images.length;i++){const col=i%cols,row=Math.floor(i/cols);out.push({img:images[i].img||images[i],name:images[i].name||`Item ${i+1}`,x:(m+col*(cw+gap))/w,y:(m+row*(ch+gap))/h,w:cw/w,h:ch/h,crop:{x:0,y:0,w:1,h:1}});}return out;}
  function drawPrint(){if(!printCanvas)return;const {w,h}=paperSize();printCanvas.width=w;printCanvas.height=h;const ctx=printCanvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';S.v11PrintItems.forEach(it=>{const r=it.crop||{x:0,y:0,w:1,h:1},sx=r.x*it.img.width,sy=r.y*it.img.height,sw=r.w*it.img.width,sh=r.h*it.img.height;ctx.drawImage(it.img,sx,sy,sw,sh,it.x*w,it.y*h,it.w*w,it.h*h);});E('printEmpty')&&(E('printEmpty').style.display=S.v11PrintItems.length?'none':'');requestAnimationFrame(renderPrintOverlay);}
  function renderPrintOverlay(){const layer=E('printInteractiveLayer');if(!layer||!printCanvas)return;const cr=printCanvas.getBoundingClientRect(),hr=printWrap.getBoundingClientRect();layer.style.left=(cr.left-hr.left+printWrap.scrollLeft)+'px';layer.style.top=(cr.top-hr.top+printWrap.scrollTop)+'px';layer.style.width=cr.width+'px';layer.style.height=cr.height+'px';layer.innerHTML='';S.v11PrintItems.forEach((it,i)=>{const d=document.createElement('div');d.className='v11-print-item'+(i===S.v11PrintSelected?' selected':'');d.style.left=(it.x*100)+'%';d.style.top=(it.y*100)+'%';d.style.width=(it.w*100)+'%';d.style.height=(it.h*100)+'%';d.dataset.i=i;const label=document.createElement('span');label.className='v11-print-item-label';label.textContent=`${i+1}`;d.appendChild(label);['nw','n','ne','e','se','s','sw','w'].forEach(h=>{const s=document.createElement('span');s.className=`v11-print-resize ${h}`;s.dataset.h=h;d.appendChild(s);});layer.appendChild(d);
      d.addEventListener('pointerdown',e=>{e.preventDefault();const idx=i;S.v11PrintSelected=idx;renderPrintOverlay();const hnd=e.target.dataset.h||'move',base={...S.v11PrintItems[idx]},sx=e.clientX,sy=e.clientY;const move=ev=>{const dx=(ev.clientX-sx)/cr.width,dy=(ev.clientY-sy)/cr.height,it={...base},min=.025;if(hnd==='move'){it.x=clamp(base.x+dx,0,1-base.w);it.y=clamp(base.y+dy,0,1-base.h);}else{if(hnd.includes('w')){const nx=clamp(base.x+dx,0,base.x+base.w-min);it.w=base.w+(base.x-nx);it.x=nx;}if(hnd.includes('e'))it.w=clamp(base.w+dx,min,1-base.x);if(hnd.includes('n')){const ny=clamp(base.y+dy,0,base.y+base.h-min);it.h=base.h+(base.y-ny);it.y=ny;}if(hnd.includes('s'))it.h=clamp(base.h+dy,min,1-base.y);}S.v11PrintItems[idx]=it;drawPrint();};const up=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);};document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);});});}
  async function addPrintImages(entries,replace=false){if(replace)S.v11PrintItems=[];const existing=S.v11PrintItems.map(x=>({img:x.img,name:x.name})),all=existing.concat(entries);S.v11PrintItems=initialPrintItems(all);S.v11PrintSelected=S.v11PrintItems.length?0:-1;drawPrint();const n=E('printStatus');if(n)n.textContent=`${S.v11PrintItems.length} item(s) loaded • drag anywhere • resize from edges or corners • crop selected item.`;}
  E('printInputV11')?.addEventListener('change',async e=>{const entries=[];for(const f of [...e.target.files]){try{entries.push({img:await fileImage(f),name:f.name});}catch(err){console.warn(err);}}if(entries.length)await addPrintImages(entries,S.v11PrintItems.length===0);e.target.value='';});
  E('printPdfInputV11')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{const pages=await pdfPagesToImages(f,2);await addPrintImages(pages,S.v11PrintItems.length===0);}catch(err){console.error(err);alert('Could not load this PDF.');}finally{e.target.value='';}});
  ['printCount','printPaper','printOrientation','printMargin','printGapV11','printDpiV11'].forEach(id=>E(id)?.addEventListener('input',()=>{if(S.v11PrintItems.length){const src=S.v11PrintItems.map(x=>({img:x.img,name:x.name}));S.v11PrintItems=initialPrintItems(src);drawPrint();}}));
  const buildOld=E('buildPrintSheet');if(buildOld){const b=buildOld.cloneNode(true);buildOld.replaceWith(b);b.addEventListener('click',()=>{if(!S.v11PrintItems.length)return alert('Load images or a PDF first.');drawPrint();addHistory('Print Studio','Built editable layout',`${S.v11PrintItems.length} item(s)`);});}
  const pngOld=E('downloadPrintSheet');if(pngOld){const b=pngOld.cloneNode(true);pngOld.replaceWith(b);b.addEventListener('click',()=>{if(!S.v11PrintItems.length)return alert('Load images or a PDF first.');drawPrint();downloadDataURL(printCanvas.toDataURL('image/png'),'print-studio-sheet.png');});}
  const pdfOld=E('downloadPrintSheetPdf');if(pdfOld){const b=pdfOld.cloneNode(true);pdfOld.replaceWith(b);b.addEventListener('click',async()=>{if(!S.v11PrintItems.length)return alert('Load images or a PDF first.');drawPrint();const doc=await PDFLib.PDFDocument.create(),bytes=await(await canvasToBlob(printCanvas,'image/png',1)).arrayBuffer(),img=await doc.embedPng(bytes),p=doc.addPage([img.width,img.height]);p.drawImage(img,{x:0,y:0,width:img.width,height:img.height});downloadBytes(await doc.save(),'print-studio-sheet.pdf','application/pdf');});}
  const prOld=E('browserPrint');if(prOld){const b=prOld.cloneNode(true);prOld.replaceWith(b);b.addEventListener('click',()=>{if(!S.v11PrintItems.length)return alert('Load images or a PDF first.');drawPrint();const w=window.open('');if(w)w.document.write(`<img src="${printCanvas.toDataURL('image/png')}" style="width:100%;max-width:100%"><script>onload=()=>print()<\/script>`);});}
  E('deleteSelectedPrint')?.addEventListener('click',()=>{if(S.v11PrintSelected<0)return;S.v11PrintItems.splice(S.v11PrintSelected,1);S.v11PrintSelected=Math.min(S.v11PrintSelected,S.v11PrintItems.length-1);drawPrint();});
  E('cropSelectedPrint')?.addEventListener('click',()=>{const it=S.v11PrintItems[S.v11PrintSelected];if(!it)return alert('Click an item on the sheet first.');const c=printCropCanvas,img=it.img,max=1600,s=Math.min(1,max/Math.max(img.width,img.height));c.width=Math.max(1,Math.round(img.width*s));c.height=Math.max(1,Math.round(img.height*s));c.getContext('2d').drawImage(img,0,0,c.width,c.height);printCropPanel.hidden=false;if(!printCropCtrl)printCropCtrl=cropController(E('printCropHost'),c,null);printCropCtrl.show(it.crop||{x:0,y:0,w:1,h:1});});
  E('applyPrintItemCrop')?.addEventListener('click',()=>{const i=S.v11PrintSelected;if(i<0)return;S.v11PrintItems[i].crop=printCropCtrl.get();printCropCtrl.hide();printCropPanel.hidden=true;drawPrint();});
  E('cancelPrintItemCrop')?.addEventListener('click',()=>{printCropCtrl?.hide();printCropPanel.hidden=true;});
  window.addEventListener('resize',renderPrintOverlay);

  // Improve scanner drop zone to accept PDFs as well as images and route to the dedicated loader.
  E('scanCropStage')?.addEventListener('drop',async e=>{const pdf=[...e.dataTransfer.files].find(f=>f.type==='application/pdf'||/\.pdf$/i.test(f.name));if(!pdf)return;e.preventDefault();e.stopImmediatePropagation();try{const pages=await pdfPagesToImages(pdf,2.2);S.scanPages=pages;S.scanImg=pages[0]?.img||null;if(S.scanImg){drawScan();renderScanThumbs();E('scanEmpty')&&(E('scanEmpty').style.display='none');}}catch(err){console.error(err);}},true);

  document.title='Shop Studio Pro v11.0';const meta=document.querySelector('meta[name="shop-build"]');if(meta)meta.content='11.0.0';
})();

/* v11.0 final isolation: old Print Studio overlay is superseded by v11 editor. */
(function(){const old=document.getElementById('printEditor');if(old){old.innerHTML='';old.style.display='none';old.style.pointerEvents='none';}const legacy=document.getElementById('printInput');if(legacy)legacy.disabled=true;})();

/* SHOP STUDIO PRO v11.2 — Target KB image/PDF + per-item Print Studio crop */
(function(){
  const $=id=>document.getElementById(id), clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const S=(typeof state!=='undefined')?state:(window.state||{});
  const safeImageFromFile=file=>new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onerror=()=>reject(r.error||new Error('File read failed'));
    r.onload=()=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Image decode failed'));im.src=r.result;};
    r.readAsDataURL(file);
  });
  const imageFromCanvas=c=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=c.toDataURL('image/png');});
  function cropImageNormalized(img,r){
    const sx=Math.max(0,Math.round(r.x*img.width)), sy=Math.max(0,Math.round(r.y*img.height));
    const sw=Math.max(1,Math.min(img.width-sx,Math.round(r.w*img.width))), sh=Math.max(1,Math.min(img.height-sy,Math.round(r.h*img.height)));
    const c=document.createElement('canvas');c.width=sw;c.height=sh;c.getContext('2d').drawImage(img,sx,sy,sw,sh,0,0,sw,sh);return imageFromCanvas(c);
  }
  function makeCropController(host,canvas){
    let box=host.querySelector('.v111-crop-box'),rect={x:.05,y:.05,w:.90,h:.90},drag=null,visible=false;
    if(!box){box=document.createElement('div');box.className='v111-crop-box';['nw','n','ne','e','se','s','sw','w'].forEach(h=>{const q=document.createElement('span');q.className='v111-crop-handle '+h;q.dataset.h=h;box.appendChild(q)});host.appendChild(box);}
    const geom=()=>{const cr=canvas.getBoundingClientRect(),hr=host.getBoundingClientRect();return {x:cr.left-hr.left+host.scrollLeft,y:cr.top-hr.top+host.scrollTop,w:cr.width,h:cr.height};};
    const render=()=>{if(!visible){box.style.display='none';return;}if(!canvas.width)return;const g=geom();box.style.display='block';box.style.left=(g.x+rect.x*g.w)+'px';box.style.top=(g.y+rect.y*g.h)+'px';box.style.width=(rect.w*g.w)+'px';box.style.height=(rect.h*g.h)+'px';};
    const set=r=>{rect={x:clamp(r.x,0,.98),y:clamp(r.y,0,.98),w:clamp(r.w,.02,1),h:clamp(r.h,.02,1)};if(rect.x+rect.w>1)rect.w=1-rect.x;if(rect.y+rect.h>1)rect.h=1-rect.y;render();};
    box.onpointerdown=e=>{e.preventDefault();e.stopPropagation();const g=geom(),h=e.target.dataset.h||'move';drag={h,sx:e.clientX,sy:e.clientY,r:{...rect},g};box.setPointerCapture?.(e.pointerId);};
    box.onpointermove=e=>{if(!drag)return;const dx=(e.clientX-drag.sx)/drag.g.w,dy=(e.clientY-drag.sy)/drag.g.h,r={...drag.r},h=drag.h,min=.02;
      if(h==='move'){r.x=clamp(drag.r.x+dx,0,1-drag.r.w);r.y=clamp(drag.r.y+dy,0,1-drag.r.h);}else{
        if(h.includes('w')){const nx=clamp(drag.r.x+dx,0,drag.r.x+drag.r.w-min);r.w=drag.r.w+(drag.r.x-nx);r.x=nx;}
        if(h.includes('e'))r.w=clamp(drag.r.w+dx,min,1-drag.r.x);
        if(h.includes('n')){const ny=clamp(drag.r.y+dy,0,drag.r.y+drag.r.h-min);r.h=drag.r.h+(drag.r.y-ny);r.y=ny;}
        if(h.includes('s'))r.h=clamp(drag.r.h+dy,min,1-drag.r.y);
      } rect=r;render();
    };
    box.onpointerup=box.onpointercancel=()=>drag=null;
    window.addEventListener('resize',render);
    return {show:r=>{visible=true;if(r)set(r);else render();},hide:()=>{visible=false;box.style.display='none';},get:()=>({...rect}),set,render};
  }

  // SMART CARD — authoritative repeatable crop. Saving a side no longer destroys the source,
  // so Front and Back can be cropped repeatedly from one image/PDF page.
  (function(){
    const sec=$('cards'),stage=$('cardPerspectiveStage'),canvas=$('cardSourceCanvas');if(!sec||!stage||!canvas)return;
    let layer=$('cardV111CropHost');
    if(!layer){layer=document.createElement('div');layer.id='cardV111CropHost';layer.className='v111-card-crop-host';stage.appendChild(layer);}
    const ctrl=makeCropController(layer,canvas);let simpleActive=false;
    function hideLegacy(){['cardFreeCropLayer','cardPerspectiveLayer'].forEach(id=>{const n=$(id);if(n)n.style.display='none';});S.cardFreeCrop=null;S.cardPerspectiveMode=false;S.cardPerspectivePts=null;}
    function startSimple(){if(!canvas.width)return alert('Open a PDF or image first.');hideLegacy();simpleActive=true;layer.style.display='block';ctrl.show({x:.06,y:.08,w:.88,h:.84});const s=$('cardStatus');if(s)s.textContent='Crop active • move the rectangle or resize from any edge/corner • Apply & Save when ready.';}
    function stopSimple(){simpleActive=false;ctrl.hide();layer.style.display='none';}
    async function rectangularCardOutput(){const r=ctrl.get(),dpi=+$('cardExportDpi')?.value||600,out=document.createElement('canvas');out.width=mmToPx(85.6,dpi);out.height=mmToPx(54,dpi);const ctx=out.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.fillStyle='#fff';ctx.fillRect(0,0,out.width,out.height);ctx.drawImage(canvas,r.x*canvas.width,r.y*canvas.height,r.w*canvas.width,r.h*canvas.height,0,0,out.width,out.height);return out;}
    const cropBtn=$('cardSimpleCropBtn');if(cropBtn){const b=cropBtn.cloneNode(true);cropBtn.replaceWith(b);b.addEventListener('click',startSimple);}
    const persp=$('manualCardPerspectiveBtn');if(persp){const b=persp.cloneNode(true);persp.replaceWith(b);b.addEventListener('click',()=>{stopSimple();const auto=$('autoDetectCardBtn');if(auto)auto.click();else if(typeof enableCardPerspective==='function')enableCardPerspective();});}
    const save=$('saveCardCrop');if(save){const b=save.cloneNode(true);save.replaceWith(b);b.addEventListener('click',async()=>{
      if(!canvas.width)return alert('Open a PDF or image first.');
      try{
        const side=$('cardCropAction')?.value||'front';let crop=null;
        if(simpleActive) crop=await rectangularCardOutput();
        else if(S.cardPerspectiveMode&&S.cardPerspectivePts&&typeof perspectiveCardCanvas==='function') crop=await perspectiveCardCanvas(canvas,S.cardPerspectivePts,+$('cardExportDpi')?.value||600);
        else {startSimple();return;}
        if(side==='front')S.cardFrontCrop=crop;else S.cardBackCrop=crop;
        if(typeof previewCardCanvas==='function')previewCardCanvas(side==='front'?'cardFrontPreview':'cardBackPreview',crop);
        stopSimple();S.cardPerspectiveMode=false;const pl=$('cardPerspectiveLayer');if(pl)pl.style.display='none';
        const st=$('cardStatus');if(st)st.textContent=`${side.toUpperCase()} saved • crop can be started again without re-uploading the file.`;
        addHistory?.('Smart Card',`Saved ${side} crop`,`repeatable crop • ${crop.width}×${crop.height}px`);
      }catch(err){console.error(err);const st=$('cardStatus');if(st)st.textContent='Crop failed • source remains loaded. Start Crop and try again.';}
    });}
    document.addEventListener('keydown',e=>{if(e.key==='Enter'&&document.querySelector('.section.active')?.id==='cards'&&simpleActive&&!e.target.matches('input,select,textarea')){e.preventDefault();$('saveCardCrop')?.click();}});
  })();

  // PHOTO & SIGNATURE — no implicit crop. Preview uses contain, not cover.
  (function(){
    window.drawResizePreview=drawResizePreview=function(signatureClean=false){
      if(!S.resizeImg)return;const empty=$('resizeEmpty');if(empty)empty.style.display='none';
      const w=unitToPx($('resizeW').value,$('resizeUnit').value,$('resizeDpi').value),h=unitToPx($('resizeH').value,$('resizeUnit').value,$('resizeDpi').value),c=$('resizeCanvas'),ctx=c.getContext('2d');
      c.width=w;c.height=h;ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);fitContain(ctx,S.resizeImg,0,0,w,h);
      if(signatureClean){const d=ctx.getImageData(0,0,w,h),p=d.data;for(let i=0;i<p.length;i+=4){const g=.299*p[i]+.587*p[i+1]+.114*p[i+2],v=g>210?255:(g<120?0:g);p[i]=p[i+1]=p[i+2]=v;}ctx.putImageData(d,0,0);}
    };
    const st=$('resize')?.querySelector('.status-inline')||(()=>{const n=document.createElement('div');n.className='status-inline';n.id='resizeV111Status';n.textContent='No crop is applied automatically. Use Crop only when needed.';const p=$('resize')?.querySelector('.compact-controls');p?.insertAdjacentElement('afterend',n);return n;})();
    if(st)st.textContent='No crop is applied automatically. The full image is preserved unless you press Apply Crop.';
  })();

  // TARGET KB — image/PDF loader, optional image crop, resize/compress, export in the same file family.
  (function(){
    const sec=$('compressor'); if(!sec) return;
    let sourceFile=null, img=null, pdfBytes=null, sourceKind=null;
    const oldCropActions=$('compressCropActions'); if(oldCropActions) oldCropActions.style.display='none';
    const oldCropHost=$('compressCropHost'); if(oldCropHost) oldCropHost.style.display='none';

    // Make the existing picker accept both images and PDFs.
    const oldInput=$('compressInput');
    let input=oldInput;
    if(oldInput){
      input=oldInput.cloneNode(true);
      input.accept='image/*,application/pdf,.pdf';
      oldInput.replaceWith(input);
      const label=input.closest('label');
      if(label) label.childNodes[0].nodeValue='Upload Image / PDF';
    }

    let preview=$('compressV112Host'), canvas=$('compressV112Canvas');
    if(!preview){
      preview=document.createElement('div');
      preview.id='compressV112Host';
      preview.className='v111-source-host';
      canvas=document.createElement('canvas');
      canvas.id='compressV112Canvas';
      preview.appendChild(canvas);
      const status=$('compressStatus');
      status?.insertAdjacentElement('afterend',preview);
    }

    const ctrl=makeCropController(preview,canvas); ctrl.hide();

    let actions=$('compressV112Actions');
    if(!actions){
      actions=document.createElement('div');
      actions.id='compressV112Actions';
      actions.className='workspace-actions';
      actions.innerHTML='<button class="ghost-btn" id="compressV112Crop">Crop Image</button><button class="primary-btn" id="compressV112Apply" style="display:none">Apply Crop</button><button class="ghost-btn" id="compressV112Cancel" style="display:none">Cancel Crop</button>';
      preview.insertAdjacentElement('afterend',actions);
    }

    function sameImageMime(file){
      const t=(file?.type||'').toLowerCase();
      if(t==='image/jpeg'||t==='image/png'||t==='image/webp') return t;
      const ext=(file?.name||'').split('.').pop().toLowerCase();
      if(ext==='jpg'||ext==='jpeg') return 'image/jpeg';
      if(ext==='webp') return 'image/webp';
      return 'image/png';
    }
    function sameImageName(file){
      const n=file?.name||'compressed-image.png';
      const dot=n.lastIndexOf('.');
      const base=dot>0?n.slice(0,dot):n;
      const ext=(dot>0?n.slice(dot+1).toLowerCase():'png');
      const outExt=(ext==='jpg'||ext==='jpeg')?'jpg':(ext==='webp'?'webp':'png');
      return `${base}-target-kb.${outExt}`;
    }
    function drawImagePreview(){
      if(!img) return;
      const max=1500, sc=Math.min(1,max/Math.max(img.width,img.height));
      canvas.width=Math.max(1,Math.round(img.width*sc));
      canvas.height=Math.max(1,Math.round(img.height*sc));
      const ctx=canvas.getContext('2d');
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      preview.style.display='grid';
      ctrl.render();
      $('compressV112Crop').style.display='';
    }
    async function drawPdfPreview(bytes){
      try{
        const mod=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
        mod.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
        const pdf=await mod.getDocument({data:new Uint8Array(bytes)}).promise;
        const pg=await pdf.getPage(1), vp=pg.getViewport({scale:1.4});
        canvas.width=Math.ceil(vp.width); canvas.height=Math.ceil(vp.height);
        await pg.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
        preview.style.display='grid';
      }catch(err){
        console.error(err);
        canvas.width=1; canvas.height=1;
      }
      ctrl.hide();
      $('compressV112Crop').style.display='none';
      $('compressV112Apply').style.display='none';
      $('compressV112Cancel').style.display='none';
    }

    async function canvasBlobAt(canvas,mime,q){
      return await new Promise(res=>canvas.toBlob(res,mime,q));
    }
    async function compressImageSameType(image,targetKb,maxW,mime){
      const target=Math.max(1,targetKb)*1024;
      let w=image.width,h=image.height;
      if(maxW && w>maxW){h=Math.max(1,Math.round(h*maxW/w));w=maxW;}

      // JPEG/WebP: search quality first, then dimensions if necessary.
      if(mime==='image/jpeg'||mime==='image/webp'){
        let scale=1,best=null;
        for(let pass=0;pass<8;pass++){
          const c=document.createElement('canvas');
          c.width=Math.max(1,Math.round(w*scale)); c.height=Math.max(1,Math.round(h*scale));
          const ctx=c.getContext('2d'); ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
          ctx.drawImage(image,0,0,c.width,c.height);
          let lo=.08,hi=.98,localBest=null;
          for(let i=0;i<10;i++){
            const q=(lo+hi)/2, b=await canvasBlobAt(c,mime,q);
            if(!localBest || Math.abs(b.size-target)<Math.abs(localBest.size-target)) localBest=b;
            if(b.size>target) hi=q; else lo=q;
          }
          best=localBest;
          if(best.size<=target*1.03 || scale<.25) return {blob:best,w:c.width,h:c.height};
          scale*=.82;
        }
        return {blob:best,w:Math.round(w*scale),h:Math.round(h*scale)};
      }

      // PNG: dimension reduction is the dependable way to reduce byte size while keeping PNG output.
      let scale=1,best=null,bw=w,bh=h;
      for(let pass=0;pass<12;pass++){
        const c=document.createElement('canvas');
        c.width=Math.max(1,Math.round(w*scale)); c.height=Math.max(1,Math.round(h*scale));
        const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
        ctx.drawImage(image,0,0,c.width,c.height);
        const b=await canvasBlobAt(c,'image/png',1);
        best=b;bw=c.width;bh=c.height;
        if(b.size<=target*1.03 || scale<.18) break;
        const ratio=Math.sqrt(target/Math.max(1,b.size));
        scale*=Math.max(.55,Math.min(.9,ratio*.96));
      }
      return {blob:best,w:bw,h:bh};
    }

    async function renderPdfToImages(bytes,scale,quality){
      const mod=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
      mod.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
      const pdf=await mod.getDocument({data:new Uint8Array(bytes)}).promise;
      const pages=[];
      for(let n=1;n<=pdf.numPages;n++){
        const pg=await pdf.getPage(n), vp=pg.getViewport({scale});
        const c=document.createElement('canvas');c.width=Math.max(1,Math.ceil(vp.width));c.height=Math.max(1,Math.ceil(vp.height));
        await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
        const blob=await canvasBlobAt(c,'image/jpeg',quality);
        pages.push({blob,w:c.width,h:c.height});
      }
      return pages;
    }
    async function buildRasterPdf(pages){
      const doc=await PDFLib.PDFDocument.create();
      for(const pg of pages){
        const bytes=await pg.blob.arrayBuffer(), im=await doc.embedJpg(bytes);
        const p=doc.addPage([pg.w,pg.h]);
        p.drawImage(im,{x:0,y:0,width:pg.w,height:pg.h});
      }
      return await doc.save();
    }
    async function compressPdfToTarget(bytes,targetKb){
      const target=Math.max(5,targetKb)*1024;
      let best=null;
      // Search combinations from higher fidelity to lower, keeping the closest result.
      const scales=[1.6,1.35,1.15,.95,.8,.68,.56,.46,.38];
      const qualities=[.82,.68,.55,.43,.32,.24,.18,.12];
      for(const sc of scales){
        for(const q of qualities){
          const pages=await renderPdfToImages(bytes,sc,q);
          const out=await buildRasterPdf(pages);
          if(!best || Math.abs(out.byteLength-target)<Math.abs(best.byteLength-target)) best=out;
          if(out.byteLength<=target*1.03) return out;
        }
      }
      return best;
    }

    input?.addEventListener('change',async e=>{
      const f=e.target.files?.[0]; if(!f) return;
      sourceFile=f; img=null; pdfBytes=null; sourceKind=null;
      try{
        if(f.type==='application/pdf'||/\.pdf$/i.test(f.name)){
          sourceKind='pdf'; pdfBytes=await f.arrayBuffer(); await drawPdfPreview(pdfBytes);
          $('compressStatus').textContent=`Loaded PDF: ${f.name} • ${(f.size/1024).toFixed(1)} KB • export stays PDF`;
        }else{
          sourceKind='image'; img=await safeImageFromFile(f); S.v11CompressImg=img; S.compressFile=f;
          drawImagePreview(); ctrl.hide();
          $('compressStatus').textContent=`Loaded image: ${f.name} • ${(f.size/1024).toFixed(1)} KB • ${img.width}×${img.height}px • export keeps image type`;
        }
      }catch(err){
        console.error(err);
        sourceKind=null;sourceFile=null;img=null;pdfBytes=null;
        $('compressStatus').textContent='Could not load this file. Please choose a valid image or PDF.';
      }finally{e.target.value='';}
    });

    $('compressV112Crop').onclick=()=>{
      if(sourceKind!=='image'||!img) return alert('Crop is available for images. Load an image first.');
      ctrl.show({x:.05,y:.05,w:.9,h:.9});
      $('compressV112Apply').style.display='inline-flex';
      $('compressV112Cancel').style.display='inline-flex';
    };
    $('compressV112Apply').onclick=async()=>{
      if(!img) return;
      img=await cropImageNormalized(img,ctrl.get());S.v11CompressImg=img;
      drawImagePreview();ctrl.hide();
      $('compressV112Apply').style.display='none';$('compressV112Cancel').style.display='none';
      $('compressStatus').textContent=`Crop applied • ${img.width}×${img.height}px`;
    };
    $('compressV112Cancel').onclick=()=>{
      ctrl.hide();$('compressV112Apply').style.display='none';$('compressV112Cancel').style.display='none';
    };

    const oldBtn=$('compressBtn');
    if(oldBtn){
      const b=oldBtn.cloneNode(true); oldBtn.replaceWith(b);
      b.textContent='Resize / Compress & Export';
      b.addEventListener('click',async()=>{
        if(!sourceFile||!sourceKind) return alert('Upload an image or PDF first.');
        const target=+$('targetKb').value||50, maxW=+$('compressMaxW').value||0;
        b.disabled=true;
        try{
          if(sourceKind==='image'){
            const mime=sameImageMime(sourceFile);
            $('compressStatus').textContent='Processing image…';
            const out=await compressImageSameType(img,target,maxW,mime);
            $('compressStatus').textContent=`Output: ${(out.blob.size/1024).toFixed(1)} KB • ${out.w}×${out.h}px • ${mime.replace('image/','').toUpperCase()}`;
            downloadBlob(out.blob,sameImageName(sourceFile));
            addHistory?.('Target KB','Resized/compressed image',`${(out.blob.size/1024).toFixed(1)} KB`);
          }else{
            $('compressStatus').textContent='Processing PDF… this can take a little longer for multi-page files.';
            const outBytes=await compressPdfToTarget(pdfBytes,target);
            const blob=new Blob([outBytes],{type:'application/pdf'});
            const base=(sourceFile.name||'document.pdf').replace(/\.pdf$/i,'');
            $('compressStatus').textContent=`Output PDF: ${(blob.size/1024).toFixed(1)} KB • PDF format preserved`;
            downloadBlob(blob,`${base}-target-kb.pdf`);
            addHistory?.('Target KB','Compressed PDF',`${(blob.size/1024).toFixed(1)} KB`);
          }
        }catch(err){
          console.error(err);$('compressStatus').textContent='Could not process this file.';
          alert('Could not resize/compress this file.');
        }finally{b.disabled=false;}
      });
    }

    // The old output-format selector is image-specific and is no longer needed; export follows the input type.
    const format=$('compressFormat')?.closest('label'); if(format) format.style.display='none';
  })();

  // PRINT STUDIO — isolated editor with reliable load/select/move/8-way resize/crop.
  (function(){
    const sec=$('print'),wrap=$('printCanvasWrap'),canvas=$('printCanvas');if(!sec||!wrap||!canvas)return;
    // Hide older interaction layers so only this editor receives pointer events.
    ['printInteractiveLayer','printEditor'].forEach(id=>{const n=$(id);if(n){n.style.display='none';n.style.pointerEvents='none';}});
    const header=sec.querySelector('.workspace-head');let row=header?.querySelector('.v111-print-loaders');
    if(!row&&header){row=document.createElement('div');row.className='button-row v111-print-loaders';row.innerHTML='<label class="upload-btn">Load Images<input id="printImagesV111" type="file" accept="image/*" multiple hidden></label><label class="ghost-btn">Load PDF<input id="printPdfV111" type="file" accept="application/pdf" hidden></label>';header.querySelectorAll('label.upload-btn,.button-row').forEach(n=>{if(n!==row&&!row.contains(n))n.style.display='none';});header.appendChild(row);}
    let layer=$('printV111Layer');if(!layer){layer=document.createElement('div');layer.id='printV111Layer';layer.className='v111-print-layer';wrap.appendChild(layer);}
    let sources=[],items=[],selected=-1;
    const paper=()=>{const dpi=+(document.getElementById('printDpiV11')?.value||300),p=$('printPaper').value,o=$('printOrientation').value;let w=p==='a4'?mmToPx(210,dpi):6*dpi,h=p==='a4'?mmToPx(297,dpi):4*dpi;if(o==='landscape'&&h>w)[w,h]=[h,w];if(o==='portrait'&&w>h)[w,h]=[h,w];return {w,h,dpi};};
    function layoutFromSources(){if(!sources.length){items=[];selected=-1;draw();return;}const {w,h,dpi}=paper(),wanted=Math.max(+$('printCount').value||sources.length,sources.length),cols=wanted===4?2:wanted===6?3:wanted===9?3:Math.ceil(Math.sqrt(wanted)),rows=Math.ceil(wanted/cols),m=mmToPx(+$('printMargin').value||4,dpi),gap=mmToPx(+(document.getElementById('printGapV11')?.value||3),dpi),cw=(w-2*m-gap*(cols-1))/cols,ch=(h-2*m-gap*(rows-1))/rows;items=[];for(let i=0;i<wanted;i++){const src=sources[i%sources.length];items.push({img:src.img,name:src.name,x:(m+(i%cols)*(cw+gap))/w,y:(m+Math.floor(i/cols)*(ch+gap))/h,w:cw/w,h:ch/h,crop:{x:0,y:0,w:1,h:1}});}selected=items.length?0:-1;draw();}
    function draw(){const {w,h}=paper();canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';for(const it of items){const r=it.crop||{x:0,y:0,w:1,h:1};ctx.drawImage(it.img,r.x*it.img.width,r.y*it.img.height,r.w*it.img.width,r.h*it.img.height,it.x*w,it.y*h,it.w*w,it.h*h);}const e=$('printEmpty');if(e)e.style.display=items.length?'none':'';requestAnimationFrame(renderOverlay);}
    function renderOverlay(){const cr=canvas.getBoundingClientRect(),wr=wrap.getBoundingClientRect();layer.style.left=(cr.left-wr.left+wrap.scrollLeft)+'px';layer.style.top=(cr.top-wr.top+wrap.scrollTop)+'px';layer.style.width=cr.width+'px';layer.style.height=cr.height+'px';layer.innerHTML='';items.forEach((it,i)=>{const d=document.createElement('div');d.className='v111-print-item'+(i===selected?' selected':'');d.style.left=it.x*100+'%';d.style.top=it.y*100+'%';d.style.width=it.w*100+'%';d.style.height=it.h*100+'%';d.dataset.i=i;const lab=document.createElement('span');lab.className='v111-print-label';lab.textContent=String(i+1);d.appendChild(lab);const crop=document.createElement('button');crop.type='button';crop.className='v112-item-crop';crop.textContent='Crop';crop.title='Crop this image';crop.onpointerdown=e=>{e.preventDefault();e.stopPropagation();};crop.onclick=e=>{e.preventDefault();e.stopPropagation();selected=i;renderOverlay();cropBtn?.click();};d.appendChild(crop);['nw','n','ne','e','se','s','sw','w'].forEach(h=>{const q=document.createElement('span');q.className='v111-print-resize '+h;q.dataset.h=h;d.appendChild(q);});layer.appendChild(d);
        d.onpointerdown=e=>{if(e.target.closest('.v112-item-crop'))return;e.preventDefault();e.stopPropagation();selected=i;renderOverlay();const hnd=e.target.dataset.h||'move',base={...items[i]},sx=e.clientX,sy=e.clientY,cbox=canvas.getBoundingClientRect();const mv=ev=>{const dx=(ev.clientX-sx)/cbox.width,dy=(ev.clientY-sy)/cbox.height,n={...base},min=.02;if(hnd==='move'){n.x=clamp(base.x+dx,0,1-base.w);n.y=clamp(base.y+dy,0,1-base.h);}else{if(hnd.includes('w')){const nx=clamp(base.x+dx,0,base.x+base.w-min);n.w=base.w+(base.x-nx);n.x=nx;}if(hnd.includes('e'))n.w=clamp(base.w+dx,min,1-base.x);if(hnd.includes('n')){const ny=clamp(base.y+dy,0,base.y+base.h-min);n.h=base.h+(base.y-ny);n.y=ny;}if(hnd.includes('s'))n.h=clamp(base.h+dy,min,1-base.y);}items[i]=n;draw();};const up=()=>{document.removeEventListener('pointermove',mv,true);document.removeEventListener('pointerup',up,true);};document.addEventListener('pointermove',mv,true);document.addEventListener('pointerup',up,true);};
      });}
    async function loadPdf(file){const mod=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');mod.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';const pdf=await mod.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise,out=[];for(let n=1;n<=pdf.numPages;n++){const pg=await pdf.getPage(n),vp=pg.getViewport({scale:2}),c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;out.push({img:await imageFromCanvas(c),name:`${file.name} • page ${n}`});}return out;}
    $('printImagesV111')?.addEventListener('change',async e=>{const files=[...e.target.files];if(!files.length)return;const loaded=[];for(const f of files){try{loaded.push({img:await safeImageFromFile(f),name:f.name});}catch(err){console.error(err);}}sources=sources.concat(loaded);layoutFromSources();const st=$('printStatus');if(st)st.textContent=`${items.length} item(s) ready • first item selected • drag to move • resize from 4 sides or 4 corners.`;e.target.value='';});
    $('printPdfV111')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{sources=sources.concat(await loadPdf(f));layoutFromSources();const st=$('printStatus');if(st)st.textContent=`PDF loaded • ${items.length} editable item(s) • first item selected.`;}catch(err){console.error(err);alert('Could not load this PDF.');}finally{e.target.value='';}});
    // Dedicated crop panel.
    let panel=$('printV111CropPanel'),cc=$('printV111CropCanvas'),cropCtrl=null;
    if(!panel){panel=document.createElement('div');panel.id='printV111CropPanel';panel.className='v111-print-crop-panel';panel.hidden=true;panel.innerHTML='<div class="v11-source-title"><strong>Crop selected item</strong><span class="v11-inline-status">Move / resize from edges or corners</span></div><div class="v111-source-host" id="printV111CropHost"><canvas id="printV111CropCanvas"></canvas></div><div class="workspace-actions"><button class="primary-btn" id="printV111ApplyCrop">Apply Crop</button><button class="ghost-btn" id="printV111CancelCrop">Cancel</button></div>';wrap.insertAdjacentElement('afterend',panel);cc=$('printV111CropCanvas');cropCtrl=makeCropController($('printV111CropHost'),cc);}else cropCtrl=makeCropController($('printV111CropHost'),cc);
    const actions=sec.querySelector('.workspace-actions');let cropBtn=$('printV111Crop');if(!cropBtn&&actions){cropBtn=document.createElement('button');cropBtn.id='printV111Crop';cropBtn.className='ghost-btn';cropBtn.textContent='Crop Selected';actions.insertBefore(cropBtn,actions.firstChild);}
    cropBtn.onclick=()=>{if(selected<0&&items.length)selected=0;if(selected<0)return alert('Load an image or PDF first.');const it=items[selected],max=1600,s=Math.min(1,max/Math.max(it.img.width,it.img.height));cc.width=Math.max(1,Math.round(it.img.width*s));cc.height=Math.max(1,Math.round(it.img.height*s));cc.getContext('2d').drawImage(it.img,0,0,cc.width,cc.height);panel.hidden=false;cropCtrl.show(it.crop||{x:0,y:0,w:1,h:1});};
    $('printV111ApplyCrop').onclick=()=>{if(selected<0)return;items[selected].crop=cropCtrl.get();cropCtrl.hide();panel.hidden=true;draw();};
    $('printV111CancelCrop').onclick=()=>{cropCtrl.hide();panel.hidden=true;};
    const oldCrop=$('cropSelectedPrint');if(oldCrop)oldCrop.style.display='none';const oldDelete=$('deleteSelectedPrint');if(oldDelete)oldDelete.style.display='none';
    let del=$('printV111Delete');if(!del&&actions){del=document.createElement('button');del.id='printV111Delete';del.className='ghost-btn';del.textContent='Delete Selected';actions.insertBefore(del,cropBtn.nextSibling);}del.onclick=()=>{if(selected<0&&items.length)selected=0;if(selected<0)return;items.splice(selected,1);selected=Math.min(selected,items.length-1);draw();};
    let rot=$('printV111Rotate');if(!rot&&actions){rot=document.createElement('button');rot.id='printV111Rotate';rot.className='ghost-btn';rot.textContent='↻ Rotate Selected';actions.insertBefore(rot,del.nextSibling);}
    rot.onclick=async()=>{if(selected<0&&items.length)selected=0;if(selected<0)return alert('Load an image or PDF first.');const it=items[selected],src=it.img,c=document.createElement('canvas');c.width=src.height;c.height=src.width;const cx=c.getContext('2d');cx.translate(c.width/2,c.height/2);cx.rotate(Math.PI/2);cx.drawImage(src,-src.width/2,-src.height/2);it.img=await imageFromCanvas(c);it.crop={x:0,y:0,w:1,h:1};draw();const st=$('printStatus');if(st)st.textContent=`Item ${selected+1} rotated 90° clockwise • layout position and size preserved.`;};
    const build=$('buildPrintSheet');if(build){const b=build.cloneNode(true);build.replaceWith(b);b.addEventListener('click',()=>{if(!sources.length)return alert('Load images or a PDF first.');layoutFromSources();});}
    const png=$('downloadPrintSheet');if(png){const b=png.cloneNode(true);png.replaceWith(b);b.addEventListener('click',()=>{if(!items.length)return alert('Load images or a PDF first.');draw();downloadDataURL(canvas.toDataURL('image/png'),'print-studio-sheet.png');});}
    const pdf=$('downloadPrintSheetPdf');if(pdf){const b=pdf.cloneNode(true);pdf.replaceWith(b);b.addEventListener('click',async()=>{if(!items.length)return alert('Load images or a PDF first.');draw();const doc=await PDFLib.PDFDocument.create(),bytes=await(await canvasToBlob(canvas,'image/png',1)).arrayBuffer(),im=await doc.embedPng(bytes),p=doc.addPage([im.width,im.height]);p.drawImage(im,{x:0,y:0,width:im.width,height:im.height});downloadBytes(await doc.save(),'print-studio-sheet.pdf','application/pdf');});}
    const pr=$('browserPrint');if(pr){const b=pr.cloneNode(true);pr.replaceWith(b);b.addEventListener('click',()=>{if(!items.length)return alert('Load images or a PDF first.');draw();const w=window.open('');w?.document.write(`<img src="${canvas.toDataURL('image/png')}" style="width:100%;max-width:100%"><script>onload=()=>print()<\/script>`);});}
    ['printPaper','printOrientation'].forEach(id=>$(id)?.addEventListener('change',draw));
    $('printCount')?.addEventListener('change',()=>{if(sources.length)layoutFromSources();});
    window.addEventListener('resize',renderOverlay);
  })();

  document.title='Shop Studio Pro v11.3';document.querySelector('meta[name="shop-build"]')?.setAttribute('content','11.3.0');
  const bs=document.querySelector('.brand-subtitle');if(bs)bs.textContent='PRO TOOLKIT • V11.3';
})();

/* SHOP STUDIO PRO v11.4 — consolidated Target KB, scanner persistence, advanced PDF workspace */
(function(){
  const $=id=>document.getElementById(id), clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const S=typeof state!=='undefined'?state:(window.state||{});
  const pdfJs=async()=>{const m=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');m.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';return m;};
  const toImg=src=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});
  const canvasImg=c=>toImg(c.toDataURL('image/png'));
  const blobOf=(c,t='image/jpeg',q=.85)=>new Promise(r=>c.toBlob(r,t,q));

  // ---------- TARGET KB v11.5: strict image/PDF loader + preview + compression ----------
  (function(){
    const sec=$('compressor'), oldInput=$('compressInput'), oldBtn=$('compressBtn'); if(!sec||!oldInput||!oldBtn)return;
    const input=oldInput.cloneNode(true); input.accept='image/*,application/pdf,.pdf'; oldInput.replaceWith(input);
    const btn=oldBtn.cloneNode(true); oldBtn.replaceWith(btn); btn.textContent='Resize / Compress & Export';
    ['compressV112Host','compressV112Actions','compressCropHost','compressCropActions','compressV114Host','compressV114Actions'].forEach(id=>$(id)?.remove());
    const host=document.createElement('div'); host.id='compressV115Host'; host.className='v114-compress-host';
    host.innerHTML='<canvas id="compressV115Canvas"></canvas><div id="compressV115Crop" class="v114-crop-box" hidden><i data-h="nw"></i><i data-h="n"></i><i data-h="ne"></i><i data-h="e"></i><i data-h="se"></i><i data-h="s"></i><i data-h="sw"></i><i data-h="w"></i></div>';
    $('compressStatus').insertAdjacentElement('afterend',host);
    const actions=document.createElement('div'); actions.id='compressV115Actions'; actions.className='workspace-actions';
    actions.innerHTML='<button class="ghost-btn" id="compressV115CropBtn" hidden>Crop Image</button><button class="primary-btn" id="compressV115Apply" hidden>Apply Crop</button><button class="ghost-btn" id="compressV115Cancel" hidden>Cancel Crop</button>';
    host.insertAdjacentElement('afterend',actions);
    const canvas=$('compressV115Canvas'), box=$('compressV115Crop');
    let file=null, kind=null, image=null, pdfBytes=null, crop={x:.05,y:.05,w:.9,h:.9}, drag=null;
    const status=t=>$('compressStatus').textContent=t;
    const readImage=f=>new Promise((resolve,reject)=>{const u=URL.createObjectURL(f),im=new Image();im.onload=()=>{URL.revokeObjectURL(u);resolve(im)};im.onerror=e=>{URL.revokeObjectURL(u);reject(e)};im.src=u});
    const renderCropBox=()=>{if(box.hidden||!canvas.width)return;const cr=canvas.getBoundingClientRect(),hr=host.getBoundingClientRect();box.style.left=(cr.left-hr.left+crop.x*cr.width)+'px';box.style.top=(cr.top-hr.top+crop.y*cr.height)+'px';box.style.width=(crop.w*cr.width)+'px';box.style.height=(crop.h*cr.height)+'px'};
    function drawImagePreview(){if(!image)return;const max=1500,sc=Math.min(1,max/Math.max(image.naturalWidth||image.width,image.naturalHeight||image.height));canvas.width=Math.max(1,Math.round((image.naturalWidth||image.width)*sc));canvas.height=Math.max(1,Math.round((image.naturalHeight||image.height)*sc));const x=canvas.getContext('2d');x.clearRect(0,0,canvas.width,canvas.height);x.drawImage(image,0,0,canvas.width,canvas.height);host.hidden=false;$('compressV115CropBtn').hidden=false;requestAnimationFrame(renderCropBox)}
    async function drawPdfPreview(){const m=await pdfJs(),pdf=await m.getDocument({data:new Uint8Array(pdfBytes.slice(0))}).promise,pg=await pdf.getPage(1),vp=pg.getViewport({scale:1.35});canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);const x=canvas.getContext('2d');x.clearRect(0,0,canvas.width,canvas.height);await pg.render({canvasContext:x,viewport:vp}).promise;host.hidden=false;box.hidden=true;$('compressV115CropBtn').hidden=true;$('compressV115Apply').hidden=true;$('compressV115Cancel').hidden=true}
    function resetCrop(){crop={x:.05,y:.05,w:.9,h:.9};box.hidden=true;$('compressV115Apply').hidden=true;$('compressV115Cancel').hidden=true}
    input.addEventListener('change',async e=>{const f=e.target.files&&e.target.files[0];if(!f)return;file=f;image=null;pdfBytes=null;kind=null;resetCrop();status('Loading file…');try{if((f.type||'').toLowerCase()==='application/pdf'||/\.pdf$/i.test(f.name)){kind='pdf';pdfBytes=await f.arrayBuffer();await drawPdfPreview();status(`Loaded PDF • ${(f.size/1024).toFixed(1)} KB • ${f.name}`)}else{kind='image';image=await readImage(f);drawImagePreview();status(`Loaded image • ${(f.size/1024).toFixed(1)} KB • ${image.naturalWidth||image.width}×${image.naturalHeight||image.height}px`)} }catch(err){console.error(err);file=kind=image=pdfBytes=null;canvas.width=canvas.height=0;status('Could not load this file. Please try another image or PDF.')}finally{e.target.value=''}});
    $('compressV115CropBtn').onclick=()=>{if(kind!=='image'||!image)return status('Load an image first.');crop={x:.05,y:.05,w:.9,h:.9};box.hidden=false;$('compressV115Apply').hidden=false;$('compressV115Cancel').hidden=false;requestAnimationFrame(renderCropBox)};
    $('compressV115Cancel').onclick=resetCrop;
    $('compressV115Apply').onclick=async()=>{if(!image)return;const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height,c=document.createElement('canvas');c.width=Math.max(1,Math.round(iw*crop.w));c.height=Math.max(1,Math.round(ih*crop.h));c.getContext('2d').drawImage(image,iw*crop.x,ih*crop.y,iw*crop.w,ih*crop.h,0,0,c.width,c.height);image=await canvasImg(c);resetCrop();drawImagePreview();status(`Crop applied • ${c.width}×${c.height}px`)};
    box.addEventListener('pointerdown',e=>{e.preventDefault();const cr=canvas.getBoundingClientRect();drag={id:e.pointerId,h:e.target.dataset.h||'move',sx:e.clientX,sy:e.clientY,r:{...crop},cw:cr.width,ch:cr.height};box.setPointerCapture?.(e.pointerId)});
    window.addEventListener('pointermove',e=>{if(!drag)return;const dx=(e.clientX-drag.sx)/drag.cw,dy=(e.clientY-drag.sy)/drag.ch,r={...drag.r},h=drag.h,min=.025;if(h==='move'){r.x=clamp(r.x+dx,0,1-r.w);r.y=clamp(r.y+dy,0,1-r.h)}else{if(h.includes('w')){const nx=clamp(r.x+dx,0,r.x+r.w-min);r.w+=r.x-nx;r.x=nx}if(h.includes('e'))r.w=clamp(r.w+dx,min,1-r.x);if(h.includes('n')){const ny=clamp(r.y+dy,0,r.y+r.h-min);r.h+=r.y-ny;r.y=ny}if(h.includes('s'))r.h=clamp(r.h+dy,min,1-r.y)}crop=r;renderCropBox()});
    window.addEventListener('pointerup',()=>drag=null);window.addEventListener('resize',renderCropBox);
    const mime=f=>{const t=(f.type||'').toLowerCase();if(['image/jpeg','image/png','image/webp'].includes(t))return t;return /\.png$/i.test(f.name)?'image/png':/\.webp$/i.test(f.name)?'image/webp':'image/jpeg'};
    async function compressImage(targetKb,maxW){const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;let w=iw,h=ih;if(maxW&&w>maxW){h=Math.max(1,Math.round(h*maxW/w));w=maxW}const target=targetKb*1024,type=mime(file);let best=null,bestDiff=Infinity,bw=w,bh=h,scale=1;for(let pass=0;pass<14;pass++){const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w*scale));c.height=Math.max(1,Math.round(h*scale));const x=c.getContext('2d');x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(image,0,0,c.width,c.height);if(type==='image/png'){const b=await blobOf(c,'image/png',1),d=Math.abs(b.size-target);if(d<bestDiff){best=b;bestDiff=d;bw=c.width;bh=c.height}}else{let lo=.04,hi=.98;for(let i=0;i<13;i++){const q=(lo+hi)/2,b=await blobOf(c,type,q),d=Math.abs(b.size-target);if(d<bestDiff){best=b;bestDiff=d;bw=c.width;bh=c.height}if(b.size>target)hi=q;else lo=q}}if(best&&best.size<=target*1.025&&best.size>=target*.72)break;scale*=.84}return{blob:best,w:bw,h:bh,type}}
    async function compressPdf(targetKb){const target=targetKb*1024,m=await pdfJs(),src=await m.getDocument({data:new Uint8Array(pdfBytes.slice(0))}).promise;let best=null,bestDiff=Infinity;for(const sc of [1.7,1.45,1.25,1.05,.9,.76,.64,.52,.42,.34]){for(const q of [.82,.7,.58,.46,.36,.28,.21,.15,.1]){const doc=await PDFLib.PDFDocument.create();for(let n=1;n<=src.numPages;n++){const pg=await src.getPage(n),vp=pg.getViewport({scale:sc}),c=document.createElement('canvas');c.width=Math.max(1,Math.ceil(vp.width));c.height=Math.max(1,Math.ceil(vp.height));await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;const b=await blobOf(c,'image/jpeg',q),im=await doc.embedJpg(await b.arrayBuffer()),p=doc.addPage([im.width,im.height]);p.drawImage(im,{x:0,y:0,width:im.width,height:im.height})}const out=await doc.save({useObjectStreams:true}),d=Math.abs(out.byteLength-target);if(d<bestDiff){best=out;bestDiff=d}if(out.byteLength<=target*1.025&&out.byteLength>=target*.65)return out}}return best}
    btn.addEventListener('click',async()=>{if(!file||!kind)return status('Upload an image or PDF first.');btn.disabled=true;try{const target=Math.max(5,+$('targetKb').value||50),maxW=Math.max(0,+$('compressMaxW').value||0);if(kind==='image'){status('Compressing image…');const o=await compressImage(target,maxW),ext=o.type==='image/png'?'png':o.type==='image/webp'?'webp':'jpg',base=file.name.replace(/\.[^.]+$/,'');downloadBlob(o.blob,`${base}-target-kb.${ext}`);status(`Output ${(o.blob.size/1024).toFixed(1)} KB • ${o.w}×${o.h}px`)}else{status('Compressing PDF pages…');const out=await compressPdf(target),blob=new Blob([out],{type:'application/pdf'}),base=file.name.replace(/\.pdf$/i,'');downloadBlob(blob,`${base}-target-kb.pdf`);status(`Output PDF ${(blob.size/1024).toFixed(1)} KB`)} }catch(err){console.error(err);status('Compression failed. The source file was not changed.')}finally{btn.disabled=false}});
  })();

  // ---------- SCANNER: saved device/settings + stronger auto document crop ----------
  (function(){
    const side=$('scanner')?.querySelector('.tool-sidebar');if(!side)return;
    let g=$('scannerDevicePrefs');if(!g){g=document.createElement('div');g.id='scannerDevicePrefs';g.className='control-group';g.innerHTML='<h4>Device Defaults</h4><label>DPI<select id="savedScanDpi"><option>150</option><option selected>300</option><option>600</option></select></label><label>Mode<select id="savedScanBit"><option value="24" selected>Color</option><option value="8">Grayscale</option><option value="1">B&W</option></select></label><label>Source<select id="savedScanSource"><option value="flatbed">Flatbed</option><option value="feeder">Feeder</option></select></label><label><input id="scanRememberDevice" type="checkbox" checked> Remember scanner & settings</label><div class="v11-inline-status" id="scanSavedDeviceLabel">No scanner saved yet</div>';side.appendChild(g)}
    let pref={};try{pref=JSON.parse(localStorage.getItem('shopstudio_scan_device')||'{}')}catch{};['savedScanDpi','savedScanBit','savedScanSource'].forEach(id=>{if(pref[id]!=null&&$(id))$(id).value=pref[id]});if($('scanRememberDevice'))$('scanRememberDevice').checked=pref.remember!==false;if(pref.name)$('scanSavedDeviceLabel').textContent=`Saved: ${pref.name}`;
    const savePref=extra=>{if(!$('scanRememberDevice')?.checked)return;pref={...pref,...extra,savedScanDpi:$('savedScanDpi').value,savedScanBit:$('savedScanBit').value,savedScanSource:$('savedScanSource').value,remember:true};localStorage.setItem('shopstudio_scan_device',JSON.stringify(pref));if(pref.name)$('scanSavedDeviceLabel').textContent=`Saved: ${pref.name}`};['savedScanDpi','savedScanBit','savedScanSource'].forEach(id=>$(id)?.addEventListener('change',()=>savePref({})));
    const old=$('scannerBridgeBtn');if(old){const b=old.cloneNode(true);old.replaceWith(b);b.addEventListener('click',async()=>{const label=b.textContent;b.disabled=true;b.textContent='Scanning…';try{const r=await fetch('http://127.0.0.1:17899/scanners',{signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Error('Scanner bridge not responding.');const data=await r.json(),scanners=data.scanners||[];if(!scanners.length)throw new Error('No WIA/TWAIN scanner detected.');let s=scanners.find(x=>x.name===pref.name&&x.driver===pref.driver);if(!s){const choices=scanners.map((x,i)=>`${i+1}. [${String(x.driver).toUpperCase()}] ${x.name}`).join('\n');const pick=prompt(`Choose scanner once (it will be remembered):\n\n${choices}`,'1');if(pick===null)return;s=scanners[Math.max(0,Math.min(scanners.length-1,(parseInt(pick)||1)-1))];savePref({name:s.name,driver:s.driver})}const url=`http://127.0.0.1:17899/scan?driver=${encodeURIComponent(s.driver)}&device=${encodeURIComponent(s.name)}&dpi=${encodeURIComponent($('savedScanDpi').value)}&bitdepth=${encodeURIComponent($('savedScanBit').value)}&source=${encodeURIComponent($('savedScanSource').value)}&deskew=true`;const rr=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!rr.ok)throw new Error('Scan failed.');const blob=await rr.blob(),im=await fileToImage(blob);S.scanImg=im;S.scanPages.push({img:im,name:`${s.name} scan`});S.scanCurrentIndex=S.scanPages.length-1;drawScan();renderScanThumbs();$('scanSavedDeviceLabel').textContent=`Saved: ${s.name} • ${$('savedScanDpi').value} DPI`;savePref({name:s.name,driver:s.driver})}catch(err){console.error(err);alert(`${err.message}\n\nStart the Windows Scanner Bridge and check the scanner driver.`)}finally{b.disabled=false;b.textContent=label}})}
    async function detectQuad(c){if(typeof cv==='undefined'||!cv.Mat)return null;const max=1800,sc=Math.min(1,max/Math.max(c.width,c.height)),dc=document.createElement('canvas');dc.width=Math.round(c.width*sc);dc.height=Math.round(c.height*sc);dc.getContext('2d').drawImage(c,0,0,dc.width,dc.height);const src=cv.imread(dc),gray=new cv.Mat(),blur=new cv.Mat(),edge=new cv.Mat(),cont=new cv.MatVector(),hier=new cv.Mat();let best=null;try{cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);cv.GaussianBlur(gray,blur,new cv.Size(5,5),0);cv.Canny(blur,35,130,edge);cv.dilate(edge,edge,cv.Mat.ones(3,3,cv.CV_8U));cv.findContours(edge,cont,hier,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);const areaAll=dc.width*dc.height;for(let i=0;i<cont.size();i++){const q=cont.get(i),area=Math.abs(cv.contourArea(q));if(area<areaAll*.16)continue;const peri=cv.arcLength(q,true),ap=new cv.Mat();cv.approxPolyDP(q,ap,.018*peri,true);if(ap.rows===4&&cv.isContourConvex(ap)){const pts=[];for(let j=0;j<4;j++){const p=ap.intPtr(j,0);pts.push({x:p[0],y:p[1]})}const ar=area/areaAll,score=ar*10-(ar>.99?8:0);if(!best||score>best.score)best={pts,score}}ap.delete()}if(!best)return null;const pts=best.pts.map(p=>({x:p.x/sc,y:p.y/sc})),sum=p=>p.x+p.y,diff=p=>p.x-p.y;return [pts.reduce((a,b)=>sum(a)<sum(b)?a:b),pts.reduce((a,b)=>diff(a)>diff(b)?a:b),pts.reduce((a,b)=>sum(a)>sum(b)?a:b),pts.reduce((a,b)=>diff(a)<diff(b)?a:b)]}finally{[src,gray,blur,edge,hier].forEach(x=>x.delete());cont.delete()}}
  })();

  // ---------- ADVANCED PDF STUDIO v11.5 ----------
  (function(){
    const sec=$('pdf');if(!sec)return;
    $('pdfAdvancedV114')?.remove();
    let launch=$('openAdvancedPdfV115');
    if(!launch){const card=document.createElement('div');card.className='utility-card';card.innerHTML='<h3>Advanced PDF Studio</h3><p class="muted">Crop, perspective, arrange pages, color, export PDF/images.</p><button class="primary-btn" id="openAdvancedPdfV115">Open Studio</button>';sec.querySelector('.utility-grid')?.appendChild(card);launch=card.querySelector('button')}
    const panel=document.createElement('div');panel.id='pdfAdvancedV115';panel.className='pdf-v114 panel';panel.hidden=true;panel.innerHTML=`
      <div class="workspace-head"><div><span class="eyebrow">ADVANCED PDF STUDIO</span><h2>Crop, Arrange & Enhance PDF</h2></div><div class="workspace-actions"><label class="upload-btn">Open PDF<input id="pdfV115Input" type="file" accept="application/pdf,.pdf" hidden></label><button class="ghost-btn" id="pdfV115Close">Close</button></div></div>
      <div class="pdf-v114-toolbar">
        <button class="ghost-btn" id="pdfV115Pages">Show All Pages</button>
        <label>Apply to<select id="pdfV115Scope"><option value="current">Current page</option><option value="selected">Selected pages</option><option value="all">All pages</option><option value="even">Even pages</option><option value="odd">Odd pages</option></select></label>
        <button class="ghost-btn" id="pdfV115Crop">Crop</button><button class="ghost-btn" id="pdfV115Auto">Auto Detect</button><button class="ghost-btn" id="pdfV115Perspective">Perspective Crop</button>
        <button class="ghost-btn" id="pdfV115RotL">↶ 90°</button><button class="ghost-btn" id="pdfV115RotR">↷ 90°</button>
        <label>Color<select id="pdfV115Color"><option value="original">Original</option><option value="document">Document</option><option value="gray">Grayscale</option><option value="bw">B&W</option><option value="vivid">Vivid</option></select></label>
        <button class="ghost-btn" id="pdfV115Blank">Add Blank After Current</button><label class="upload-btn">Add PDF After Current<input id="pdfV115InsertPdf" type="file" accept="application/pdf,.pdf" hidden></label><button class="ghost-btn" id="pdfV115Delete">Delete</button><button class="ghost-btn" id="pdfV115Numbers">Page Numbers: Off</button>
      </div>
      <div class="pdf-v114-body" id="pdfV115Body"><div class="pdf-v114-thumbs" id="pdfV115Thumbs"></div><div class="pdf-v114-stage" id="pdfV115Stage"><canvas id="pdfV115Canvas"></canvas><div class="v114-crop-box" id="pdfV115CropBox" hidden><i data-h="nw"></i><i data-h="n"></i><i data-h="ne"></i><i data-h="e"></i><i data-h="se"></i><i data-h="s"></i><i data-h="sw"></i><i data-h="w"></i></div><div id="pdfV115PerspectiveLayer" hidden><svg viewBox="0 0 100 100" preserveAspectRatio="none"><polygon id="pdfV115Poly"></polygon></svg><b data-i="0"></b><b data-i="1"></b><b data-i="2"></b><b data-i="3"></b></div><div class="pdf-v115-page-grid" id="pdfV115Grid" hidden></div></div></div>
      <div class="pdf-v114-export"><label>Export<select id="pdfV115ExportMode"><option value="all">All</option><option value="selected">Selected</option><option value="even">Even</option><option value="odd">Odd</option><option value="range">Range</option></select></label><input id="pdfV115Range" placeholder="1-3,5"><button class="primary-btn" id="pdfV115ExportPdf">Export PDF</button><label>Image<select id="pdfV115ImageType"><option value="png">PNG</option><option value="jpeg">JPG</option></select></label><button class="ghost-btn" id="pdfV115ExportImage">Export as Image</button><span id="pdfV115Status" class="status-inline">Open a PDF to start.</span></div>`;
    sec.appendChild(panel);
    launch.onclick=()=>{panel.hidden=false;panel.scrollIntoView({behavior:'smooth',block:'start'})};$('pdfV115Close').onclick=()=>panel.hidden=true;
    let pages=[],current=0,selectedSet=new Set(),pageNums=false,gridMode=false,cropMode=false,perspMode=false,crop={x:.05,y:.05,w:.9,h:.9},pts=null,cropDrag=null,perspDrag=null;
    const stage=$('pdfV115Stage'),canvas=$('pdfV115Canvas'),box=$('pdfV115CropBox'),pl=$('pdfV115PerspectiveLayer'),grid=$('pdfV115Grid'),status=t=>$('pdfV115Status').textContent=t;
    function rotateCanvas(src,deg){const r=((deg%360)+360)%360;if(!r)return src;const o=document.createElement('canvas');if(r===90||r===270){o.width=src.height;o.height=src.width}else{o.width=src.width;o.height=src.height}const x=o.getContext('2d');x.translate(o.width/2,o.height/2);x.rotate(r*Math.PI/180);x.drawImage(src,-src.width/2,-src.height/2);return o}
    function colorCanvas(src,mode){if(!mode||mode==='original')return src;const o=document.createElement('canvas');o.width=src.width;o.height=src.height;const x=o.getContext('2d');x.drawImage(src,0,0);const d=x.getImageData(0,0,o.width,o.height),a=d.data;for(let i=0;i<a.length;i+=4){const lum=.299*a[i]+.587*a[i+1]+.114*a[i+2];if(mode==='gray')a[i]=a[i+1]=a[i+2]=lum;else if(mode==='bw'){const v=lum>170?255:0;a[i]=a[i+1]=a[i+2]=v}else if(mode==='document'){const v=lum>208?255:lum<92?0:clamp((lum-92)*2.25,0,255);a[i]=a[i+1]=a[i+2]=v}else if(mode==='vivid'){a[i]=clamp((a[i]-128)*1.18+128,0,255);a[i+1]=clamp((a[i+1]-128)*1.18+128,0,255);a[i+2]=clamp((a[i+2]-128)*1.18+128,0,255)}}x.putImageData(d,0,0);return o}
    function cropCanvas(src,r){if(!r)return src;const o=document.createElement('canvas');o.width=Math.max(1,Math.round(src.width*r.w));o.height=Math.max(1,Math.round(src.height*r.h));o.getContext('2d').drawImage(src,src.width*r.x,src.height*r.y,src.width*r.w,src.height*r.h,0,0,o.width,o.height);return o}
    function processed(p,{ignoreCrop=false,ignoreColor=false}={}){let c=document.createElement('canvas');c.width=p.canvas.width;c.height=p.canvas.height;c.getContext('2d').drawImage(p.canvas,0,0);c=rotateCanvas(c,p.rotation||0);if(!ignoreCrop)c=cropCanvas(c,p.crop);if(!ignoreColor)c=colorCanvas(c,p.color);return c}
    function render(){const p=pages[current];if(!p){canvas.width=canvas.height=0;return}const out=processed(p,{ignoreCrop:cropMode,ignoreColor:false});canvas.width=out.width;canvas.height=out.height;canvas.getContext('2d').drawImage(out,0,0);requestAnimationFrame(()=>{renderCrop();renderPerspective()})}
    async function pdfToPages(f){const m=await pdfJs(),pdf=await m.getDocument({data:new Uint8Array(await f.arrayBuffer())}).promise,out=[];for(let n=1;n<=pdf.numPages;n++){const pg=await pdf.getPage(n),vp=pg.getViewport({scale:1.65}),c=document.createElement('canvas');c.width=Math.max(1,Math.ceil(vp.width));c.height=Math.max(1,Math.ceil(vp.height));await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;out.push({canvas:c,name:`Page ${n}`,rotation:0,crop:null,color:'original'})}return out}
    async function openPdf(f){status('Loading PDF pages…');pages=await pdfToPages(f);current=0;selectedSet=new Set([0]);gridMode=false;grid.hidden=true;canvas.hidden=false;thumbs();render();status(`Loaded ${pages.length} page(s). Drag thumbnails or use Show All Pages to arrange.`)}
    $('pdfV115Input').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{await openPdf(f)}catch(err){console.error(err);status('Could not load this PDF.')}e.target.value=''};
    function selectPage(i,add=false){current=clamp(i,0,Math.max(0,pages.length-1));if(add){selectedSet.has(current)?selectedSet.delete(current):selectedSet.add(current)}else selectedSet=new Set([current]);thumbs();render();if(gridMode)renderGrid()}
    function thumbCanvas(p,max=130){const src=processed(p),sc=Math.min(1,max/Math.max(src.width,src.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(src.width*sc));c.height=Math.max(1,Math.round(src.height*sc));c.getContext('2d').drawImage(src,0,0,c.width,c.height);return c}
    function reorder(from,to){if(from===to||from<0||to<0||from>=pages.length||to>=pages.length)return;const [p]=pages.splice(from,1);pages.splice(to,0,p);const remap=i=>i===from?to:(from<to&&i>from&&i<=to?i-1:(to<from&&i>=to&&i<from?i+1:i));current=remap(current);selectedSet=new Set([...selectedSet].map(remap));thumbs();render();if(gridMode)renderGrid()}
    function thumbs(){const w=$('pdfV115Thumbs');w.innerHTML='';pages.forEach((p,i)=>{const d=document.createElement('div');d.className='pdf-v114-thumb'+(i===current?' active':'')+(selectedSet.has(i)?' selected':'');d.draggable=true;d.dataset.i=i;d.appendChild(thumbCanvas(p));const s=document.createElement('span');s.textContent=`${i+1}${selectedSet.has(i)?' ✓':''}`;d.appendChild(s);d.onclick=e=>selectPage(i,e.ctrlKey||e.metaKey||e.shiftKey);d.ondragstart=e=>e.dataTransfer.setData('text/plain',String(i));d.ondragover=e=>e.preventDefault();d.ondrop=e=>{e.preventDefault();reorder(+e.dataTransfer.getData('text/plain'),i)};w.appendChild(d)})}
    function renderGrid(){grid.innerHTML='';pages.forEach((p,i)=>{const d=document.createElement('div');d.className='pdf-v115-grid-item'+(i===current?' active':'')+(selectedSet.has(i)?' selected':'');d.draggable=true;d.dataset.i=i;d.appendChild(thumbCanvas(p,220));const bar=document.createElement('div');bar.className='pdf-v115-grid-actions';bar.innerHTML=`<span>Page ${i+1}</span><button data-a="rot">↷</button><button data-a="del">🗑</button>`;d.appendChild(bar);d.onclick=e=>{const a=e.target.dataset.a;if(a==='rot'){p.rotation=(p.rotation+90)%360;thumbs();renderGrid();if(i===current)render();return}if(a==='del'){deleteIndices([i]);return}selectPage(i,e.ctrlKey||e.metaKey||e.shiftKey)};d.ondragstart=e=>e.dataTransfer.setData('text/plain',String(i));d.ondragover=e=>e.preventDefault();d.ondrop=e=>{e.preventDefault();reorder(+e.dataTransfer.getData('text/plain'),i)};grid.appendChild(d)})}
    $('pdfV115Pages').onclick=()=>{if(!pages.length)return status('Open a PDF first.');gridMode=!gridMode;grid.hidden=!gridMode;canvas.hidden=gridMode;box.hidden=true;pl.hidden=true;cropMode=perspMode=false;$('pdfV115Pages').textContent=gridMode?'Back to Page':'Show All Pages';if(gridMode)renderGrid();else render()};
    function indicesFor(mode){const all=pages.map((_,i)=>i);if(mode==='current')return pages[current]?[current]:[];if(mode==='selected')return [...selectedSet].sort((a,b)=>a-b);if(mode==='even')return all.filter(i=>(i+1)%2===0);if(mode==='odd')return all.filter(i=>(i+1)%2===1);return all}
    function actionIndices(){return indicesFor($('pdfV115Scope').value)}
    function deleteIndices(idx){const del=new Set(idx);pages=pages.filter((_,i)=>!del.has(i));current=Math.min(current,Math.max(0,pages.length-1));selectedSet=pages.length?new Set([current]):new Set();thumbs();if(gridMode)renderGrid();else render();status(`Deleted ${del.size} page(s).`)}
    $('pdfV115Delete').onclick=()=>{const idx=actionIndices();if(!idx.length)return;deleteIndices(idx)};
    $('pdfV115RotL').onclick=()=>{actionIndices().forEach(i=>pages[i].rotation=(pages[i].rotation-90)%360);thumbs();render();if(gridMode)renderGrid()};
    $('pdfV115RotR').onclick=()=>{actionIndices().forEach(i=>pages[i].rotation=(pages[i].rotation+90)%360);thumbs();render();if(gridMode)renderGrid()};
    $('pdfV115Color').onchange=e=>{actionIndices().forEach(i=>pages[i].color=e.target.value);thumbs();render();if(gridMode)renderGrid()};
    $('pdfV115Blank').onclick=()=>{const ref=pages[current]?.canvas,c=document.createElement('canvas');c.width=ref?.width||1240;c.height=ref?.height||1754;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);const at=pages.length?current+1:0;pages.splice(at,0,{canvas:c,name:'Blank page',rotation:0,crop:null,color:'original'});selectPage(at);if(gridMode)renderGrid();status('Blank page inserted after current page.')};
    $('pdfV115InsertPdf').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{status('Importing PDF pages…');const add=await pdfToPages(f),at=pages.length?current+1:0;pages.splice(at,0,...add);selectPage(at);if(gridMode)renderGrid();status(`Inserted ${add.length} page(s) after current page.`)}catch(err){console.error(err);status('Could not insert this PDF.')}e.target.value=''};
    function renderCrop(){if(box.hidden||!canvas.width)return;const cr=canvas.getBoundingClientRect(),sr=stage.getBoundingClientRect();box.style.left=(cr.left-sr.left+crop.x*cr.width)+'px';box.style.top=(cr.top-sr.top+crop.y*cr.height)+'px';box.style.width=(crop.w*cr.width)+'px';box.style.height=(crop.h*cr.height)+'px'}
    box.addEventListener('pointerdown',e=>{e.preventDefault();const cr=canvas.getBoundingClientRect();cropDrag={h:e.target.dataset.h||'move',sx:e.clientX,sy:e.clientY,r:{...crop},cw:cr.width,ch:cr.height};box.setPointerCapture?.(e.pointerId)});
    window.addEventListener('pointermove',e=>{if(!cropDrag)return;const dx=(e.clientX-cropDrag.sx)/cropDrag.cw,dy=(e.clientY-cropDrag.sy)/cropDrag.ch,r={...cropDrag.r},h=cropDrag.h,min=.02;if(h==='move'){r.x=clamp(r.x+dx,0,1-r.w);r.y=clamp(r.y+dy,0,1-r.h)}else{if(h.includes('w')){const nx=clamp(r.x+dx,0,r.x+r.w-min);r.w+=r.x-nx;r.x=nx}if(h.includes('e'))r.w=clamp(r.w+dx,min,1-r.x);if(h.includes('n')){const ny=clamp(r.y+dy,0,r.y+r.h-min);r.h+=r.y-ny;r.y=ny}if(h.includes('s'))r.h=clamp(r.h+dy,min,1-r.y)}crop=r;renderCrop()});window.addEventListener('pointerup',()=>cropDrag=null);
    function enterCrop(r){cropMode=true;perspMode=false;pl.hidden=true;crop=r||{x:.04,y:.04,w:.92,h:.92};render();box.hidden=false;$('pdfV115Crop').textContent='Apply Crop';requestAnimationFrame(renderCrop)}
    $('pdfV115Crop').onclick=()=>{if(!pages.length)return status('Open a PDF first.');if(!cropMode){enterCrop(pages[current].crop||{x:.04,y:.04,w:.92,h:.92})}else{actionIndices().forEach(i=>pages[i].crop={...crop});cropMode=false;box.hidden=true;$('pdfV115Crop').textContent='Crop';thumbs();render();if(gridMode)renderGrid();status(`Crop applied to ${actionIndices().length} page(s).`)}};
    function detectRect(src){if(typeof cv==='undefined'||!cv.Mat)return null;const max=1700,sc=Math.min(1,max/Math.max(src.width,src.height)),dc=document.createElement('canvas');dc.width=Math.max(1,Math.round(src.width*sc));dc.height=Math.max(1,Math.round(src.height*sc));dc.getContext('2d').drawImage(src,0,0,dc.width,dc.height);const im=cv.imread(dc),gray=new cv.Mat(),blur=new cv.Mat(),edges=new cv.Mat(),contours=new cv.MatVector(),hier=new cv.Mat();let best=null;try{cv.cvtColor(im,gray,cv.COLOR_RGBA2GRAY);cv.GaussianBlur(gray,blur,new cv.Size(5,5),0);for(const pair of [[25,90],[40,130],[60,180]]){cv.Canny(blur,pair[0],pair[1],edges);cv.dilate(edges,edges,cv.Mat.ones(3,3,cv.CV_8U));cv.findContours(edges,contours,hier,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);for(let i=0;i<contours.size();i++){const q=contours.get(i),area=Math.abs(cv.contourArea(q));if(area<dc.width*dc.height*.08)continue;const r=cv.boundingRect(q),ar=(r.width*r.height)/(dc.width*dc.height),fill=area/Math.max(1,r.width*r.height),touch=(r.x<3&&r.y<3&&r.x+r.width>dc.width-3&&r.y+r.height>dc.height-3);const score=ar+fill*.35-(touch?.7:0);if(r.width>dc.width*.25&&r.height>dc.height*.25&&(!best||score>best.score))best={r,score}}if(best&&best.score>.45)break}if(!best)return null;const r=best.r;return{x:clamp(r.x/dc.width,0,1),y:clamp(r.y/dc.height,0,1),w:clamp(r.width/dc.width,.02,1-r.x/dc.width),h:clamp(r.height/dc.height,.02,1-r.y/dc.height)}}finally{[im,gray,blur,edges,hier].forEach(x=>x.delete());contours.delete()}}
    $('pdfV115Auto').onclick=()=>{if(!pages.length)return status('Open a PDF first.');const base=processed(pages[current],{ignoreCrop:true,ignoreColor:true}),r=detectRect(base);if(r){enterCrop(r);status('Document boundary detected. Adjust the crop if needed, then Apply Crop.')}else{enterCrop({x:.02,y:.02,w:.96,h:.96});status('No strong edge was found; a full-page crop is ready for manual adjustment.')}};
    function renderPerspective(){if(pl.hidden||!pts||!canvas.width)return;const cr=canvas.getBoundingClientRect(),sr=stage.getBoundingClientRect();pl.style.left=(cr.left-sr.left)+'px';pl.style.top=(cr.top-sr.top)+'px';pl.style.width=cr.width+'px';pl.style.height=cr.height+'px';$('pdfV115Poly').setAttribute('points',pts.map(p=>`${p.x*100},${p.y*100}`).join(' '));pl.querySelectorAll('b').forEach((b,i)=>{b.style.left=pts[i].x*100+'%';b.style.top=pts[i].y*100+'%'})}
    pl.querySelectorAll('b').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();perspDrag=+b.dataset.i;b.setPointerCapture?.(e.pointerId)};b.onpointermove=e=>{if(perspDrag==null)return;const cr=canvas.getBoundingClientRect();pts[perspDrag]={x:clamp((e.clientX-cr.left)/cr.width,0,1),y:clamp((e.clientY-cr.top)/cr.height,0,1)};renderPerspective()};b.onpointerup=b.onpointercancel=()=>perspDrag=null});
    $('pdfV115Perspective').onclick=async()=>{if(!pages.length)return status('Open a PDF first.');if(!perspMode){perspMode=true;cropMode=false;box.hidden=true;const base=processed(pages[current],{ignoreCrop:true,ignoreColor:true});canvas.width=base.width;canvas.height=base.height;canvas.getContext('2d').drawImage(base,0,0);pts=[{x:.04,y:.04},{x:.96,y:.04},{x:.96,y:.96},{x:.04,y:.96}];pl.hidden=false;$('pdfV115Perspective').textContent='Apply Perspective';requestAnimationFrame(renderPerspective);return}if(typeof cv==='undefined'||!cv.Mat)return status('Perspective engine is still loading.');try{const src=canvas,px=pts.map(p=>({x:p.x*src.width,y:p.y*src.height})),w=Math.max(Math.hypot(px[1].x-px[0].x,px[1].y-px[0].y),Math.hypot(px[2].x-px[3].x,px[2].y-px[3].y)),h=Math.max(Math.hypot(px[3].x-px[0].x,px[3].y-px[0].y),Math.hypot(px[2].x-px[1].x,px[2].y-px[1].y)),sm=cv.imread(src),sp=cv.matFromArray(4,1,cv.CV_32FC2,px.flatMap(p=>[p.x,p.y])),dp=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,w-1,0,w-1,h-1,0,h-1]),M=cv.getPerspectiveTransform(sp,dp),dst=new cv.Mat();cv.warpPerspective(sm,dst,M,new cv.Size(Math.max(1,Math.round(w)),Math.max(1,Math.round(h))),cv.INTER_CUBIC,cv.BORDER_REPLICATE,new cv.Scalar());const o=document.createElement('canvas');cv.imshow(o,dst);[sm,sp,dp,M,dst].forEach(x=>x.delete());pages[current]={...pages[current],canvas:o,rotation:0,crop:null};perspMode=false;pl.hidden=true;$('pdfV115Perspective').textContent='Perspective Crop';thumbs();render();if(gridMode)renderGrid();status('Perspective crop applied.')}catch(err){console.error(err);status('Perspective crop could not be applied. Adjust the four corners and try again.')}};
    $('pdfV115Numbers').onclick=()=>{pageNums=!pageNums;$('pdfV115Numbers').textContent=`Page Numbers: ${pageNums?'On':'Off'}`};
    function parseRange(s,max){const out=[];for(const part of String(s||'').split(',').map(x=>x.trim()).filter(Boolean)){if(part.includes('-')){let[a,b]=part.split('-').map(Number);if(a>b)[a,b]=[b,a];for(let n=a;n<=b;n++)if(n>=1&&n<=max)out.push(n-1)}else{const n=+part;if(n>=1&&n<=max)out.push(n-1)}}return[...new Set(out)]}
    function exportIndices(){const m=$('pdfV115ExportMode').value;if(m==='range')return parseRange($('pdfV115Range').value,pages.length);return indicesFor(m)}
    $('pdfV115ExportPdf').onclick=async()=>{const idx=exportIndices();if(!idx.length)return status('No pages selected for export.');status('Exporting PDF…');try{const doc=await PDFLib.PDFDocument.create(),font=pageNums?await doc.embedFont(PDFLib.StandardFonts.Helvetica):null;for(let k=0;k<idx.length;k++){const out=processed(pages[idx[k]]),b=await blobOf(out,'image/jpeg',.93),im=await doc.embedJpg(await b.arrayBuffer()),pg=doc.addPage([im.width,im.height]);pg.drawImage(im,{x:0,y:0,width:im.width,height:im.height});if(pageNums)pg.drawText(String(k+1),{x:pg.getWidth()/2-4,y:12,size:10,font,color:PDFLib.rgb(.15,.15,.15)})}downloadBytes(await doc.save({useObjectStreams:true}),'pdf-studio-export.pdf','application/pdf');status(`Exported ${idx.length} page(s) as PDF.`)}catch(err){console.error(err);status('PDF export failed.')}};
    $('pdfV115ExportImage').onclick=async()=>{const idx=exportIndices();if(!idx.length)return status('No pages selected for export.');const type=$('pdfV115ImageType').value==='jpeg'?'image/jpeg':'image/png',ext=type==='image/jpeg'?'jpg':'png';status(`Exporting ${idx.length} image(s)…`);try{if(idx.length===1){const out=processed(pages[idx[0]]),b=await blobOf(out,type,.94);downloadBlob(b,`pdf-page-${idx[0]+1}.${ext}`)}else if(typeof JSZip!=='undefined'){const zip=new JSZip();for(const i of idx){const out=processed(pages[i]),b=await blobOf(out,type,.94);zip.file(`pdf-page-${i+1}.${ext}`,b)}downloadBlob(await zip.generateAsync({type:'blob'}),`pdf-pages-${ext}.zip`)}else{for(const i of idx){const out=processed(pages[i]),b=await blobOf(out,type,.94);downloadBlob(b,`pdf-page-${i+1}.${ext}`);await new Promise(r=>setTimeout(r,150))}}status(`Exported ${idx.length} page(s) as ${ext.toUpperCase()}.`)}catch(err){console.error(err);status('Image export failed.')}};
    window.addEventListener('resize',()=>{renderCrop();renderPerspective()});
  })();


  document.title='Shop Studio Pro v11.9.2'; const bs=document.querySelector('.brand-subtitle');if(bs)bs.textContent='PRO TOOLKIT • V11.9.2';
})();

/* END app-v11.5.0.js */

;
/* BEGIN app-v11.6.0.js */
/* Shop Studio Pro v11.6 — stabilization layer: Passport workflow, Print Studio Pro, Advanced PDF Studio */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mm2px=(mm,dpi=300)=>Math.max(1,Math.round(mm/25.4*dpi));
const blobOf=(c,t='image/png',q=.95)=>new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error('Canvas export failed')),t,q));
const imgFromFile=f=>new Promise((res,rej)=>{const u=URL.createObjectURL(f),im=new Image();im.onload=()=>{URL.revokeObjectURL(u);res(im)};im.onerror=e=>{URL.revokeObjectURL(u);rej(e)};im.src=u});
const imgFromCanvas=c=>new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=c.toDataURL('image/png')});
const download=(blob,name)=>{const a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download=window.shopAutoFilename?window.shopAutoFilename(name):name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500)};
const cloneCanvas=c=>{const n=document.createElement('canvas');n.width=c.width;n.height=c.height;n.getContext('2d').drawImage(c,0,0);return n};
const pdfjs=async()=>{const m=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');m.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';return m};
const S=window.state||{};

function removeSmartCrop(){
  document.querySelectorAll('button,label,.mini-btn,.ghost-btn,.primary-btn').forEach(el=>{
    const t=(el.textContent||'').trim(); if(/^smart\s*crop$/i.test(t)||/smart\s+auto\s*crop/i.test(t)) el.remove();
  });
}

/* -------- Passport Photo: keep sheet inside Passport section -------- */
function installPassportSheet(){
  const sec=$('photo'),btn=$('makePassportSheet'); if(!sec||!btn)return;
  let panel=$('passportSheetV116');
  if(!panel){
    panel=document.createElement('div');panel.id='passportSheetV116';panel.className='passport-sheet-v116';panel.hidden=true;
    panel.innerHTML=`
      <div class="workspace-head passport-sheet-head"><div><span class="eyebrow">PASSPORT PRINT SHEET</span><h3>Your 8-Photo Sheet</h3></div><div class="button-row"><button class="ghost-btn" id="passportSheetClose">Close Preview</button></div></div>
      <div class="compact-controls passport-sheet-controls" hidden aria-hidden="true">
        <label>Paper<select id="ps116Paper"><option value="6x4">6×4</option><option value="a4">A4</option></select></label>
        <label>Orientation<select id="ps116Orientation"><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select></label>
        <label>Copies<input id="ps116Copies" type="number" min="1" max="50" value="8"></label>
        <label>Margin (mm)<input id="ps116Margin" type="number" min="0" max="30" step="0.5" value="3"></label>
        <label>Photo Gap (mm)<input id="ps116Gap" type="number" min="0" max="20" step="0.5" value="4.5"></label>
        <label>DPI<select id="ps116Dpi"><option value="300" selected>300</option><option value="600">600</option></select></label>
        <label>Border<select id="ps116Border"><option value="0">None</option><option value="1">1 px</option><option value="2" selected>2 px</option><option value="3">3 px</option></select></label>
        <label>Cut Lines<select id="ps116Cut"><option value="yes" selected>On</option><option value="no">Off</option></select></label>
      </div>
      <div class="canvas-wrap passport-sheet-canvas-wrap"><canvas id="passportSheetCanvasV116"></canvas></div>
      <div class="status-inline" id="passportSheetStatusV116">Change any option to regenerate automatically.</div>
      <div class="workspace-actions"><button class="primary-btn" id="passportSheetRegenV116">Regenerate</button><button class="ghost-btn" id="passportSheetPdfV116">PDF</button><button class="ghost-btn" id="passportSheetPrintV116">Print</button></div>`;
    sec.querySelector('.panel')?.appendChild(panel);
  }
  const old=btn.cloneNode(true);btn.replaceWith(old);
  const srcCanvas=$('photoCanvas');
  function syncBase(){
    $('ps116Paper').value='6x4';
    $('ps116Copies').value='8';
    $('ps116Border').value='2';
    $('ps116Cut').value='yes';
    $('ps116Margin').value='3';
    $('ps116Gap').value='4.5';
    $('ps116Orientation').value='landscape';
    $('ps116Dpi').value='300';
  }
  function draw(){
    if(!srcCanvas||!srcCanvas.width){$('passportSheetStatusV116').textContent='Upload and prepare a passport photo first.';return;}
    const dpi=+$('ps116Dpi').value||300,paper=$('ps116Paper').value,ori=$('ps116Orientation').value;
    let W=paper==='a4'?mm2px(210,dpi):6*dpi,H=paper==='a4'?mm2px(297,dpi):4*dpi;if(ori==='landscape'&&H>W)[W,H]=[H,W];if(ori==='portrait'&&W>H)[W,H]=[H,W];
    const ratio=$('passportRatio')?.value||'0.7777778';let photoW=mm2px(ratio==='0.8'?40:35,dpi),photoH=mm2px(ratio==='0.8'?50:45,dpi);
    const count=8,margin=mm2px(+$('ps116Margin').value||0,dpi),gap=mm2px(+$('ps116Gap').value||0,dpi);
    const availW=Math.max(1,W-margin*2),availH=Math.max(1,H-margin*2);
    let best=null;for(let cols=1;cols<=count;cols++){const rows=Math.ceil(count/cols),gw=cols*photoW+(cols-1)*gap,gh=rows*photoH+(rows-1)*gap;if(gw<=availW&&gh<=availH){const waste=(availW-gw)+(availH-gh);if(!best||waste<best.waste)best={cols,rows,gw,gh,waste}}}
    if(!best){const cols=Math.ceil(Math.sqrt(count*availW/availH)),rows=Math.ceil(count/cols),maxPW=(availW-(cols-1)*gap)/cols,maxPH=(availH-(rows-1)*gap)/rows,scale=Math.min(maxPW/photoW,maxPH/photoH);photoW=Math.max(1,Math.floor(photoW*scale));photoH=Math.max(1,Math.floor(photoH*scale));best={cols,rows,gw:cols*photoW+(cols-1)*gap,gh:rows*photoH+(rows-1)*gap};}
    const c=$('passportSheetCanvasV116'),ctx=c.getContext('2d');c.width=W;c.height=H;ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    const sx=(W-best.gw)/2,sy=(H-best.gh)/2,border=+$('ps116Border').value||0,cut=$('ps116Cut').value==='yes';
    for(let i=0;i<count;i++){const col=i%best.cols,row=Math.floor(i/best.cols),x=Math.round(sx+col*(photoW+gap)),y=Math.round(sy+row*(photoH+gap));ctx.drawImage(srcCanvas,0,0,srcCanvas.width,srcCanvas.height,x,y,photoW,photoH);if(border){ctx.strokeStyle='#111';ctx.lineWidth=border;ctx.strokeRect(x+.5,y+.5,photoW-1,photoH-1)}if(cut){ctx.save();ctx.strokeStyle='rgba(0,0,0,.55)';ctx.lineWidth=1;ctx.setLineDash([]);const m=Math.max(8,Math.round(dpi/25)),o=Math.max(3,Math.round(dpi/75));ctx.beginPath();ctx.moveTo(x-o-m,y-o);ctx.lineTo(x-o,y-o);ctx.lineTo(x-o,y-o-m);ctx.moveTo(x+photoW+o+m,y-o);ctx.lineTo(x+photoW+o,y-o);ctx.lineTo(x+photoW+o,y-o-m);ctx.moveTo(x-o-m,y+photoH+o);ctx.lineTo(x-o,y+photoH+o);ctx.lineTo(x-o,y+photoH+o+m);ctx.moveTo(x+photoW+o+m,y+photoH+o);ctx.lineTo(x+photoW+o,y+photoH+o);ctx.lineTo(x+photoW+o,y+photoH+o+m);ctx.stroke();ctx.restore()}}
    $('passportSheetStatusV116').textContent=`8 photos • 6×4 in sheet • ready to save as PDF or print. Note: photos automatically scale to fit the selected sheet.`;
  }
  old.addEventListener('click',e=>{e.preventDefault();syncBase();panel.hidden=false;draw();panel.scrollIntoView({behavior:'smooth',block:'start'})});
  $('passportSheetClose').onclick=()=>panel.hidden=true;
  $('passportSheetRegenV116').onclick=draw;
  panel.querySelectorAll('input,select').forEach(x=>x.addEventListener('input',draw));
  $('passportSheetPdfV116').onclick=async()=>{draw();if(!window.PDFLib)return alert('PDF export library is unavailable.');const c=$('passportSheetCanvasV116'),doc=await PDFLib.PDFDocument.create(),im=await doc.embedPng(await (await blobOf(c,'image/png')).arrayBuffer()),p=doc.addPage([432,288]);p.drawImage(im,{x:0,y:0,width:432,height:288});download(new Blob([await doc.save()],{type:'application/pdf'}),'passport-8-photos-6x4.pdf')};
  $('passportSheetPrintV116').onclick=()=>{draw();const u=$('passportSheetCanvasV116').toDataURL('image/png'),w=open('','_blank');if(!w)return;w.document.write(`<html><head><title>Passport Sheet</title><style>@page{size:6in 4in;margin:0}html,body{width:6in;height:4in;margin:0}body{display:grid;place-items:center}img{display:block;width:6in;height:4in}</style></head><body><img src="${u}" onload="print();setTimeout(()=>close(),500)"></body></html>`);w.document.close()};
}

/* -------- Print Studio Pro: snap/alignment/templates -------- */
function installPrintStudioPro(){
  const sec=$('print'),wrap=$('printCanvasWrap'),canvas=$('printCanvas');if(!sec||!wrap||!canvas)return;
  // Disable previous overlays/controllers to avoid competing pointer handlers.
  ['printV111Layer','printInteractiveLayer','printEditor'].forEach(id=>{const n=$(id);if(n){n.style.display='none';n.style.pointerEvents='none'}});
  let bar=$('printV116Tools');if(!bar){bar=document.createElement('div');bar.id='printV116Tools';bar.className='print-v116-tools';bar.innerHTML=`<label class="upload-btn">Load Images<input id="printV116Images" type="file" accept="image/*" multiple hidden></label><label class="ghost-btn">Load PDF<input id="printV116Pdf" type="file" accept="application/pdf" hidden></label><label>Snap <input id="printV116Snap" type="checkbox" checked></label><label>Grid mm <input id="printV116Grid" type="number" value="2" min="0.5" step="0.5"></label><button class="ghost-btn" id="printV116SaveTpl">Save Template</button><button class="ghost-btn" id="printV116LoadTpl">Load Template</button>`;sec.querySelector('.compact-controls')?.insertAdjacentElement('afterend',bar)}
  let layer=$('printV116Layer');if(!layer){layer=document.createElement('div');layer.id='printV116Layer';layer.className='print-v116-layer';wrap.appendChild(layer)}
  let sources=[],items=[],sel=new Set(),active=-1;
  const paper=()=>{const dpi=+($('printDpiV11')?.value||$('printDpi')?.value||300),p=$('printPaper')?.value||'6x4',o=$('printOrientation')?.value||'landscape';let w=p==='a4'?mm2px(210,dpi):6*dpi,h=p==='a4'?mm2px(297,dpi):4*dpi;if(o==='landscape'&&h>w)[w,h]=[h,w];if(o==='portrait'&&w>h)[w,h]=[h,w];return{w,h,dpi}};
  const snap=(v,axis)=>{if(!$('printV116Snap').checked)return v;const p=paper(),step=mm2px(+$('printV116Grid').value||2,p.dpi)/(axis==='x'?p.w:p.h);return Math.round(v/step)*step};
  function layout(){if(!sources.length)return;const {w,h,dpi}=paper(),n=Math.max(1,+$('printCount').value||sources.length),cols=Math.ceil(Math.sqrt(n*w/h)),rows=Math.ceil(n/cols),m=mm2px(+$('printMargin').value||4,dpi),g=mm2px(+($('printGapV11')?.value||$('printGap')?.value||3),dpi),cw=(w-2*m-(cols-1)*g)/cols,ch=(h-2*m-(rows-1)*g)/rows;items=[];for(let i=0;i<n;i++){const s=sources[i%sources.length];items.push({img:s.img,name:s.name,x:(m+(i%cols)*(cw+g))/w,y:(m+Math.floor(i/cols)*(ch+g))/h,w:cw/w,h:ch/h,crop:{x:0,y:0,w:1,h:1}})}sel=new Set([0]);active=0;draw()}
  function draw(){const {w,h}=paper(),ctx=canvas.getContext('2d');canvas.width=w;canvas.height=h;ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';items.forEach(it=>{const r=it.crop;ctx.drawImage(it.img,r.x*it.img.width,r.y*it.img.height,r.w*it.img.width,r.h*it.img.height,it.x*w,it.y*h,it.w*w,it.h*h)});$('printEmpty')&&( $('printEmpty').style.display=items.length?'none':'');requestAnimationFrame(overlay)}
  function overlay(){const cr=canvas.getBoundingClientRect(),wr=wrap.getBoundingClientRect();layer.style.left=(cr.left-wr.left+wrap.scrollLeft)+'px';layer.style.top=(cr.top-wr.top+wrap.scrollTop)+'px';layer.style.width=cr.width+'px';layer.style.height=cr.height+'px';layer.innerHTML='';items.forEach((it,i)=>{const d=document.createElement('div');d.className='print-v116-item'+(sel.has(i)?' selected':'');Object.assign(d.style,{left:it.x*100+'%',top:it.y*100+'%',width:it.w*100+'%',height:it.h*100+'%'});d.dataset.i=i;['nw','n','ne','e','se','s','sw','w'].forEach(h=>{const q=document.createElement('i');q.className='print-v116-handle '+h;q.dataset.h=h;d.appendChild(q)});d.onpointerdown=e=>{e.preventDefault();e.stopPropagation();if(!e.ctrlKey&&!e.metaKey&&!sel.has(i))sel.clear();sel.add(i);active=i;overlay();const hnd=e.target.dataset.h||'move',base=items.map(x=>({...x})),sx=e.clientX,sy=e.clientY,cw=cr.width,ch=cr.height;const mv=ev=>{const dx=(ev.clientX-sx)/cw,dy=(ev.clientY-sy)/ch;sel.forEach(k=>{const b=base[k],n={...b};if(hnd==='move'){n.x=clamp(snap(b.x+dx,'x'),0,1-b.w);n.y=clamp(snap(b.y+dy,'y'),0,1-b.h)}else{const min=.02;if(hnd.includes('w')){const nx=clamp(snap(b.x+dx,'x'),0,b.x+b.w-min);n.w=b.w+(b.x-nx);n.x=nx}if(hnd.includes('e'))n.w=clamp(snap(b.w+dx,'x'),min,1-b.x);if(hnd.includes('n')){const ny=clamp(snap(b.y+dy,'y'),0,b.y+b.h-min);n.h=b.h+(b.y-ny);n.y=ny}if(hnd.includes('s'))n.h=clamp(snap(b.h+dy,'y'),min,1-b.y)}items[k]=n});draw()};const up=()=>{document.removeEventListener('pointermove',mv,true);document.removeEventListener('pointerup',up,true)};document.addEventListener('pointermove',mv,true);document.addEventListener('pointerup',up,true)};layer.appendChild(d)})}
  async function addFiles(files){for(const f of files){try{sources.push({img:await imgFromFile(f),name:f.name})}catch{}}layout()}
  $('printV116Images').onchange=e=>addFiles([...e.target.files]);
  $('printV116Pdf').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;const m=await pdfjs(),pdf=await m.getDocument({data:new Uint8Array(await f.arrayBuffer())}).promise;for(let n=1;n<=pdf.numPages;n++){const p=await pdf.getPage(n),v=p.getViewport({scale:2}),c=document.createElement('canvas');c.width=Math.ceil(v.width);c.height=Math.ceil(v.height);await p.render({canvasContext:c.getContext('2d'),viewport:v}).promise;sources.push({img:await imgFromCanvas(c),name:`${f.name} p${n}`})}layout()};
  function align(type){if(!sel.size)return;const arr=[...sel].map(i=>items[i]);if(type==='l'){const x=Math.min(...arr.map(x=>x.x));sel.forEach(i=>items[i].x=x)}if(type==='cx')sel.forEach(i=>items[i].x=(1-items[i].w)/2);if(type==='t'){const y=Math.min(...arr.map(x=>x.y));sel.forEach(i=>items[i].y=y)}if(type==='cy')sel.forEach(i=>items[i].y=(1-items[i].h)/2);draw()}
  if($('printV116AlignL'))$('printV116AlignL').onclick=()=>align('l');if($('printV116AlignC'))$('printV116AlignC').onclick=()=>align('cx');if($('printV116AlignT'))$('printV116AlignT').onclick=()=>align('t');if($('printV116CenterY'))$('printV116CenterY').onclick=()=>align('cy');
  $('printV116SaveTpl').onclick=()=>{localStorage.setItem('shopstudio_print_template_v116',JSON.stringify({paper:$('printPaper').value,orientation:$('printOrientation').value,margin:$('printMargin').value,count:$('printCount').value,items:items.map(({x,y,w,h,crop})=>({x,y,w,h,crop}))}));alert('Print template saved on this device.')};
  $('printV116LoadTpl').onclick=()=>{let t;try{t=JSON.parse(localStorage.getItem('shopstudio_print_template_v116')||'null')}catch{}if(!t)return alert('No saved template yet.');$('printPaper').value=t.paper;$('printOrientation').value=t.orientation;$('printMargin').value=t.margin;$('printCount').value=t.count;if(sources.length&&t.items?.length){items=t.items.map((x,i)=>({...x,img:sources[i%sources.length].img,name:sources[i%sources.length].name}));draw()}else layout()};
  ['printCount','printPaper','printOrientation','printMargin','printGapV11','printDpiV11','printDpi'].forEach(id=>$(id)?.addEventListener('change',()=>sources.length&&layout()));
  const oldBuild=$('buildPrintSheet');if(oldBuild){const b=oldBuild.cloneNode(true);oldBuild.replaceWith(b);b.onclick=()=>sources.length?layout():$('printV116Images').click()}
  const oldPng=$('downloadPrintSheet');if(oldPng){const b=oldPng.cloneNode(true);oldPng.replaceWith(b);b.onclick=async()=>{if(!canvas.width)return;download(await blobOf(canvas,'image/png'),'print-layout.png')}}
  const oldPdf=$('downloadPrintSheetPdf');if(oldPdf){const b=oldPdf.cloneNode(true);oldPdf.replaceWith(b);b.onclick=async()=>{if(!window.PDFLib||!canvas.width)return;const doc=await PDFLib.PDFDocument.create(),im=await doc.embedPng(await (await blobOf(canvas,'image/png')).arrayBuffer()),p=doc.addPage([im.width,im.height]);p.drawImage(im,{x:0,y:0,width:im.width,height:im.height});download(new Blob([await doc.save()],{type:'application/pdf'}),'print-layout.pdf')}}
}

/* -------- Advanced PDF Studio v11.6 -------- */
function installPdfStudio(){
  const sec=$('pdf');if(!sec)return;
  $('pdfAdvancedV115')?.remove();$('openAdvancedPdfV115')?.closest('.utility-card')?.remove();
  let card=$('pdfV116Card');if(!card){card=document.createElement('div');card.id='pdfV116Card';card.className='utility-card';card.innerHTML='<h3>Advanced PDF Studio</h3><p class="muted">Crop, perspective, pages, enhance, print and export.</p><button class="primary-btn" id="openPdfV116">Open Studio</button>';sec.querySelector('.utility-grid')?.appendChild(card)}
  let panel=$('pdfStudioV116');if(!panel){panel=document.createElement('div');panel.id='pdfStudioV116';panel.className='pdf116 panel';panel.hidden=true;panel.innerHTML=`
  <div class="workspace-head"><div><span class="eyebrow">ADVANCED PDF STUDIO</span><h2>Professional PDF Workspace</h2></div><div class="button-row"><label class="upload-btn">Open PDF<input id="pdf116Open" type="file" accept="application/pdf" hidden></label><button class="ghost-btn" id="pdf116Undo">Undo</button><button class="ghost-btn" id="pdf116Redo">Redo</button><button class="ghost-btn" id="pdf116Pages">Show All Pages</button><button class="ghost-btn" id="pdf116Close">Close</button></div></div>
  <div class="pdf116-toolbar">
    <label>Apply To<select id="pdf116Scope"><option value="current">Current</option><option value="selected">Selected</option><option value="all">All</option><option value="even">Even</option><option value="odd">Odd</option></select></label>
    <button class="ghost-btn" id="pdf116SelAll">All</button><button class="ghost-btn" id="pdf116SelEven">Even</button><button class="ghost-btn" id="pdf116SelOdd">Odd</button><button class="ghost-btn" id="pdf116SelClear">Clear</button>
    <button class="ghost-btn" id="pdf116Crop">Crop</button><button class="ghost-btn" id="pdf116AutoCrop">Auto Detect</button><button class="ghost-btn" id="pdf116Perspective">Perspective Crop</button><button class="ghost-btn" id="pdf116Deskew">Auto Deskew / Orient</button><button class="ghost-btn" id="pdf116RemoveBgWhite" title="Remove the background from passport/photo PDF pages and replace it with pure white">Remove BG + White</button>
    <button class="ghost-btn" id="pdf116RotL">↶ Rotate</button><button class="ghost-btn" id="pdf116RotR">↷ Rotate</button><select id="pdf116Color"><option value="original">Original</option><option value="document">Document Enhance</option><option value="gray">Grayscale</option><option value="adaptive">Adaptive B&W</option></select>
    <button class="ghost-btn" id="pdf116Delete">Delete</button><button class="ghost-btn" id="pdf116Blank">Add Blank</button><label class="ghost-btn">Add PDF<input id="pdf116AddPdf" type="file" accept="application/pdf" hidden></label><label class="ghost-btn">Add Image<input id="pdf116AddImage" type="file" accept="image/*" multiple hidden></label><label class="ghost-btn">Replace Page<input id="pdf116Replace" type="file" accept="image/*,application/pdf" hidden></label><button class="ghost-btn" id="pdf116Scanner">Insert Scanner Page</button>
  </div>
  <div class="pdf116-body"><div class="pdf116-thumbs" id="pdf116Thumbs"></div><div class="pdf116-stage" id="pdf116Stage"><div class="pdf116-canvas-shell" id="pdf116Shell"><canvas id="pdf116Canvas"></canvas><div id="pdf116CropBox" class="pdf116-crop" hidden>${['nw','n','ne','e','se','s','sw','w'].map(h=>`<i class="${h}" data-h="${h}"></i>`).join('')}</div><div id="pdf116PerspectiveLayer" class="pdf116-perspective" hidden><svg viewBox="0 0 100 100" preserveAspectRatio="none"><polygon id="pdf116Poly"></polygon></svg>${[0,1,2,3].map(i=>`<b data-i="${i}"></b>`).join('')}</div></div><div id="pdf116Grid" class="pdf116-grid" hidden></div></div></div>
  <div class="status-inline" id="pdf116Status">Open a PDF to begin.</div>
  <div class="pdf116-export"><label>Export<select id="pdf116ExportScope"><option value="all">All</option><option value="selected">Selected</option><option value="even">Even</option><option value="odd">Odd</option><option value="current">Current</option><option value="range">Range</option></select></label><input id="pdf116Range" placeholder="1-3,5"><label>Image<select id="pdf116ImageType"><option value="png">PNG</option><option value="jpeg">JPG</option></select></label><label>N-up<select id="pdf116Nup"><option value="1">1/page</option><option value="2">2/page</option><option value="4">4/page</option><option value="6">6/page</option><option value="9">9/page</option></select></label><button class="ghost-btn" id="pdf116Numbers">Page Numbers: Off</button><button class="primary-btn" id="pdf116ExportPdf">Export PDF</button><button class="ghost-btn" id="pdf116ExportImages">Export Images</button><button class="ghost-btn" id="pdf116Print">Direct Print / N-up</button></div>`;sec.querySelector('.panel')?.appendChild(panel)}
  $('openPdfV116').onclick=()=>{panel.hidden=false;panel.scrollIntoView({behavior:'smooth',block:'start'})};$('pdf116Close').onclick=()=>panel.hidden=true;
  const canvas=$('pdf116Canvas'),shell=$('pdf116Shell'),box=$('pdf116CropBox'),pl=$('pdf116PerspectiveLayer'),grid=$('pdf116Grid');
  let pages=[],current=0,selected=new Set(),gridMode=false,cropMode=false,crop={x:.04,y:.04,w:.92,h:.92},drag=null,perspMode=false,pts=null,pdrag=null,pageNumbers=false;
  const undo=[],redo=[];const status=t=>$('pdf116Status').textContent=t;
  function pageClone(p){return{canvas:cloneCanvas(p.canvas),name:p.name,rotation:p.rotation||0,crop:p.crop?{...p.crop}:null,color:p.color||'original'}}
  function snapshot(){return{pages:pages.map(pageClone),current,selected:[...selected]}}
  function pushHistory(){undo.push(snapshot());if(undo.length>15)undo.shift();redo.length=0}
  function restore(s){pages=s.pages.map(pageClone);current=clamp(s.current,0,Math.max(0,pages.length-1));selected=new Set(s.selected.filter(i=>i<pages.length));if(!selected.size&&pages.length)selected.add(current);cropMode=perspMode=false;box.hidden=pl.hidden=true;renderAll()}
  $('pdf116Undo').onclick=()=>{if(!undo.length)return;redo.push(snapshot());restore(undo.pop());status('Undid last PDF edit.')};$('pdf116Redo').onclick=()=>{if(!redo.length)return;undo.push(snapshot());restore(redo.pop());status('Redid PDF edit.')};
  async function pdfToPages(file){const m=await pdfjs(),pdf=await m.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise,out=[];for(let n=1;n<=pdf.numPages;n++){const pg=await pdf.getPage(n),vp=pg.getViewport({scale:2}),c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;out.push({canvas:c,name:`${file.name} • ${n}`,rotation:0,crop:null,color:'original'})}return out}
  async function imagePages(files){const out=[];for(const f of files){const im=await imgFromFile(f),c=document.createElement('canvas');c.width=im.naturalWidth||im.width;c.height=im.naturalHeight||im.height;c.getContext('2d').drawImage(im,0,0);out.push({canvas:c,name:f.name,rotation:0,crop:null,color:'original'})}return out}
  function indices(mode=$('pdf116Scope').value){if(mode==='current')return pages[current]?[current]:[];if(mode==='selected')return [...selected].sort((a,b)=>a-b);if(mode==='even')return pages.map((_,i)=>i).filter(i=>(i+1)%2===0);if(mode==='odd')return pages.map((_,i)=>i).filter(i=>(i+1)%2===1);return pages.map((_,i)=>i)}
  function parseRange(s){const out=[];String(s||'').split(',').map(x=>x.trim()).filter(Boolean).forEach(part=>{if(part.includes('-')){let[a,b]=part.split('-').map(Number);if(a>b)[a,b]=[b,a];for(let n=a;n<=b;n++)if(n>=1&&n<=pages.length)out.push(n-1)}else{const n=+part;if(n>=1&&n<=pages.length)out.push(n-1)}});return[...new Set(out)]}
  function processed(p,opt={}){let src=p.canvas,c=document.createElement('canvas'),ctx;if(!opt.ignoreRotation&&p.rotation%360){const r=((p.rotation%360)+360)%360;if(r===90||r===270){c.width=src.height;c.height=src.width}else{c.width=src.width;c.height=src.height}ctx=c.getContext('2d');ctx.translate(c.width/2,c.height/2);ctx.rotate(r*Math.PI/180);ctx.drawImage(src,-src.width/2,-src.height/2)}else{c.width=src.width;c.height=src.height;c.getContext('2d').drawImage(src,0,0)}
    if(!opt.ignoreCrop&&p.crop){const r=p.crop,o=document.createElement('canvas');o.width=Math.max(1,Math.round(c.width*r.w));o.height=Math.max(1,Math.round(c.height*r.h));o.getContext('2d').drawImage(c,c.width*r.x,c.height*r.y,c.width*r.w,c.height*r.h,0,0,o.width,o.height);c=o}
    if(!opt.ignoreColor&&p.color&&p.color!=='original'){const x=c.getContext('2d'),d=x.getImageData(0,0,c.width,c.height),a=d.data;if(p.color==='gray'){for(let i=0;i<a.length;i+=4){const g=.299*a[i]+.587*a[i+1]+.114*a[i+2];a[i]=a[i+1]=a[i+2]=g}}else if(p.color==='document'){for(let i=0;i<a.length;i+=4){let g=.299*a[i]+.587*a[i+1]+.114*a[i+2];g=clamp((g-128)*1.45+150,0,255);a[i]=a[i+1]=a[i+2]=g>238?255:g}}else if(p.color==='adaptive'){adaptiveBW(d,c.width,c.height)}x.putImageData(d,0,0)}return c}
  function adaptiveBW(img,w,h){const p=img.data,gray=new Uint8Array(w*h),ii=new Float64Array((w+1)*(h+1));for(let y=0;y<h;y++){let rows=0;for(let x=0;x<w;x++){const k=(y*w+x)*4,g=.299*p[k]+.587*p[k+1]+.114*p[k+2];gray[y*w+x]=g;rows+=g;ii[(y+1)*(w+1)+(x+1)]=ii[y*(w+1)+(x+1)]+rows}}const r=Math.max(8,Math.floor(Math.min(w,h)/60)),C=12;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const x1=Math.max(0,x-r),y1=Math.max(0,y-r),x2=Math.min(w-1,x+r),y2=Math.min(h-1,y+r),sum=ii[(y2+1)*(w+1)+(x2+1)]-ii[y1*(w+1)+(x2+1)]-ii[(y2+1)*(w+1)+x1]+ii[y1*(w+1)+x1],mean=sum/((x2-x1+1)*(y2-y1+1)),v=gray[y*w+x]<mean-C?0:255,k=(y*w+x)*4;p[k]=p[k+1]=p[k+2]=v}}
  function render(){if(!pages.length){canvas.width=canvas.height=0;return}const c=processed(pages[current],cropMode?{ignoreCrop:true}:{});canvas.width=c.width;canvas.height=c.height;canvas.getContext('2d').drawImage(c,0,0);requestAnimationFrame(()=>{renderCrop();renderPerspective()})}
  function thumbCanvas(p){const src=processed(p),c=document.createElement('canvas'),s=Math.min(1,130/src.width);c.width=Math.max(1,Math.round(src.width*s));c.height=Math.max(1,Math.round(src.height*s));c.getContext('2d').drawImage(src,0,0,c.width,c.height);return c}
  function select(i,multi=false){current=i;if(!multi)selected.clear();selected.has(i)&&multi?selected.delete(i):selected.add(i);if(!selected.size)selected.add(i);renderAll()}
  function thumbs(){const w=$('pdf116Thumbs');w.innerHTML='';pages.forEach((p,i)=>{const d=document.createElement('div');d.className='pdf116-thumb'+(i===current?' active':'')+(selected.has(i)?' selected':'');d.draggable=true;d.appendChild(thumbCanvas(p));const s=document.createElement('span');s.textContent=`Page ${i+1}${selected.has(i)?' ✓':''}`;d.appendChild(s);d.onclick=e=>select(i,e.ctrlKey||e.metaKey||e.shiftKey);d.ondragstart=e=>e.dataTransfer.setData('text/plain',String(i));d.ondragover=e=>e.preventDefault();d.ondrop=e=>{e.preventDefault();const from=+e.dataTransfer.getData('text/plain');if(from===i||from<0)return;pushHistory();const [m]=pages.splice(from,1);pages.splice(i,0,m);current=i;selected=new Set([i]);renderAll()};w.appendChild(d)})}
  function renderGrid(){grid.innerHTML='';pages.forEach((p,i)=>{const d=document.createElement('div');d.className='pdf116-grid-item'+(selected.has(i)?' selected':'');d.draggable=true;d.appendChild(thumbCanvas(p));const bar=document.createElement('div');bar.innerHTML=`<span>Page ${i+1}</span><button data-a="rot">↷</button><button data-a="del">🗑</button>`;d.appendChild(bar);d.onclick=e=>{const a=e.target.dataset.a;if(a==='rot'){pushHistory();p.rotation=(p.rotation+90)%360;renderAll();return}if(a==='del'){pushHistory();pages.splice(i,1);current=clamp(current,0,pages.length-1);selected=new Set(pages.length?[current]:[]);renderAll();return}select(i,e.ctrlKey||e.metaKey||e.shiftKey)};d.ondragstart=e=>e.dataTransfer.setData('text/plain',String(i));d.ondragover=e=>e.preventDefault();d.ondrop=e=>{e.preventDefault();const from=+e.dataTransfer.getData('text/plain');pushHistory();const [m]=pages.splice(from,1);pages.splice(i,0,m);current=i;selected=new Set([i]);renderAll()};grid.appendChild(d)})}
  function renderAll(){thumbs();if(gridMode)renderGrid();else render();}
  $('pdf116Open').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;status('Loading PDF…');try{pages=await pdfToPages(f);current=0;selected=new Set(pages.length?[0]:[]);undo.length=redo.length=0;gridMode=false;grid.hidden=true;shell.hidden=false;$('pdf116Pages').textContent='Show All Pages';renderAll();status(`Loaded ${pages.length} page(s).`)}catch(err){console.error(err);status('Could not open this PDF.')}e.target.value=''};
  $('pdf116Pages').onclick=()=>{if(!pages.length)return status('Open a PDF first.');gridMode=!gridMode;grid.hidden=!gridMode;shell.hidden=gridMode;box.hidden=pl.hidden=true;cropMode=perspMode=false;$('pdf116Pages').textContent=gridMode?'Back to Page':'Show All Pages';if(gridMode)renderGrid();else render()};
  [['pdf116SelAll','all'],['pdf116SelEven','even'],['pdf116SelOdd','odd']].forEach(([id,m])=>$(id).onclick=()=>{selected=new Set(indices(m));if(selected.size)current=[...selected][0];renderAll()});$('pdf116SelClear').onclick=()=>{selected=new Set([current]);renderAll()};
  function renderCrop(){if(box.hidden||!canvas.width)return;box.style.left=crop.x*100+'%';box.style.top=crop.y*100+'%';box.style.width=crop.w*100+'%';box.style.height=crop.h*100+'%'}
  const pdfCropMove=e=>{if(!drag||e.pointerId!==drag.id)return;e.preventDefault();const dx=(e.clientX-drag.sx)/drag.w,dy=(e.clientY-drag.sy)/drag.hpx,r={...drag.r},h=drag.handle,min=.02;if(h==='move'){r.x=clamp(drag.r.x+dx,0,1-drag.r.w);r.y=clamp(drag.r.y+dy,0,1-drag.r.h)}else{if(h.includes('w')){const nx=clamp(drag.r.x+dx,0,drag.r.x+drag.r.w-min);r.w=drag.r.w+(drag.r.x-nx);r.x=nx}if(h.includes('e'))r.w=clamp(drag.r.w+dx,min,1-drag.r.x);if(h.includes('n')){const ny=clamp(drag.r.y+dy,0,drag.r.y+drag.r.h-min);r.h=drag.r.h+(drag.r.y-ny);r.y=ny}if(h.includes('s'))r.h=clamp(drag.r.h+dy,min,1-drag.r.y)}crop=r;renderCrop()};
  const pdfCropUp=e=>{if(!drag||e.pointerId!==drag.id)return;drag=null;document.removeEventListener('pointermove',pdfCropMove,true);document.removeEventListener('pointerup',pdfCropUp,true);document.removeEventListener('pointercancel',pdfCropUp,true)};
  box.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();const rect=shell.getBoundingClientRect();drag={id:e.pointerId,handle:e.target.dataset.h||'move',sx:e.clientX,sy:e.clientY,r:{...crop},w:Math.max(1,rect.width),hpx:Math.max(1,rect.height)};document.addEventListener('pointermove',pdfCropMove,true);document.addEventListener('pointerup',pdfCropUp,true);document.addEventListener('pointercancel',pdfCropUp,true)};
  function enterCrop(r){cropMode=true;perspMode=false;pl.hidden=true;crop=r||{x:.04,y:.04,w:.92,h:.92};box.hidden=false;$('pdf116Crop').textContent='Apply Crop';renderCrop()}
  $('pdf116Crop').onclick=()=>{if(!pages.length)return status('Open a PDF first.');if(!cropMode){enterCrop(pages[current].crop||{x:.04,y:.04,w:.92,h:.92});render();requestAnimationFrame(renderCrop);return;}pushHistory();const idx=indices();idx.forEach(i=>{const p=pages[i],base=processed(p,{ignoreCrop:true,ignoreColor:true}),r={...crop},sx=Math.round(r.x*base.width),sy=Math.round(r.y*base.height),sw=Math.max(1,Math.round(r.w*base.width)),sh=Math.max(1,Math.round(r.h*base.height)),out=document.createElement('canvas');out.width=sw;out.height=sh;out.getContext('2d').drawImage(base,sx,sy,sw,sh,0,0,sw,sh);p.canvas=out;p.rotation=0;p.crop=null;});cropMode=false;box.hidden=true;$('pdf116Crop').textContent='Crop';renderAll();status(`Crop applied permanently to ${idx.length} page(s). Undo is available.`)};
  function jsDetectRect(src){const c=document.createElement('canvas'),max=900,s=Math.min(1,max/Math.max(src.width,src.height));c.width=Math.max(1,Math.round(src.width*s));c.height=Math.max(1,Math.round(src.height*s));c.getContext('2d').drawImage(src,0,0,c.width,c.height);const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data,w=c.width,h=c.height,pts=[[3,3],[w-4,3],[3,h-4],[w-4,h-4]],bg=pts.map(([x,y])=>{const k=(y*w+x)*4;return[d[k],d[k+1],d[k+2]]}),B=bg.reduce((a,b)=>a.map((v,i)=>v+b[i]),[0,0,0]).map(v=>v/bg.length);let minX=w,minY=h,maxX=-1,maxY=-1,count=0;const step=Math.max(1,Math.floor(Math.min(w,h)/700));for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){const k=(y*w+x)*4,dist=Math.abs(d[k]-B[0])+Math.abs(d[k+1]-B[1])+Math.abs(d[k+2]-B[2]);if(dist>60){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);count++}}if(maxX<0||count<100)return{x:.02,y:.02,w:.96,h:.96};const pad=Math.max(2,Math.round(Math.min(w,h)*.008));minX=clamp(minX-pad,0,w-1);minY=clamp(minY-pad,0,h-1);maxX=clamp(maxX+pad,1,w);maxY=clamp(maxY+pad,1,h);const r={x:minX/w,y:minY/h,w:(maxX-minX)/w,h:(maxY-minY)/h};if(r.w<.3||r.h<.3||r.w*r.h<.18)return{x:.02,y:.02,w:.96,h:.96};return r}
  $('pdf116AutoCrop').onclick=()=>{if(!pages.length)return status('Open a PDF first.');const base=processed(pages[current],{ignoreCrop:true,ignoreColor:true});let r=null;try{r=jsDetectRect(base)}catch{}enterCrop(r||{x:.02,y:.02,w:.96,h:.96});status('Auto Detect prepared the best document boundary found. Move or resize it freely, then Apply Crop.')};
  function renderPerspective(){if(pl.hidden||!pts)return;$('pdf116Poly').setAttribute('points',pts.map(p=>`${p.x*100},${p.y*100}`).join(' '));pl.querySelectorAll('b').forEach((b,i)=>{b.style.left=pts[i].x*100+'%';b.style.top=pts[i].y*100+'%'})}
  pl.querySelectorAll('b').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();pdrag={id:e.pointerId,i:+b.dataset.i};b.setPointerCapture?.(e.pointerId)};b.onpointermove=e=>{if(!pdrag||pdrag.id!==e.pointerId)return;const r=shell.getBoundingClientRect();pts[pdrag.i]={x:clamp((e.clientX-r.left)/r.width,0,1),y:clamp((e.clientY-r.top)/r.height,0,1)};renderPerspective()};b.onpointerup=b.onpointercancel=()=>pdrag=null});
  $('pdf116Perspective').onclick=async()=>{if(!pages.length)return status('Open a PDF first.');if(!perspMode){perspMode=true;cropMode=false;box.hidden=true;pts=[{x:.04,y:.04},{x:.96,y:.04},{x:.96,y:.96},{x:.04,y:.96}];pl.hidden=false;$('pdf116Perspective').textContent='Apply Perspective';renderPerspective();return}if(typeof cv==='undefined'||!cv.Mat)return status('Perspective engine is still loading. Try again in a moment.');try{pushHistory();const src=processed(pages[current],{ignoreCrop:true,ignoreColor:true}),px=pts.map(p=>({x:p.x*src.width,y:p.y*src.height})),w=Math.max(Math.hypot(px[1].x-px[0].x,px[1].y-px[0].y),Math.hypot(px[2].x-px[3].x,px[2].y-px[3].y)),h=Math.max(Math.hypot(px[3].x-px[0].x,px[3].y-px[0].y),Math.hypot(px[2].x-px[1].x,px[2].y-px[1].y)),sm=cv.imread(src),sp=cv.matFromArray(4,1,cv.CV_32FC2,px.flatMap(p=>[p.x,p.y])),dp=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,w-1,0,w-1,h-1,0,h-1]),M=cv.getPerspectiveTransform(sp,dp),dst=new cv.Mat();cv.warpPerspective(sm,dst,M,new cv.Size(Math.max(1,Math.round(w)),Math.max(1,Math.round(h))),cv.INTER_CUBIC,cv.BORDER_REPLICATE,new cv.Scalar());const o=document.createElement('canvas');cv.imshow(o,dst);[sm,sp,dp,M,dst].forEach(x=>x.delete());pages[current]={...pages[current],canvas:o,rotation:0,crop:null};perspMode=false;pl.hidden=true;$('pdf116Perspective').textContent='Perspective Crop';renderAll();status('Perspective crop applied.')}catch(err){console.error(err);status('Perspective crop failed; original page is preserved by Undo.')}};
  function estimateSkew(src){if(typeof cv==='undefined'||!cv.Mat)return 0;const max=1200,s=Math.min(1,max/Math.max(src.width,src.height)),c=document.createElement('canvas');c.width=Math.round(src.width*s);c.height=Math.round(src.height*s);c.getContext('2d').drawImage(src,0,0,c.width,c.height);const im=cv.imread(c),g=new cv.Mat(),e=new cv.Mat(),lines=new cv.Mat();let angles=[];try{cv.cvtColor(im,g,cv.COLOR_RGBA2GRAY);cv.Canny(g,e,50,150,3);cv.HoughLinesP(e,lines,1,Math.PI/180,80,Math.min(c.width,c.height)*.2,20);for(let i=0;i<lines.rows;i++){const a=lines.intPtr(i,0),ang=Math.atan2(a[3]-a[1],a[2]-a[0])*180/Math.PI;if(Math.abs(ang)<25)angles.push(ang)}if(!angles.length)return 0;angles.sort((a,b)=>a-b);return angles[Math.floor(angles.length/2)]}finally{[im,g,e,lines].forEach(x=>x.delete())}}
  function rotateArbitrary(src,deg){const r=deg*Math.PI/180,s=Math.abs(Math.sin(r)),c=Math.abs(Math.cos(r)),o=document.createElement('canvas');o.width=Math.ceil(src.width*c+src.height*s);o.height=Math.ceil(src.width*s+src.height*c);const x=o.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,o.width,o.height);x.translate(o.width/2,o.height/2);x.rotate(r);x.drawImage(src,-src.width/2,-src.height/2);return o}
  $('pdf116Deskew').onclick=async()=>{const idx=indices();if(!idx.length)return status('Open a PDF first.');pushHistory();for(const i of idx){const base=processed(pages[i],{ignoreCrop:true,ignoreColor:true,ignoreRotation:true}),a=estimateSkew(base);if(Math.abs(a)>.25)pages[i].canvas=rotateArbitrary(base,-a);pages[i].crop=null;pages[i].rotation=0;try{if(window.Tesseract?.createWorker){/* orientation detection intentionally best-effort */}}catch{}}renderAll();status(`Automatic deskew completed for ${idx.length} page(s).`)};
  async function pdfRemoveBgWhiteCanvas(source,onProgress){
    const blob=await blobOf(source,'image/png',1);
    const mod=await import(/* webpackIgnore: true */ 'https://esm.sh/@imgly/background-removal@1.7.0?bundle');
    const removeBackground=mod.default||mod.removeBackground;if(!removeBackground)throw new Error('AI engine unavailable');
    const result=await removeBackground(blob,{model:'medium',proxyToWorker:false,publicPath:'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/',output:{format:'image/png',quality:1},progress:(key,current,total)=>{if(total&&onProgress)onProgress(Math.round(current/total*100))}});
    const cutout=await imgFromFile(result),out=document.createElement('canvas');out.width=source.width;out.height=source.height;
    const x=out.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,out.width,out.height);x.drawImage(cutout,0,0,out.width,out.height);return out;
  }
  function pdfLocalWhiteBackground(source){
    const c=cloneCanvas(source),x=c.getContext('2d',{willReadFrequently:true}),im=x.getImageData(0,0,c.width,c.height),d=im.data,w=c.width,h=c.height;
    const pts=[[0,0],[w-1,0],[0,h-1],[w-1,h-1],[Math.floor(w/2),0],[Math.floor(w/2),h-1],[0,Math.floor(h/2)],[w-1,Math.floor(h/2)]];
    let br=0,bg=0,bb=0;for(const [px,py] of pts){const k=(py*w+px)*4;br+=d[k];bg+=d[k+1];bb+=d[k+2]}br/=pts.length;bg/=pts.length;bb/=pts.length;
    const tol=72,seen=new Uint8Array(w*h),q=[];for(let xx=0;xx<w;xx++){q.push(xx,(h-1)*w+xx)}for(let yy=1;yy<h-1;yy++){q.push(yy*w,yy*w+w-1)}
    let head=0;while(head<q.length){const n=q[head++];if(seen[n])continue;seen[n]=1;const k=n*4,dist=Math.hypot(d[k]-br,d[k+1]-bg,d[k+2]-bb);if(dist>tol)continue;d[k]=d[k+1]=d[k+2]=255;d[k+3]=255;const xx=n%w,yy=(n/w)|0;if(xx)q.push(n-1);if(xx<w-1)q.push(n+1);if(yy)q.push(n-w);if(yy<h-1)q.push(n+w)}
    x.putImageData(im,0,0);return c;
  }
  $('pdf116RemoveBgWhite').onclick=async()=>{
    const idx=indices();if(!idx.length)return status('Open a PDF first.');const btn=$('pdf116RemoveBgWhite'),old=btn.textContent;btn.disabled=true;btn.textContent='Removing…';pushHistory();
    let done=0,usedFallback=0;try{for(const i of idx){const base=processed(pages[i],{ignoreCrop:true,ignoreColor:true});status(`Removing background • page ${i+1} • ${done+1}/${idx.length}`);let out;try{out=await pdfRemoveBgWhiteCanvas(base,p=>status(`Removing background • page ${i+1} • ${p}% • ${done+1}/${idx.length}`))}catch(err){console.warn('PDF AI background removal unavailable; using local fallback.',err);out=pdfLocalWhiteBackground(base);usedFallback++}pages[i].canvas=out;pages[i].rotation=0;pages[i].crop=null;pages[i].color='original';done++;renderAll()}status(`Remove BG + White complete • ${done} page(s)${usedFallback?` • local fallback used on ${usedFallback}`:' • AI'}.`)}catch(err){console.error(err);status(`Background removal stopped after ${done} page(s). Use Undo to restore.`)}finally{btn.disabled=false;btn.textContent=old}
  };
  $('pdf116RotL').onclick=()=>{const idx=indices();if(!idx.length)return;pushHistory();idx.forEach(i=>pages[i].rotation=(pages[i].rotation-90)%360);renderAll()};$('pdf116RotR').onclick=()=>{const idx=indices();if(!idx.length)return;pushHistory();idx.forEach(i=>pages[i].rotation=(pages[i].rotation+90)%360);renderAll()};
  $('pdf116Color').onchange=e=>{const idx=indices();if(!idx.length)return;pushHistory();idx.forEach(i=>pages[i].color=e.target.value);renderAll()};
  $('pdf116Delete').onclick=()=>{const idx=indices();if(!idx.length)return;pushHistory();[...idx].sort((a,b)=>b-a).forEach(i=>pages.splice(i,1));current=clamp(current,0,Math.max(0,pages.length-1));selected=new Set(pages.length?[current]:[]);renderAll()};
  $('pdf116Blank').onclick=()=>{pushHistory();const ref=pages[current]?.canvas,c=document.createElement('canvas');c.width=ref?.width||1240;c.height=ref?.height||1754;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);const at=pages.length?current+1:0;pages.splice(at,0,{canvas:c,name:'Blank page',rotation:0,crop:null,color:'original'});current=at;selected=new Set([at]);renderAll()};
  async function insertList(add){if(!add.length)return;pushHistory();const at=pages.length?current+1:0;pages.splice(at,0,...add);current=at;selected=new Set(add.map((_,j)=>at+j));renderAll()}
  $('pdf116AddPdf').onchange=async e=>{const f=e.target.files?.[0];if(f)await insertList(await pdfToPages(f));e.target.value=''};$('pdf116AddImage').onchange=async e=>{if(e.target.files?.length)await insertList(await imagePages([...e.target.files]));e.target.value=''};
  $('pdf116Replace').onchange=async e=>{const f=e.target.files?.[0];if(!f||!pages.length)return;let add;if(/pdf$/i.test(f.type)||/\.pdf$/i.test(f.name))add=await pdfToPages(f);else add=await imagePages([f]);if(add.length){pushHistory();pages.splice(current,1,...add);selected=new Set(add.map((_,j)=>current+j));renderAll()}e.target.value=''};
  $('pdf116Scanner').onclick=async()=>{if(!S.scanImg)return status('No scanner page is currently available. Scan or upload a page in Scanner first.');const im=S.scanImg,c=document.createElement('canvas');c.width=im.naturalWidth||im.width;c.height=im.naturalHeight||im.height;c.getContext('2d').drawImage(im,0,0);insertList([{canvas:c,name:'Scanner page',rotation:0,crop:null,color:'original'}])};
  function exportIdx(){const m=$('pdf116ExportScope').value;return m==='range'?parseRange($('pdf116Range').value):indices(m)}
  $('pdf116Numbers').onclick=()=>{pageNumbers=!pageNumbers;$('pdf116Numbers').textContent=`Page Numbers: ${pageNumbers?'On':'Off'}`};
  $('pdf116ExportPdf').onclick=async()=>{const idx=exportIdx();if(!idx.length)return status('No pages selected for export.');status('Exporting PDF…');try{const doc=await PDFLib.PDFDocument.create(),font=pageNumbers?await doc.embedFont(PDFLib.StandardFonts.Helvetica):null;for(let k=0;k<idx.length;k++){const out=processed(pages[idx[k]]),b=await blobOf(out,'image/jpeg',.94),im=await doc.embedJpg(await b.arrayBuffer()),pg=doc.addPage([im.width,im.height]);pg.drawImage(im,{x:0,y:0,width:im.width,height:im.height});if(pageNumbers)pg.drawText(String(k+1),{x:pg.getWidth()/2-4,y:12,size:11,font,color:PDFLib.rgb(.1,.1,.1)})}download(new Blob([await doc.save({useObjectStreams:true})],{type:'application/pdf'}),'advanced-pdf-export.pdf');status(`Exported ${idx.length} page(s).`)}catch(err){console.error(err);status('PDF export failed.')}};
  $('pdf116ExportImages').onclick=async()=>{const idx=exportIdx();if(!idx.length)return status('No pages selected for export.');const jpg=$('pdf116ImageType').value==='jpeg',type=jpg?'image/jpeg':'image/png',ext=jpg?'jpg':'png';status('Exporting images…');if(idx.length===1)return download(await blobOf(processed(pages[idx[0]]),type,.94),`page-${idx[0]+1}.${ext}`);if(window.JSZip){const z=new JSZip();for(const i of idx)z.file(`page-${i+1}.${ext}`,await blobOf(processed(pages[i]),type,.94));download(await z.generateAsync({type:'blob'}),`pdf-pages-${ext}.zip`)}else for(const i of idx)download(await blobOf(processed(pages[i]),type,.94),`page-${i+1}.${ext}`);status(`Exported ${idx.length} image(s).`)};
  function nupSheets(idx,n){const W=2480,H=3508,cols=n===1?1:n===2?1:n===4?2:n===6?2:3,rows=Math.ceil(n/cols),gap=35,m=70,cw=(W-2*m-(cols-1)*gap)/cols,ch=(H-2*m-(rows-1)*gap)/rows,out=[];for(let s=0;s<idx.length;s+=n){const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,W,H);idx.slice(s,s+n).forEach((pi,j)=>{const p=processed(pages[pi]),scale=Math.min(cw/p.width,ch/p.height),dw=p.width*scale,dh=p.height*scale,col=j%cols,row=Math.floor(j/cols),dx=m+col*(cw+gap)+(cw-dw)/2,dy=m+row*(ch+gap)+(ch-dh)/2;x.drawImage(p,dx,dy,dw,dh)});out.push(c)}return out}
  $('pdf116Print').onclick=()=>{const idx=exportIdx();if(!idx.length)return status('No pages selected for printing.');const n=+$('pdf116Nup').value||1,sheets=nupSheets(idx,n),w=open('','_blank');if(!w)return;w.document.write('<html><head><title>PDF Print</title><style>@page{size:A4;margin:0}body{margin:0}.p{page-break-after:always;width:210mm;height:297mm;display:flex;align-items:center;justify-content:center}.p:last-child{page-break-after:auto}img{width:100%;height:100%;object-fit:contain}</style></head><body>'+sheets.map(c=>`<div class="p"><img src="${c.toDataURL('image/jpeg',.94)}"></div>`).join('')+'<script>onload=()=>{print();setTimeout(()=>close(),700)}<\/script></body></html>');w.document.close()};
  window.addEventListener('resize',()=>{renderCrop();renderPerspective()});
}

function start(){removeSmartCrop();installPassportSheet();installPrintStudioPro();installPdfStudio();document.title='Shop Studio Pro v11.7';const bs=document.querySelector('.brand-subtitle');if(bs)bs.textContent='PRO TOOLKIT • V11.7';}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(start,0));else setTimeout(start,0);
})();

/* END app-v11.6.0.js */

;
/* BEGIN app-v11.7.0.js */
/* Shop Studio Pro v11.7 — focused stabilization: Print Studio, Target-KB removal, Smart Card drag/drop */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mm2px=(mm,dpi=300)=>Math.max(1,Math.round((+mm||0)/25.4*dpi));
const blobOf=(c,t='image/png',q=.95)=>new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error('Canvas export failed')),t,q));
const imgFile=f=>new Promise((res,rej)=>{const u=URL.createObjectURL(f),im=new Image();im.onload=()=>{URL.revokeObjectURL(u);res(im)};im.onerror=e=>{URL.revokeObjectURL(u);rej(e)};im.src=u});
const imgCanvas=c=>new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=c.toDataURL('image/png')});
const download=(b,n)=>{const a=document.createElement('a'),u=URL.createObjectURL(b);a.href=u;a.download=window.shopAutoFilename?window.shopAutoFilename(n):n;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000)};
const pdfjs=async()=>{const m=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');m.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';return m};

function removeTargetKbUI(){
  document.querySelectorAll('[data-section="compressor"],[data-section-jump="compressor"]').forEach(n=>n.remove());
  const sec=$('compressor');if(sec){sec.hidden=true;sec.setAttribute('aria-hidden','true');sec.classList.remove('active');}
  const rt=$('resizeTargetKb');if(rt){const lab=rt.closest('label');if(lab)lab.hidden=true;rt.value='';}
  if(location.hash==='#compressor')window.__shopShowSection?.('home');
}

function setPassportDefaults(){
  const set=()=>{const m=$('ps116Margin'),g=$('ps116Gap'),bm=$('passportMargin'),bg=$('passportGap');if(m)m.value='3';if(g)g.value='4.5';if(bm)bm.value='3';if(bg)bg.value='4.5';};
  set();
  const b=$('makePassportSheet');if(b)b.addEventListener('click',()=>setTimeout(()=>{set();$('passportSheetRegenV116')?.click()},0),true);
}

function rebuildPrintStudio(){
  const old=$('print');if(!old)return;
  const sec=document.createElement('section');sec.className='section';sec.id='print';sec.innerHTML=`
    <div class="panel compact-tool print117-panel">
      <div class="workspace-head"><div><span class="eyebrow">PRINT STUDIO</span><h2>Collage & Layout</h2></div><div class="button-row"><label class="upload-btn">Load Images<input id="p117Images" type="file" accept="image/*" multiple hidden></label><label class="ghost-btn">Load PDF<input id="p117Pdf" type="file" accept="application/pdf" hidden></label></div></div>
      <div class="compact-controls">
        <label>Layout<select id="p117Count"><option>4</option><option>6</option><option selected>8</option><option>9</option><option>12</option></select></label>
        <label>Paper<select id="p117Paper"><option value="6x4">6×4</option><option value="a4">A4</option></select></label>
        <label>Orientation<select id="p117Orientation"><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select></label>
        <label>Margin (mm)<input id="p117Margin" type="number" value="4" min="0" step="0.5"></label>
        <label>Gap (mm)<input id="p117Gap" type="number" value="3" min="0" step="0.5"></label>
        <label>DPI<select id="p117Dpi"><option value="300" selected>300</option><option value="600">600</option></select></label>
        <label>Snap<input id="p117Snap" type="checkbox" checked></label>
      </div>
      <div class="print117-tools"><button class="ghost-btn" id="p117Crop">Crop Selected</button><button class="ghost-btn" id="p117ResetCrop">Reset Crop</button><button class="ghost-btn" id="p117Delete">Delete</button></div>
      <div class="status-inline" id="p117Status">Load images or a PDF. Click an image to select it; drag to move, use blue handles to resize, or click Crop.</div>
      <div class="canvas-wrap print117-wrap" id="p117Wrap"><canvas id="p117Canvas"></canvas><div id="p117Layer" class="print117-layer"></div><div class="empty-state" id="p117Empty">Upload images to begin</div></div>
      <div class="print117-crop-panel" id="p117CropPanel" hidden><div class="workspace-head"><div><span class="eyebrow">INDIVIDUAL IMAGE CROP</span><h3 id="p117CropTitle">Crop selected image</h3></div><button class="ghost-btn" id="p117CropClose">Close</button></div><div class="print117-crop-stage" id="p117CropStage"><div class="print117-crop-shell"><canvas id="p117CropCanvas"></canvas><div id="p117CropBox" class="print117-crop-box">${['nw','n','ne','e','se','s','sw','w'].map(h=>`<i class="${h}" data-h="${h}"></i>`).join('')}</div></div></div><div class="workspace-actions"><button class="ghost-btn" id="p117RotateLeft" type="button">↶ Rotate Left</button><button class="ghost-btn" id="p117RotateRight" type="button">↷ Rotate Right</button><button class="primary-btn" id="p117CropApply">Apply Crop</button><button class="ghost-btn" id="p117CropReset">Full Image</button></div></div>
      <div class="workspace-actions"><button class="primary-btn" id="p117Build">Build / Reset Layout</button><button class="ghost-btn" id="p117Png">PNG</button><button class="ghost-btn" id="p117PdfOut">PDF</button><button class="ghost-btn" id="p117Print">Print</button></div>
    </div>`;
  const active=old.classList.contains('active');old.replaceWith(sec);if(active)sec.classList.add('active');

  const canvas=$('p117Canvas'),wrap=$('p117Wrap'),layer=$('p117Layer');let sources=[],items=[],selected=new Set(),activeIndex=-1;
  const paper=()=>{const dpi=+$('p117Dpi').value||300,p=$('p117Paper').value,o=$('p117Orientation').value;let w=p==='a4'?mm2px(210,dpi):6*dpi,h=p==='a4'?mm2px(297,dpi):4*dpi;if(o==='landscape'&&h>w)[w,h]=[h,w];if(o==='portrait'&&w>h)[w,h]=[h,w];return{w,h,dpi}};
  function status(t){$('p117Status').textContent=t}
  function layout(){if(!sources.length)return draw();const {w,h,dpi}=paper(),n=Math.max(1,+$('p117Count').value||sources.length),cols=Math.ceil(Math.sqrt(n*w/h)),rows=Math.ceil(n/cols),m=mm2px(+$('p117Margin').value,dpi),g=mm2px(+$('p117Gap').value,dpi),cw=(w-2*m-(cols-1)*g)/cols,ch=(h-2*m-(rows-1)*g)/rows;items=[];for(let i=0;i<n;i++){const s=sources[i%sources.length];items.push({img:s.img,name:s.name,x:(m+(i%cols)*(cw+g))/w,y:(m+Math.floor(i/cols)*(ch+g))/h,w:cw/w,h:ch/h,crop:{x:0,y:0,w:1,h:1}})}selected=new Set(items.length?[0]:[]);activeIndex=items.length?0:-1;draw();status(`${items.length} item(s) • drag image to move • blue handles resize • Crop edits only the selected image.`)}
  function draw(){const {w,h}=paper();canvas.width=w;canvas.height=h;const x=canvas.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';for(const it of items){const r=it.crop||{x:0,y:0,w:1,h:1};x.drawImage(it.img,r.x*it.img.width,r.y*it.img.height,r.w*it.img.width,r.h*it.img.height,it.x*w,it.y*h,it.w*w,it.h*h)}$('p117Empty').style.display=items.length?'none':'';requestAnimationFrame(overlay)}
  function overlay(){const cr=canvas.getBoundingClientRect(),wr=wrap.getBoundingClientRect();if(!cr.width)return;Object.assign(layer.style,{left:(cr.left-wr.left+wrap.scrollLeft)+'px',top:(cr.top-wr.top+wrap.scrollTop)+'px',width:cr.width+'px',height:cr.height+'px'});layer.innerHTML='';items.forEach((it,i)=>{const d=document.createElement('div');d.className='print117-item'+(selected.has(i)?' selected':'');Object.assign(d.style,{left:it.x*100+'%',top:it.y*100+'%',width:it.w*100+'%',height:it.h*100+'%'});d.dataset.i=i;const cropBtn=document.createElement('button');cropBtn.type='button';cropBtn.className='print117-crop-mini';cropBtn.textContent='Crop';cropBtn.onclick=e=>{e.stopPropagation();activeIndex=i;selected=new Set([i]);openCrop();overlay()};d.appendChild(cropBtn);['nw','n','ne','e','se','s','sw','w'].forEach(h=>{const q=document.createElement('i');q.className='print117-handle '+h;q.dataset.h=h;d.appendChild(q)});d.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;e.preventDefault();e.stopPropagation();if(!e.ctrlKey&&!e.metaKey&&!selected.has(i))selected.clear();selected.add(i);activeIndex=i;overlay();const hnd=e.target.dataset.h||'move',base=items.map(v=>({...v,crop:{...v.crop}})),sx=e.clientX,sy=e.clientY;const mv=ev=>{const dx=(ev.clientX-sx)/cr.width,dy=(ev.clientY-sy)/cr.height,min=.025;selected.forEach(k=>{const b=base[k],n={...b,crop:{...b.crop}};if(hnd==='move'){n.x=clamp(b.x+dx,0,1-b.w);n.y=clamp(b.y+dy,0,1-b.h)}else{if(hnd.includes('w')){const nx=clamp(b.x+dx,0,b.x+b.w-min);n.w=b.w+(b.x-nx);n.x=nx}if(hnd.includes('e'))n.w=clamp(b.w+dx,min,1-b.x);if(hnd.includes('n')){const ny=clamp(b.y+dy,0,b.y+b.h-min);n.h=b.h+(b.y-ny);n.y=ny}if(hnd.includes('s'))n.h=clamp(b.h+dy,min,1-b.y)}items[k]=n});draw()};const up=()=>{document.removeEventListener('pointermove',mv,true);document.removeEventListener('pointerup',up,true)};document.addEventListener('pointermove',mv,true);document.addEventListener('pointerup',up,true)});layer.appendChild(d)})}
  async function addFiles(files){for(const f of files){try{sources.push({img:await imgFile(f),name:f.name})}catch(e){console.warn(e)}}layout()}
  $('p117Images').onchange=e=>{addFiles([...e.target.files]);e.target.value=''};
  $('p117Pdf').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;status('Loading PDF pages…');try{const m=await pdfjs(),pdf=await m.getDocument({data:new Uint8Array(await f.arrayBuffer())}).promise;for(let n=1;n<=pdf.numPages;n++){const p=await pdf.getPage(n),v=p.getViewport({scale:2}),c=document.createElement('canvas');c.width=Math.ceil(v.width);c.height=Math.ceil(v.height);await p.render({canvasContext:c.getContext('2d'),viewport:v}).promise;sources.push({img:await imgCanvas(c),name:`${f.name} p${n}`})}layout()}catch(err){console.error(err);status('Could not load this PDF.')}e.target.value=''};
  // Individual crop editor.
  const cp=$('p117CropPanel'),cc=$('p117CropCanvas'),cb=$('p117CropBox');let crop={x:0,y:0,w:1,h:1},cd=null;
  function renderCrop(){cb.style.left=crop.x*100+'%';cb.style.top=crop.y*100+'%';cb.style.width=crop.w*100+'%';cb.style.height=crop.h*100+'%'}
  function openCrop(){if(activeIndex<0||!items[activeIndex])return status('Select an image first.');const it=items[activeIndex];cc.width=it.img.width;cc.height=it.img.height;cc.getContext('2d').drawImage(it.img,0,0);crop={...(it.crop||{x:0,y:0,w:1,h:1})};$('p117CropTitle').textContent=`Crop • ${it.name}`;cp.hidden=false;renderCrop();cp.scrollIntoView({behavior:'smooth',block:'nearest'})}
  const cmove=e=>{if(!cd||e.pointerId!==cd.id)return;e.preventDefault();const r=cc.getBoundingClientRect(),dx=(e.clientX-cd.sx)/r.width,dy=(e.clientY-cd.sy)/r.height,n={...cd.r},h=cd.h,min=.02;if(h==='move'){n.x=clamp(cd.r.x+dx,0,1-cd.r.w);n.y=clamp(cd.r.y+dy,0,1-cd.r.h)}else{if(h.includes('w')){const nx=clamp(cd.r.x+dx,0,cd.r.x+cd.r.w-min);n.w=cd.r.w+(cd.r.x-nx);n.x=nx}if(h.includes('e'))n.w=clamp(cd.r.w+dx,min,1-cd.r.x);if(h.includes('n')){const ny=clamp(cd.r.y+dy,0,cd.r.y+cd.r.h-min);n.h=cd.r.h+(cd.r.y-ny);n.y=ny}if(h.includes('s'))n.h=clamp(cd.r.h+dy,min,1-cd.r.y)}crop=n;renderCrop()};
  const cup=e=>{if(!cd||e.pointerId!==cd.id)return;cd=null;document.removeEventListener('pointermove',cmove,true);document.removeEventListener('pointerup',cup,true);document.removeEventListener('pointercancel',cup,true)};
  cb.onpointerdown=e=>{e.preventDefault();e.stopPropagation();cd={id:e.pointerId,h:e.target.dataset.h||'move',sx:e.clientX,sy:e.clientY,r:{...crop}};document.addEventListener('pointermove',cmove,true);document.addEventListener('pointerup',cup,true);document.addEventListener('pointercancel',cup,true)};
  async function rotateCropImage(dir){
    if(activeIndex<0||!items[activeIndex])return status('Select an image first.');
    const it=items[activeIndex],src=it.img,c=document.createElement('canvas');c.width=src.height;c.height=src.width;const x=c.getContext('2d');
    x.translate(c.width/2,c.height/2);x.rotate(dir*Math.PI/2);x.drawImage(src,-src.width/2,-src.height/2);
    it.img=await imgCanvas(c);
    const r={...crop};crop=dir>0?{x:1-r.y-r.h,y:r.x,w:r.h,h:r.w}:{x:r.y,y:1-r.x-r.w,w:r.h,h:r.w};
    it.crop={...crop};cc.width=it.img.width;cc.height=it.img.height;cc.getContext('2d').drawImage(it.img,0,0);renderCrop();draw();status(`Item ${activeIndex+1} rotated ${dir>0?'right':'left'} 90°.`);
  }
  $('p117Crop').onclick=openCrop;$('p117CropClose').onclick=()=>cp.hidden=true;$('p117CropReset').onclick=()=>{crop={x:0,y:0,w:1,h:1};renderCrop()};$('p117RotateLeft').onclick=()=>rotateCropImage(-1);$('p117RotateRight').onclick=()=>rotateCropImage(1);$('p117CropApply').onclick=()=>{if(activeIndex<0)return;items[activeIndex].crop={...crop};cp.hidden=true;draw();status(`Crop applied to item ${activeIndex+1}.`)};$('p117ResetCrop').onclick=()=>{if(activeIndex<0)return;items[activeIndex].crop={x:0,y:0,w:1,h:1};draw()};
  function align(kind){if(!selected.size)return;const a=[...selected].map(i=>items[i]);if(kind==='l'){const v=Math.min(...a.map(x=>x.x));selected.forEach(i=>items[i].x=v)}if(kind==='cx')selected.forEach(i=>items[i].x=(1-items[i].w)/2);if(kind==='t'){const v=Math.min(...a.map(x=>x.y));selected.forEach(i=>items[i].y=v)}if(kind==='cy')selected.forEach(i=>items[i].y=(1-items[i].h)/2);draw()}
  if($('p117AlignL'))$('p117AlignL').onclick=()=>align('l');if($('p117AlignCX'))$('p117AlignCX').onclick=()=>align('cx');if($('p117AlignT'))$('p117AlignT').onclick=()=>align('t');if($('p117AlignCY'))$('p117AlignCY').onclick=()=>align('cy');$('p117Delete').onclick=()=>{if(!selected.size)return;items=items.filter((_,i)=>!selected.has(i));selected=new Set(items.length?[0]:[]);activeIndex=items.length?0:-1;draw()};
  ['p117Count','p117Paper','p117Orientation','p117Margin','p117Gap','p117Dpi'].forEach(id=>$(id).onchange=()=>sources.length&&layout());$('p117Build').onclick=()=>sources.length?layout():$('p117Images').click();
  $('p117Png').onclick=async()=>items.length&&download(await blobOf(canvas,'image/png'),'print-layout.png');$('p117PdfOut').onclick=async()=>{if(!items.length||!window.PDFLib)return;const doc=await PDFLib.PDFDocument.create(),im=await doc.embedPng(await (await blobOf(canvas,'image/png')).arrayBuffer()),p=doc.addPage([im.width,im.height]);p.drawImage(im,{x:0,y:0,width:im.width,height:im.height});download(new Blob([await doc.save()],{type:'application/pdf'}),'print-layout.pdf')};$('p117Print').onclick=()=>{if(!items.length)return;const u=canvas.toDataURL('image/png'),w=open('','_blank');if(!w)return;w.document.write(`<html><head><style>@page{margin:0}body{margin:0;display:grid;place-items:center}img{max-width:100%;max-height:100vh}</style></head><body><img src="${u}" onload="print();setTimeout(()=>close(),500)"></body></html>`);w.document.close()};
  window.addEventListener('resize',overlay);
}

function installSmartCardDragDrop(){
  const sec=$('cards'),source=$('cardSourceCanvas'),front=$('cardFrontPreview'),back=$('cardBackPreview');if(!sec||!source||!front||!back)return;
  const row=front.closest('.saved-card-row');if(!row)return;
  row.classList.add('card117-drop-row');
  const decorate=(canvas,side)=>{const box=canvas.parentElement;box.classList.add('card117-drop-zone');box.dataset.side=side;let hint=box.querySelector('.card117-hint');if(!hint){hint=document.createElement('div');hint.className='card117-hint';hint.innerHTML=`Drop current canvas here for <b>${side.toUpperCase()}</b><br><small>or click to select ${side}</small>`;box.appendChild(hint)}box.tabIndex=0;box.onclick=e=>{if(e.target.closest('button'))return;setSide(side)};['dragenter','dragover'].forEach(ev=>box.addEventListener(ev,e=>{e.preventDefault();box.classList.add('drag-over')}));['dragleave','drop'].forEach(ev=>box.addEventListener(ev,e=>{e.preventDefault();box.classList.remove('drag-over')}));box.addEventListener('drop',e=>{const files=[...e.dataTransfer.files];if(files.length){const f=files[0],inp=f.type==='application/pdf'||/\.pdf$/i.test(f.name)?$('cardPdfInput'):$('cardImageInput');if(inp){const dt=new DataTransfer();dt.items.add(f);inp.files=dt.files;inp.dispatchEvent(new Event('change',{bubbles:true}));setSide(side);setTimeout(()=>$('saveCardCrop')?.click(),500)}return}setSide(side);$('saveCardCrop')?.click()});};
  function setSide(side){const sel=$('cardCropAction');if(sel){sel.value=side;sel.dispatchEvent(new Event('change',{bubbles:true}))}document.querySelectorAll('#cardSideTabs button').forEach(b=>b.classList.toggle('active',b.dataset.side===side));const btn=$('saveCardCrop');if(btn)btn.textContent=`Apply & Save ${side[0].toUpperCase()+side.slice(1)}`;}
  decorate(front,'front');decorate(back,'back');
  source.draggable=true;source.title='Drag this canvas to Front or Back after adjusting crop.';source.addEventListener('dragstart',e=>{e.dataTransfer.effectAllowed='copy';e.dataTransfer.setData('text/x-shop-card','current-canvas');});
  let flow=$('card117Flow');if(!flow){flow=document.createElement('div');flow.id='card117Flow';flow.className='status-inline card117-flow';flow.innerHTML='<strong>Fast flow:</strong> Open PDF/Image → crop if required → drag the main canvas to Front/Back, or choose a side and click Apply & Save → Export PVC.';row.insertAdjacentElement('beforebegin',flow)}
}

function strictSectionVisibility(){
  const st=document.createElement('style');st.id='v117StrictVisibility';st.textContent='.section{display:none!important}.section.active{display:block!important}.section:target:not(.active){display:none!important}#compressor{display:none!important}';document.head.appendChild(st);
}

function start(){
  removeTargetKbUI();strictSectionVisibility();rebuildPrintStudio();installSmartCardDragDrop();setPassportDefaults();
  document.title='Shop Studio Pro v11.7';document.querySelector('.brand-subtitle')?.replaceChildren(document.createTextNode('PRO TOOLKIT • V11.7'));const meta=document.querySelector('meta[name="shop-build"]');if(meta)meta.content='11.7.0';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(start,40));else setTimeout(start,40);
})();

/* END app-v11.7.0.js */

;
/* BEGIN app-v11.8.0.js */
/* Shop Studio Pro v11.8 — single passport border + image/PDF compressor */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const blobOf=(c,t='image/jpeg',q=.92)=>new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error('Canvas export failed')),t,q));
const download=(blob,name)=>{const a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download=window.shopAutoFilename?window.shopAutoFilename(name):name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500)};
const imageFromFile=f=>new Promise((res,rej)=>{const u=URL.createObjectURL(f),im=new Image();im.onload=()=>{URL.revokeObjectURL(u);res(im)};im.onerror=e=>{URL.revokeObjectURL(u);rej(e)};im.src=u});
const imageFromCanvas=c=>new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=c.toDataURL('image/png')});
const pdfjs=async()=>{const m=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');m.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';return m};

/* Hide obsolete legacy compressor controls while preserving compatibility nodes required by earlier scripts. */
document.querySelectorAll('label,button,h2,h3,.eyebrow').forEach(el=>{
  if(/target\s*kb/i.test((el.textContent||'').trim())){const sec=el.closest('#compressor');if(sec){sec.hidden=true;sec.setAttribute('aria-hidden','true')}else el.style.display='none';}
});

const input=$('cf118Input'); if(!input)return;
const stage=$('cf118Stage'),shell=$('cf118Shell'),canvas=$('cf118Canvas'),ctx=canvas.getContext('2d'),box=$('cf118CropBox');
let file=null,kind=null,img=null,pdfBytes=null,pdfDoc=null,pdfPage=1,pdfSelectedPages=[1];
let crop={x:.08,y:.08,w:.84,h:.84},cropApplied=null,drag=null;

function status(t){$('cf118Status').textContent=t}
function showBox(on=true){box.hidden=!on; if(on)renderBox()}
function renderBox(){box.style.left=(crop.x*100)+'%';box.style.top=(crop.y*100)+'%';box.style.width=(crop.w*100)+'%';box.style.height=(crop.h*100)+'%'}
function resetCrop(){crop={x:.08,y:.08,w:.84,h:.84};cropApplied=null;renderBox();status('Crop reset. Full file will be compressed unless you apply a crop.')}
function targetBytes(){const n=Math.max(1,+$('cf118Target').value||1);return Math.round(n*($('cf118Unit').value==='mb'?1024*1024:1024))}
function formatBytes(n){return n>=1024*1024?(n/1024/1024).toFixed(2)+' MB':(n/1024).toFixed(1)+' KB'}

function parsePdfPageSelection(text,total){
  if(!text||!String(text).trim())return[1];
  const out=[];for(const raw of String(text).split(',').map(v=>v.trim()).filter(Boolean)){
    if(raw.includes('-')){let[a,b]=raw.split('-').map(Number);if(!Number.isFinite(a)||!Number.isFinite(b))continue;if(a>b)[a,b]=[b,a];for(let n=a;n<=b;n++)if(n>=1&&n<=total)out.push(n)}
    else{const n=Number(raw);if(Number.isInteger(n)&&n>=1&&n<=total)out.push(n)}
  }
  return [...new Set(out)].length?[...new Set(out)]:[1];
}


async function renderImagePreview(){
  const max=1300,iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height,s=Math.min(1,max/Math.max(iw,ih));
  canvas.width=Math.max(1,Math.round(iw*s));canvas.height=Math.max(1,Math.round(ih*s));ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,canvas.width,canvas.height);$('cf118Empty').style.display='none';shell.style.display='inline-block';
}
async function renderPdfPreview(){
  const p=await pdfDoc.getPage(pdfPage),vp0=p.getViewport({scale:1}),s=Math.min(1.7,1200/Math.max(vp0.width,vp0.height)),vp=p.getViewport({scale:s});
  canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);await p.render({canvasContext:ctx,viewport:vp}).promise;$('cf118Empty').style.display='none';shell.style.display='inline-block';
}

input.addEventListener('change',async()=>{
  const f=input.files?.[0]; if(!f)return; file=f; crop={x:.08,y:.08,w:.84,h:.84};cropApplied=null;showBox(false);
  try{
    if(f.type==='application/pdf'||/\.pdf$/i.test(f.name)){
      kind='pdf';pdfBytes=await f.arrayBuffer();const m=await pdfjs();pdfDoc=await m.getDocument({data:new Uint8Array(pdfBytes.slice(0))}).promise;img=null;
      if(pdfDoc.numPages>1){const ask=window.prompt(`This PDF has ${pdfDoc.numPages} pages. Enter page number(s) to load (example: 2 or 1,3-5). Leave blank for page 1.`,'');pdfSelectedPages=parsePdfPageSelection(ask,pdfDoc.numPages)}else pdfSelectedPages=[1];
      pdfPage=pdfSelectedPages[0]||1;await renderPdfPreview();status(`Loaded PDF page${pdfSelectedPages.length>1?'s':''} ${pdfSelectedPages.join(', ')} of ${pdfDoc.numPages} • ${formatBytes(f.size)}. Crop applies only to the loaded page(s).`);
    }else if(f.type.startsWith('image/')){
      kind='image';img=await imageFromFile(f);pdfBytes=null;pdfDoc=null;await renderImagePreview();status(`Loaded image • ${img.naturalWidth||img.width}×${img.naturalHeight||img.height}px • ${formatBytes(f.size)}`);
    }else throw new Error('Unsupported file');
  }catch(e){console.error(e);kind=null;status('Could not load this file. Please choose a valid image or PDF.');}
});

$('cf118CropBtn').onclick=async()=>{if(!kind)return status('Load an image or PDF first.');if(kind==='pdf')await renderPdfPreview();showBox(true);status(kind==='pdf'?`Adjust crop for loaded page${pdfSelectedPages.length>1?'s':''} ${pdfSelectedPages.join(', ')}. Apply Crop uses this crop on those page(s) only.`:'Adjust crop, then click Apply Crop.')};
$('cf118ResetCrop').onclick=()=>{if(!kind)return;resetCrop();showBox(false)};
$('cf118ApplyCrop').onclick=async()=>{
  if(!kind)return status('Load an image or PDF first.'); cropApplied={...crop}; showBox(false);
  if(kind==='image'){
    const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height,x=Math.round(crop.x*iw),y=Math.round(crop.y*ih),w=Math.max(1,Math.round(crop.w*iw)),h=Math.max(1,Math.round(crop.h*ih));
    const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,x,y,w,h,0,0,w,h);img=await imageFromCanvas(c);cropApplied=null;crop={x:.08,y:.08,w:.84,h:.84};await renderImagePreview();status(`Crop applied to image • ${w}×${h}px`);
  } else {await renderPdfPreview();const src=document.createElement('canvas');src.width=canvas.width;src.height=canvas.height;src.getContext('2d').drawImage(canvas,0,0);const sx=Math.round(cropApplied.x*src.width),sy=Math.round(cropApplied.y*src.height),sw=Math.max(1,Math.round(cropApplied.w*src.width)),sh=Math.max(1,Math.round(cropApplied.h*src.height));canvas.width=sw;canvas.height=sh;ctx.drawImage(src,sx,sy,sw,sh,0,0,sw,sh);status(`PDF crop applied to loaded page${pdfSelectedPages.length>1?'s':''} ${pdfSelectedPages.join(', ')}.`);}
};

box.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;e.preventDefault();e.stopPropagation();const r=canvas.getBoundingClientRect(),h=e.target.dataset.h||'move';drag={h,sx:e.clientX,sy:e.clientY,start:{...crop},rw:Math.max(1,r.width),rh:Math.max(1,r.height)};
});
document.addEventListener('pointermove',e=>{
  if(!drag)return;const dx=(e.clientX-drag.sx)/drag.rw,dy=(e.clientY-drag.sy)/drag.rh,s=drag.start,h=drag.h,n={...s},min=.03;
  if(h==='move'){n.x=clamp(s.x+dx,0,1-s.w);n.y=clamp(s.y+dy,0,1-s.h)}else{
    if(h.includes('w')){const nx=clamp(s.x+dx,0,s.x+s.w-min);n.w=s.w+(s.x-nx);n.x=nx}
    if(h.includes('e'))n.w=clamp(s.w+dx,min,1-s.x);
    if(h.includes('n')){const ny=clamp(s.y+dy,0,s.y+s.h-min);n.h=s.h+(s.y-ny);n.y=ny}
    if(h.includes('s'))n.h=clamp(s.h+dy,min,1-s.y);
  }
  crop=n;renderBox();
},{passive:false});
['pointerup','pointercancel'].forEach(ev=>document.addEventListener(ev,()=>drag=null));

function sourceImageCanvas(){
  const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height,c=document.createElement('canvas');let sw=iw,sh=ih,sx=0,sy=0;
  if(cropApplied){sx=Math.round(cropApplied.x*iw);sy=Math.round(cropApplied.y*ih);sw=Math.max(1,Math.round(cropApplied.w*iw));sh=Math.max(1,Math.round(cropApplied.h*ih));}
  const maxDim=Math.max(0,+$('cf118MaxDim').value||0),scale=maxDim?Math.min(1,maxDim/Math.max(sw,sh)):1;c.width=Math.max(1,Math.round(sw*scale));c.height=Math.max(1,Math.round(sh*scale));
  const x=c.getContext('2d');x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(img,sx,sy,sw,sh,0,0,c.width,c.height);return c;
}
async function compressRasterCanvas(base,target,mime,mode){
  const scales=mode==='best'?[1,.94,.88,.82,.75,.68,.6,.52,.44,.36]:mode==='balanced'?[1,.88,.76,.64,.52,.42,.34]:[.85,.72,.6,.5,.4,.32,.25];
  let best=null,bestDiff=Infinity,bestW=base.width,bestH=base.height;
  for(const sc of scales){
    const c=document.createElement('canvas');c.width=Math.max(1,Math.round(base.width*sc));c.height=Math.max(1,Math.round(base.height*sc));const x=c.getContext('2d');x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';if(mime==='image/jpeg'){x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height)}x.drawImage(base,0,0,c.width,c.height);
    if(mime==='image/png'){
      const b=await blobOf(c,mime,1),d=Math.abs(b.size-target);if(d<bestDiff){best=b;bestDiff=d;bestW=c.width;bestH=c.height}if(b.size<=target*1.02)break;continue;
    }
    let lo=mode==='best'?.35:.18,hi=.98;
    for(let i=0;i<12;i++){const q=(lo+hi)/2,b=await blobOf(c,mime,q),d=Math.abs(b.size-target);if(d<bestDiff){best=b;bestDiff=d;bestW=c.width;bestH=c.height}if(b.size>target)hi=q;else lo=q}
    if(best&&best.size<=target*1.02&&best.size>=target*.72)break;
  }
  return{blob:best,w:bestW,h:bestH};
}
async function compressImage(){
  const target=targetBytes(),mode=$('cf118Quality').value,base=sourceImageCanvas(),chosen=$('cf118Format').value;
  let mime=chosen==='jpeg'?'image/jpeg':chosen==='webp'?'image/webp':chosen==='png'?'image/png':(file.type==='image/png'?'image/png':file.type==='image/webp'?'image/webp':'image/jpeg');
  let out=await compressRasterCanvas(base,target,mime,mode);
  if(chosen==='auto'&&mime==='image/png'&&out.blob.size>target*1.05){mime='image/jpeg';out=await compressRasterCanvas(base,target,mime,mode)}
  const ext=mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg',baseName=file.name.replace(/\.[^.]+$/,'');download(out.blob,`${baseName}-compressed.${ext}`);
  status(`Done • ${formatBytes(out.blob.size)} • ${out.w}×${out.h}px${out.blob.size>target*1.05?' • requested size is too low for higher quality; closest result exported.':''}`);
}
async function renderPdfPageBase(page,scale,cropRect){
  const vp0=page.getViewport({scale:1}),maxDim=Math.max(0,+$('cf118MaxDim').value||0);let sc=scale;if(maxDim)sc=Math.min(sc,maxDim/Math.max(vp0.width,vp0.height));const vp=page.getViewport({scale:sc}),full=document.createElement('canvas');full.width=Math.max(1,Math.ceil(vp.width));full.height=Math.max(1,Math.ceil(vp.height));await page.render({canvasContext:full.getContext('2d'),viewport:vp}).promise;
  if(!cropRect)return full;const sx=Math.round(cropRect.x*full.width),sy=Math.round(cropRect.y*full.height),sw=Math.max(1,Math.round(cropRect.w*full.width)),sh=Math.max(1,Math.round(cropRect.h*full.height)),c=document.createElement('canvas');c.width=sw;c.height=sh;c.getContext('2d').drawImage(full,sx,sy,sw,sh,0,0,sw,sh);return c;
}
async function buildPdfAt(scale,q){
  const doc=await PDFLib.PDFDocument.create();
  for(let k=0;k<pdfSelectedPages.length;k++){const n=pdfSelectedPages[k];status(`Compressing PDF • loaded page ${k+1}/${pdfSelectedPages.length} (source page ${n})…`);const pg=await pdfDoc.getPage(n),c=await renderPdfPageBase(pg,scale,cropApplied),b=await blobOf(c,'image/jpeg',q),im=await doc.embedJpg(await b.arrayBuffer()),p=doc.addPage([im.width,im.height]);p.drawImage(im,{x:0,y:0,width:im.width,height:im.height});}
  return await doc.save({useObjectStreams:true});
}
async function compressPdf(){
  const target=targetBytes(),mode=$('cf118Quality').value;
  const scales=mode==='best'?[2,1.7,1.45,1.25,1.08,.92,.78,.64,.52]:mode==='balanced'?[1.6,1.35,1.15,.98,.82,.68,.55,.45]:[1.2,1,.82,.68,.55,.44,.34];
  const qs=mode==='best'?[.9,.82,.74,.66,.58,.5,.42,.34]:mode==='balanced'?[.82,.7,.6,.5,.4,.32,.24]:[.62,.5,.4,.3,.22,.16,.11];
  let best=null,bestDiff=Infinity;
  outer:for(const sc of scales){
    for(const q of qs){const out=await buildPdfAt(sc,q),d=Math.abs(out.byteLength-target);if(d<bestDiff){best=out;bestDiff=d}if(out.byteLength<=target*1.02&&out.byteLength>=target*.68)break outer;if(out.byteLength<target*.55)break;}
  }
  const blob=new Blob([best],{type:'application/pdf'}),base=file.name.replace(/\.pdf$/i,'');download(blob,`${base}-compressed.pdf`);status(`Done • PDF ${formatBytes(blob.size)} • ${pdfSelectedPages.length} loaded page(s)${cropApplied?' • crop applied':''}${blob.size>target*1.05?' • closest quality-preserving result exported.':''}`);
}

$('cf118Compress').onclick=async()=>{
  if(!kind)return status('Load an image or PDF first.');const b=$('cf118Compress');b.disabled=true;const old=b.textContent;b.textContent='Compressing…';
  try{if(kind==='image')await compressImage();else await compressPdf()}catch(e){console.error(e);status('Compression failed. Original file was not changed.')}finally{b.disabled=false;b.textContent=old}
};

/* Passport print sheet: keep a single continuous photo border; cut lines are corner crop marks in v11.6 renderer. */
window.addEventListener('DOMContentLoaded',()=>{
  document.title='Shop Studio Pro v11.9';const bs=document.querySelector('.brand-subtitle');if(bs)bs.textContent='PRO TOOLKIT • V11.9';
  const note=$('passportSheetStatusV116'); if(note&&/regenerate/i.test(note.textContent||'')) note.title='Photo border is a single line. Cut Lines use corner crop marks, not a second rectangle.';
});
})();

/* END app-v11.8.0.js */

;
/* BEGIN app-v11.9.8.js */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
function printCanvas(canvas,title='Shop Studio Print'){
  if(!canvas||!canvas.width)return alert('Build the sheet first.');
  const u=canvas.toDataURL('image/png'),w=window.open('','_blank');if(!w)return alert('Allow pop-ups to print.');
  w.document.write(`<!doctype html><html><head><title>${title}</title><style>@page{margin:0}html,body{margin:0;min-height:100%}body{display:grid;place-items:center;background:#fff}img{display:block;max-width:100%;max-height:100vh;object-fit:contain}</style></head><body><img src="${u}" onload="setTimeout(()=>window.print(),100)"></body></html>`);w.document.close();
}
function init(){
  document.title='Shop Studio Pro v11.9.8';
  const sub=document.querySelector('.brand-subtitle');if(sub)sub.textContent='PRO TOOLKIT • V11.9.8';
  const meta=document.querySelector('meta[name="shop-build"]');if(meta)meta.content='11.9.8';

  // One clear Apply Crop action directly below Crop / Perspective Crop.
  $('applyCardCrop')?.addEventListener('click',()=>{
    const free=$('cardFreeCropLayer'),persp=$('cardPerspectiveLayer');
    if(free&&getComputedStyle(free).display!=='none') return $('applyCardFlexibleCrop')?.click();
    if(persp&&getComputedStyle(persp).display!=='none') return $('saveCardCrop')?.click();
    // If no overlay is open, open normal crop first so Apply is never destructive/unexpected.
    $('cardSimpleCropBtn')?.click();
  });

  $('printCardSheet')?.addEventListener('click',()=>{
    const c=$('cardCanvas');if(!c?.width){$('buildCardSheet')?.click();setTimeout(()=>printCanvas($('cardCanvas'),'Smart Card Print'),80);return;}printCanvas(c,'Smart Card Print');
  });

  // Google-Lens-like OCR flow: image preview above text, then extract/copy/print.
  const input=$('ocrInput'),preview=$('ocrPreview'),empty=$('ocrPreviewEmpty');let objectUrl='';
  input?.addEventListener('change',()=>{
    const f=input.files?.[0];if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl='';
    if(!f){if(preview)preview.style.display='none';if(empty)empty.style.display='grid';return;}
    objectUrl=URL.createObjectURL(f);if(preview){preview.src=objectUrl;preview.style.display='block'}if(empty)empty.style.display='none';
    const st=$('ocrStatus');if(st)st.textContent=`Ready to extract • ${f.name}`;
  });
  $('copyOcr')?.addEventListener('click',()=>{const st=$('ocrStatus');if(st&&$('ocrText')?.value)st.textContent='Text copied to clipboard.';});
  $('printOcr')?.addEventListener('click',()=>{
    const src=preview?.src||'',txt=$('ocrText')?.value||'';if(!src&&!txt)return alert('Upload an image or extract text first.');
    const w=window.open('','_blank');if(!w)return alert('Allow pop-ups to print.');
    const safe=txt.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
    w.document.write(`<!doctype html><html><head><title>OCR Print</title><style>@page{margin:12mm}body{font-family:Arial,sans-serif;color:#111}img{display:block;max-width:100%;max-height:45vh;margin:0 auto 16px}pre{white-space:pre-wrap;font:14px/1.5 Arial,sans-serif}</style></head><body>${src?`<img src="${src}">`:''}<pre>${safe}</pre><script>onload=()=>setTimeout(()=>print(),150)<\/script></body></html>`);w.document.close();
  });

  // Enhance card/print layout editor after every build: 4 sides + 4 corners + rotate.
  const enhance=()=>document.querySelectorAll('.layout-editor .layout-item').forEach((d,i)=>{
    if(d.dataset.v1198)return;d.dataset.v1198='1';
    ['n','e','s','w'].forEach(pos=>{if(!d.querySelector('.layout-resize.'+pos)){const h=document.createElement('span');h.className='layout-resize '+pos;h.dataset.handle=pos;d.appendChild(h);installSideResize(d,h,pos)}});
    if(!d.querySelector('.layout-rotate')){const r=document.createElement('span');r.className='layout-rotate';r.title='Drag to rotate';d.appendChild(r);installRotate(d,r)}
  });
  function getLayout(node){const ed=node.parentElement,idx=[...ed.children].indexOf(node);try{if(ed.id==='cardSheetEditor')return {arr:state.cardSheetLayout,idx,canvas:$('cardCanvas')};if(ed.id==='printEditor')return {arr:state.printLayout,idx,canvas:$('printCanvas')};}catch{}return null;}
  function redraw(info){const c=info?.canvas,it=info?.arr;if(!c?.width||!it)return;const x=c.getContext('2d');x.clearRect(0,0,c.width,c.height);x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);it.forEach(o=>{if(!o.img)return;const px=o.x*c.width,py=o.y*c.height,pw=o.w*c.width,ph=o.h*c.height,a=+o.rotation||0,sc=Math.min(pw/o.img.width,ph/o.img.height),dw=o.img.width*sc,dh=o.img.height*sc;x.save();x.translate(px+pw/2,py+ph/2);x.rotate(a*Math.PI/180);x.drawImage(o.img,-dw/2,-dh/2,dw,dh);x.restore();});}
  function installSideResize(node,h,pos){h.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();const info=getLayout(node);if(!info||!info.arr?.[info.idx])return;const base={...info.arr[info.idx]},sx=e.clientX,sy=e.clientY,rect=info.canvas.getBoundingClientRect(),min=.025;const move=ev=>{let n={...base},dx=(ev.clientX-sx)/rect.width,dy=(ev.clientY-sy)/rect.height;if(pos==='e')n.w=Math.max(min,Math.min(1-base.x,base.w+dx));if(pos==='s')n.h=Math.max(min,Math.min(1-base.y,base.h+dy));if(pos==='w'){const nx=Math.max(0,Math.min(base.x+base.w-min,base.x+dx));n.w=base.w+(base.x-nx);n.x=nx}if(pos==='n'){const ny=Math.max(0,Math.min(base.y+base.h-min,base.y+dy));n.h=base.h+(base.y-ny);n.y=ny}info.arr[info.idx]=n;node.style.left=n.x*100+'%';node.style.top=n.y*100+'%';node.style.width=n.w*100+'%';node.style.height=n.h*100+'%';redraw(info)};const up=()=>{document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',up,true)};document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',up,true)},true)}
  function installRotate(item,handle){
    handle.addEventListener('pointerdown',e=>{
      e.preventDefault();e.stopPropagation();const rect=item.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
      const base=parseFloat(item.dataset.rotation||'0'),start=Math.atan2(e.clientY-cy,e.clientX-cx)*180/Math.PI;
      const move=ev=>{let a=base+(Math.atan2(ev.clientY-cy,ev.clientX-cx)*180/Math.PI-start);if(ev.shiftKey)a=Math.round(a/15)*15;item.dataset.rotation=String(a);item.style.rotate=a+'deg';syncCanvasRotation(item,a)};
      const up=()=>{document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',up,true)};
      document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',up,true);
    },true);
  }
  // Store rotation on the underlying layout item by matching editor/index. The renderer patch in v11.5 reads it.
  function syncCanvasRotation(node,a){
    const ed=node.parentElement,idx=[...ed.children].indexOf(node);try{
      if(ed.id==='cardSheetEditor'&&typeof state!=='undefined'&&state.cardSheetLayout?.[idx])state.cardSheetLayout[idx].rotation=a;
      if(ed.id==='printEditor'&&typeof state!=='undefined'&&state.printLayout?.[idx])state.printLayout[idx].rotation=a;
    }catch{}
  }
  const mo=new MutationObserver(enhance);document.querySelectorAll('.layout-editor').forEach(x=>mo.observe(x,{childList:true,subtree:true}));
  ['buildCardSheet','buildPrintSheet'].forEach(id=>$(id)?.addEventListener('click',()=>setTimeout(enhance,0)));
  enhance();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,120));else setTimeout(init,120);
})();

/* END app-v11.9.8.js */

;
/* BEGIN app-v11.9.9.js */
/* Shop Studio Pro v11.9.9 — Smart Card Apply Crop fix + Lens-style OCR selection */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
function init(){
  document.title='Shop Studio Pro v11.9.9';
  const sub=document.querySelector('.brand-subtitle');if(sub)sub.textContent='PRO TOOLKIT • V11.9.9';
  const meta=document.querySelector('meta[name="shop-build"]');if(meta)meta.content='11.9.9';

  // Fix the public Apply Crop button so it applies the CURRENT crop controller.
  const apply=$('applyCardCrop');
  if(apply){
    const fresh=apply.cloneNode(true);apply.replaceWith(fresh);
    fresh.addEventListener('click',()=>{
      const host=$('cardV111CropHost');
      const simpleOpen=host && getComputedStyle(host).display!=='none' && host.querySelector('.v111-crop-box') && getComputedStyle(host.querySelector('.v111-crop-box')).display!=='none';
      let perspectiveOpen=false;
      try{ perspectiveOpen=!!(state?.cardPerspectiveMode && state?.cardPerspectivePts); }catch{}
      if($('cardFreeCropLayer') && getComputedStyle($('cardFreeCropLayer')).display!=='none' && !simpleOpen){ $('applyCardFlexibleCrop')?.click(); return; }
      if(simpleOpen||perspectiveOpen){ $('saveCardCrop')?.click(); return; }
      $('cardSimpleCropBtn')?.click();
    });
  }

  // OCR: reliable preview via FileReader and Google-Lens-like drag selection.
  const input=$('ocrInput'),preview=$('ocrPreview'),wrap=$('ocrImageWrap'),shell=$('ocrPreviewShell'),empty=$('ocrPreviewEmpty'),box=$('ocrSelectBox'),status=$('ocrStatus'),text=$('ocrText');
  if(!input||!preview||!wrap||!shell||!box)return;
  let file=null, drag=null, selection=null;

  function setPreview(f){
    file=f||null;selection=null;box.hidden=true;
    if(!file){wrap.style.display='none';shell.classList.remove('has-image');if(empty)empty.style.display='grid';return;}
    const reader=new FileReader();
    reader.onload=()=>{preview.onload=()=>{wrap.style.display='inline-block';shell.classList.add('has-image');if(empty)empty.style.display='none';if(status)status.textContent=`Ready • drag over text to extract selection • ${file.name}`;};preview.src=reader.result;};
    reader.onerror=()=>{if(status)status.textContent='Could not preview this image.';};reader.readAsDataURL(file);
  }
  input.addEventListener('change',()=>setPreview(input.files?.[0]),true);

  function point(e){const r=preview.getBoundingClientRect();return{x:Math.max(0,Math.min(r.width,e.clientX-r.left)),y:Math.max(0,Math.min(r.height,e.clientY-r.top)),w:r.width,h:r.height};}
  function showRect(a,b){const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y);box.hidden=false;box.style.left=x+'px';box.style.top=y+'px';box.style.width=w+'px';box.style.height=h+'px';return{x,y,w,h,displayW:a.w,displayH:a.h};}
  wrap.addEventListener('pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;e.preventDefault();const p=point(e);drag={start:p,last:p};wrap.setPointerCapture?.(e.pointerId);showRect(p,p);});
  wrap.addEventListener('pointermove',e=>{if(!drag)return;e.preventDefault();drag.last=point(e);selection=showRect(drag.start,drag.last);});
  wrap.addEventListener('pointerup',async e=>{if(!drag)return;e.preventDefault();drag.last=point(e);selection=showRect(drag.start,drag.last);drag=null;if(selection.w<8||selection.h<8){box.hidden=true;selection=null;return;}await recognizeSelection();});
  wrap.addEventListener('pointercancel',()=>{drag=null;});

  async function recognizeSelection(){
    if(!selection||!preview.naturalWidth||!window.Tesseract)return;
    const sx=preview.naturalWidth/selection.displayW,sy=preview.naturalHeight/selection.displayH;
    const c=document.createElement('canvas');c.width=Math.max(1,Math.round(selection.w*sx));c.height=Math.max(1,Math.round(selection.h*sy));
    c.getContext('2d').drawImage(preview,Math.round(selection.x*sx),Math.round(selection.y*sy),c.width,c.height,0,0,c.width,c.height);
    if(status)status.textContent='Reading selected text...';
    try{
      const r=await Tesseract.recognize(c,'eng',{logger:m=>{if(m.progress&&status)status.textContent=`${m.status} • ${Math.round(m.progress*100)}%`;}});
      const value=(r.data.text||'').trim();text.value=value;
      if(!value){if(status)status.textContent='No clear text found in the selected area.';return;}
      let copied=false;try{await navigator.clipboard.writeText(value);copied=true;}catch{}
      if(status)status.textContent=copied?'Selected text extracted and copied.':'Selected text extracted • press Copy Text to copy it.';
    }catch(err){console.error(err);if(status)status.textContent='Selected-area OCR failed. Try a clearer/larger selection.';}
  }

  // Keep whole-image Extract Text working and ensure preview exists even if another handler replaced state.
  $('ocrBtn')?.addEventListener('click',()=>{if(input.files?.[0]&&preview.src==='')setPreview(input.files[0]);},true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,180));else setTimeout(init,180);
})();

/* END app-v11.9.9.js */

;
/* BEGIN smart-card-patch.js */
/* Smart Card v19: rebuilt isolated fit-to-view canvas controller. Other tools untouched. */
(()=>{'use strict';
  const $=id=>document.getElementById(id), clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const init=()=>{
    const section=$('cards'),stage=$('cardPerspectiveStage'),canvas=$('cardSourceCanvas'),zoom=$('cardZoom'),preset=$('cardAspect');
    if(!section||!stage||!canvas||!zoom||!preset)return;
    // Preserve the existing controls and colour scheme. Free is an additional size choice.
    if(!preset.querySelector('[value="free"]'))preset.insertAdjacentHTML('afterbegin','<option value="free">Free — adjustable crop</option>');
    if(!preset.querySelector('[value="aadhaar-wide"]'))preset.insertAdjacentHTML('beforeend','<option value="aadhaar-wide">Aadhaar Wide 6.74 × 2.125 in</option>');
    preset.value='free';
    const size=()=>preset.value==='aadhaar-wide'?[6.74*25.4,2.125*25.4]:preset.value==='free'?null:[85.6,54];
    const ratio=()=>{const s=size();return s?s[0]/s[1]:null};
    const status=txt=>{if($('cardStatus'))$('cardStatus').textContent=txt};
    const modeButtons=()=>{$('cardSimpleCropBtn')?.classList.toggle('active',mode==='rect');$('manualCardPerspectiveBtn')?.classList.toggle('active',mode==='quad')};
    const clone=src=>{const c=document.createElement('canvas');c.width=src.width;c.height=src.height;c.getContext('2d').drawImage(src,0,0);return c};
    let sourceOriginal=null,mode='none',rect=null,quad=null,loadedLabel='',loadTicket=0,drag=null,applied=false;
    const undoStack=[],redoStack=[];const maxHistory=12;let restoringHistory=false;
    function snapshot(){return {image:clone(canvas),mode,rect:rect?{...rect}:null,quad:quad?quad.map(p=>({...p})):null}}
    function remember(){if(restoringHistory||!canvas.width)return;undoStack.push(snapshot());if(undoStack.length>maxHistory)undoStack.shift();redoStack.length=0;refreshHistory()}
    function restoreSnapshot(s){restoringHistory=true;canvas.width=s.image.width;canvas.height=s.image.height;canvas.getContext('2d').drawImage(s.image,0,0);rect=s.rect;quad=s.quad;mode=s.mode;updateOverlay();screen();restoringHistory=false;refreshHistory()}
    function undo(){if(!undoStack.length)return;redoStack.push(snapshot());restoreSnapshot(undoStack.pop());status('Undo complete.')}
    function redo(){if(!redoStack.length)return;undoStack.push(snapshot());restoreSnapshot(redoStack.pop());status('Redo complete.')}
    let undoButton,redoButton;function refreshHistory(){if(undoButton)undoButton.disabled=!undoStack.length;if(redoButton)redoButton.disabled=!redoStack.length}
    const host=$('cardV111CropHost')||document.createElement('div');host.id='cardV111CropHost';host.className='v111-card-crop-host sc13-host';stage.appendChild(host);
    // Keep canvas and selection in a single scrollable content box.
    const viewport=document.createElement('div');viewport.id='card19Viewport';viewport.className='card19-viewport';
    stage.insertBefore(viewport,canvas);viewport.appendChild(canvas);viewport.appendChild(host);
    // Replace the contents of the old host: old pointers are detached, so only one crop overlay can exist.
    host.innerHTML='<div id="sc13Rect" class="v111-crop-box sc13-rect">'+['nw','n','ne','e','se','s','sw','w'].map(h=>`<span class="v111-crop-handle ${h}" data-h="${h}"></span>`).join('')+'</div><div id="sc13Quad" class="sc13-quad"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><polygon id="sc13Poly" points="5,5 95,5 95,95 5,95"></polygon></svg>'+Array.from({length:4},(_,i)=>`<span class="sc13-point" data-point="${i}"></span>`).join('')+'</div>';
    const rectBox=$('sc13Rect'),quadBox=$('sc13Quad'),poly=$('sc13Poly');
    const hideOld=()=>{
      for(const id of ['cardFreeCropLayer','cardPerspectiveLayer']){const n=$(id);if(n){n.style.display='none';n.style.pointerEvents='none';}}
      // Older auto-crop handlers must not display their own polygon above ours.
      if(typeof state!=='undefined'){state.cardFreeCrop=null;state.cardPerspectiveMode=false;state.cardPerspectivePts=null;}
    };
    const endOverlay=()=>{mode='none';rectBox.style.display='none';quadBox.style.display='none';host.style.display='none';modeButtons();hideOld()};
    window.shopSmartCardClearCrop=()=>{++loadTicket;rect=null;quad=null;endOverlay();status('Crop selection cleared. The original image is unchanged.');};
    function screen(){
      if(!canvas.width||!canvas.height)return;
      stage.style.display='block';stage.style.position='relative';stage.style.overflow='auto';
      stage.style.width='100%';stage.style.minWidth='0';stage.style.boxSizing='border-box';
      stage.style.height='68vh';stage.style.maxHeight='68vh';stage.style.minHeight='320px';
      const availableW=Math.max(100,stage.clientWidth-36);
      const availableH=Math.max(100,stage.clientHeight-36);
      // Fit the complete page at 100%; zoom changes its CSS size, not its pixel resolution.
      const fit=Math.min(availableW/canvas.width,availableH/canvas.height);
      const factor=(Number(zoom.value)||100)/100;
      const w=Math.max(1,Math.round(canvas.width*fit*factor));
      const h=Math.max(1,Math.round(canvas.height*fit*factor));
      viewport.style.width=w+'px';viewport.style.height=h+'px';
      viewport.style.marginLeft=w<availableW?'auto':'0px';
      viewport.style.marginRight=w<availableW?'auto':'0px';
      viewport.style.marginTop=h<availableH?Math.max(0,(availableH-h)/2)+'px':'0px';
      viewport.style.marginBottom='0px';
      canvas.style.setProperty('width','100%','important');
      canvas.style.setProperty('height','100%','important');
      canvas.style.setProperty('max-width','none','important');
      canvas.style.setProperty('max-height','none','important');
      canvas.style.setProperty('transform','none','important');
      canvas.style.margin='0';canvas.style.display='block';
      Object.assign(host.style,{left:'0',top:'0',right:'auto',bottom:'auto',margin:'0',padding:'0',boxSizing:'border-box',width:'100%',height:'100%'});
      updateOverlay();
    }
    function updateOverlay(){
      host.style.display=mode==='none'?'none':'block';rectBox.style.display=mode==='rect'?'block':'none';quadBox.style.display=mode==='quad'?'block':'none';
      if(mode==='rect'&&rect){Object.assign(rectBox.style,{left:rect.x*100+'%',top:rect.y*100+'%',width:rect.w*100+'%',height:rect.h*100+'%'});}
      if(mode==='quad'&&quad){poly.setAttribute('points',quad.map(p=>p.x*100+','+p.y*100).join(' '));quadBox.querySelectorAll('.sc13-point').forEach((el,i)=>{el.style.left=quad[i].x*100+'%';el.style.top=quad[i].y*100+'%';});}
      modeButtons();
    }
    function centered(candidate){
      const aspect=ratio();let r=candidate||{x:.06,y:.08,w:.88,h:.84};r={...r};
      r.x=clamp(r.x,0,.99);r.y=clamp(r.y,0,.99);r.w=clamp(r.w,.02,1-r.x);r.h=clamp(r.h,.02,1-r.y);
      if(aspect){const imageAR=canvas.width/canvas.height,normalized=aspect/imageAR;let w=Math.min(r.w,r.h*normalized),h=w/normalized;if(h>r.h){h=r.h;w=h*normalized}r.x+=(r.w-w)/2;r.y+=(r.h-h)/2;r.w=w;r.h=h;}
      return r;
    }
    const baseRect=()=>centered({x:.08,y:.08,w:.84,h:.84});
    function activateRect(r){hideOld();mode='rect';rect=centered(r||rect||baseRect());quad=null;updateOverlay();}
    function activatePerspective(points){hideOld();mode='quad';quad=points||[{x:.06,y:.08},{x:.94,y:.08},{x:.94,y:.92},{x:.06,y:.92}];rect=null;updateOverlay();}
    function rectFromPixels(points){const xs=points.map(p=>p.x/canvas.width),ys=points.map(p=>p.y/canvas.height);return {x:clamp(Math.min(...xs),0,1),y:clamp(Math.min(...ys),0,1),w:clamp(Math.max(...xs)-Math.min(...xs),.02,1),h:clamp(Math.max(...ys)-Math.min(...ys),.02,1)}}
    function orderFour(points){const p=points.map(o=>({...o}));if(p.length!==4)return null;const sums=p.map(x=>x.x+x.y),diff=p.map(x=>x.x-x.y);return [p[sums.indexOf(Math.min(...sums))],p[diff.indexOf(Math.max(...diff))],p[sums.indexOf(Math.max(...sums))],p[diff.indexOf(Math.min(...diff))]]}
    // Automatically detect the card edges after upload/page change; fall back to a manually adjustable ratio-sized rectangle.
    async function detect(){
      if(!canvas.width||!canvas.height)return;const ticket=++loadTicket;let points=null;
      try{
        if(typeof cv!=='undefined'&&cv.Mat&&typeof detectCardQuadrilaterals==='function'){
          const found=await detectCardQuadrilaterals(canvas,6);const target=ratio();
          if(found?.length){const rank=[...found].sort((a,b)=>{
            const value=q=>{const xs=q.points.map(p=>p.x),ys=q.points.map(p=>p.y);const w=Math.max(...xs)-Math.min(...xs),h=Math.max(...ys)-Math.min(...ys),actual=w/Math.max(1,h),err=target?Math.abs(Math.log(actual/target)):0,area=w*h/(canvas.width*canvas.height);return (q.score||0)+Math.min(area,1)*2-err*2};
            return value(b)-value(a);
          });points=rank[0].points;}
        }
        if(!points&&typeof bestDocumentPoints==='function'&&typeof cv!=='undefined'&&cv.Mat)points=await bestDocumentPoints(canvas,false);
      }catch(e){console.warn('Smart Card edge detection unavailable; using adjustable crop',e)}
      if(ticket!==loadTicket)return;
      const conf=points?.length===4?Math.max(0,Math.min(100,Math.round((1-Math.abs(Math.log(Math.max(.01,(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)))/Math.max(1,(Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y))))/(ratio()||canvas.width/canvas.height)))))*100))):0;
      // Edge confidence text is intentionally hidden; crop detection still runs.
      if(points?.length===4){activateRect(rectFromPixels(points));status('Document detected. Adjust the single crop rectangle, then click Apply Crop.');}
      else{activateRect(baseRect());status('Adjust the single crop rectangle and click Apply Crop. Automatic edges were not available.');}
    }
    function updatePreset(){if(!canvas.width)return;const s=size();if(typeof state!=='undefined')state.cardOutputSizeMm=s;
      if(mode!=='quad'){activateRect(baseRect())}else{updateOverlay()}
      status(s?`Crop ratio: ${s[0].toFixed(2)} × ${s[1].toFixed(2)} mm. Drag to reposition or resize.`:'Free crop: drag any edge or corner to choose the output size.');
    }
    // Rect is a single normalized selection; all pointer input uses the untransformed canvas display bounds.
    function downRect(e){if(mode!=='rect')return;remember();e.preventDefault();e.stopPropagation();const handle=e.target.dataset.h||'move';drag={kind:'rect',handle,x:e.clientX,y:e.clientY,start:{...rect}};rectBox.setPointerCapture(e.pointerId)}
    function moveRect(e){if(!drag||drag.kind!=='rect')return;const start=drag.start,dx=(e.clientX-drag.x)/Math.max(1,host.clientWidth),dy=(e.clientY-drag.y)/Math.max(1,host.clientHeight);let x=start.x,y=start.y,w=start.w,h=start.h;const handle=drag.handle,as=ratio(),n=as?as*canvas.height/canvas.width:null;
      if(handle==='move'){x=clamp(x+dx,0,1-w);y=clamp(y+dy,0,1-h)}
      else if(n){
        // Anchor the opposite edge/corner. Never allow a resize to exceed canvas bounds.
        const anchorX=handle.includes('w')?start.x+start.w:handle.includes('e')?start.x:start.x+start.w/2;
        const anchorY=handle.includes('n')?start.y+start.h:handle.includes('s')?start.y:start.y+start.h/2;
        let desiredW=start.w;
        if(handle.includes('e'))desiredW=start.w+dx;
        if(handle.includes('w'))desiredW=start.w-dx;
        if(handle==='n')desiredW=(start.h-dy)*n;
        if(handle==='s')desiredW=(start.h+dy)*n;
        if(handle.length===2&&Math.abs(dy*n)>Math.abs(dx))desiredW=start.w+(handle.includes('n')?-dy:dy)*n;
        const maxX=handle.includes('w')?anchorX:handle.includes('e')?1-anchorX:2*Math.min(anchorX,1-anchorX);
        const maxY=handle.includes('n')?anchorY:handle.includes('s')?1-anchorY:2*Math.min(anchorY,1-anchorY);
        w=clamp(desiredW,Math.min(.02,maxX,maxY*n),Math.max(.02,Math.min(maxX,maxY*n)));
        h=w/n;
        x=handle.includes('w')?anchorX-w:handle.includes('e')?anchorX:anchorX-w/2;
        y=handle.includes('n')?anchorY-h:handle.includes('s')?anchorY:anchorY-h/2;
        x=clamp(x,0,1-w);y=clamp(y,0,1-h);
      }else{
        if(handle.includes('w')){const right=x+w;x=clamp(x+dx,0,right-.02);w=right-x}
        if(handle.includes('e'))w=clamp(w+dx,.02,1-x);
        if(handle.includes('n')){const bottom=y+h;y=clamp(y+dy,0,bottom-.02);h=bottom-y}
        if(handle.includes('s'))h=clamp(h+dy,.02,1-y);
      }
      rect={x,y,w,h};updateOverlay();
    }
    rectBox.addEventListener('pointerdown',downRect);rectBox.addEventListener('pointermove',moveRect);rectBox.addEventListener('pointerup',()=>drag=null);rectBox.addEventListener('pointercancel',()=>drag=null);
    function downQuad(e){if(mode!=='quad')return;remember();e.preventDefault();e.stopPropagation();drag={kind:'quad',i:e.target.classList.contains('sc13-point')?Number(e.target.dataset.point):-1,x:e.clientX,y:e.clientY,start:quad.map(p=>({...p}))};quadBox.setPointerCapture(e.pointerId)}
    function moveQuad(e){if(drag?.kind!=='quad')return;const dx=(e.clientX-drag.x)/Math.max(1,host.clientWidth),dy=(e.clientY-drag.y)/Math.max(1,host.clientHeight);const p=drag.start.map(x=>({...x}));if(drag.i>=0){p[drag.i]={x:clamp(p[drag.i].x+dx,0,1),y:clamp(p[drag.i].y+dy,0,1)}}else{const minX=Math.min(...p.map(x=>x.x)),maxX=Math.max(...p.map(x=>x.x)),minY=Math.min(...p.map(x=>x.y)),maxY=Math.max(...p.map(x=>x.y));const x=clamp(dx,-minX,1-maxX),y=clamp(dy,-minY,1-maxY);p.forEach(q=>{q.x+=x;q.y+=y})}quad=p;updateOverlay();}
    quadBox.addEventListener('pointerdown',downQuad);quadBox.addEventListener('pointermove',moveQuad);
    async function cropped(){
      if(mode==='rect'&&rect){const r=rect,out=document.createElement('canvas');out.width=Math.max(1,Math.round(canvas.width*r.w));out.height=Math.max(1,Math.round(canvas.height*r.h));out.getContext('2d').drawImage(canvas,r.x*canvas.width,r.y*canvas.height,r.w*canvas.width,r.h*canvas.height,0,0,out.width,out.height);return out;}
      if(mode==='quad'&&quad){
        if(typeof cv==='undefined'||!cv.Mat)throw new Error('Perspective correction needs OpenCV to finish loading.');
        const ordered=orderFour(quad.map(p=>({x:p.x*canvas.width,y:p.y*canvas.height})));if(!ordered)throw new Error('Invalid perspective corners');
        const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),w=Math.min(10000,Math.max(1,Math.round(Math.max(dist(ordered[0],ordered[1]),dist(ordered[3],ordered[2]))))),h=Math.min(10000,Math.max(1,Math.round(Math.max(dist(ordered[0],ordered[3]),dist(ordered[1],ordered[2])))));
        let src,srcPts,dstPts,M,dst;try{src=cv.imread(canvas);srcPts=cv.matFromArray(4,1,cv.CV_32FC2,ordered.flatMap(p=>[p.x,p.y]));dstPts=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,w-1,0,w-1,h-1,0,h-1]);M=cv.getPerspectiveTransform(srcPts,dstPts);dst=new cv.Mat();cv.warpPerspective(src,dst,M,new cv.Size(w,h),cv.INTER_LINEAR,cv.BORDER_REPLICATE,new cv.Scalar());const out=document.createElement('canvas');out.width=w;out.height=h;cv.imshow(out,dst);return out;}finally{[src,srcPts,dstPts,M,dst].forEach(m=>m?.delete())}
      }
      return null;
    }
    async function applyOnly(){
      if(!canvas.width||!canvas.height){status('Upload an image or PDF page first.');return;}
      if(mode==='none'){activateRect(baseRect());status('Crop area ready — adjust it and click Apply Crop.');return;}
      try{remember();const out=await cropped();if(!out)return; if(!sourceOriginal)sourceOriginal=clone(canvas);canvas.width=out.width;canvas.height=out.height;canvas.getContext('2d').drawImage(out,0,0);applied=true;endOverlay();zoom.value='100';$('cardZoomValue').textContent='100%';screen();stage.scrollLeft=0;stage.scrollTop=0;status('Crop applied to the main canvas. Save Front / Back or drag the cropped canvas to a card preview.');}
      catch(e){console.error(e);status(e.message||'Unable to apply crop. Original image has been retained.')}
    }
    function save(side){
      if(!canvas.width||!canvas.height){status('Upload a document first.');return;}
      const s=size(),dpi=Number($('cardExportDpi')?.value)||300;
      const w=s?Math.max(1,Math.round(s[0]/25.4*dpi)):canvas.width,h=s?Math.max(1,Math.round(s[1]/25.4*dpi)):canvas.height;
      const out=document.createElement('canvas');out.width=w;out.height=h;const ctx=out.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
      // Contain protects text at all times, including when a detected boundary is imperfect.
      const scale=Math.min(w/canvas.width,h/canvas.height);ctx.drawImage(canvas,(w-canvas.width*scale)/2,(h-canvas.height*scale)/2,canvas.width*scale,canvas.height*scale);
      state[side==='front'?'cardFrontCrop':'cardBackCrop']=out;
      state.cardSavedDimensions=state.cardSavedDimensions||{};state.cardSavedDimensions[side]=s||[canvas.width/dpi*25.4,canvas.height/dpi*25.4];
      const preview=$(side==='front'?'cardFrontPreview':'cardBackPreview');if(preview){const ratio=Math.min(380/w,190/h,1);preview.width=Math.max(1,Math.round(w*ratio));preview.height=Math.max(1,Math.round(h*ratio));preview.getContext('2d').drawImage(out,0,0,preview.width,preview.height)}
      status(side.toUpperCase()+' saved at '+w+'×'+h+' px. The other side is unchanged.');
    }
    function replaceClick(id,fn){const old=$(id);if(!old)return;const next=old.cloneNode(true);old.replaceWith(next);next.addEventListener('click',fn);return next}
    replaceClick('cardSimpleCropBtn',()=>{if(!canvas.width)return status('Upload a document first.');activateRect(baseRect());status('Single crop selection: drag edges/corners or move the rectangle.');});
    replaceClick('manualCardPerspectiveBtn',()=>{if(!canvas.width)return status('Upload a document first.');activatePerspective();status('Perspective crop enabled. Drag the four corner points, then Apply Crop.');});
    replaceClick('applyCardCrop',applyOnly);
    replaceClick('saveCardCrop',()=>save($('cardCropAction')?.value==='back'?'back':'front'));
    replaceClick('restoreCardSourceBtn',()=>{if(sourceOriginal)remember();if(!sourceOriginal)return status('No previous original to restore.');canvas.width=sourceOriginal.width;canvas.height=sourceOriginal.height;canvas.getContext('2d').drawImage(sourceOriginal,0,0);applied=false;zoom.value='100';$('cardZoomValue').textContent='100%';activateRect(baseRect());screen();status('Original restored. Adjust the single crop selection.');});
    replaceClick('exportCardCropImage',()=>{const side=$('cardCropAction')?.value==='back'?'back':'front',c=state[side==='front'?'cardFrontCrop':'cardBackCrop'];if(!c)return status('Save '+side+' first.');const type=$('cardOutputFormat')?.value||'image/png';if(typeof downloadCanvas==='function')downloadCanvas(c,'smart-card-'+side,type,1);});
    const viewControl=zoom.closest('label');
    if(viewControl){
      const fitBtn=document.createElement('button');fitBtn.type='button';fitBtn.className='mini-btn';
      fitBtn.id='card19FitPage';fitBtn.textContent='Fit Page';fitBtn.title='Show the entire uploaded page';
      viewControl.after(fitBtn);
      fitBtn.addEventListener('click',()=>{zoom.value='100';$('cardZoomValue').textContent='100%';screen();stage.scrollLeft=0;stage.scrollTop=0;});
    }
    // Undo and redo remain available exclusively with Ctrl/Cmd+Z and Ctrl/Cmd+Y.
    // Automatic edge detection remains on upload, but has no manual 1-click button.
    const confidenceLabel=null; // No confidence text in the simplified UI.
    // Calibration stays at 100% internally; no user input is needed.

    const calInput=null;
    calInput?.addEventListener('change',()=>{let v=Number(calInput.value);if(!Number.isFinite(v))v=100;calInput.value=String(clamp(v,90,110));status('Calibration '+calInput.value+'%. Build Sheet again, then print at Actual Size / 100%.')});
    // Calibrate card dimensions during sheet building; never rescale the whole A4 page.
    $('buildCardSheet')?.addEventListener('click',()=>{const v=Number(calInput?.value)||100;if(v===100||!state.cardSheetLayout?.length)return;const factor=v/100;for(const item of state.cardSheetLayout){const cx=item.x+item.w/2,cy=item.y+item.h/2;item.w*=factor;item.h*=factor;item.x=cx-item.w/2;item.y=cy-item.h/2;}if(typeof buildFromLayout==='function')buildFromLayout($('cardCanvas'),state.cardSheetLayout,$('cardCanvas').width,$('cardCanvas').height);if(typeof renderLayoutEditor==='function')renderLayoutEditor($('cardSheetEditor'),$('cardCanvas'),state.cardSheetLayout,'CARD');status('Calibrated card layout '+v+'%. Print at actual size, without Fit to Page.');});

    // Old hidden buttons only manipulate old overlays, so leave them hidden and inactive.
    preset.addEventListener('change',e=>{e.stopImmediatePropagation();loadTicket++;updatePreset();if($('cardPageLabel')?.textContent!=='No file')detect();},true);
    zoom.addEventListener('input',e=>{e.stopImmediatePropagation();const oldW=stage.scrollWidth||1,oldH=stage.scrollHeight||1,px=(stage.scrollLeft+stage.clientWidth/2)/oldW,py=(stage.scrollTop+stage.clientHeight/2)/oldH;screen();stage.scrollLeft=Math.max(0,px*stage.scrollWidth-stage.clientWidth/2);stage.scrollTop=Math.max(0,py*stage.scrollHeight-stage.clientHeight/2);$('cardZoomValue').textContent=zoom.value+'%';},true);
    document.addEventListener('keydown',e=>{if(section.classList.contains('active')&&!e.target.closest('input,textarea,select,[contenteditable=true]')&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.stopImmediatePropagation();e.shiftKey?redo():undo();return;}if(section.classList.contains('active')&&!e.target.closest('input,textarea,select,[contenteditable=true]')&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();e.stopImmediatePropagation();redo();return;}if(e.key!=='Enter'||!section.classList.contains('active')||e.target.closest('input,textarea,select,button'))return;e.preventDefault();e.stopImmediatePropagation();applyOnly();},true);
    // The loader updates the page label *after* the PDF/image pixels are rendered.
    const pageLabel=$('cardPageLabel');
    if(pageLabel){const observer=new MutationObserver(()=>{
      const label=pageLabel.textContent;if(!label||label==='No file'||label===loadedLabel)return;loadedLabel=label;loadTicket++;sourceOriginal=null;applied=false;undoStack.length=0;redoStack.length=0;refreshHistory();zoom.value='100';$('cardZoomValue').textContent='100%';endOverlay();requestAnimationFrame(()=>requestAnimationFrame(()=>{screen();stage.scrollLeft=0;stage.scrollTop=0;detect()}));
    });observer.observe(pageLabel,{childList:true,characterData:true,subtree:true});}
    for(const uploadId of ['cardPdfInput','cardImageInput']){
      $(uploadId)?.addEventListener('change',()=>{
        const ticket=++loadTicket;
        // A page can load asynchronously, especially when PDF.js renders a large page.
        const check=(attempt=0)=>{
          if(ticket!==loadTicket)return;
          if(canvas.width>1&&canvas.height>1){
            zoom.value='100';$('cardZoomValue').textContent='100%';
            screen();stage.scrollLeft=0;stage.scrollTop=0;
            detect();return;
          }
          if(attempt<40)setTimeout(()=>check(attempt+1),100);
        };
        setTimeout(()=>check(),200);
      });
    }
    // Canvas size is also changed by PDF rendering and the Apply Crop action.
    const observer=new MutationObserver(()=>requestAnimationFrame(screen));observer.observe(canvas,{attributes:true,attributeFilter:['width','height']});
    window.addEventListener('resize',()=>requestAnimationFrame(screen));
    if(typeof ResizeObserver!=='undefined'){new ResizeObserver(()=>requestAnimationFrame(screen)).observe(stage);}
    // Refresh the crop alignment if the viewport scrollbars/layout shift.
    // Scrolling does not change canvas geometry; rebuilding styles on every scroll causes jumps.
    // Canvas and crop host share the same viewport, so scrolling cannot desynchronise them.
    const src=canvas;src.draggable=true;src.addEventListener('dragstart',e=>{if(!canvas.width)return;e.dataTransfer.setData('text/x-shop-card','current-canvas');e.dataTransfer.setData('text/plain','smart-card-canvas');e.dataTransfer.effectAllowed='copy'},true);
    for(const [side,id] of [['front','cardFrontPreview'],['back','cardBackPreview']]){
      const el=$(id);if(!el)continue;const container=el.parentElement;container.addEventListener('drop',e=>{const hasCard=e.dataTransfer?.types?.includes('text/x-shop-card')||e.dataTransfer?.types?.includes('text/plain');if(!hasCard||e.dataTransfer.files.length)return;e.preventDefault();e.stopImmediatePropagation();save(side)},true);
      container.addEventListener('dragover',e=>{if(e.dataTransfer?.types?.includes('text/x-shop-card'))e.preventDefault()},true);
    }
    const notice=section.querySelector('.compact-notice');if(notice)notice.textContent='Free, PVC, Aadhaar / PAN or Aadhaar Wide crop size. Only one crop area appears. Export preserves aspect ratio.';
    if(typeof state!=='undefined')state.cardOutputSizeMm=null;
    endOverlay();screen();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,450));else setTimeout(init,450);
})();

/* END smart-card-patch.js */

;
/* BEGIN advanced-pdf-studio.js */
/* Advanced PDF Studio: A4 landscape 2-up sheets with alternate full-sheet 180 degree rotation. */
(()=>{'use strict';
  const input=document.getElementById('imposePdfInput'), button=document.getElementById('imposePdfBuild');
  const status=document.getElementById('imposePdfStatus'),result=document.getElementById('imposePdfResult'),download=document.getElementById('imposePdfDownload');
  if(!input||!button||!status||!download)return;
  let objectUrl=null, busy=false;
  const setStatus=message=>{status.textContent=message};
  const generate=async()=>{
    if(!input.files?.[0]||busy)return;
    if(!window.PDFLib){setStatus('PDF library did not load. Check internet connection and reload.');return;}
    busy=true;button.disabled=true;result.hidden=true;
    if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}
    setStatus('Arranging PDF pages for printing…');
    try{
      const file=input.files[0], raw=await file.arrayBuffer(),src=await PDFLib.PDFDocument.load(raw,{ignoreEncryption:false,updateMetadata:false});
      const count=src.getPageCount();if(!count)throw Error('This PDF contains no pages.');
      const dst=await PDFLib.PDFDocument.create();
      // ISO A4 landscape, PDF points. Each half occupies exactly 148.5 × 210 mm.
      const sheetW=841.8898,sheetH=595.2756,halfW=sheetW/2;
      const margin=15, footerH=25, font=await dst.embedFont(PDFLib.StandardFonts.Helvetica);
      // pdf-lib embeds only page 0 by default; explicitly embed every original page.
      let embedded=null, raster=null;
      try {
        // embedPages accepts PDFPage objects; embedPdf's page-index behavior differs between releases.
        embedded=await dst.embedPages(src.getPages());
        if(embedded.length!==count||embedded.some(p=>!p||!Number.isFinite(p.width)||!Number.isFinite(p.height)))throw Error('Invalid embedded page');
      } catch(embedError) {
        // Some scanner/legacy PDFs cannot be embedded as vectors. Use PDF.js raster output instead.
        console.warn('Vector embedding unavailable; switching to high-resolution PDF rendering.',embedError);
        const pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
        raster=await pdfjs.getDocument({data:new Uint8Array(raw.slice(0))}).promise;
        if(raster.numPages!==count)throw Error('Could not read all original PDF pages.');
      }
      for(let i=0;i<count;i+=2){
        const sheet=dst.addPage([sheetW,sheetH]);
        for(let j=0;j<2&&i+j<count;j++){
          const idx=i+j,cw=halfW-2*margin,ch=sheetH-2*margin-footerH;
          let source=embedded?.[idx], image=null, sw, sh;
          if(raster){
            const pg=await raster.getPage(idx+1),vp=pg.getViewport({scale:2.25});
            const cv=document.createElement('canvas');cv.width=Math.ceil(vp.width);cv.height=Math.ceil(vp.height);
            await pg.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;
            const blob=await new Promise((resolve,reject)=>cv.toBlob(b=>b?resolve(b):reject(Error('Page rendering failed')),'image/png'));
            image=await dst.embedPng(await blob.arrayBuffer());sw=image.width;sh=image.height;
            cv.width=cv.height=1;
          } else {
            if(!source)throw Error(`Original PDF page ${idx+1} could not be embedded.`);
            sw=source.width;sh=source.height;
          }
          if(sw<=0||sh<=0)throw Error('Page '+(idx+1)+' has invalid dimensions.');
          const scale=Math.min(cw/sw,ch/sh),w=sw*scale,h=sh*scale;
          const centerX=j*halfW+halfW/2,centerY=margin+footerH+ch/2;
          // Keep both original pages in reading order and upright within this combined sheet.
          if(image)sheet.drawImage(image,{x:centerX-w/2,y:centerY-h/2,width:w,height:h});
          else sheet.drawPage(source,{x:centerX-w/2,y:centerY-h/2,width:w,height:h});
        }
        // Number the resulting sheets, not their constituent original pages.
        const sheetNumber=String(Math.floor(i/2)+1),fontSize=11;
        const numberW=font.widthOfTextAtSize(sheetNumber,fontSize);
        sheet.drawText(sheetNumber,{x:(sheetW-numberW)/2,y:margin+5,size:fontSize,font,color:PDFLib.rgb(.16,.16,.16)});
        // Printed sheet 2, 4, 6 ... is rotated as a WHOLE, including its number.
        if((Math.floor(i/2)+1)%2===0)sheet.setRotation(PDFLib.degrees(180));
      }
      const bytes=await dst.save();objectUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
      download.href=objectUrl;download.download=file.name.replace(/\.pdf$/i,'').replace(/[^a-z0-9_-]+/gi,'_').slice(0,55)+'_2up_A4_print.pdf';
      result.hidden=false;setStatus(`Ready: ${count} original pages → ${Math.ceil(count/2)} A4 landscape sheets. Every second combined sheet rotated 180°; one sheet number per A4 sheet.`);
      // Auto arrange and prepare the file, without triggering an unsolicited browser download.
    }catch(err){console.error('Advanced PDF Studio failed:',err);setStatus('Could not arrange PDF: '+(err?.message||String(err)))}
    finally{busy=false;button.disabled=!input.files?.length;}
  };
  input.addEventListener('change',()=>{button.disabled=!input.files?.length;result.hidden=true;if(input.files?.length)generate();});
  button.addEventListener('click',generate);
  window.addEventListener('pagehide',()=>{if(objectUrl)URL.revokeObjectURL(objectUrl)});
})();

/* END advanced-pdf-studio.js */

;
/* BEGIN qr-print-integration.js */
/* QR Print Orders: direct authenticated owner portal and customer QR.
   Does not embed a GitHub Pages Owner.html (which could be unpublished/404). */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const CFG=window.SHOP_STUDIO_CONFIG||{};
const KEY='shopstudio_qr_v2';
const valid=u=>{try{const x=new URL(u);return x.protocol==='https:'&&x.hostname==='script.google.com'&&/^\/macros\/s\/[^/]+\/exec$/.test(x.pathname)}catch{return false}};
const normalize=u=>String(u||'').trim().replace(/\?.*$/,'').replace(/\/$/,'');
let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')}catch{}
let customer=normalize(saved.customer||CFG.customerBridgeUrl||'');
// ownerBridgeUrl may historically be a '?page=bridge' URL. Remove its query only;
// never send owner credentials to the public customer endpoint.
let owner=normalize(saved.owner||CFG.ownerBridgeUrl||'');
const customerUrl=new URL('Customer.html',document.baseURI).href;
const customerInput=$('qrScriptUrl'),ownerInput=$('qrOwnerUrl'),status=$('qrConnectionStatus');
if(customerInput)customerInput.value=customer;
if(ownerInput)ownerInput.value=owner;
function updateStatus(message,level='info'){
 if(status){status.textContent=message;status.dataset.level=level;}
}
function ownerTarget(){return valid(owner)?owner+'?page=owner':null}
function launchOwner(){
 const target=ownerTarget();
 if(!target){$('qrSettings').open=true;updateStatus('Enter your authenticated owner deployment URL in Connection settings.','warning');return}
 const win=window.open(target,'_blank','noopener');
 if(!win)updateStatus('Pop-up blocked. Allow pop-ups for this site or use the owner link below.','warning');
}
function syncEmbed(){const iframe=$('qrOwnerFrame');if(!iframe)return; const target=ownerTarget();
 if(target && iframe.dataset.target!==target){iframe.src=target;iframe.dataset.target=target}
 if(!target){iframe.removeAttribute('src');iframe.dataset.target='';}
}
$('qrOpenOwner')?.addEventListener('click',launchOwner);
$('qrRefreshOrders')?.addEventListener('click',launchOwner);
$('qrOpenCustomer')?.addEventListener('click',()=>window.open(customerUrl,'_blank','noopener'));
const link=$('qrCustomerLink');if(link){link.href=customerUrl;link.textContent=customerUrl}
$('qrCopyCustomer')?.addEventListener('click',async()=>{
 try{await navigator.clipboard.writeText(customerUrl);updateStatus('Customer upload link copied.','ok')}
 catch{updateStatus('Copy not available: select the customer link to copy it.','warning')}
});
$('qrSaveUrl')?.addEventListener('click',()=>{
 const c=normalize(customerInput?.value),o=normalize(ownerInput?.value);
 if(!valid(c)||!valid(o)){updateStatus('Enter valid /exec URLs for both customer and authenticated owner deployments.','warning');return}
 customer=c;owner=o;localStorage.setItem(KEY,JSON.stringify({customer,owner}));
 updateStatus('Connection URLs saved in this browser. Open Owner Orders to sign in.','ok');syncEmbed();
});
$('qrEmbedded')?.addEventListener('toggle',e=>{if(e.currentTarget.open)syncEmbed()});
const qr=$('qrCode');if(qr){
 if(window.QRCode){new QRCode(qr,{text:customerUrl,width:192,height:192,correctLevel:QRCode.CorrectLevel.M})}
 else{qr.textContent='QR library unavailable. Use the customer link below.';}
}
if(!valid(customer)){updateStatus('Customer backend URL is not configured. Open Connection settings.','warning')}
else if(!valid(owner)){updateStatus('Owner console is not configured. Enter your authenticated owner Apps Script URL.','warning')}
else if(customer===owner){updateStatus('Owner and customer URLs are the same. If owner Google sign-in fails, create a separate authenticated owner deployment.','warning')}
else{updateStatus('Configured. Open Owner Orders to sign in with your authorized Google account.','ok')}
})();

/* END qr-print-integration.js */

;
/* BEGIN studio-enhancements.js */
/* Shop Studio enhancement layer — additive, keeps existing modules. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const el=(tag,attrs={},html='')=>{const n=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));n.innerHTML=html;return n};
const css=el('style',{},`.enh-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:9px 0}.enh-row label{font-size:12px}.enh-row input[type=number]{width:75px}.enh-row input[type=range]{max-width:135px}.enh-hint{font-size:12px;color:var(--muted,#777)}.enh-drop{outline:2px dashed #2588d6;outline-offset:3px}.enh-compare{display:grid;grid-template-columns:1fr 1fr;gap:8px}.enh-compare img{max-width:100%;max-height:220px;object-fit:contain}.enh-print{margin:10px 0}`);document.head.append(css);
const makeBtn=(text,fn)=>{const b=el('button',{type:'button',class:'mini-btn'},text);b.addEventListener('click',fn);return b};
const status=(node,msg)=>{node.textContent=msg};
const download=(blob,name)=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)};
const blobCanvas=(c,type='image/jpeg',q=.9)=>new Promise(r=>c.toBlob(r,type,q));
function scanner(){
 if(typeof state==='undefined'||!$('scanCanvas'))return;
 const sidebar=$('scanFilter').closest('.control-group'),row=el('div',{class:'enh-row'});sidebar.append(row);
 const br=el('input',{type:'range',min:50,max:150,value:100,id:'enhScanBrightness'}),ct=el('input',{type:'range',min:50,max:200,value:100,id:'enhScanContrast'});
 row.append(el('label',{},'Brightness '),br,el('label',{},'Contrast '),ct);
 const originalDraw=drawScan;
 drawScan=function(){originalDraw();const c=$('scanCanvas');if(!c.width)return;const b=+br.value/100,k=+ct.value/100;if(b!==1||k!==1){const tmp=document.createElement('canvas');tmp.width=c.width;tmp.height=c.height;tmp.getContext('2d').drawImage(c,0,0);const x=c.getContext('2d');x.clearRect(0,0,c.width,c.height);x.filter=`brightness(${b}) contrast(${k})`;x.drawImage(tmp,0,0);x.filter='none';}};
 br.oninput=ct.oninput=()=>drawScan();
 // Commit edits on page switches, preserving exactly what the user sees.
 let current=state.scanCurrentIndex||0;
 function commit(){const c=$('scanCanvas');if(!c.width||!state.scanPages?.[current])return;const snap=document.createElement('canvas');snap.width=c.width;snap.height=c.height;snap.getContext('2d').drawImage(c,0,0);state.scanPages[current].edited=snap.toDataURL('image/png');}
 function resetAdjustments(){br.value=100;ct.value=100;['scanRotate','scanFilter','shadowStrength','ocrSharpen'].forEach(id=>{const x=$(id);if(x)x.value=id==='scanFilter'?'original':'0'});}
 $('scanPages').addEventListener('click',e=>{const t=e.target.closest('[data-i]');if(!t)return;const target=+t.dataset.i;if(target!==current){commit();current=target;resetAdjustments();const p=state.scanPages[current];if(p?.edited){const im=new Image();im.onload=()=>{if(state.scanCurrentIndex===current){state.scanImg=im;originalDraw();}};im.src=p.edited;}}},true);
 const actions=$('exportScanPdf').parentElement,tool=el('div',{class:'enh-row'});actions.after(tool);
 const note=el('span',{class:'enh-hint'},'Drag page thumbnails to reorder. Edits are saved in the exported PDF.');tool.append(note);
 $('scanPages').addEventListener('dragstart',e=>{const t=e.target.closest('[data-i]');if(t){commit();e.dataTransfer.setData('text/plain',t.dataset.i);e.dataTransfer.effectAllowed='move'}});
 $('scanPages').addEventListener('dragover',e=>e.preventDefault());
 $('scanPages').addEventListener('drop',e=>{e.preventDefault();const t=e.target.closest('[data-i]');if(!t)return;const from=Number(e.dataTransfer.getData('text/plain')),to=+t.dataset.i;if(!Number.isInteger(from)||from<0||from>=state.scanPages.length)return;const [page]=state.scanPages.splice(from,1);state.scanPages.splice(to,0,page);current=state.scanCurrentIndex=to;state.scanImg=page.img;renderScanThumbs();drawScan();});
 new MutationObserver(()=>{for(const t of $('scanPages').querySelectorAll('[data-i]'))t.draggable=true}).observe($('scanPages'),{childList:true});
 $('exportScanPdf').onclick=async()=>{if(!state.scanPages?.length)return alert('Add scanned pages first');commit();try{const pdf=await PDFLib.PDFDocument.create();for(let i=0;i<state.scanPages.length;i++){const p=state.scanPages[i],img=new Image();img.src=p.edited||p.img.src;await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0);const bytes=await (await blobCanvas(c)).arrayBuffer();const jpg=await pdf.embedJpg(bytes),page=pdf.addPage([jpg.width,jpg.height]);page.drawImage(jpg,{x:0,y:0,width:jpg.width,height:jpg.height});}download(new Blob([await pdf.save()],{type:'application/pdf'}),'scanned-edited-pages.pdf')}catch(e){alert('PDF export failed: '+e.message)}};
 tool.append(makeBtn('Save current edits',()=>{commit();status(note,'Current page edits saved for PDF export.')}));
 tool.append(makeBtn('Remove selected page',()=>{if(!state.scanPages.length)return;state.scanPages.splice(state.scanCurrentIndex,1);current=state.scanCurrentIndex=Math.max(0,Math.min(state.scanCurrentIndex,state.scanPages.length-1));state.scanImg=state.scanPages[current]?.img||null;renderScanThumbs();if(state.scanImg)drawScan();}));
 // Browser printing uses the native Chrome dialog; Chrome cannot be embedded in a page.
 tool.append(makeBtn('Print edited pages',async()=>{commit();const images=state.scanPages.map(p=>p.edited||p.img.src);const w=window.open('','_blank');if(!w)return alert('Allow popups for printing');w.document.write('<!doctype html><title>Print scanned pages</title><style>@page{margin:8mm}body{margin:0}.page{break-after:page;display:flex;align-items:center;justify-content:center;height:95vh}.page img{max-width:100%;max-height:100%;object-fit:contain}</style>'+images.map(src=>`<div class="page"><img src="${src}"></div>`).join(''));w.document.close();setTimeout(()=>w.print(),700)}));
 // Native auto-edge detection is already implemented by deskewBtn; expose it.
 if($('deskewBtn')){$('deskewBtn').hidden=false;$('deskewBtn').textContent='Auto-detect page edges';}
}
function globalPrint(){for(const section of document.querySelectorAll('main section.section')){if(section.id==='home'||section.id==='photo'||section.id==='scanner'||section.id==='cards'||section.id==='resize')continue;const b=makeBtn('🖨 Print / Chrome dialog',()=>window.print());b.classList.add('enh-print');section.prepend(b)}const style=el('style',{},'@media print{aside,.topbar,.enh-print,.nav,.tool-sidebar,.workspace-actions{display:none!important}main{margin:0!important;width:100%!important}.section{display:none!important}.section.active{display:block!important}canvas,img{max-width:100%!important;break-inside:avoid}}');document.head.append(style)}
function passport(){const section=$('photo');if(!section)return;const r=el('div',{class:'enh-row'},'<strong>Additional output controls</strong>');section.append(r);const col=el('input',{type:'color',value:'#ffffff',title:'Background color'}),dpi=el('input',{type:'number',min:72,max:1200,value:300,title:'Print DPI'}),kb=el('input',{type:'number',min:10,max:1000,value:200,title:'JPEG max KB'});r.append(el('label',{},'Background color '),col,el('label',{},'Print DPI '),dpi,el('label',{},'JPEG target KB '),kb);const preview=section.querySelector('canvas');r.append(makeBtn('JPEG under KB',async()=>{if(!preview?.width)return alert('Prepare the photo first');const target=+kb.value*1024;let lo=.05,hi=.98,best=null;for(let i=0;i<12;i++){const mid=(lo+hi)/2,b=await blobCanvas(preview,'image/jpeg',mid);if(b.size<=target){best=b;lo=mid}else hi=mid}if(!best)return alert('Cannot meet target KB at current dimensions; reduce photo dimensions');download(best,'passport-photo.jpg')}));r.append(el('span',{class:'enh-hint'},'Color and DPI settings are reference controls; existing background replacement and layout exports are unchanged.'));}
function pdfTools(){const section=$('pdf');if(!section)return;const r=el('div',{class:'enh-row'},'<strong>PDF page organizer</strong>');section.append(r);const input=el('input',{type:'file',accept:'application/pdf'}),list=el('div',{class:'enh-row'}),msg=el('span',{class:'enh-hint'},'Select PDF to load page thumbnails. Drag to reorder.');section.append(list,msg);r.append(input);let src=null,order=[];input.onchange=async()=>{try{src=await PDFLib.PDFDocument.load(await input.files[0].arrayBuffer());order=src.getPageIndices();render()}catch(e){status(msg,'Unable to open PDF: '+e.message)}};function render(){list.innerHTML='';order.forEach((n,i)=>{const b=makeBtn(`Page ${n+1} ✕`,()=>{order.splice(i,1);render()});b.draggable=true;b.dataset.i=i;b.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',i));b.addEventListener('dragover',e=>e.preventDefault());b.addEventListener('drop',e=>{e.preventDefault();const from=+e.dataTransfer.getData('text/plain');const [v]=order.splice(from,1);order.splice(i,0,v);render()});list.append(b)});status(msg,`${order.length} pages • drag to reorder • click a page to remove it`)}r.append(makeBtn('Duplicate last page',()=>{if(order.length){order.push(order.at(-1));render()}}));r.append(makeBtn('Export organized PDF',async()=>{if(!src||!order.length)return alert('Load a PDF and keep at least one page');const out=await PDFLib.PDFDocument.create();const pages=await out.copyPages(src,order);pages.forEach(p=>out.addPage(p));download(new Blob([await out.save()],{type:'application/pdf'}),'organized.pdf')}));}
function ocr(){const sec=$('ocr');if(!sec)return;const r=el('div',{class:'enh-row'},'<strong>OCR language</strong>');sec.append(r);const sel=el('select',{id:'enhOcrLanguage'},'<option value="eng">English</option><option value="hin">Hindi</option><option value="tel">Telugu</option><option value="eng+hin+tel">All three</option>');r.append(sel);const text=sec.querySelector('textarea');r.append(makeBtn('Export TXT',()=>{const t=text?.value||'';if(!t)return alert('Run OCR first');download(new Blob([t],{type:'text/plain;charset=utf-8'}),'ocr-text.txt')}));r.append(el('span',{class:'enh-hint'},'Language selector is not connected to the existing OCR engine yet.'));}
function qr(){const sec=$('qrorders');if(!sec)return;sec.append(el('p',{class:'enh-hint'},'Customer upload progress, file preview, page ranges, and tracking require coordinated updates to the customer portal and Apps Script backend. These are not enabled by this UI patch.'))}
window.addEventListener('DOMContentLoaded',()=>{/* Modern document-pages-v2.js handles scanner page actions. */try{globalPrint();pdfTools();ocr();qr()}catch(e){console.error('Enhancement',e)}});
})();

/* END studio-enhancements.js */

;
/* BEGIN print-settings.js */
/* Shop Studio shared print preferences — local to this browser */
(()=>{'use strict';
const KEY='shopstudio.print.preferences.v2';
const LEGACY='shopstudio.print.preferences.v1';
const defaults={printer:'canon',paper:'A4',orientation:'portrait',copies:1,color:'color',duplex:'single',scale:'fit',margins:'default',pagesPerSheet:'1'};
const printerDefaults={canon:{...defaults},brother:{...defaults,printer:'brother',color:'bw'},system:{...defaults,printer:'system'},pdf:{...defaults,printer:'pdf'}};
let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{}
if(!saved.profiles){let legacy={};try{legacy=JSON.parse(localStorage.getItem(LEGACY)||'{}')||{}}catch{};saved={active:legacy.printer||'canon',profiles:{[legacy.printer||'canon']:{...legacy}}}}
let active=saved.active in printerDefaults?saved.active:'canon';let profiles={...printerDefaults,...saved.profiles};let settings={...printerDefaults[active],...profiles[active],printer:active};
function persist(){try{localStorage.setItem(KEY,JSON.stringify({active,profiles}));msg.textContent='Saved settings for '+active+'.'}catch{msg.textContent='Storage unavailable; settings retained only for this session.'}}
const opts={printer:[['canon','Canon G3012'],['brother','Brother DCP-L2541DW'],['system','System default'],['pdf','Save as PDF']],paper:[['A4','A4'],['A5','A5'],['letter','Letter'],['legal','Legal'],['4x6','4 × 6 inches']],orientation:[['portrait','Portrait'],['landscape','Landscape']],color:[['color','Color'],['bw','Black & white']],duplex:[['single','One-sided'],['long','Two-sided long edge'],['short','Two-sided short edge']],scale:[['fit','Fit to page'],['actual','Actual size'],['fill','Fill page']],margins:[['default','Default'],['none','None'],['narrow','Narrow']],pagesPerSheet:[['1','1 page'],['2','2 pages'],['4','4 pages'],['6','6 pages'],['9','9 pages'],['16','16 pages']]};
const css=document.createElement('style');css.textContent=`#ss-print-panel{position:fixed;inset:0;z-index:999999;background:#0009;display:none;align-items:center;justify-content:center;padding:16px}#ss-print-panel.open{display:flex}#ss-print-panel .ss-inner{width:min(660px,96vw);max-height:92vh;overflow:auto;background:#172338;color:#f7faff;padding:22px;border:1px solid #6b7c97;border-radius:15px;box-shadow:0 15px 60px #0008}#ss-print-panel label{display:grid;gap:5px;font-size:13px}#ss-print-panel select,#ss-print-panel input{width:100%;padding:9px;border:1px solid #62718b;border-radius:8px;background:#0b1526;color:white}#ss-print-panel .ss-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}#ss-print-panel .ss-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:18px}#ss-print-panel button{padding:10px 14px;border:1px solid #667997;border-radius:8px;background:#263e63;color:white;cursor:pointer}#ss-print-panel button.primary{background:#1e69c6}#ss-print-panel p{font-size:12px;line-height:1.5;color:#c7d2e6}@media(max-width:480px){#ss-print-panel .ss-grid{grid-template-columns:1fr}}@media print{#ss-print-panel,#ss-print-open{display:none!important}}`;document.head.appendChild(css);
const modal=document.createElement('div');modal.id='ss-print-panel';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Shop Studio print settings');
modal.innerHTML=`<div class="ss-inner"><h2 style="margin:0 0 14px">Print Settings</h2><div class="ss-grid">${Object.keys(opts).map(k=>`<label>${({printer:'Printer',paper:'Paper size',orientation:'Orientation',color:'Color',duplex:'Print sides',scale:'Scaling',margins:'Margins',pagesPerSheet:'Pages per sheet'})[k]}<select data-key="${k}">${opts[k].map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select></label>`).join('')}<label>Copies<input data-key="copies" type="number" min="1" max="99" step="1"></label></div><p>Saved preferences are used for Shop Studio previews and can be exported for the Windows agent. Chrome does not let websites preselect its printer, copies, color, duplex or pages per sheet. Confirm these in Chrome's native print dialog. Direct agent jobs use their approved order settings.</p><div class="ss-actions"><button data-act="save" class="primary">Save defaults</button><button data-act="print" class="primary">Save & open Chrome Print</button><button data-act="export">Download agent defaults</button><button data-act="reset">Reset</button><button data-act="close">Close</button></div><p id="ss-print-message" role="status"></p></div>`;
document.body.appendChild(modal);
const fields=[...modal.querySelectorAll('[data-key]')];const msg=modal.querySelector('#ss-print-message');
function render(){fields.forEach(el=>el.value=settings[el.dataset.key]);}
function collect(){const next={};fields.forEach(el=>next[el.dataset.key]=el.dataset.key==='copies'?Math.min(99,Math.max(1,parseInt(el.value,10)||1)):el.value);return next;}
function save(){let next=collect();const selected=next.printer;if(selected!==active){profiles[active]={...settings,printer:active};active=selected;}settings={...printerDefaults[active],...profiles[active],...next,printer:active};profiles[active]={...settings};persist();return settings;}
function printCss(){let old=document.getElementById('ss-print-page-css');if(old)old.remove();const style=document.createElement('style');style.id='ss-print-page-css';const size=({'4x6':'4in 6in',A4:'A4',A5:'A5',letter:'letter',legal:'legal'})[settings.paper]||'A4';const margin=({none:'0',narrow:'5mm',default:'12mm'})[settings.margins];style.textContent=`@media print{@page{size:${size} ${settings.orientation};margin:${margin}}}`;document.head.appendChild(style);}
function exportAgent(){const content=JSON.stringify({print_defaults:settings,print_profiles:profiles,notes:'Merge print_defaults into windows10-print-agent/config.json. Existing approved order settings override these defaults. Pages-per-sheet requires a supported print engine and is not guaranteed by Chrome.'},null,2);const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='shopstudio-print-defaults.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
modal.querySelector('[data-key="printer"]').addEventListener('change',e=>{const previous=active;const snapshot=collect();snapshot.printer=previous;profiles[previous]={...snapshot};active=e.target.value;settings={...printerDefaults[active],...profiles[active],printer:active};render();persist();});
modal.addEventListener('click',e=>{if(e.target===modal){modal.classList.remove('open');return;}const b=e.target.closest('[data-act]');if(!b)return;const act=b.dataset.act;if(act==='close'){modal.classList.remove('open');return;}if(act==='reset'){settings={...printerDefaults[active]};profiles[active]={...settings};render();persist();return;}if(act==='export'){save();exportAgent();msg.textContent='Downloaded agent defaults; see PRINT-SETTINGS-SETUP.md.';return;}save();if(act==='print'){printCss();modal.classList.remove('open');window.print();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')modal.classList.remove('open')});
const btn=document.createElement('button');btn.id='ss-print-open';btn.type='button';btn.className='ghost-btn';btn.textContent='⚙ Print Settings';btn.addEventListener('click',()=>{render();msg.textContent='';modal.classList.add('open')});(document.querySelector('.top-actions')||document.body).prepend(btn);
window.ShopStudioPrint={open:()=>btn.click(),get:()=>({...settings}),getProfiles:()=>JSON.parse(JSON.stringify(profiles)),nativePrint:()=>{printCss();window.print()}};
render();
})();

/* END print-settings.js */

;
/* BEGIN phase3-features.js */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const style=document.createElement('style');style.textContent=`.p3-panel{padding:16px;margin:16px 0;border:1px solid #8995a566;border-radius:12px}.p3-grid{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0;max-height:480px;overflow:auto}.p3-item{width:126px;min-height:150px;padding:7px;border:1px solid #8888;border-radius:8px;cursor:grab;background:var(--surface,#fff);color:#222}.p3-item img{width:110px;height:115px;object-fit:contain;background:#eee}.p3-item small{display:block;overflow-wrap:anywhere}.p3-item button{cursor:pointer}.p3-item.p3-selected{outline:3px solid #327bff}.p3-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.p3-controls button{padding:7px 12px}`;document.head.append(style);
const isTyping=el=>el?.matches('input,textarea,select,[contenteditable="true"]');
// Keep keyboard deletion scoped to focused print layout, not text inputs or other app shortcuts.
function installPrintKeys(){const section=$('print'),wrap=$('printCanvasWrap');if(!section||!wrap)return;wrap.tabIndex=0;wrap.title='Click a selected image and press Delete to remove it';const note=document.createElement('p');note.className='crop-help';note.textContent='Two-layer layout available. Click the layout canvas and press Delete to remove a selected image where supported.';section.querySelector('.compact-controls')?.after(note);}
// A standalone PDF organizer handles one PDF (all pages) or multiple PDFs (first-page file cards).
function installPdfOrganizer(){const section=$('pdf');if(!section||!window.PDFLib)return;const panel=document.createElement('div');panel.className='p3-panel';panel.innerHTML=`<h3>PDF Organizer — drag, reorder, remove</h3><p>One PDF: see every page. Multiple PDFs: see each file's first page and name. Export in the displayed order.</p><div class="p3-controls"><label class="upload-btn">Choose PDF files<input id="p3Files" type="file" accept="application/pdf,.pdf" multiple hidden></label><button id="p3ViewPages" type="button">Show all pages</button><button id="p3Delete" type="button">Delete selected</button><button id="p3Export" type="button">Export organized PDF</button></div><div id="p3Status" role="status">Choose PDFs to begin.</div><div class="p3-grid" id="p3Grid" tabindex="0" aria-label="PDF page and file organizer"></div>`;section.querySelector('.panel')?.append(panel);
let files=[],pageItems=[],mode='pages',selected=-1;const grid=$('p3Grid'),status=t=>$('p3Status').textContent=t;
const thumb=async bytes=>{const c=document.createElement('canvas');try{if(typeof pdfjsLib==='undefined')throw new Error('PDF.js preview library unavailable');const pdf=await pdfjsLib.getDocument({data:new Uint8Array(bytes.slice(0))}).promise;const p=await pdf.getPage(1),v=p.getViewport({scale:Math.min(1,150/p.getViewport({scale:1}).width)});c.width=Math.ceil(v.width);c.height=Math.ceil(v.height);await p.render({canvasContext:c.getContext('2d'),viewport:v}).promise;return c.toDataURL('image/png')}catch(e){console.warn('PDF thumbnail error',e);return null}};
async function render(){grid.replaceChildren();const items=mode==='files'?files:pageItems;for(let i=0;i<items.length;i++){const item=items[i],d=document.createElement('div');d.className='p3-item'+(selected===i?' p3-selected':'');d.draggable=true;d.tabIndex=0;d.setAttribute('aria-label',item.name);const img=document.createElement('img');img.alt='PDF thumbnail';if(item.thumb)img.src=item.thumb;else{img.alt='Preview unavailable';img.style.display='none';const fallback=document.createElement('div');fallback.textContent='PDF preview unavailable';fallback.style.cssText='height:110px;display:grid;place-items:center;background:#293548;color:#fff;font-size:12px;text-align:center';d.append(fallback)}d.append(img);const name=document.createElement('small');name.textContent=item.name;d.append(name);const b=document.createElement('button');b.textContent='Remove';b.type='button';b.onclick=e=>{e.stopPropagation();items.splice(i,1);selected=-1;render()};d.append(b);d.onclick=()=>{selected=i;render()};d.ondragstart=e=>{e.dataTransfer.setData('text/plain',String(i));e.dataTransfer.effectAllowed='move'};d.ondragover=e=>e.preventDefault();d.ondrop=e=>{e.preventDefault();const from=Number(e.dataTransfer.getData('text/plain'));if(!Number.isInteger(from)||from<0||from>=items.length)return;const [v]=items.splice(from,1);items.splice(i,0,v);selected=i;render()};grid.append(d)}status(`${items.length} ${mode==='files'?'files':'pages'} • drag to reorder • click to select • Delete removes selection`)}
$('p3Files').onchange=async e=>{const input=[...e.target.files];if(!input.length)return;status('Loading and rendering PDF previews…');files=[];pageItems=[];selected=-1;try{for(const file of input){const bytes=await file.arrayBuffer(),doc=await PDFLib.PDFDocument.load(bytes),first=await thumb(bytes);const f={name:file.name,bytes,thumb:first};files.push(f);for(let i=0;i<doc.getPageCount();i++){pageItems.push({name:`${file.name} — page ${i+1}`,bytes,page:i,thumb:i===0?first:null})}}mode=files.length>1?'files':'pages';$('p3ViewPages').textContent=mode==='files'?'Show all pages':'Show files';await render();if(mode==='pages')await renderPageThumbs()}catch(err){console.error(err);status('Could not load PDF: '+err.message)}e.target.value=''};
async function renderPageThumbs(){if(typeof pdfjsLib==='undefined'){status('PDF previews unavailable: PDF.js failed to load. Check network and reload.');return;}const cache=new Map();for(const item of pageItems){try{let pdf=cache.get(item.bytes);if(!pdf){pdf=await pdfjsLib.getDocument({data:new Uint8Array(item.bytes.slice(0))}).promise;cache.set(item.bytes,pdf)}const p=await pdf.getPage(item.page+1),v0=p.getViewport({scale:1}),v=p.getViewport({scale:Math.min(1,120/v0.width)}),c=document.createElement('canvas');c.width=Math.ceil(v.width);c.height=Math.ceil(v.height);await p.render({canvasContext:c.getContext('2d'),viewport:v}).promise;item.thumb=c.toDataURL('image/png')}catch(e){console.warn(e)}}await render()}
$('p3ViewPages').onclick=async()=>{if(!files.length)return;mode=mode==='files'?'pages':'files';selected=-1;$('p3ViewPages').textContent=mode==='files'?'Show all pages':'Show files';if(mode==='pages')await renderPageThumbs();else await render()};
function remove(){const items=mode==='files'?files:pageItems;if(selected<0||selected>=items.length)return;items.splice(selected,1);selected=-1;render()};$('p3Delete').onclick=remove;grid.addEventListener('keydown',e=>{if((e.key==='Delete'||e.key==='Backspace')&&!isTyping(e.target)){e.preventDefault();remove()}});
$('p3Export').onclick=async()=>{const items=mode==='files'?files:pageItems;if(!items.length)return status('Nothing to export.');status('Creating PDF…');try{const dest=await PDFLib.PDFDocument.create(),cache=new Map();for(const item of items){let doc=cache.get(item.bytes);if(!doc){doc=await PDFLib.PDFDocument.load(item.bytes);cache.set(item.bytes,doc)}const idx=mode==='files'?doc.getPageIndices():[item.page];const copied=await dest.copyPages(doc,idx);copied.forEach(p=>dest.addPage(p))}const blob=new Blob([await dest.save()],{type:'application/pdf'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='organized-pages.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);status('Organized PDF exported.')}catch(err){console.error(err);status('Export failed: '+err.message)}};
}
function installCardCleanup(){const sec=$('cards');if(!sec)return;const btn=document.createElement('button');btn.type='button';btn.className='ghost-btn';btn.textContent='Clean Document (white background)';btn.title='Apply contrast and lighten paper background to the currently displayed card source canvas';const host=sec.querySelector('.control-group');host?.append(btn);btn.onclick=()=>{const c=$('cardSourceCanvas');if(!c?.width)return alert('Open a card document first.');const ctx=c.getContext('2d'),im=ctx.getImageData(0,0,c.width,c.height),d=im.data;for(let i=0;i<d.length;i+=4){const gray=.299*d[i]+.587*d[i+1]+.114*d[i+2];if(gray>200){const a=Math.min(1,(gray-200)/45);for(let k=0;k<3;k++)d[i+k]=Math.round(d[i+k]*(1-a)+255*a)}else{for(let k=0;k<3;k++)d[i+k]=Math.max(0,Math.min(255,(d[i+k]-110)*1.08+110))}}ctx.putImageData(im,0,0);alert('Preview cleaned. Save/crop the card again to use the result. Original upload remains unchanged.')}}
function init(){installPrintKeys();installPdfOrganizer();installCardCleanup();const select=$('cardLayout');select?.addEventListener('change',()=>{if(select.value==='aadhaar-pair'){$('cardPaper').value='a4';$('cardPrintGap').value='4';$('cardPrintMargin').value='8';}})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
/* END phase3-features.js */

;
/* BEGIN phase4-workspace.js */
(()=>{'use strict';
const $=id=>document.getElementById(id);const typing=e=>e.target?.closest('input,textarea,select,[contenteditable],button');
const css=document.createElement('style');css.textContent='.p4-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0}.p4-toolbar button{padding:7px 10px}.p4-list{display:flex;flex-wrap:wrap;gap:9px;margin:10px 0}.p4-tile{position:relative;width:112px;padding:7px;background:#fff;color:#222;border:2px solid #aaa;border-radius:8px;cursor:grab}.p4-tile.selected{border-color:#2686f6}.p4-tile img{width:96px;height:85px;object-fit:contain}.p4-tile button{display:block;width:100%;margin-top:5px}.p4-help{font-size:12px;opacity:.8}';document.head.append(css);
function printWorkspace(){const sec=$('print'),input=$('printInput'),build=$('buildPrintSheet');if(!sec||!input||!build)return;const panel=document.createElement('div');panel.className='p3-panel';panel.innerHTML='<h3>Collage image organizer</h3><p class="p4-help">Select an image, press Delete or Backspace, or drag images to reorder. Build regenerates the output from the current list. The original uploads are not modified.</p><div class="p4-toolbar"><button type="button" id="p4Rebuild">Build with current images</button><span id="p4PrintStatus" role="status"></span></div><div class="p4-list" id="p4PrintList" tabindex="0"></div>';sec.querySelector('.panel')?.append(panel);
let entries=[],selected=-1;const list=$('p4PrintList'),status=$('p4PrintStatus');
function sync(){const dt=new DataTransfer();entries.forEach(e=>dt.items.add(e.file));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));status.textContent=`${entries.length} images selected`}
function render(){list.replaceChildren();entries.forEach((entry,i)=>{const tile=document.createElement('div');tile.className='p4-tile'+(i===selected?' selected':'');tile.tabIndex=0;tile.draggable=true;const img=document.createElement('img');img.src=entry.url;img.alt=entry.file.name;tile.append(img);const label=document.createElement('small');label.textContent=entry.file.name;tile.append(label);const del=document.createElement('button');del.type='button';del.textContent='Remove';del.onclick=e=>{e.stopPropagation();remove(i)};tile.append(del);tile.onclick=()=>{selected=i;render();tile.focus()};tile.ondragstart=e=>e.dataTransfer.setData('text/plain',String(i));tile.ondragover=e=>e.preventDefault();tile.ondrop=e=>{e.preventDefault();const from=Number(e.dataTransfer.getData('text/plain'));if(!Number.isInteger(from)||from<0||from>=entries.length)return;const [v]=entries.splice(from,1);entries.splice(i,0,v);selected=i;sync();render()};list.append(tile)})}
function remove(i){if(i<0||i>=entries.length)return;URL.revokeObjectURL(entries[i].url);entries.splice(i,1);selected=-1;sync();render();if(!entries.length){const c=$('printCanvas');if(c){c.width=1;c.height=1}$('printEmpty').style.display=''}}
input.addEventListener('change',e=>{if(e.isTrusted){entries.forEach(v=>URL.revokeObjectURL(v.url));entries=[...input.files].map(file=>({file,url:URL.createObjectURL(file)}));selected=-1;render();status.textContent=`${entries.length} images selected`}});
list.addEventListener('keydown',e=>{if((e.key==='Delete'||e.key==='Backspace')&&!typing(e)){e.preventDefault();remove(selected)}});$('p4Rebuild').onclick=()=>{if(entries.length)build.click();else status.textContent='Upload images first.'};
}
function cardCleanup(){const sec=$('cards'),source=$('cardSourceCanvas');if(!sec||!source)return;const panel=document.createElement('div');panel.className='p3-panel';panel.innerHTML='<h3>Document Cleanup – Non-destructive</h3><p class="p4-help">Clean the active source before cropping or saving. Use Restore if the cleanup affects document details.</p><div class="p4-toolbar"><label>Strength <input id="p4CleanStrength" type="range" min="1" max="100" value="35"></label><button type="button" id="p4Clean">Apply cleanup</button><button type="button" id="p4Restore">Restore before cleanup</button></div><p id="p4CleanStatus" role="status"></p>';sec.querySelector('.panel')?.append(panel);let snapshot=null;const status=$('p4CleanStatus');$('p4Clean').onclick=()=>{if(source.width<=1||source.height<=1)return status.textContent='Open a card image or PDF page first.';const ctx=source.getContext('2d',{willReadFrequently:true});try{const current=ctx.getImageData(0,0,source.width,source.height);if(!snapshot)snapshot=new ImageData(new Uint8ClampedArray(current.data),current.width,current.height);const pixels=current.data,strength=Number($('p4CleanStrength').value)/100;for(let i=0;i<pixels.length;i+=4){const lum=.299*pixels[i]+.587*pixels[i+1]+.114*pixels[i+2];if(lum>180){const factor=Math.min(1,(lum-180)/75)*strength;for(let j=0;j<3;j++)pixels[i+j]=Math.round(pixels[i+j]+(255-pixels[i+j])*factor)}}ctx.putImageData(current,0,0);status.textContent='Cleanup applied to source canvas. Crop or save the card to retain it.'}catch(e){status.textContent='Cleanup unavailable: '+e.message}};$('p4Restore').onclick=()=>{if(!snapshot)return status.textContent='Nothing to restore.';source.width=snapshot.width;source.height=snapshot.height;source.getContext('2d').putImageData(snapshot,0,0);snapshot=null;status.textContent='Restored source pixels from before cleanup.'};
// Discard stale undo data whenever a different source is opened.
sec.querySelectorAll('input[type=file]').forEach(input=>input.addEventListener('change',()=>{snapshot=null}));
}
function init(){printWorkspace()}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* END phase4-workspace.js */

;
/* BEGIN phase5-layer-editor.js */
(()=>{'use strict';
const ready=()=>{const section=document.getElementById('print');if(!section)return;const host=section.querySelector('.panel');if(!host)return;
const style=document.createElement('style');style.textContent='.p5-editor{margin-top:18px;padding:16px;border:1px solid #8793a6;border-radius:12px}.p5-tools{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin:10px 0}.p5-tools label{display:flex;gap:5px;align-items:center}.p5-stage{display:block;max-width:100%;height:auto;border:1px solid #999;touch-action:none;background:white;cursor:default}.p5-selected{font-size:13px}.p5-editor button{padding:7px 11px}.p5-editor button:disabled{opacity:.5}';document.head.append(style);
const box=document.createElement('div');box.className='p5-editor';box.innerHTML=`<h3>Two-layer Collage Editor (Independent)</h3><p>Position two overlapping images independently. Select a layer, drag to move, use the size control, or press Delete to remove the selected layer. This editor does not replace the existing Print Studio layouts.</p><div class="p5-tools"><label>Layer 1 <input id="p5File1" type="file" accept="image/*"></label><label>Layer 2 <input id="p5File2" type="file" accept="image/*"></label></div><div class="p5-tools"><label>Selected layer <select id="p5Select"><option value="0">Layer 1</option><option value="1">Layer 2</option></select></label><label>Size <input id="p5Size" type="range" min="10" max="200" value="100"></label><button id="p5Front" type="button">Bring forward</button><button id="p5Back" type="button">Send backward</button><button id="p5Delete" type="button">Remove layer</button><button id="p5Reset" type="button">Reset positions</button></div><canvas class="p5-stage" id="p5Stage" width="900" height="630" tabindex="0" aria-label="Two layer collage canvas"></canvas><p id="p5Status" class="p5-selected" role="status">Upload up to two images to begin.</p><div class="p5-tools"><button id="p5Png" type="button">Download PNG</button><button id="p5Pdf" type="button">Download PDF</button><button id="p5Print" type="button">Chrome Print</button></div>`;host.append(box);
const q=id=>box.querySelector('#'+id),canvas=q('p5Stage'),ctx=canvas.getContext('2d'),layers=[null,null];let selected=0,order=[0,1],drag=null;
const render=(handles=true)=>{ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);for(const i of order){const l=layers[i];if(!l)continue;ctx.drawImage(l.img,l.x,l.y,l.w,l.h);if(handles&&i===selected){ctx.strokeStyle='#1769ff';ctx.lineWidth=3;ctx.strokeRect(l.x,l.y,l.w,l.h)}}const l=layers[selected];q('p5Size').value=l?Math.round(l.scale*100):100;q('p5Status').textContent=l?`Selected layer ${selected+1} · ${Math.round(l.w)} × ${Math.round(l.h)} px`:'Selected layer is empty.'};
const bounds=l=>{l.x=Math.max(-l.w+15,Math.min(canvas.width-15,l.x));l.y=Math.max(-l.h+15,Math.min(canvas.height-15,l.y))};
for(let i=0;i<2;i++)q('p5File'+(i+1)).addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const url=URL.createObjectURL(file);const img=new Image();try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url})}finally{URL.revokeObjectURL(url)}const base=Math.min(390/img.naturalWidth,420/img.naturalHeight,1);layers[i]={img,baseW:img.naturalWidth*base,baseH:img.naturalHeight*base,scale:1,x:70+i*180,y:65+i*95};layers[i].w=layers[i].baseW;layers[i].h=layers[i].baseH;selected=i;q('p5Select').value=String(i);render()}catch(err){q('p5Status').textContent='Could not load image: '+err.message}});
q('p5Select').onchange=e=>{selected=Number(e.target.value);render()};q('p5Size').oninput=e=>{const l=layers[selected];if(!l)return;l.scale=Number(e.target.value)/100;l.w=l.baseW*l.scale;l.h=l.baseH*l.scale;bounds(l);render()};q('p5Front').onclick=()=>{order=order.filter(v=>v!==selected).concat(selected);render()};q('p5Back').onclick=()=>{order=[selected,...order.filter(v=>v!==selected)];render()};const remove=()=>{layers[selected]=null;q('p5File'+(selected+1)).value='';render()};q('p5Delete').onclick=remove;q('p5Reset').onclick=()=>{layers.forEach((l,i)=>{if(!l)return;l.x=70+i*180;l.y=65+i*95;l.scale=1;l.w=l.baseW;l.h=l.baseH});render()};
const point=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}};
canvas.addEventListener('pointerdown',e=>{const p=point(e);for(const i of [...order].reverse()){const l=layers[i];if(l&&p.x>=l.x&&p.x<=l.x+l.w&&p.y>=l.y&&p.y<=l.y+l.h){selected=i;q('p5Select').value=String(i);drag={id:e.pointerId,dx:p.x-l.x,dy:p.y-l.y};canvas.setPointerCapture(e.pointerId);render();return}}});canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const l=layers[selected],p=point(e);if(!l)return;l.x=p.x-drag.dx;l.y=p.y-drag.dy;bounds(l);render()});const end=e=>{if(drag&&drag.id===e.pointerId)drag=null};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
box.addEventListener('keydown',e=>{if(!['Delete','Backspace'].includes(e.key)||e.target.closest('input,select,textarea,button,[contenteditable]'))return;e.preventDefault();remove()});
const data=()=>{render(false);const uri=canvas.toDataURL('image/png');render();return uri};const download=(blob,name)=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)};
q('p5Png').onclick=()=>canvas.toBlob(b=>b&&download(b,'two-layer-collage.png'),'image/png');q('p5Pdf').onclick=async()=>{if(!window.PDFLib){q('p5Status').textContent='PDF library unavailable. Check your connection.';return}try{const pdf=await PDFLib.PDFDocument.create(),page=pdf.addPage([595.28,416.7]),img=await pdf.embedPng(data());page.drawImage(img,{x:0,y:0,width:595.28,height:416.7});download(new Blob([await pdf.save()],{type:'application/pdf'}),'two-layer-collage.pdf')}catch(e){q('p5Status').textContent='PDF export failed: '+e.message}};
q('p5Print').onclick=()=>{const url=data(),win=window.open('','_blank');if(!win){q('p5Status').textContent='Allow popups to open Chrome print preview.';return}win.document.write('<!doctype html><html><head><title>Two Layer Collage</title><style>@page{size:A4 landscape;margin:10mm}body{margin:0}img{width:100%;height:auto}</style></head><body><img alt="Collage" src="'+url+'"><script>window.onload=()=>window.print()<\/script></body></html>');win.document.close()};render();};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();})();

/* END phase5-layer-editor.js */

;
/* BEGIN card-pair-group.js */
/* Phase 8: opt-in grouped movement/scale for reference-pair Smart Card sheet only. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 let enabled=true, group=null;
 const cardEditor=()=> $('cardSheetEditor');
 const active=()=> $('cardLayout')?.value==='reference-pair' && !!window.shopCardGroupData?.length && window.shopCardGroupData.length===2;
 function paint(){
   const ed=cardEditor(), canvas=$('cardCanvas'), items=window.shopCardGroupData;
   if(!ed||!canvas||!items||!active())return;
   if(group)group.remove();
   ed.querySelectorAll('.layout-item').forEach(el=>{el.style.pointerEvents=enabled?'none':'';el.style.opacity=enabled?'0.72':'';});
   if(!enabled)return;
   const minX=Math.min(...items.map(i=>i.x)),minY=Math.min(...items.map(i=>i.y));
   const maxX=Math.max(...items.map(i=>i.x+i.w)),maxY=Math.max(...items.map(i=>i.y+i.h));
   group=document.createElement('div');group.className='p8-card-group';
   Object.assign(group.style,{position:'absolute',left:minX*100+'%',top:minY*100+'%',width:(maxX-minX)*100+'%',height:(maxY-minY)*100+'%',border:'2px solid #0ea5e9',background:'rgba(14,165,233,.045)',boxSizing:'border-box',cursor:'move',touchAction:'none',zIndex:'20'});
   const label=document.createElement('span');label.textContent='FRONT + BACK • MOVE TOGETHER';Object.assign(label.style,{position:'absolute',top:'-24px',left:'0',font:'bold 11px sans-serif',background:'#075985',color:'white',padding:'3px 6px',whiteSpace:'nowrap'});group.appendChild(label);
   const handle=document.createElement('span');handle.title='Resize both cards proportionally';Object.assign(handle.style,{position:'absolute',right:'-7px',bottom:'-7px',width:'15px',height:'15px',border:'2px solid white',background:'#0284c7',cursor:'nwse-resize',borderRadius:'3px'});group.appendChild(handle);
   const start=e=>{
     if(e.button!==0)return;e.preventDefault();e.stopPropagation();
     const resize=e.target===handle,rect=canvas.getBoundingClientRect(),sx=e.clientX,sy=e.clientY;
     const base=items.map(i=>({x:i.x,y:i.y,w:i.w,h:i.h}));
     const bx=Math.min(...base.map(i=>i.x)),by=Math.min(...base.map(i=>i.y));
     const bw=Math.max(...base.map(i=>i.x+i.w))-bx,bh=Math.max(...base.map(i=>i.y+i.h))-by;
     const move=ev=>{
       const dx=(ev.clientX-sx)/rect.width,dy=(ev.clientY-sy)/rect.height;
       if(resize){const desired=Math.max(.1,1+Math.max(dx/Math.max(bw,.001),dy/Math.max(bh,.001)));
         const scale=Math.min(desired,(1-bx)/bw,(1-by)/bh);
         items.forEach((it,i)=>{it.x=bx+(base[i].x-bx)*scale;it.y=by+(base[i].y-by)*scale;it.w=base[i].w*scale;it.h=base[i].h*scale;});
       }else{const mx=Math.max(-bx,Math.min(1-bx-bw,dx)),my=Math.max(-by,Math.min(1-by-bh,dy));items.forEach((it,i)=>{it.x=base[i].x+mx;it.y=base[i].y+my;});}
       group.style.left=Math.min(...items.map(i=>i.x))*100+'%';group.style.top=Math.min(...items.map(i=>i.y))*100+'%';
       group.style.width=(Math.max(...items.map(i=>i.x+i.w))-Math.min(...items.map(i=>i.x)))*100+'%';
       group.style.height=(Math.max(...items.map(i=>i.y+i.h))-Math.min(...items.map(i=>i.y)))*100+'%';
       const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);
       items.forEach(it=>{const x=it.x*canvas.width,y=it.y*canvas.height,w=it.w*canvas.width,h=it.h*canvas.height,img=it.img;if(!img?.width)return;const s=Math.min(w/img.width,h/img.height),dw=img.width*s,dh=img.height*s;c.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);});
     };
     const up=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);};document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);
   };
   group.addEventListener('pointerdown',start);ed.appendChild(group);
 }
 function refresh(){if(group){group.remove();group=null;}const ed=cardEditor();if(!ed)return;if(active())paint();else ed.querySelectorAll('.layout-item').forEach(el=>{el.style.pointerEvents='';el.style.opacity='';});}
 function setup(){const layout=$('cardLayout');if(!layout)return;
   // Group editing remains enabled internally; the extra option is removed from the UI.

   layout.addEventListener('change',()=>setTimeout(refresh,0));
   $('buildCardSheet')?.addEventListener('click',()=>setTimeout(refresh,0));
   window.addEventListener('resize',()=>setTimeout(refresh,20));
   window.shopCardGroup={refresh};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();

/* END card-pair-group.js */

;
/* BEGIN phase9-fixes.js */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const css=document.createElement('style');css.textContent=`
#scanner .p9-scanner-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-top:12px;align-items:start}
#scanner .p9-scanner-row .control-group{margin:0;min-width:0;max-width:none}
#scanner .p9-scanner-row label{max-width:100%;min-width:0}
#pdf .p9-preview{display:flex;flex-wrap:wrap;gap:8px;padding:8px 0}
#pdf .p9-preview-card{background:#222d3d;color:#fff;border:1px solid #52617a;border-radius:7px;padding:7px;max-width:135px;min-width:90px;font-size:11px;overflow-wrap:anywhere;cursor:grab}
#pdf .p9-preview-card img{display:block;width:100px;height:125px;object-fit:contain;background:white;margin-bottom:4px}
#pdf .p9-preview-card.selected{outline:2px solid #60a5fa}
#pdf .p3-item{background:#1e293b;color:#f8fafc}
#pdf .p3-item button{background:#334155;color:white;border:1px solid #64748b}
#p9LayerOpen{margin-left:8px;background:#e5af47;color:#101820;font-weight:700;padding:10px;border-radius:7px;border:0;cursor:pointer}
#p5Stage:focus,#printEditor:focus,#cardSheetEditor:focus{outline:2px solid #60a5fa}
`;document.head.append(css);
const typing=e=>!!e.target.closest('input,textarea,select,[contenteditable="true"]');
function scanner(){const sec=$('scanner');if(!sec)return;const wrap=$('scanCropStage');if(!wrap)return;const row=document.createElement('div');row.className='p9-scanner-row';row.setAttribute('aria-label','Compact scanner controls');wrap.after(row);const move=()=>{for(const id of ['scannerDefaultsGroup','scannerDevicePrefs','scannerPresetGroup']){const node=$(id);if(node&&node.parentElement!==row)row.append(node)}const scanView=[...sec.querySelectorAll('.control-group')].find(x=>/^View$/i.test(x.querySelector('h4')?.textContent?.trim()||''));if(scanView&&scanView.parentElement!==row)row.prepend(scanView)};move();const observer=new MutationObserver(()=>move());observer.observe(sec,{childList:true,subtree:true});}
function print(){const sec=$('print'),sel=$('printCount');if(!sec||!sel)return;const launch=document.createElement('button');launch.id='p9LayerOpen';launch.type='button';launch.textContent='Open 2-Layer Editor';sel.parentElement.after(launch);launch.onclick=()=>{sel.value='2';const editor=$('p5Stage');if(!editor){alert('Layer editor could not load. Reload the page.');return}editor.closest('.p5-editor')?.scrollIntoView({behavior:'smooth',block:'start'});editor.focus({preventScroll:true})};sel.addEventListener('change',()=>{if(sel.value==='2')launch.textContent='Open 2-Layer Editor';});}
function keyboard(){for(const [sectionId,editorId,canvasId] of [['print','printEditor','printCanvas'],['cards','cardSheetEditor','cardCanvas']]){const sec=$(sectionId),ed=$(editorId);if(!sec||!ed)continue;ed.tabIndex=0;ed.addEventListener('keydown',e=>{if(!['Delete','Backspace'].includes(e.key)||typing(e))return;const selected=ed.querySelector('.layout-item.selected')||ed.querySelector('.layout-item:focus');if(!selected)return;e.preventDefault();e.stopPropagation();const index=Number(selected.dataset.i);if(!Number.isInteger(index))return; // Existing layout data lives in a closure; use safe targeted remove via its image selection when available.
if(!window.shopStudioRemoveLayoutItem?.(sectionId,index))return;const msg=sec.querySelector('.p9-delete-note');if(msg)msg.textContent='Selected item removed from layout and export.';});const note=document.createElement('p');note.className='p9-delete-note';note.textContent='Click an item to select; Delete/Backspace removes it from layout and export.';ed.after(note)}}
async function thumb(file,page=1){if(!window.pdfjsLib)throw Error('PDF.js not loaded');const doc=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;const p=await doc.getPage(page),v=p.getViewport({scale:1}),vp=p.getViewport({scale:Math.min(0.8,120/v.width)});const c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);await p.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;return c.toDataURL('image/png')}
function pdf(){for(const id of ['mergePdfInput','reorderPdfInput','splitPdfInput','rotatePdfInput','pdfToImageInput']){const inp=$(id);if(!inp)continue;const card=inp.closest('.utility-card');if(!card)continue;const previews=document.createElement('div');previews.className='p9-preview';previews.setAttribute('aria-label','PDF previews for '+id);card.querySelector('.upload-btn')?.after(previews);inp.addEventListener('change',async()=>{previews.replaceChildren();const files=[...inp.files];for(const file of files){const box=document.createElement('div');box.className='p9-preview-card';const label=document.createElement('div');label.textContent=file.name;box.append(label);previews.append(box);try{const src=await thumb(file);const img=new Image();img.alt='First page of '+file.name;img.src=src;box.prepend(img)}catch(e){const msg=document.createElement('small');msg.textContent='Preview unavailable (PDF.js or damaged PDF)';box.prepend(msg);console.warn(e)}}if(id==='mergePdfInput'&&files.length>1){const msg=document.createElement('small');msg.textContent='Use PDF Organizer below to drag and export a custom merge order.';previews.append(msg)}})} }
function init(){scanner();print();keyboard();pdf();const panel=document.querySelector('#print .p5-editor');const controls=document.querySelector('#print .compact-controls');if(panel&&controls){controls.after(panel);panel.hidden=true;const btn=$('p9LayerOpen');if(btn){btn.onclick=()=>{panel.hidden=false;$('printCount').value='2';panel.scrollIntoView({behavior:'smooth',block:'start'});$('p5Stage')?.focus({preventScroll:true})}}}document.addEventListener('keydown',e=>{if(!['Delete','Backspace'].includes(e.key)||typing(e))return;const active=document.activeElement;if(active?.id==='p5Stage'){const remove=$('p5Delete');if(remove){e.preventDefault();remove.click()}}});};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
/* END phase9-fixes.js */

;
/* BEGIN document-pages-v2.js */
/* Shop Studio 16 — document page management; depends on app-v11.5.0.js */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const S=typeof state!=='undefined'?state:window.state;
if(!S || !$('scanPages'))return;
const selected=new Set();
let anchor=-1,active=-1,lastKnownLength=0,loading=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const imageFromCanvas=c=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=c.toDataURL('image/png');});
const thumbFor=im=>{const c=document.createElement('canvas'),sc=Math.min(1,125/im.width,165/im.height);c.width=Math.max(1,Math.round(im.width*sc));c.height=Math.max(1,Math.round(im.height*sc));c.getContext('2d').drawImage(im,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.8);};
function status(message){if($('scanStatus'))$('scanStatus').textContent=message;}
function clearEditor(){const c=$('scanCanvas');if(c){c.width=0;c.height=0;}if($('scanEmpty'))$('scanEmpty').style.display='';if($('scanCropLayer'))$('scanCropLayer').style.display='none';S.scanCropMode=false;S.scanCropPts=null;}
function commit(){
 if(active<0||active>=S.scanPages.length)return;
 const c=$('scanCanvas');if(!c?.width||!c.height)return;
 const p=S.scanPages[active];
 // Current canvas contains user edits and is the single source for print/export.
 try {p.edited=c.toDataURL('image/png');}catch(e){console.warn('Could not commit current page',e);}
}
function show(index){
 const p=S.scanPages[index];S.scanCurrentIndex=index;
 S.scanImg=p?.img||null;
 S.scanCropMode=false;S.scanCropPts=null;
 if(!p){clearEditor();return;}
 drawScan();
 if(p.edited){const img=new Image();const expected=index;img.onload=()=>{if(S.scanCurrentIndex!==expected)return;const c=$('scanCanvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0);};img.src=p.edited;}
 $('scanEmpty')?.style.setProperty('display','none');
}
function updateSelectedUI(){
 $('scanPages').querySelectorAll('.document-page-item').forEach(el=>{const i=+el.dataset.i;el.classList.toggle('is-selected',selected.has(i));el.classList.toggle('is-active',i===active);el.setAttribute('aria-selected',String(selected.has(i)));});
 const n=S.scanPages.length;
 if($('scanSelectionInfo'))$('scanSelectionInfo').textContent=`${n} page${n!==1?'s':''} • ${selected.size} selected • Ctrl+click multi-select, Shift+click range`;
 if($('scanRemoveSelected'))$('scanRemoveSelected').disabled=n===0;
 if($('scanPrintEdited'))$('scanPrintEdited').disabled=n===0;
}
function render(){
 const wrap=$('scanPages');wrap.textContent='';
 for(let i=0;i<S.scanPages.length;i++){
  const p=S.scanPages[i],b=document.createElement('button');b.type='button';b.className='document-page-item';b.dataset.i=i;b.setAttribute('role','option');b.setAttribute('aria-label',`Page ${i+1} ${p.name||''}`);
  const img=document.createElement('img');img.alt='';try{img.src=p.edited||p.thumb||thumbFor(p.img);}catch{img.src=p.img?.src||'';}
  const num=document.createElement('span');num.className='document-page-number';num.textContent=`${i+1}`;
  const label=document.createElement('span');label.className='document-page-title';label.textContent=p.name||`Page ${i+1}`;
  b.append(img,num,label);wrap.appendChild(b);
 }
 lastKnownLength=S.scanPages.length;
 updateSelectedUI();
}
function select(i,e){
 if(i<0||i>=S.scanPages.length)return;
 commit();
 if(e?.shiftKey&&anchor>=0){
  if(!e.ctrlKey&&!e.metaKey)selected.clear();
  for(let j=Math.min(anchor,i);j<=Math.max(anchor,i);j++)selected.add(j);
 }else if(e?.ctrlKey||e?.metaKey){if(selected.has(i))selected.delete(i);else selected.add(i);anchor=i;}
 else {selected.clear();selected.add(i);anchor=i;}
 active=i;show(i);updateSelectedUI();
}
// Replace older thumbnail rendering implementation with accessible selection buttons.
window.renderScanThumbs=renderScanThumbs=function(){
 if(S.scanPages.length!==lastKnownLength){selected.clear();active=Math.min(Math.max(0,S.scanCurrentIndex||0),S.scanPages.length-1);if(active>=0)selected.add(active);anchor=active;}
 else if(active<0&&S.scanPages.length){active=Math.max(0,S.scanCurrentIndex||0);selected.add(active);anchor=active;}
 render();
};
// Capture the event so older per-thumbnail callbacks and drag handlers cannot override the multi-selection.
$('scanPages').addEventListener('click',e=>{const el=e.target.closest('.document-page-item');if(!el)return;e.preventDefault();e.stopImmediatePropagation();select(+el.dataset.i,e);},true);
$('scanPages').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){e.preventDefault();e.stopPropagation();selected.clear();S.scanPages.forEach((_,i)=>selected.add(i));updateSelectedUI();}},true);
$('scanSelectAll')?.addEventListener('click',()=>{selected.clear();S.scanPages.forEach((_,i)=>selected.add(i));updateSelectedUI();});
function insertPages(pages){
 commit();
 const pos=active>=0?active+1:S.scanPages.length;
 S.scanPages.splice(pos,0,...pages);
 active=pos;anchor=pos;selected.clear();if(pages.length)selected.add(pos);
 show(active);render();
 status(`${pages.length} page(s) inserted at position ${pos+1}.`);
}
function newBlank(){const c=document.createElement('canvas');c.width=1240;c.height=1754;const ctx=c.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,c.width,c.height);return imageFromCanvas(c).then(img=>({img,name:'Blank A4 page',edited:null}));}
const blank=$('addScanToPdf');if(blank){const fresh=blank.cloneNode(true);blank.replaceWith(fresh);fresh.addEventListener('click',async()=>insertPages([await newBlank()]));}
$('scanRemoveSelected')?.addEventListener('click',()=>{
 const toRemove=selected.size?[...selected].sort((a,b)=>b-a):active>=0?[active]:[];
 if(!toRemove.length)return;
 if(!confirm(`Remove ${toRemove.length} selected page(s)?`))return;
 // Snapshot current edits before mutating, but only remaining pages are retained.
 commit();for(const i of toRemove)S.scanPages.splice(i,1);
 selected.clear();active=S.scanPages.length?Math.min(Math.min(...toRemove),S.scanPages.length-1):-1;anchor=active;
 if(active>=0)selected.add(active);
 show(active);render();status(`${toRemove.length} page(s) removed.`);
});
async function renderPdfPage(page,scale=1.8){const v=page.getViewport({scale});const c=document.createElement('canvas');c.width=Math.ceil(v.width);c.height=Math.ceil(v.height);await page.render({canvasContext:c.getContext('2d',{alpha:false}),viewport:v}).promise;return imageFromCanvas(c);}
function modalForPages(pdf,filename){return new Promise(async(resolve,reject)=>{
 const overlay=document.createElement('div');overlay.className='scan-pdf-modal';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Select PDF pages');
 overlay.innerHTML=`<div class="scan-pdf-dialog"><div class="scan-pdf-header"><div><h3>Add PDF Pages</h3><p>Select pages to insert after the active document page.</p></div><button type="button" class="ghost-btn" data-cancel>Close</button></div><div class="scan-pdf-tools"><button type="button" class="ghost-btn" data-all>Select All</button><button type="button" class="ghost-btn" data-none>Clear</button><span data-count></span></div><div class="scan-pdf-grid" data-list></div><div class="scan-pdf-footer"><button type="button" class="ghost-btn" data-cancel>Cancel</button><button type="button" class="primary-btn" data-add>Add Selected Pages</button></div></div>`;
 document.body.appendChild(overlay);let done=false;
 const picked=new Set(Array.from({length:pdf.numPages},(_,i)=>i));const grid=overlay.querySelector('[data-list]');
 const finish=(result)=>{if(done)return;done=true;overlay.remove();resolve(result);};
 const sync=()=>{overlay.querySelector('[data-count]').textContent=`${picked.size} of ${pdf.numPages} selected`;overlay.querySelector('[data-add]').disabled=!picked.size;grid.querySelectorAll('[data-page]').forEach(b=>{const on=picked.has(+b.dataset.page);b.classList.toggle('is-selected',on);b.setAttribute('aria-pressed',String(on));});};
 overlay.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>finish([]));overlay.querySelector('[data-all]').onclick=()=>{for(let i=0;i<pdf.numPages;i++)picked.add(i);sync();};overlay.querySelector('[data-none]').onclick=()=>{picked.clear();sync();};
 overlay.querySelector('[data-add]').onclick=()=>finish([...picked].sort((a,b)=>a-b));
 overlay.addEventListener('click',e=>{if(e.target===overlay)finish([])});
 // Generate previews progressively without blocking the selection toolbar.
 try{
  for(let i=0;i<pdf.numPages&&!done;i++){
   const b=document.createElement('button');b.type='button';b.className='scan-pdf-page is-selected';b.dataset.page=i;b.setAttribute('aria-pressed','true');
   const im=document.createElement('img');im.alt=`PDF page ${i+1}`;const caption=document.createElement('span');caption.textContent=`Page ${i+1}`;b.append(im,caption);grid.append(b);
   b.onclick=()=>{if(picked.has(i))picked.delete(i);else picked.add(i);sync();};
   const page=await pdf.getPage(i+1),v=page.getViewport({scale:.3}),c=document.createElement('canvas');c.width=Math.ceil(v.width);c.height=Math.ceil(v.height);await page.render({canvasContext:c.getContext('2d'),viewport:v}).promise;if(!done)im.src=c.toDataURL('image/jpeg',.75);
   if(i%4===0)await sleep(0);
  }
 }catch(e){if(!done){overlay.remove();reject(e);}}
 sync();
 });}
$('scanInsertPdf')?.addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file||loading)return;loading=true;
 try{
  if(!window.pdfjsLib)throw Error('PDF renderer is unavailable. Check your connection and reload.');
  const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  const indices=await modalForPages(pdf,file.name);
  if(!indices.length){status('PDF insertion cancelled.');return;}
  const pages=[];
  for(let j=0;j<indices.length;j++){
   status(`Adding PDF page ${j+1} of ${indices.length}…`);
   const im=await renderPdfPage(await pdf.getPage(indices[j]+1));pages.push({img:im,name:`${file.name} • p${indices[j]+1}`});
  }
  insertPages(pages);
 }catch(ex){console.error(ex);status(`Could not add PDF: ${ex.message}`);alert(`Could not add PDF pages: ${ex.message}`);}
 finally{e.target.value='';loading=false;}
});
function effectiveImage(p){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=p.edited||p.img.src;});}
async function exportPdf(){if(!S.scanPages.length)return alert('Add a page first.');commit();if(!window.PDFLib)return alert('PDF export library is unavailable.');const pdf=await PDFLib.PDFDocument.create();
 for(const p of S.scanPages){const img=await effectiveImage(p),c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0);const blob=await new Promise(res=>c.toBlob(res,'image/jpeg',.92));const embed=await pdf.embedJpg(await blob.arrayBuffer());const pg=pdf.addPage([embed.width,embed.height]);pg.drawImage(embed,{x:0,y:0,width:embed.width,height:embed.height});}
 const bytes=await pdf.save();const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download='edited-document.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
const exportButton=$('exportScanPdf');if(exportButton){const b=exportButton.cloneNode(true);exportButton.replaceWith(b);b.addEventListener('click',()=>exportPdf().catch(e=>{console.error(e);alert('PDF export failed: '+e.message)}));}
$('scanPrintEdited')?.addEventListener('click',async()=>{
 if(!S.scanPages.length)return alert('Add a page first.');commit();const targets=selected.size?[...selected].sort((a,b)=>a-b):S.scanPages.map((_,i)=>i);
 // Open before awaiting image processing, to avoid popup blockers.
 const win=window.open('','_blank');if(!win)return alert('Please allow print popups for this website.');
 try{
  const images=await Promise.all(targets.map(async i=>{const img=await effectiveImage(S.scanPages[i]);return img.src;}));
  win.document.open();win.document.write(`<!DOCTYPE html><html><head><title>Edited Document Print</title><style>@page{margin:8mm}body{margin:0;background:#fff}.page{page-break-after:always;break-after:page;height:calc(100vh - 16mm);display:flex;align-items:center;justify-content:center}.page:last-child{page-break-after:auto;break-after:auto}.page img{display:block;max-height:100%;max-width:100%;object-fit:contain}</style></head><body>${images.map(src=>`<section class="page"><img src="${src}" alt="Edited page"></section>`).join('')}<script>window.addEventListener('load',()=>{const all=[...document.images];Promise.all(all.map(x=>x.decode().catch(()=>{}))).then(()=>{window.focus();window.print();})});<\/script></body></html>`);win.document.close();
 }catch(ex){win.close();alert('Unable to print: '+ex.message);}
});
// Keep the current page and selection in sync after uploads, crops, and page imports.
$('scanInput')?.addEventListener('change',()=>setTimeout(()=>{active=0;anchor=0;selected.clear();if(S.scanPages.length)selected.add(0);render();},600));
$('scanPdfInput')?.addEventListener('change',()=>setTimeout(()=>{active=0;anchor=0;selected.clear();if(S.scanPages.length)selected.add(0);render();},1000));
$('applyScanCrop')?.addEventListener('click',()=>setTimeout(()=>{if(active>=0&&S.scanImg){S.scanPages[active].img=S.scanImg;S.scanPages[active].edited=null;render();}},250));
// The existing edge detector is invoked automatically by the original upload handler.
// Keep manual auto-detect button available to correct its boundaries before applying crop.
$('deskewBtn')?.removeAttribute('hidden');
if(S.scanPages.length){active=Math.min(S.scanCurrentIndex||0,S.scanPages.length-1);selected.add(active);anchor=active;}
render();
})();

/* END document-pages-v2.js */

;
/* BEGIN smart-card-clean.js */
/* Smart Card — clear crop without altering source; conceal crop tools after sheet build. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
function init(){
  const section=$('cards'),noCrop=$('cardNoCrop'),build=$('buildCardSheet');
  if(!section||!noCrop||!build)return;
  const group=$('applyCardCrop')?.closest('.control-group');
  if(group)group.classList.add('card-crop-tools');
  function clear(){
    if(typeof window.shopSmartCardClearCrop==='function')window.shopSmartCardClearCrop();
    for(const id of ['cardFreeCropLayer','cardPerspectiveLayer','cardV111CropHost','sc13Rect','sc13Quad']){
      const node=$(id);if(node){node.style.display='none';node.style.pointerEvents='none';}
    }
    try{if(typeof state!=='undefined'){
      state.cardFreeCrop=null;state.cardPerspectiveMode=false;state.cardPerspectivePts=null;
    }}catch(e){console.debug('Card crop reset',e)}
  }
  noCrop.addEventListener('click',()=>{clear();section.classList.remove('card-sheet-ready');});
  // Run before other build listeners: make sheet from saved front/back, not an open crop box.
  build.addEventListener('click',()=>{clear();section.classList.add('card-sheet-ready');},true);
  for(const id of ['cardImageInput','cardPdfInput'])$(id)?.addEventListener('change',()=>{
    section.classList.remove('card-sheet-ready');
  },true);
  for(const id of ['cardSimpleCropBtn','manualCardPerspectiveBtn'])$(id)?.addEventListener('click',()=>{
    section.classList.remove('card-sheet-ready');
  },true);
  // Remove old browser print buttons if a legacy patch injected them.
  section.querySelectorAll('.enh-print').forEach(el=>el.remove());
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* END smart-card-clean.js */

;
/* BEGIN smart-card-loader-fix.js */
/* Shop Studio 16 — unified Smart Card source loading.
   Intercepts Smart Card file-input changes before legacy competing handlers;
   leaves other workspaces and the v19 crop engine untouched. */
(()=>{'use strict';
  const $=id=>document.getElementById(id);
  const stage=$('cardPerspectiveStage'),canvas=$('cardSourceCanvas'),empty=$('cardSourceEmpty'),label=$('cardPageLabel');
  if(!stage||!canvas||!empty||!label)return;
  const ctx=()=>canvas.getContext('2d',{alpha:false});
  let currentPdf=null, currentPage=1, generation=0, selectedName='';
  const status=message=>{const n=$('cardStatus');if(n)n.textContent=message;};
  function showError(message){
    empty.style.display='flex';empty.textContent='Unable to load file: '+message;
    empty.classList.add('card-load-error');label.textContent='Load failed';
    status('Smart Card: '+message);console.error('Smart Card loading:',message);
  }
  function showCanvas(text){
    empty.style.display='none';empty.classList.remove('card-load-error');
    label.textContent=text;status(text);
    requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
  }
  function start(file){
    const ticket=++generation;
    selectedName=file.name;label.textContent='Loading '+file.name+'…';
    empty.textContent='Loading '+file.name+'…';empty.style.display='flex';
    empty.classList.remove('card-load-error');
    $('cards')?.classList.remove('card-sheet-ready');
    if(typeof window.shopSmartCardClearCrop==='function')window.shopSmartCardClearCrop();
    return ticket;
  }
  async function decodeImage(file){
    if(typeof createImageBitmap==='function'){
      try{return await createImageBitmap(file,{imageOrientation:'from-image'});}catch(e){console.warn('ImageBitmap decoder fallback',e);}
    }
    return await new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(file),image=new Image();
      image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};
      image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Image could not be decoded. Try JPG or PNG.'))};
      image.src=url;
    });
  }
  async function loadImage(file){
    const ticket=start(file);currentPdf=null;currentPage=1;
    try{
      const image=await decodeImage(file);
      if(ticket!==generation){image.close?.();return;}
      const w=image.width||image.naturalWidth,h=image.height||image.naturalHeight;
      if(!w||!h)throw Error('Image has invalid dimensions');
      canvas.width=w;canvas.height=h;ctx().drawImage(image,0,0,w,h);
      image.close?.();
      // The shared crop/save code reads these fields; update them once.
      if(typeof state!=='undefined'){
        state.cardPdf=null;state.cardPdfPage=1;
        state.cardSourceType='image';state.cardSourceImg=null;
        state.cardSourceScale=1;
      }
      showCanvas(`${file.name} • ${w}×${h}`);
    }catch(e){if(ticket===generation)showError(e?.message||'Unsupported image');}
  }
  async function loadPdf(file){
    const ticket=start(file);
    try{
      const pdf=window.pdfjsLib;
      if(!pdf?.getDocument)throw Error('PDF library not available. Check your connection and reload.');
      const bytes=new Uint8Array(await file.arrayBuffer());
      const doc=await pdf.getDocument({data:bytes}).promise;
      if(ticket!==generation)return;
      currentPdf=doc;currentPage=1;
      if(typeof state!=='undefined'){
        state.cardPdf=doc;state.cardPdfPage=1;
        state.cardSourceType='pdf';state.cardSourceImg=null;
      }
      await renderPdfPage(ticket);
    }catch(e){if(ticket===generation)showError(e?.message||'PDF could not be opened');}
  }
  async function renderPdfPage(ticket=++generation){
    if(!currentPdf)return;
    const pageNumber=currentPage;
    try{
      const page=await currentPdf.getPage(pageNumber);
      const quality=Number($('cardRenderQuality')?.value)||2.5;
      const viewport=page.getViewport({scale:Math.max(1,Math.min(quality,5))});
      if(ticket!==generation)return;
      canvas.width=Math.max(1,Math.round(viewport.width));
      canvas.height=Math.max(1,Math.round(viewport.height));
      await page.render({canvasContext:ctx(),viewport}).promise;
      if(ticket!==generation)return;
      if(typeof state!=='undefined'){
        state.cardPdf=currentPdf;state.cardPdfPage=currentPage;
        state.cardSourceType='pdf';state.cardSourceScale=quality;
      }
      showCanvas(`Page ${currentPage} of ${currentPdf.numPages} • ${selectedName}`);
    }catch(e){if(ticket===generation)showError(e?.message||'Could not render PDF page');}
  }
  // Capture event BEFORE other handlers, which otherwise compete to load/reset the canvas.
  document.addEventListener('change',e=>{
    if(e.target?.id!=='cardImageInput'&&e.target?.id!=='cardPdfInput')return;
    const file=e.target.files?.[0];
    if(!file)return;
    e.stopImmediatePropagation();e.stopPropagation();
    const isPdf=e.target.id==='cardPdfInput';
    (isPdf?loadPdf(file):loadImage(file)).finally(()=>{try{e.target.value='';}catch{}});
  },true);
  // Handle PDF paging ourselves so legacy rendering does not use a second PDF.js runtime.
  for(const [id,step] of [['prevCardPage',-1],['nextCardPage',1]]){
    const btn=$(id);if(!btn)continue;
    btn.addEventListener('click',event=>{
      if(!currentPdf)return;
      event.preventDefault();event.stopImmediatePropagation();
      const next=currentPage+step;
      if(next<1||next>currentPdf.numPages)return;
      currentPage=next;
      const ticket=++generation;
      renderPdfPage(ticket);
    },true);
  }
  // Do not display an uninitialized browser-default 300x150 white canvas as a loaded card.
  if(label.textContent.trim()==='No file'){
    canvas.width=1;canvas.height=1;
    empty.style.display='flex';
    empty.textContent='Open a PDF or image';
    if(typeof window.shopSmartCardClearCrop==='function')window.shopSmartCardClearCrop();
  }
  // Recover from browsers caching stale loaders by printing a version in the console.
  console.info('Shop Studio Smart Card unified loader v1 active');
})();

/* END smart-card-loader-fix.js */

;
/* BEGIN smart-card-build-fix.js */
/* Smart Card Build Sheet recovery: own one click pipeline, robust against legacy handlers. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const mm=(n,dpi)=>Math.round(n/25.4*dpi);
const report=(message,error=false)=>{const n=$('cardStatus');if(n)n.textContent=message;if(error)console.error('[Smart Card sheet]',message)};
function snapshotSide(side){
  let image=null;
  try { image=(typeof state!=='undefined')?state[side==='front'?'cardFrontCrop':'cardBackCrop']:null; } catch(_) {}
  if(image&&image.width>1&&image.height>1)return image;
  // Visible saved-preview canvas is a recovery source when a legacy handler overwrites the state.
  const preview=$(side==='front'?'cardFrontPreview':'cardBackPreview');
  if(!preview||preview.width<2||preview.height<2)return null;
  try{const a=preview.getContext('2d').getImageData(0,0,preview.width,preview.height).data;
    let hasPixels=false;for(let i=3;i<a.length;i+=Math.max(4,Math.floor(a.length/5000/4)*4)){if(a[i]>0){hasPixels=true;break}}
    if(hasPixels)return preview;
  }catch(e){console.warn('Preview check unavailable',e)}
  return null;
}
function build(){
  const canvas=$('cardCanvas'),empty=$('cardEmpty');if(!canvas)throw new Error('Sheet canvas is missing.');
  const sources=[['front',snapshotSide('front')],['back',snapshotSide('back')]].filter(v=>!!v[1]);
  if(!sources.length){report('Save Front and/or Back first, then click Build Sheet.',true);return false;}
  const paper=$('cardPaper')?.value||'a4',layout=$('cardLayout')?.value||'top-bottom';
  // 300 DPI avoids 139 MB+ A4 bitmap allocations and browser tab crashes at 600 DPI.
  const dpi=300,W=mm(paper==='a4'?210:152.4,dpi),H=mm(paper==='a4'?297:101.6,dpi);
  const margin=mm(8,dpi),gap=mm(layout==='reference-pair'?4:7,dpi);
  const reference=layout==='reference-pair',sideBySide=['side-by-side','aadhaar-pair','reference-pair'].includes(layout)&&sources.length>1;
  const maxW=W-2*margin,maxH=H-2*margin;
  const items=sources.map(([side,img])=>{
    let dimensions=(typeof state!=='undefined'&&state.cardSavedDimensions?.[side])||[85.6,54];
    if(reference)dimensions=[86.9,60.96];
    const w=mm(Number(dimensions[0])||85.6,dpi),h=mm(Number(dimensions[1])||54,dpi);
    return {side,img,w,h};
  });
  // Fit both cards to the available sheet without clipping. Preserve aspect ratio.
  const row=sideBySide && (items.reduce((n,it)=>n+it.w,0)+gap<=maxW);
  const rawExtent=items.reduce((n,it)=>n+(row?it.w:it.h),0)+gap*(items.length-1);
  const scale=Math.min(1,maxW/Math.max(...items.map(x=>x.w)),maxH/Math.max(...items.map(x=>x.h)),(row?maxW:maxH)/rawExtent);
  const extent=rawExtent*scale;
  let cursor=(row?W:H)/2-extent/2;
  if(reference&&row)cursor=margin;
  const layoutItems=items.map(it=>{
    const w=it.w*scale,h=it.h*scale;
    const x=row?cursor:(W-w)/2,y=row?(reference?margin:(H-h)/2):cursor;
    cursor+=(row?w:h)+gap*scale;
    return {img:it.img,x:x/W,y:y/H,w:w/W,h:h/H,ratio:w/h};
  });
  canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('Cannot open sheet canvas context.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  for(const it of layoutItems){
    const x=it.x*W,y=it.y*H,w=it.w*W,h=it.h*H;
    const factor=Math.min(w/it.img.width,h/it.img.height),dw=it.img.width*factor,dh=it.img.height*factor;
    ctx.drawImage(it.img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
  }
  try{if(typeof state!=='undefined')state.cardSheetLayout=layoutItems;}catch(_){}
  window.shopCardGroupData=layoutItems;
  if(empty){empty.hidden=true;empty.style.display='none';}
  const editor=$('cardSheetEditor');
  if(editor){editor.style.display='none';editor.innerHTML='';}
  try{if(typeof renderLayoutEditor==='function')renderLayoutEditor(editor,canvas,layoutItems,'CARD');}catch(e){console.warn('Layout editor unavailable; sheet is still generated',e)}
  try{window.shopCardGroup?.refresh?.()}catch(e){console.debug(e)}
  $('cards')?.classList.add('card-sheet-ready');
  report(`Sheet ready • ${items.map(it=>it.side).join(' + ')} • ${paper.toUpperCase()} • 300 DPI. Drag cards to arrange.`);
  document.dispatchEvent(new CustomEvent('shopstudio:card-sheet-built',{detail:{items:layoutItems,canvas}}));
  try{addHistory('Smart Card','Built card sheet',layout)}catch(_){}
  return true;
}
function init(){const button=$('buildCardSheet');if(!button)return;
  button.addEventListener('click',event=>{
    event.preventDefault();event.stopImmediatePropagation();
    try{build()}catch(e){console.error('Smart Card build failed:',e);report('Could not build sheet: '+(e?.message||'unknown error'),true)}
  },true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* END smart-card-build-fix.js */

;
/* BEGIN smart-card-sheet-editor.js */
/* Shop Studio 16 — editable Smart Card A4 output. Handles are HTML overlays, not printed. */
(()=>{'use strict';
const $=id=>document.getElementById(id), clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let items=[],selected=-1,canvas=null,layer=null,toolbar=null,drag=null,ready=false;
function status(s){if($('cardStatus'))$('cardStatus').textContent=s}
function sync(){try{if(typeof state!=='undefined')state.cardSheetLayout=items}catch(e){} window.shopCardGroupData=items}
function draw(){if(!canvas||!canvas.width||!canvas.height)return;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 for(const it of items){if(!it.img||!it.img.width)continue;
  const x=it.x*canvas.width,y=it.y*canvas.height,w=it.w*canvas.width,h=it.h*canvas.height;
  ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate((it.angle||0)*Math.PI/180);
  const rotated=Math.abs(Math.round((it.angle||0)/90))%2===1;
  const boxW=rotated?h:w,boxH=rotated?w:h;
  const f=Math.min(boxW/it.img.width,boxH/it.img.height);
  ctx.drawImage(it.img,-it.img.width*f/2,-it.img.height*f/2,it.img.width*f,it.img.height*f);ctx.restore();
 }
 sync();paintOverlay();
}
function positionLayer(){if(!layer||!canvas)return;const c=canvas.getBoundingClientRect(),p=layer.parentElement.getBoundingClientRect();if(!c.width||!c.height)return;
 Object.assign(layer.style,{left:(c.left-p.left+layer.parentElement.scrollLeft)+'px',top:(c.top-p.top+layer.parentElement.scrollTop)+'px',width:c.width+'px',height:c.height+'px'});
}
function paintOverlay(){if(!layer)return;positionLayer();layer.replaceChildren();items.forEach((it,i)=>{
 const node=document.createElement('div');node.className='ss-card-item'+(i===selected?' selected':'');node.style.left=(it.x*100)+'%';node.style.top=(it.y*100)+'%';node.style.width=(it.w*100)+'%';node.style.height=(it.h*100)+'%';node.title='Drag to move; select to resize or rotate';
 node.setAttribute('role','button');node.tabIndex=0;node.setAttribute('aria-label',`Card ${i+1} — select, move or resize`);
 if(i===selected){for(const handle of ['nw','n','ne','e','se','s','sw','w']){const h=document.createElement('span');h.className='ss-card-handle '+handle;h.dataset.handle=handle;node.appendChild(h)}const tag=document.createElement('span');tag.className='ss-card-tag';tag.textContent=i===0?'Card 1':'Card '+(i+1);node.appendChild(tag)}
 node.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();selected=i;const mode=e.target.dataset.handle||'move';drag={id:e.pointerId,mode,sx:e.clientX,sy:e.clientY,base:{...items[i]}};paintOverlay();document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',end,true);document.addEventListener('pointercancel',end,true)});
 node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selected=i;paintOverlay()}});
 layer.appendChild(node);
 });toolbar?.classList.toggle('ss-has-selection',selected>=0&&selected<items.length);
}
function move(e){if(!drag||e.pointerId!==drag.id)return;e.preventDefault();const rect=canvas.getBoundingClientRect();if(rect.width<1)return;
 const dx=(e.clientX-drag.sx)/rect.width,dy=(e.clientY-drag.sy)/rect.height,b=drag.base,n={...b};const min=.025,mode=drag.mode;
 if(mode==='move'){n.x=clamp(b.x+dx,0,1-b.w);n.y=clamp(b.y+dy,0,1-b.h)}else{
   if(mode.includes('w')){const newX=clamp(b.x+dx,0,b.x+b.w-min);n.w=b.w+b.x-newX;n.x=newX}
   if(mode.includes('e'))n.w=clamp(b.w+dx,min,1-b.x);
   if(mode.includes('n')){const newY=clamp(b.y+dy,0,b.y+b.h-min);n.h=b.h+b.y-newY;n.y=newY}
   if(mode.includes('s'))n.h=clamp(b.h+dy,min,1-b.y);
 }
 items[selected]=n;draw();
}
function end(e){if(!drag||e.pointerId!==drag.id)return;drag=null;document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',end,true);document.removeEventListener('pointercancel',end,true)}
function rotateCard(direction){if(selected<0||!items[selected])return status('Select a card first.');const it=items[selected];it.angle=((it.angle||0)+direction*90+360)%360;draw();status(`Card ${selected+1} rotated ${direction>0?'right':'left'} 90°.`)}
function rotatePage(){if(!canvas?.width)return status('Build Sheet first.');const W=canvas.width,H=canvas.height;canvas.width=H;canvas.height=W;
 // Rotate page geometry clockwise while preserving each card's physical position and scale.
 items=items.map(it=>({...it,x:1-it.y-it.h,y:it.x,w:it.h,h:it.w,angle:((it.angle||0)+90)%360}));draw();status(`Page rotated to ${canvas.width>canvas.height?'landscape':'portrait'}.`)}
function removeSelected(){if(selected<0||!items[selected])return status('Select a card to delete.');items.splice(selected,1);selected=items.length?Math.min(selected,items.length-1):-1;draw();status('Selected card removed from A4 sheet.')}
function makeButton(name,label,fn){const btn=document.createElement('button');btn.type='button';btn.className='ghost-btn';btn.textContent=label;btn.dataset.action=name;btn.addEventListener('click',fn);return btn}
function mount(){if(ready)return;canvas=$('cardCanvas');if(!canvas)return;
 const wrap=canvas.closest('.canvas-wrap');if(!wrap)return;ready=true;wrap.classList.add('ss-editable-card-wrap');
 const old=$('cardSheetEditor');if(old)old.style.display='none';
 layer=document.createElement('div');layer.id='ssCardEditorOverlay';layer.className='ss-card-overlay';wrap.appendChild(layer);
 toolbar=document.createElement('div');toolbar.id='ssCardEditorToolbar';toolbar.className='ss-card-toolbar';toolbar.append(
 makeButton('rotate-left','↶ Rotate Card',()=>rotateCard(-1)),
 makeButton('rotate-right','↷ Rotate Card',()=>rotateCard(1)),
 makeButton('delete','Delete Selected',removeSelected),
 makeButton('rotate-page','Rotate A4 Page ↻',rotatePage));
 const help=document.createElement('span');help.className='ss-card-help';help.textContent='Select a card • Drag to move • Use 8 handles to resize';toolbar.prepend(help);wrap.insertAdjacentElement('afterend',toolbar);
 layer.addEventListener('pointerdown',e=>{if(e.target===layer){selected=-1;paintOverlay()}});
 document.addEventListener('keydown',e=>{if(!$('#cards')?.classList.contains('active')||!items.length)return;const t=e.target;if(t?.matches?.('input,textarea,select,[contenteditable]'))return;if((e.key==='Delete'||e.key==='Backspace')&&selected>=0){e.preventDefault();removeSelected()}});
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(positionLayer).observe(canvas);window.addEventListener('resize',positionLayer);
}
function onBuilt(e){mount();if(!canvas)return;items=(e.detail.items||[]).map(x=>({...x,angle:0}));selected=-1;draw();status('A4 sheet ready. Click a card and drag or resize; rotate and delete tools are below the sheet.')}
document.addEventListener('shopstudio:card-sheet-built',onBuilt);
function init(){mount();if(canvas?.width&&window.shopCardGroupData?.length){items=window.shopCardGroupData.map(x=>({...x,angle:x.angle||0}));draw()}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* END smart-card-sheet-editor.js */

;
/* BEGIN passport-upload-fix.js */
/* Passport Photo: one upload handler, reliable canvas preview, no Smart Card changes. */
(() => {
  'use strict';
  function init() {
    const oldInput = document.getElementById('photoInput');
    const canvas = document.getElementById('photoCanvas');
    const empty = document.getElementById('photoEmpty');
    const status = document.getElementById('photoAiStatus');
    if (!oldInput || !canvas) return;
    // Replace all previous upload listeners; both legacy and modern scripts attach to photoInput.
    const input = oldInput.cloneNode(true);
    oldInput.replaceWith(input);
    input.accept = 'image/jpeg,image/png,image/webp,image/bmp,image/gif';
    const label = input.closest('label');
    // Native label behavior opens the file chooser exactly once; no synthetic click forwarding.
    if (label) {
      const fresh = label.cloneNode(false);
      while (label.firstChild) fresh.appendChild(label.firstChild);
      label.replaceWith(fresh);
    }
    const activeInput = document.getElementById('photoInput');
    let seq = 0;
    activeInput.addEventListener('change', async () => {
      const file = activeInput.files?.[0];
      if (!file) return;
      const current = ++seq;
      if (status) status.textContent = 'Loading photo…';
      try {
        if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|bmp|gif)$/i.test(file.name)) {
          throw new Error('Choose a JPG, PNG, WEBP, BMP, or GIF image.');
        }
        const url = URL.createObjectURL(file);
        let img;
        try {
          img = await new Promise((resolve, reject) => {
            const preview = new Image();
            preview.onload = () => resolve(preview);
            preview.onerror = () => reject(new Error('The browser could not decode this image. Try JPG or PNG.'));
            preview.src = url;
          });
        } finally { URL.revokeObjectURL(url); }
        if (current !== seq) return;
        if (!img.naturalWidth || !img.naturalHeight) throw new Error('Image has no valid dimensions.');
        if (typeof state !== 'undefined') {
          state.photoImg = img;
          state.photoOriginal = img;
          state.photoCrop = null;
        }
        // Use the normal renderer so brightness/contrast and sheet generation share the same state.
        if (typeof drawPhoto === 'function') drawPhoto();
        else {
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext('2d').drawImage(img, 0, 0);
        }
        canvas.style.display = 'block';
        canvas.style.visibility = 'visible';
        canvas.style.opacity = '1';
        if (empty) empty.style.display = 'none';
        document.getElementById('photoCropBox')?.classList.remove('show');
        if (status) status.textContent = `Photo loaded • ${img.naturalWidth} × ${img.naturalHeight}px • Select Crop Area to continue.`;
        // Initialize after layout, so crop handles align with visible canvas dimensions.
        requestAnimationFrame(() => {
          if (typeof initPhotoCrop === 'function') initPhotoCrop();
        });
        if (typeof addHistory === 'function') addHistory('Photo Studio', 'Opened photo', file.name);
      } catch (err) {
        console.error('Passport photo upload failed:', err);
        if (status) status.textContent = `Upload failed: ${err.message}`;
      } finally { activeInput.value = ''; }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();

/* END passport-upload-fix.js */

;
/* BEGIN photo-signature-upload-fix.js */
/* Shop Studio — Photo & Signature upload reliability patch.
   Load after app-v11.5.0.js and enhancement scripts. */
(() => {
  'use strict';
  function init() {
    const section = document.getElementById('resize');
    const previous = section?.querySelector('#resizeInput');
    const canvas = section?.querySelector('#resizeCanvas');
    if (!previous || !canvas) return;

    // Both legacy replaceInput() and wireImageInput() cloned the input.  The
    // first handler left a label click listener closing over the *old* input.
    // Cloning the entire label strips the now-stale click listener too.
    const label = previous.closest('label');
    let input;
    if (label) {
      const cleanLabel = label.cloneNode(true);
      label.replaceWith(cleanLabel);
      input = cleanLabel.querySelector('#resizeInput');
      cleanLabel.removeAttribute('for'); // Native nested-input label activation.
    } else {
      input = previous.cloneNode(true);
      previous.replaceWith(input);
    }
    if (!input) return;
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/bmp,image/gif';
    input.removeAttribute('disabled');

    const empty = section.querySelector('#resizeEmpty');
    let status = section.querySelector('#photoSignatureUploadStatus');
    if (!status) {
      status = document.createElement('div');
      status.id = 'photoSignatureUploadStatus';
      status.className = 'status-inline';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.textContent = 'Upload a photo or signature.';
      section.querySelector('.canvas-wrap')?.insertAdjacentElement('beforebegin', status);
    }

    function loadImage(file) {
      return new Promise((resolve,reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        let done = false;
        const finish = (error) => {
          if (done) return;
          done = true;
          URL.revokeObjectURL(url);
          if (error) reject(error);
          else resolve(img);
        };
        img.onload = () => finish(null);
        img.onerror = () => finish(new Error('Image decoding failed. Try a JPG or PNG image.'));
        img.src = url;
      });
    }

    let sequence = 0;
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const current = ++sequence;
      status.textContent = 'Loading image…';
      try {
        if (!/^image\//i.test(file.type) && !/\.(jpe?g|png|webp|bmp|gif)$/i.test(file.name)) {
          throw new Error('Choose a JPG, PNG, WEBP, BMP or GIF image.');
        }
        const image = await loadImage(file);
        if (current !== sequence) return;
        // Uses shared state and the existing resize/crop/export renderer.
        state.resizeImg = image;
        state.v11ResizeOriginal = image;
        const source = document.getElementById('resizeSourceCanvas');
        if (source) {
          const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
          source.width = Math.max(1, Math.round(image.naturalWidth * scale));
          source.height = Math.max(1, Math.round(image.naturalHeight * scale));
          source.getContext('2d').drawImage(image, 0, 0, source.width, source.height);
        }
        const host = document.getElementById('resizeCropHost');
        if (host) host.style.display = 'none';
        for (const id of ['resizeApplyCrop', 'resizeCancelCrop']) {
          const control = document.getElementById(id);
          if (control) control.style.display = 'none';
        }
        if (typeof drawResizePreview === 'function') drawResizePreview();
        else {
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          canvas.getContext('2d').drawImage(image,0,0);
        }
        if (empty) empty.style.display = 'none';
        status.textContent = `${file.name} loaded — ${image.naturalWidth} × ${image.naturalHeight}px`;
      } catch (error) {
        console.error('Photo & Signature upload:', error);
        status.textContent = `Upload failed: ${error.message || 'Could not load the image.'}`;
      } finally {
        input.value = ''; // Allow re-uploading the same file.
      }
    });

    // Remove the redundant browser-wide print shortcut from this section.
    section.querySelectorAll('.enh-print').forEach(button => button.remove());
    const hide = document.createElement('style');
    hide.textContent = '#resize > .enh-print, #resize .enh-print { display: none !important; }';
    document.head.appendChild(hide);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();

/* END photo-signature-upload-fix.js */
