// MagicTouch camera input layer (IR pen + hand). Injects its own panel and styles.
// Requires ../mediapipe/hands.js to be loaded first (for hand mode).
(function(){
  var st=document.createElement('style'); st.textContent="\n#wt_dot{position:fixed;width:28px;height:28px;border-radius:50%;background:rgba(243,163,40,0.55);border:3px solid #F3A328;pointer-events:none;display:none;z-index:9000;transform:translate(-50%,-50%);}\n#wt_dot.down{background:rgba(204,48,84,0.6);border-color:#CC3054;}\n#wt_ring{position:fixed;border-radius:50%;pointer-events:none;display:none;z-index:8999;transform:translate(-50%,-50%);border:3px solid #F3A328;}\n.wt-dwell{outline:4px solid #F3A328 !important;outline-offset:2px;}\n#wt_panel{position:fixed;right:14px;bottom:14px;z-index:9500;background:rgba(61,14,55,0.96);color:#fff;border:2px solid #F3A328;border-radius:12px;padding:10px;width:310px;font:13px Calibri,Arial,sans-serif;}\n#wt_panel.hidden{display:none;}\n#wt_panel select,#wt_panel button{font:13px Calibri,Arial,sans-serif;border-radius:6px;border:1px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.12);color:#fff;padding:5px 8px;margin:3px 0;}\n#wt_panel select{width:100%;}\n#wt_panel option{color:#000;}\n#wt_panel label{display:flex;align-items:center;gap:6px;margin:3px 0;}\n#wt_panel input[type=range]{flex:1;}\n#wt_prev{width:100%;border-radius:8px;background:#000;display:block;margin:6px 0;}\n#wt_status{color:#F3A328;min-height:18px;}\n#wt_cal{position:fixed;inset:0;z-index:9800;background:#fff;display:none;color:#3D0E37;font:22px Calibri,Arial,sans-serif;}\n#wt_cal .msg{position:absolute;left:50%;top:28%;transform:translate(-50%,-50%);text-align:center;max-width:60%;background:rgba(255,255,255,0.9);padding:12px 18px;border-radius:12px;}\n#wt_cal .tgt{position:absolute;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;border:5px solid #CC3054;background:rgba(204,48,84,0.15);}\n#wt_cal .tgt::after{content:'';position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:#CC3054;}\n#wt_cal .tgt.done{border-color:#2E7D46;background:rgba(46,125,70,0.15);}\n#wt_cal .tgt.done::after{background:#2E7D46;}\n#wt_cal .tgt.todo{opacity:0.25;}\n#wt_cal .fill{position:absolute;inset:-5px;border-radius:50%;border:5px solid #F3A328;clip-path:inset(100% 0 0 0);}\n"; document.head.appendChild(st);
  var box=document.createElement('div'); box.innerHTML="<div id=\"wt_dot\"></div>\n<div id=\"wt_ring\"></div>\n<div id=\"wt_panel\">\n  <div><b style=\"color:#F3A328\">Camera touch</b> <span style=\"opacity:.7\">(press C to hide)</span></div>\n  <select id=\"wt_cam\"><option>Looking for cameras\u2026</option></select>\n  <select id=\"wt_mode\"><option value=\"pen\">Mode: IR pen</option><option value=\"hand\">Mode: hand / finger</option></select>\n  <canvas id=\"wt_prev\" width=\"320\" height=\"240\"></canvas>\n  <label id=\"wt_thrRow\">Pen sensitivity <input type=\"range\" id=\"wt_thr\" min=\"120\" max=\"254\" value=\"220\"><span id=\"wt_thrVal\">220</span></label>\n  <div id=\"wt_status\">Starting\u2026</div>\n  <button id=\"wt_btnCal\">Calibrate (K)</button>\n  <button id=\"wt_btnFull\">Fullscreen</button>\n</div>\n<div id=\"wt_cal\"><div class=\"msg\" id=\"wt_calmsg\"></div></div>\n<video id=\"wt_video\" playsinline muted style=\"display:none\"></video>\n<canvas id=\"wt_work\" width=\"320\" height=\"240\" style=\"display:none\"></canvas>"; while(box.firstChild) document.body.appendChild(box.firstChild);
})();

