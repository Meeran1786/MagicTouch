// T7 3D space: a real-time 3D scene you turn with the pen (drag) and explore (tap).
// scene "solar": tap planets to visit them.  scene "satellite": change the height of a satellite's orbit and meet challenges.
import { MT } from "../js/kit.js";

export default function space3d(area,d,ctx){
  var dead=false,stage=null,offs=[];
  var wrap=document.createElement('div');wrap.className='sp-wrap';area.appendChild(wrap);
  var host=document.createElement('div');host.className='sp-host';wrap.appendChild(host);
  var labels=document.createElement('div');labels.className='sp-labels';wrap.appendChild(labels);
  var card=document.createElement('div');card.className='sp-card';wrap.appendChild(card);
  var bar=document.createElement('div');bar.className='sp-bar';wrap.appendChild(bar);
  var loading=document.createElement('div');loading.className='sp-loading';loading.textContent='Loading 3D…';wrap.appendChild(loading);
  function btn(txt,fn,cls){var b=document.createElement('button');b.className='mt-btn sp-b '+(cls||'');b.innerHTML=txt;b.addEventListener('click',function(){MT.sfx.tap();fn(b);});bar.appendChild(b);return b;}
  function holoBtn(scene){btn('✨ Hologram view',function(){window.open('/engine/holo.html?scene='+scene,'mt_holo');},'alt');}

  import('../js/space/space.js').then(function(SP){
    if(dead)return;
    stage=SP.createStage(host,{bloom:d.scene==='solar'?1.0:0.6});
    loading.remove();
    if(d.scene==='satellite') satellite(SP); else solar(SP);
  }).catch(function(e){loading.textContent='3D could not start: '+e.message;});

  // ---------------- solar system ----------------
  function solar(SP){
    var S=SP.buildSolar(stage,{});var seen={},total=SP.PLANETS.length-1;
    MT.score('0 / '+total);
    var tags=S.bodies.map(function(b){var t=document.createElement('div');t.className='sp-tag';t.textContent=b.p.name.replace('The ','');
      t.addEventListener('click',function(){visit(b);});labels.appendChild(t);return t;});
    function showCard(b){
      if(!b){card.innerHTML='<h3>Our solar system</h3><p>Drag to turn the view.<br>Tap a planet (or its name) to fly to it.</p><p class="sp-note">Sizes and distances are not to scale.</p>';return;}
      card.innerHTML='<h3>'+b.p.name+'</h3><ul>'+b.p.facts.map(function(f){return '<li>'+f+'</li>';}).join('')+'</ul>';
    }
    function visit(b){S.setFocus(b);showCard(b);MT.speak(b.p.say);
      if(b.p.id!=='sun'&&!seen[b.p.id]){seen[b.p.id]=1;var n=Object.keys(seen).length;MT.score(n+' / '+total);
        if(n===total)MT.later(function(){MT.done(area,d.doneText||'You visited every planet!',ctx.again);},4000);}}
    stage.onTap=function(nx,ny){var b=S.pickAt(nx,ny);if(b)visit(b);};
    btn('☀ Whole system',function(){S.setFocus(null);showCard(null);});
    btn('🐢 Slower',function(){S.speed=Math.max(.25,S.speed/2);});
    btn('🐇 Faster',function(){S.speed=Math.min(16,S.speed*2);});
    btn('⏸ Pause',function(b){S.paused=!S.paused;b.innerHTML=S.paused?'▶ Play':'⏸ Pause';});
    holoBtn('solar');
    showCard(null);
    stage.tick=function(dt){S.update(dt);
      S.bodies.forEach(function(b,i){var w=S.worldPos(b),p=stage.project(w),t=tags[i];if(p.behind){t.style.display='none';return;}
        var low=stage.project(w.clone().addScaledVector(stage.camera.up,-b.p.r*(b.p.ring?1.6:1.15)));
        t.style.display='';t.style.transform='translate('+(p.x-t.offsetWidth/2)+'px,'+(Math.max(p.y+14,low.y+6))+'px)';t.classList.toggle('on',S.focus===b);});};
  }

  // ---------------- satellite orbit ----------------
  function satellite(SP){
    var S=SP.buildSatellite(stage,{});var goals=d.goals||[],gi=0,timer=null;
    MT.score('0 / '+goals.length);
    card.classList.add('sp-side');
    card.innerHTML='<div class="sp-goal"></div><div class="sp-read"><div><span>Height above Earth</span><b class="r-h"></b></div><div><span>Speed</span><b class="r-v"></b></div><div><span>One trip around Earth</span><b class="r-t"></b></div></div>'+
      '<div class="sp-sl"><button class="mt-btn alt minus">−</button><div class="trk"><div class="rail"></div><div class="knob"></div></div><button class="mt-btn alt plus">+</button></div>'+
      '<p class="sp-note">Earth is drawn to scale; the satellite is drawn much bigger. 1 second here = 1 hour in space. The yellow dot is over India.</p>';
    var gEl=card.querySelector('.sp-goal'),trk=card.querySelector('.trk'),knob=card.querySelector('.knob');
    var MIN=Math.log(300),MAX=Math.log(40000);
    function fmtT(s){var h=s/3600;if(h<2)return Math.round(s/60)+' minutes';return (Math.round(h*10)/10)+' hours';}
    function fmtH(h){return Math.round(h).toLocaleString('en-IN')+' km';}
    function showGoal(){if(gi<goals.length)gEl.innerHTML='<b>Challenge '+(gi+1)+' of '+goals.length+':</b> '+goals[gi].text;else gEl.innerHTML='<b>All challenges done!</b> Keep exploring.';}
    function met(g,o){if(g.height)return Math.abs(S.h-g.height[0])<=g.height[1];if(g.hours)return Math.abs(o.T/3600-g.hours[0])<=g.hours[1];return false;}
    function set(h,silent){h=Math.max(300,Math.min(40000,h));S.setHeight(h);var o=S.info();
      knob.style.left=((Math.log(h)-MIN)/(MAX-MIN)*100)+'%';
      card.querySelector('.r-h').textContent=fmtH(h);card.querySelector('.r-v').textContent=(Math.round(o.v*100)/100)+' km/s';card.querySelector('.r-t').textContent=fmtT(o.T);
      clearTimeout(timer);if(gi<goals.length&&met(goals[gi],o))timer=setTimeout(function(){if(!met(goals[gi],S.info()))return;MT.good('Challenge solved!',goals[gi].say||'');gi++;MT.score(gi+' / '+goals.length);showGoal();
        if(gi>=goals.length)MT.later(function(){MT.done(area,d.doneText||'You are a space engineer!',ctx.again);},2500);},900);}
    function fromX(x){var r=trk.getBoundingClientRect();var t=Math.max(0,Math.min(1,(x-r.left)/r.width));set(Math.exp(MIN+t*(MAX-MIN)));}
    var active=false;trk.addEventListener('pointerdown',function(e){active=true;fromX(e.clientX);});
    var mv=function(e){if(active)fromX(e.clientX);},up=function(){active=false;};document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up);
    offs.push(function(){document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up);clearTimeout(timer);});
    function step(dir){var h=S.h,st=h<2000?50:h<10000?200:h<30000?200:50;set(Math.round((h+dir*st)/st)*st);}
    card.querySelector('.minus').addEventListener('click',function(){MT.sfx.tap();step(-1);});
    card.querySelector('.plus').addEventListener('click',function(){MT.sfx.tap();step(1);});
    btn('🔭 Zoom out',function(){stage.view.want={target:new stage.THREE.Vector3(),dist:Math.min(140,stage.view.dist*1.4)};});
    btn('🔍 Zoom in',function(){stage.view.want={target:new stage.THREE.Vector3(),dist:Math.max(9,stage.view.dist/1.4)};});
    holoBtn('satellite');
    set(d.start||2000);showGoal();
    stage.tick=function(dt){S.update(dt);};
  }
  return function(){dead=true;offs.forEach(function(f){f();});if(stage)stage.dispose();};
}
