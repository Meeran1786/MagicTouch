// T9 Hit the answer: answer balloons float up the wall; hit the right one (throw a soft ball, tap with the pen, or click).
import { MT } from "../js/kit.js";

export default function ball(area,d,ctx){
  var wrap=document.createElement('div');wrap.className='bl-wrap';area.appendChild(wrap);
  var cv=document.createElement('canvas');cv.className='bl-cv';wrap.appendChild(cv);
  var qEl=document.createElement('div');qEl.className='bl-q';wrap.appendChild(qEl);
  var g=cv.getContext('2d'),W=0,H=0,DPR=Math.min(2,window.devicePixelRatio||1),dead=false,raf=0,last=performance.now(),T=0;
  function size(){W=wrap.clientWidth;H=wrap.clientHeight;cv.width=W*DPR;cv.height=H*DPR;g.setTransform(DPR,0,0,DPR,0,0);}
  size();var ro=new ResizeObserver(size);ro.observe(wrap);
  var COLS=[['#FF6B6B','#C92A2A'],['#FFD43B','#E8A21A'],['#4DABF7','#1864AB'],['#69DB7C','#2B8A3E'],['#DA77F2','#862E9C'],['#FFA94D','#D9480F']];
  var asked={},rounds=d.rounds||10,qi=0,right=0,balloons=[],parts=[],marks=[],q=null,lock=false;
  var clouds=[0,1,2,3].map(function(i){return {x:Math.random(),y:.08+Math.random()*.25,s:.6+Math.random()*.7,v:.004+Math.random()*.006};});
  function makeQ(){
    if(d.questions){var it=d.questions[qi%d.questions.length];return {text:it.q,say:it.say||it.q,ans:String(it.a),opts:MT.shuffle([String(it.a)].concat(it.wrong.map(String)))};}
    var t=d.tables||[2,3,4,5,6,7,8,9],a,b,key,tries=0;do{a=t[Math.floor(Math.random()*t.length)];b=2+Math.floor(Math.random()*9);key=Math.min(a,b)+'x'+Math.max(a,b);}while(asked[key]&&tries++<50);asked[key]=1;var ans=a*b,set={};set[ans]=1;
    var near=[ans+a,ans-a,ans+b,ans-b,(a+1)*b,a*(b+1),ans+1,ans-1,ans+10].filter(function(x){return x>0&&!set[x]&&(set[x]=1);});
    return {text:a+' × '+b+' = ?',say:a+' times '+b,ans:String(ans),opts:MT.shuffle([String(ans)].concat(MT.shuffle(near).slice(0,3)))};
  }
  function launch(){balloons=[];var n=q.opts.length,colI=Math.floor(Math.random()*COLS.length);
    q.opts.forEach(function(o,i){var r=Math.max(52,Math.min(W,H)*.085);
      balloons.push({txt:o,ok:o===q.ans,x:W*(i+.5)/n+(Math.random()-.5)*W*.05,y:H+r*.4+i*28+Math.random()*30,r:r,v:H/(13+Math.random()*3),ph:Math.random()*6,col:COLS[(colI+i)%COLS.length],alive:true});});}
  function next(){if(qi>=rounds){lock=true;qEl.classList.add('bl-hide');MT.later(function(){MT.done(area,(d.doneText||'Great throwing!')+' '+right+' / '+rounds,ctx.again);},600);return;}
    q=makeQ();qi++;qEl.innerHTML='<span class="bl-n">'+qi+' / '+rounds+'</span>'+q.text;qEl.classList.remove('bl-hide');MT.speak(q.say);launch();lock=false;}
  function burst(b,good){for(var i=0;i<(good?40:16);i++){var a=Math.random()*Math.PI*2,s=(good?220:120)*(0.4+Math.random());
      parts.push({x:b.x,y:b.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-60,life:1,c:good?(Math.random()<.4?'#FBD064':b.col[0]):'#9E9E9E',sz:4+Math.random()*7,star:good&&Math.random()<.3});}}
  function hit(x,y){
    marks.push({x:x,y:y,life:1});
    if(lock||!q)return;
    for(var i=balloons.length-1;i>=0;i--){var b=balloons[i];if(!b.alive)continue;var bx=b.x+Math.sin(T*1.3+b.ph)*12;
      if(Math.hypot(x-bx,y-(b.y))<b.r*1.15){b.alive=false;b.x=bx;
        if(b.ok){right++;burst(b,true);MT.confetti&&MT.confetti();MT.score(right+' / '+rounds);MT.good('Yes! '+q.text.replace('?',q.ans),q.say+' is '+q.ans);lock=true;MT.later(next,1500);}
        else{burst(b,false);MT.bad('Not '+b.txt+' — try again');}
        return;}}
  }
  var down=function(e){if(e.target!==cv)return;var r=cv.getBoundingClientRect();hit(e.clientX-r.left,e.clientY-r.top);};
  cv.addEventListener('pointerdown',down);
  wrap._state=function(){return {q:q,T:T,balloons:balloons.map(function(b){return {txt:b.txt,ok:b.ok,alive:b.alive,x:b.x+Math.sin(T*1.3+b.ph)*12,y:b.y,r:b.r};})};}; // used by tests
  function drawBg(){
    var sky=g.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#7EC8F5');sky.addColorStop(.7,'#D8F1FF');sky.addColorStop(1,'#FFF4D6');g.fillStyle=sky;g.fillRect(0,0,W,H);
    var sx=W*.86,sy=H*.16,sr=Math.min(W,H)*.07,sg=g.createRadialGradient(sx,sy,sr*.3,sx,sy,sr*2.6);sg.addColorStop(0,'rgba(255,230,120,1)');sg.addColorStop(.35,'rgba(255,210,80,.55)');sg.addColorStop(1,'rgba(255,210,80,0)');
    g.fillStyle=sg;g.beginPath();g.arc(sx,sy,sr*2.6,0,7);g.fill();g.fillStyle='#FFE066';g.beginPath();g.arc(sx,sy,sr,0,7);g.fill();
    clouds.forEach(function(c){c.x+=c.v/60;if(c.x>1.2)c.x=-.2;var x=c.x*W,y=c.y*H,s=c.s*Math.min(W,H)*.06;g.fillStyle='rgba(255,255,255,.92)';
      [[0,0,1],[1,-.4,1.2],[2.1,0,1],[1,.3,1.1]].forEach(function(p){g.beginPath();g.arc(x+p[0]*s,y+p[1]*s,p[2]*s,0,7);g.fill();});});
    function hills(base,amp,f,ph,c1,c2){var gr=g.createLinearGradient(0,H*base-amp,0,H);gr.addColorStop(0,c1);gr.addColorStop(1,c2);g.fillStyle=gr;g.beginPath();g.moveTo(0,H);
      function hy(x){return H*base-amp*(Math.sin(x/W*f+ph)*.6+Math.sin(x/W*f*2.3+ph*1.7)*.4);}for(var x=0;x<W;x+=12)g.lineTo(x,hy(x));g.lineTo(W,hy(W));g.lineTo(W,H);g.closePath();g.fill();}
    hills(.74,H*.08,5,1,'#A5D98C','#6FBF5A');hills(.84,H*.06,7,3,'#6CC04A','#3E8E33');
  }
  function drawBalloon(b){var x=b.x+Math.sin(T*1.3+b.ph)*12,y=b.y,r=b.r;
    g.strokeStyle='rgba(80,60,60,.7)';g.lineWidth=2;g.beginPath();g.moveTo(x,y+r*1.08);
    for(var k=1;k<=10;k++)g.lineTo(x+Math.sin(T*2+b.ph+k*.6)*6*(k/10),y+r*1.08+k*r*.12);g.stroke();
    g.fillStyle=b.col[1];g.beginPath();g.moveTo(x-8,y+r*1.12);g.lineTo(x+8,y+r*1.12);g.lineTo(x,y+r*.98);g.fill();
    var gr=g.createRadialGradient(x-r*.35,y-r*.4,r*.1,x,y,r*1.15);gr.addColorStop(0,'#FFFFFF');gr.addColorStop(.18,b.col[0]);gr.addColorStop(1,b.col[1]);
    g.fillStyle=gr;g.beginPath();g.ellipse(x,y,r*.92,r*1.08,0,0,7);g.fill();
    g.fillStyle='rgba(255,255,255,.35)';g.beginPath();g.ellipse(x-r*.38,y-r*.45,r*.16,r*.28,-.5,0,7);g.fill();
    g.font='800 '+Math.round(r*.72)+'px "Segoe UI",Arial,sans-serif';g.textAlign='center';g.textBaseline='middle';g.lineWidth=6;g.strokeStyle='rgba(40,10,40,.55)';g.strokeText(b.txt,x,y+2);g.fillStyle='#fff';g.fillText(b.txt,x,y+2);}
  function star(x,y,s){g.beginPath();for(var i=0;i<10;i++){var a=i*Math.PI/5-Math.PI/2,rr=i%2?s*.45:s;g.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}g.closePath();g.fill();}
  function loop(now){if(dead)return;var dt=Math.min(.05,(now-last)/1000);last=now;T+=dt;
    drawBg();
    var anyUp=false;balloons.forEach(function(b){if(!b.alive)return;b.y-=b.v*dt;if(b.y>-b.r*2.5)anyUp=true;drawBalloon(b);});
    if(q&&!lock&&!anyUp)launch(); // all floated away: send them again
    parts=parts.filter(function(p){p.life-=dt*1.2;if(p.life<=0)return false;p.vy+=380*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;g.globalAlpha=Math.max(0,p.life);g.fillStyle=p.c;
      if(p.star)star(p.x,p.y,p.sz*1.4);else{g.beginPath();g.arc(p.x,p.y,p.sz*.6,0,7);g.fill();}g.globalAlpha=1;return true;});
    marks=marks.filter(function(m){m.life-=dt*1.6;if(m.life<=0)return false;g.strokeStyle='rgba(99,22,84,'+m.life+')';g.lineWidth=5;g.beginPath();g.arc(m.x,m.y,(1-m.life)*60+10,0,7);g.stroke();return true;});
    raf=requestAnimationFrame(loop);}
  MT.score('0 / '+rounds);
  MT.later(next,400);raf=requestAnimationFrame(loop);
  return function(){dead=true;cancelAnimationFrame(raf);ro.disconnect();};
}