(function(){
var $=function(id){return document.getElementById(id);};
var dot=$('wt_dot'),ring=$('wt_ring'),panel=$('wt_panel'),video=$('wt_video');
var prev=$('wt_prev'),pctx=prev.getContext('2d'),statusEl=$('wt_status'),camSel=$('wt_cam'),modeSel=$('wt_mode');
var work=$('wt_work'),wctx=work.getContext('2d',{willReadFrequently:true});
var store=window.localStorage;
var DWELL_MS=600,DWELL_R=0.04,CAL_HOLD_MS=1500,CAL_INSET=0.08;
var PEN_DOWN_FRAMES=2,PEN_UP_FRAMES=6,CLICK_MOVE_PX=40;
var mode=store.getItem('wt_mode')||'pen'; modeSel.value=mode;
var thr=+(store.getItem('wt_thr')||220); $('wt_thr').value=thr; $('wt_thrVal').textContent=thr;
var CAL=null; try{CAL=JSON.parse(store.getItem('wt_cal9')||'null');}catch(e){}
var lastCam=null;
function setStatus(t){statusEl.textContent=t;}
function calText(){return CAL?' — calibrated ✓':' — press K to calibrate';}

// ---------------- maths: homographies ----------------
function solve(A,b){
  var n=b.length;
  for(var i=0;i<n;i++){
    var p=i;for(var r=i+1;r<n;r++) if(Math.abs(A[r][i])>Math.abs(A[p][i])) p=r;
    var t=A[i];A[i]=A[p];A[p]=t; t=b[i];b[i]=b[p];b[p]=t;
    if(Math.abs(A[i][i])<1e-12) return null;
    for(var r2=i+1;r2<n;r2++){var f=A[r2][i]/A[i][i];for(var c=i;c<n;c++)A[r2][c]-=f*A[i][c];b[r2]-=f*b[i];}
  }
  var x=new Array(n);
  for(var k=n-1;k>=0;k--){var s=b[k];for(var c2=k+1;c2<n;c2++)s-=A[k][c2]*x[c2];x[k]=s/A[k][k];}
  return x;
}
// least-squares homography from N>=4 point pairs (src camera 0..1 -> dst screen 0..1)
function homography(src,dst){
  var M=[],v=[];for(var i=0;i<8;i++){M.push([0,0,0,0,0,0,0,0]);v.push(0);}
  for(var k=0;k<src.length;k++){
    var x=src[k][0],y=src[k][1],u=dst[k][0],w=dst[k][1];
    var rows=[[x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-w*x,-w*y,w]];
    rows.forEach(function(r){for(var i=0;i<8;i++){for(var j=0;j<8;j++)M[i][j]+=r[i]*r[j];v[i]+=r[i]*r[8];}});
  }
  var h=solve(M,v); if(!h) return null; h.push(1); return h;
}
function apply(h,x,y){var w=h[6]*x+h[7]*y+h[8];return [(h[0]*x+h[1]*y+h[2])/w,(h[3]*x+h[4]*y+h[5])/w];}

// 3x3 grid of targets (screen fractions), row by row
var GRID=[];(function(){var a=[CAL_INSET,0.5,1-CAL_INSET];for(var r=0;r<3;r++)for(var c=0;c<3;c++)GRID.push([a[c],a[r]]);})();
// build: one global LSQ homography + one per grid cell (handles lens bend)
function buildCal(camPts){
  var g=homography(camPts,GRID); if(!g) return null;
  var cells=[];
  for(var r=0;r<2;r++)for(var c=0;c<2;c++){
    var idx=[r*3+c,r*3+c+1,(r+1)*3+c+1,(r+1)*3+c];
    cells.push({h:homography(idx.map(function(i){return camPts[i];}),idx.map(function(i){return GRID[i];})),
                x0:GRID[idx[0]][0],x1:GRID[idx[1]][0],y0:GRID[idx[0]][1],y1:GRID[idx[3]][1]});
  }
  return {g:g,cells:cells,pts:camPts};
}
function mapCal(cal,cx,cy){
  var e=0.02;
  for(var i=0;i<cal.cells.length;i++){
    var c=cal.cells[i]; if(!c.h) continue;
    var p=apply(c.h,cx,cy);
    var inX=(c.x0===GRID[0][0]?-1:c.x0-e)<=p[0]&&p[0]<=(c.x1===GRID[2][0]?2:c.x1+e);
    var inY=(c.y0===GRID[0][1]?-1:c.y0-e)<=p[1]&&p[1]<=(c.y1===GRID[6][1]?2:c.y1+e);
    if(inX&&inY) return p;
  }
  return apply(cal.g,cx,cy);
}
function camToScreen(cx,cy){
  if(CAL){var p=mapCal(CAL,cx,cy);return [p[0]*innerWidth,p[1]*innerHeight];}
  return [cx*innerWidth,cy*innerHeight];
}

// ---------------- pen: find the bright IR dot ----------------
// returns [x,y] in 0..1 camera coords, or null
function findDot(img,w,h,threshold){
  var d=img.data,best=-1,bi=-1;
  for(var i=0,p=0;i<d.length;i+=4,p++){var l=(d[i]*3+d[i+1]*6+d[i+2])/10; if(l>best){best=l;bi=p;}}
  if(best<threshold) return null;
  var big=!!window.MT_BIG_BLOB; // torch activities: follow a large bright spot too
  var bx=bi%w,by=(bi/w)|0,R=big?60:20,sx=0,sy=0,n=0,cut=Math.max(threshold,best-40);
  for(var y=Math.max(0,by-R);y<Math.min(h,by+R);y++)for(var x=Math.max(0,bx-R);x<Math.min(w,bx+R);x++){
    var j=(y*w+x)*4,l2=(d[j]*3+d[j+1]*6+d[j+2])/10; if(l2>=cut){sx+=x;sy+=y;n++;}
  }
  if(!big&&n>150) return null; // a big bright area is a lamp or window, not the pen
  return [(sx/n+0.5)/w,(sy/n+0.5)/h];
}

// ---------------- sending touches to the page ----------------
function targetAt(x,y){
  var ds=dot.style.display; dot.style.display='none';
  var el=document.elementFromPoint(x,y); dot.style.display=ds;
  if(!el||panel.contains(el)) return null; return el;
}
function evt(type,el,x,y,Ctor){
  if(!el) return;
  var o={bubbles:true,cancelable:true,clientX:x,clientY:y,pointerId:7,pointerType:'pen',isPrimary:true,button:0,buttons:type==='pointerup'||type==='click'?0:1};
  el.dispatchEvent(new (Ctor||PointerEvent)(type,o));
}
function wake(){try{if(typeof audioCtx!=='undefined')audioCtx.resume();}catch(e){}}
function pulse(x,y){ring.style.cssText='left:'+x+'px;top:'+y+'px;display:block;width:28px;height:28px;animation:none;';void ring.offsetWidth;ring.style.animation='dwellGrow 0.4s ease-out forwards';}
function showDot(x,y,down){dot.style.display='block';dot.style.left=x+'px';dot.style.top=y+'px';dot.classList.toggle('down',!!down);}
function hideDot(){dot.style.display='none';}

// pen state machine: press / move / lift (real drag & draw)
var pen={down:false,seen:0,miss:0,el:null,start:null,last:null};
function penSample(s){ // s = [x,y] screen px or null
  if(s){
    pen.miss=0; pen.seen++;
    if(!pen.down&&pen.seen>=PEN_DOWN_FRAMES){
      pen.down=true;wake();pen.el=targetAt(s[0],s[1]);pen.start=s;pen.last=s;
      evt('pointerdown',pen.el,s[0],s[1]);pulse(s[0],s[1]);
    } else if(pen.down){
      pen.last=s; var el=targetAt(s[0],s[1]); evt('pointermove',el||pen.el,s[0],s[1]);
    }
    showDot(s[0],s[1],pen.down);
  } else {
    // a TV remote (and some pens) flicker: the dot blinks on/off between frames.
    // Only forget a press after PEN_UP_FRAMES misses in a row, so blinks still count.
    if(++pen.miss>=PEN_UP_FRAMES) pen.seen=0;
    if(pen.down&&pen.miss>=PEN_UP_FRAMES){
      var l=pen.last,el2=targetAt(l[0],l[1]);
      evt('pointerup',el2||pen.el,l[0],l[1]); window.dispatchEvent(new PointerEvent('pointerup',{clientX:l[0],clientY:l[1],pointerId:7,pointerType:'pen'}));
      if(Math.hypot(l[0]-pen.start[0],l[1]-pen.start[1])<CLICK_MOVE_PX&&el2) evt('click',el2,l[0],l[1],MouseEvent);
      pen.down=false;pen.el=null;
    }
    if(!pen.down) hideDot();
  }
}

// hand dwell (fallback mode)
var anchor=null,dwellStart=0,fired=false,dwellEl=null;
function clearDwell(){if(dwellEl){dwellEl.classList.remove('wt-dwell');dwellEl=null;}}
function handSample(s){
  if(!s){anchor=null;fired=false;clearDwell();hideDot();return;}
  showDot(s[0],s[1],false);
  var r=DWELL_R*innerWidth,now=performance.now();
  if(!anchor||Math.hypot(s[0]-anchor.x,s[1]-anchor.y)>r){
    anchor={x:s[0],y:s[1]};dwellStart=now;fired=false;clearDwell();
    var el=targetAt(s[0],s[1]); if(el){dwellEl=el;el.classList.add('wt-dwell');}
    return;
  }
  if(!fired&&now-dwellStart>=DWELL_MS){
    fired=true;clearDwell();wake();var el2=targetAt(anchor.x,anchor.y);
    evt('pointerdown',el2,anchor.x,anchor.y);evt('pointerup',el2,anchor.x,anchor.y);evt('click',el2,anchor.x,anchor.y,MouseEvent);pulse(anchor.x,anchor.y);
  }
}

// ---------------- 9-dot calibration ----------------
var calibrating=false,calIdx=0,calPts=[],calHold=null,calPress=null,tgtEls=[];
function startCal(){
  calibrating=true;calIdx=0;calPts=[];calHold=null;calPress=null;pen.down=false;pen.seen=0;hideDot();
  var box=$('wt_cal'); box.querySelectorAll('.tgt').forEach(function(e){e.remove();}); tgtEls=[];
  GRID.forEach(function(g){var t=document.createElement('div');t.className='tgt todo';t.style.left=(g[0]*100)+'%';t.style.top=(g[1]*100)+'%';t.innerHTML='<div class="fill"></div>';box.appendChild(t);tgtEls.push(t);});
  box.style.display='block';showTarget();
}
function showTarget(){
  tgtEls.forEach(function(t,i){t.className='tgt'+(i<calIdx?' done':(i>calIdx?' todo':''));});
  $('wt_calmsg').innerHTML='Calibration: dot '+(calIdx+1)+' of 9<br><span style="font-size:17px">'+
    (mode==='pen'?'Press the pen on the centre of the red dot, then lift it.':'Put a fingertip on the red dot and hold still (or press Space).')+
    '<br>Esc cancels.</span>';
}
function captureCal(pt){
  calPts.push(pt);calIdx++;calHold=null;calPress=null;
  if(calIdx<9){showTarget();return;}
  var c=buildCal(calPts); $('wt_cal').style.display='none'; calibrating=false;
  if(c){CAL=c;store.setItem('wt_cal9',JSON.stringify(c));setStatus('Calibrated ✓ — ready');}
  else setStatus('Calibration failed. Press K to try again.');
}
function calSample(cam){ // cam = [x,y] camera coords or null
  if(mode==='pen'){
    // average the dot while the pen is pressed; a dot only counts once the pen is lifted
    // for PEN_UP_FRAMES frames in a row, so one dropped frame doesn't end the press
    if(cam){ if(!calPress) calPress={sx:0,sy:0,n:0,miss:0}; calPress.sx+=cam[0];calPress.sy+=cam[1];calPress.n++;calPress.miss=0; }
    else if(calPress){
      if(++calPress.miss>=PEN_UP_FRAMES){ if(calPress.n>=PEN_DOWN_FRAMES) captureCal([calPress.sx/calPress.n,calPress.sy/calPress.n]); else calPress=null; }
    }
    return;
  }
  var fill=tgtEls[calIdx]&&tgtEls[calIdx].firstChild;
  if(!cam){calHold=null;if(fill)fill.style.clipPath='inset(100% 0 0 0)';return;}
  var now=performance.now();
  if(!calHold||Math.hypot(cam[0]-calHold.x,cam[1]-calHold.y)>0.02){calHold={x:cam[0],y:cam[1],t:now};return;}
  var p=Math.min(1,(now-calHold.t)/CAL_HOLD_MS); if(fill) fill.style.clipPath='inset('+Math.round((1-p)*100)+'% 0 0 0)';
  if(p>=1) captureCal([cam[0],cam[1]]);
}

// one entry point for every detection, from either mode (also used by tests)
function onCam(cam){
  lastCam=cam;
  if(calibrating){calSample(cam);return;}
  var s=cam?camToScreen(cam[0],cam[1]):null;
  if(mode==='pen') penSample(s); else handSample(s);
}

// ---------------- UI ----------------
$('wt_btnCal').onclick=startCal;
$('wt_btnFull').onclick=function(){document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen();};
$('wt_thr').oninput=function(){thr=+this.value;$('wt_thrVal').textContent=thr;store.setItem('wt_thr',thr);};
function setMode(m){mode=m;modeSel.value=m;store.setItem('wt_mode',m);$('wt_thrRow').style.display=m==='pen'?'flex':'none';hideDot();pen.down=false;pen.seen=0;anchor=null;
  setStatus((m==='pen'?'IR pen mode':'Hand mode')+calText());}
modeSel.onchange=function(){setMode(modeSel.value);};
document.addEventListener('keydown',function(e){
  var k=e.key.toLowerCase();
  if(k==='c') panel.classList.toggle('hidden');
  else if(k==='k') startCal();
  else if(k==='p') setMode(mode==='pen'?'hand':'pen');
  else if(k===' '&&calibrating&&mode==='hand'&&lastCam){e.preventDefault();captureCal([lastCam[0],lastCam[1]]);}
  else if(k==='escape'&&calibrating){calibrating=false;$('wt_cal').style.display='none';}
});
window.__wt={homography:homography,apply:apply,buildCal:buildCal,mapCal:mapCal,findDot:findDot,GRID:GRID,
  feed:onCam,startCal:startCal,setMode:setMode,getCal:function(){return CAL;},state:function(){return {pen:pen.down,calibrating:calibrating,calIdx:calIdx};},pause:function(v){paused=v;}};

// ---------------- camera ----------------
var stream=null;
async function listCams(){
  var devs=(await navigator.mediaDevices.enumerateDevices()).filter(function(d){return d.kind==='videoinput';});
  var saved=store.getItem('wt_cam'); camSel.innerHTML='';
  devs.forEach(function(d,i){var o=document.createElement('option');o.value=d.deviceId;o.textContent=d.label||('Camera '+(i+1));camSel.appendChild(o);});
  if(saved&&devs.some(function(d){return d.deviceId===saved;})) camSel.value=saved;
  else {var ext=devs.find(function(d){return !/facetime|built-?in|integrated/i.test(d.label);}); if(ext) camSel.value=ext.deviceId;}
}
async function openCam(id){
  if(stream) stream.getTracks().forEach(function(t){t.stop();});
  var c={video:{width:{ideal:640},height:{ideal:480},frameRate:{ideal:60}},audio:false};
  if(id) c.video.deviceId={exact:id};
  stream=await navigator.mediaDevices.getUserMedia(c); video.srcObject=stream; await video.play();
}
camSel.onchange=function(){store.setItem('wt_cam',camSel.value);openCam(camSel.value).catch(function(e){setStatus('Camera error: '+e.message);});};

var hands=null,handsReady=false,busy=false,paused=false;
function drawPreview(src,cam){
  pctx.drawImage(src,0,0,prev.width,prev.height);
  if(CAL){pctx.strokeStyle='rgba(46,125,70,0.9)';pctx.lineWidth=1.5;pctx.beginPath();
    [0,2,8,6,0].forEach(function(i,k){var p=CAL.pts[i];k?pctx.lineTo(p[0]*prev.width,p[1]*prev.height):pctx.moveTo(p[0]*prev.width,p[1]*prev.height);});pctx.stroke();}
  if(cam){pctx.strokeStyle='#CC3054';pctx.lineWidth=3;pctx.beginPath();pctx.arc(cam[0]*prev.width,cam[1]*prev.height,8,0,7);pctx.stroke();}
}
async function ensureHands(){
  if(hands) return;
  hands=new Hands({locateFile:function(f){return (window.MT_MEDIAPIPE||'../mediapipe/')+f;}});
  hands.setOptions({maxNumHands:1,modelComplexity:0,minDetectionConfidence:0.4,minTrackingConfidence:0.4});
  hands.onResults(function(res){
    var cam=null; if(res.multiHandLandmarks&&res.multiHandLandmarks.length){var lm=res.multiHandLandmarks[0][8];cam=[lm.x,lm.y];}
    drawPreview(res.image,cam); if(mode==='hand') onCam(cam);
  });
  await hands.initialize(); handsReady=true;
}
async function loop(){
  if(!paused&&video.readyState>=2){
    if(mode==='pen'){
      wctx.drawImage(video,0,0,work.width,work.height);
      var cam=findDot(wctx.getImageData(0,0,work.width,work.height),work.width,work.height,thr);
      drawPreview(work,cam); onCam(cam);
    } else if(!busy){
      busy=true; try{await ensureHands(); await hands.send({image:video});}catch(e){} busy=false;
    }
  }
  requestAnimationFrame(loop);
}
(async function start(){
  setMode(mode);
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){setStatus('No camera access. Open via http://localhost:8080 in Chrome or Edge.');return;}
  try{
    var tmp=await navigator.mediaDevices.getUserMedia({video:true}); tmp.getTracks().forEach(function(t){t.stop();});
    await listCams(); await openCam(camSel.value);
    setStatus((mode==='pen'?'IR pen mode':'Hand mode')+' · '+stream.getVideoTracks()[0].label+calText());
    loop();
  }catch(e){setStatus('Camera error: '+e.message);}
})();
})();
