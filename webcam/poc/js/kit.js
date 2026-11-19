// MagicTouch shared kit: speech, sounds, feedback, confetti, score. Used by every template.
var AudioCtx=window.AudioContext||window.webkitAudioContext;
var audioCtx=new AudioCtx(); // global name kept: the camera input layer wakes it on first touch
window.MT=(function(){
  var voice=null;
  function pickVoice(){var v=speechSynthesis.getVoices();
    voice=v.find(function(x){return x.lang==='en-IN';})||v.find(function(x){return /^en/.test(x.lang)&&/female|samantha|zira|veena|heera/i.test(x.name);})||v.find(function(x){return /^en/.test(x.lang);})||null;}
  if(window.speechSynthesis){speechSynthesis.onvoiceschanged=pickVoice;pickVoice();}
  function speak(t){ if(!window.speechSynthesis||!t) return; speechSynthesis.cancel(); var u=new SpeechSynthesisUtterance(t); if(voice)u.voice=voice; u.rate=.9; u.pitch=1.05; speechSynthesis.speak(u); }
  function tone(freqs,type,len,vol){ try{audioCtx.resume();}catch(e){}
    freqs.forEach(function(f,i){var o=audioCtx.createOscillator(),g=audioCtx.createGain(),t=audioCtx.currentTime+i*.1;
      o.type=type;o.frequency.value=f;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.03);g.gain.exponentialRampToValueAtTime(.001,t+len);
      o.connect(g);g.connect(audioCtx.destination);o.start(t);o.stop(t+len+.05);}); }
  var sfx={good:function(){tone([660,880],'triangle',.25,.25);},bad:function(){tone([220],'sine',.35,.15);},
           tap:function(){tone([520],'sine',.12,.12);},win:function(){tone([523,659,784,1047],'triangle',.4,.28);}};
  var toastT=null;
  function toast(msg,kind){var el=document.getElementById('mt-toast');el.textContent=msg;el.className='show '+(kind||'');clearTimeout(toastT);toastT=setTimeout(function(){el.className='';},1600);}
  function confetti(){var c=['#631654','#CC3054','#E96E24','#F3A328','#FBD064','#2E7D46'];
    for(var i=0;i<70;i++){var e=document.createElement('div');e.className='mt-confetti';
      e.style.cssText='left:'+Math.random()*100+'vw;top:-20px;background:'+c[i%c.length]+';animation-duration:'+(1.2+Math.random()*1.4)+'s;animation-delay:'+Math.random()*.4+'s;';
      document.body.appendChild(e);setTimeout(function(x){return function(){x.remove();};}(e),3200);}}
  function score(t){document.getElementById('mt-score').textContent=t||'';}
  function good(msg,say){sfx.good();toast(msg||'Well done!','good');if(say)speak(say);}
  function bad(msg,say){sfx.bad();toast(msg||'Try again','bad');if(say)speak(say);}
  // finish screen. extra: optional HTML under the message (e.g. a quiz review).
  // Inside a lesson pack, MT.next is set by the pack and adds a "Next step" button.
  function done(area,msg,onAgain,extra){sfx.win();confetti();speak(msg);
    var d=document.createElement('div');d.className='mt-done';d.innerHTML='<div>'+msg+'</div>'+(extra?'<div class="mt-done-x">'+extra+'</div>':'');
    var row=document.createElement('div');row.className='mt-done-b';d.appendChild(row);
    var b=document.createElement('button');b.className='mt-btn'+(api.next?' alt':'');b.textContent=api.next?'Do it again':'Play again';b.addEventListener('click',onAgain);row.appendChild(b);
    if(api.next){var n=document.createElement('button');n.className='mt-btn';n.textContent=api.nextLabel||'Next step →';var go=api.next;n.addEventListener('click',function(){go();});row.appendChild(n);}
    area.appendChild(d);}
  // timers that belong to the current activity; cleared when another activity or the menu opens
  var timers=[];
  function later(fn,ms){var t=setTimeout(fn,ms);timers.push(t);return t;}
  function clearLater(){timers.forEach(clearTimeout);timers=[];}
  // a picture box that keeps the SVG's shape, so % positions on it line up with the drawing
  function sceneBox(holder,svgText){
    holder.style.display='flex';holder.style.alignItems='center';holder.style.justifyContent='center';holder.style.minHeight='0';holder.style.minWidth='0';
    var box=document.createElement('div');box.style.position='relative';box.innerHTML=svgText;holder.appendChild(box);
    var svg=box.querySelector('svg'),W=400,H=400;
    if(svg){var vb=(svg.getAttribute('viewBox')||'').split(/[ ,]+/).map(Number);if(vb.length===4&&vb[2]>0){W=vb[2];H=vb[3];}
      svg.style.cssText+=';position:absolute;left:0;top:0;width:100%;height:100%;display:block;';}
    function fit(){var w=holder.clientWidth,h=holder.clientHeight;if(!w||!h)return;var k=Math.min(w/W,h/H);box.style.width=(W*k)+'px';box.style.height=(H*k)+'px';}
    fit();if(window.ResizeObserver){var ro=new ResizeObserver(fit);ro.observe(holder);}else window.addEventListener('resize',fit);
    requestAnimationFrame(fit);return box;
  }
  function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
  // an item's face: {icon:"🐦", text:"Bird"} or {fraction:[1,2]} or {svg:"<svg…>"}
  function face(it){
    if(it.fraction) return fractionSVG(it.fraction[0],it.fraction[1])+'<div class="txt">'+it.fraction[0]+'/'+it.fraction[1]+'</div>';
    if(it.dots) return dotsSVG(it.dots)+(it.text?'<div class="txt">'+it.text+'</div>':'');
    return (it.svg||'')+(it.icon?'<div class="ico">'+it.icon+'</div>':'')+(it.text?'<div class="txt">'+it.text+'</div>':'');
  }
  function fractionSVG(n,d){var s='<svg viewBox="-55 -55 110 110" width="96" height="96">';
    for(var i=0;i<d;i++){var a0=i/d*2*Math.PI-Math.PI/2,a1=(i+1)/d*2*Math.PI-Math.PI/2;
      s+='<path d="M0 0 L'+50*Math.cos(a0)+' '+50*Math.sin(a0)+' A50 50 0 0 1 '+50*Math.cos(a1)+' '+50*Math.sin(a1)+'Z" fill="'+(i<n?'#E96E24':'#FFF0D8')+'" stroke="#3D0E37" stroke-width="2.5"/>';}
    return s+'</svg>';}
  function dotsSVG(n){var cols=5,rows=Math.ceil(n/cols),s='<svg viewBox="0 0 '+(cols*22)+' '+(rows*22)+'" width="'+(cols*20)+'" height="'+(rows*20)+'">';
    for(var i=0;i<n;i++) s+='<circle cx="'+(11+(i%cols)*22)+'" cy="'+(11+Math.floor(i/cols)*22)+'" r="8" fill="'+(i<10?'#CC3054':'#E96E24')+'"/>';
    return s+'</svg>';}
  var api={later:later,clearLater:clearLater,sceneBox:sceneBox,speak:speak,sfx:sfx,toast:toast,confetti:confetti,score:score,good:good,bad:bad,done:done,shuffle:shuffle,face:face,templates:{},next:null,nextLabel:null};
  return api;
})();
