// T6 Simulation with sliders: change values, watch the result, solve small challenges.
// d.model picks the picture: "circuit" | "line" | "market" | "formula". Sliders and challenges are data.
// All of these are optional data too, so a new topic needs no new code:
//   d.formulas  {"Rs":"R1 + R2", ...}       outputs worked out from the sliders (MT formulas, see expr.js)
//   d.picture   "<svg …{R1*10}…>"           with model "formula": an SVG whose {…} parts follow the sliders
//   d.display   [{id,label,unit,max,dp}]     with model "formula" and no picture: big read-outs with bars
//   d.solution  {title, lines:["I = V ÷ R","I = {V} ÷ {R}","I = {V/R:2} A"]}   live worked solution
//   d.predict   [{text, set:{V:6}, then:{V:12}, options:[…], answer:0, explain}]  predict, then watch it happen
MT.templates.simulate=function(area,d,ctx){
  var offs=[];
  var vals={};d.sliders.forEach(function(s){vals[s.id]=s.value;});
  var X=window.MTExpr;
  var MODELS={
    circuit:{calc:function(v){return {I:v.V/v.R};},
      draw:function(v,o){var g=Math.min(1,o.I/3);var col='rgb(255,'+Math.round(200+55*g)+','+Math.round(80+100*(1-g))+')';
        return '<svg viewBox="0 0 400 260"><rect x="40" y="40" width="320" height="180" rx="10" fill="none" stroke="#3D0E37" stroke-width="6"/>'+
        '<rect x="20" y="100" width="40" height="60" fill="#FFF8EE" stroke="#3D0E37" stroke-width="4"/><text x="40" y="136" font-size="18" text-anchor="middle" fill="#3D0E37">'+v.V+'V</text>'+
        '<rect x="150" y="26" width="100" height="28" fill="#E96E24" stroke="#3D0E37" stroke-width="4"/><text x="200" y="20" font-size="16" text-anchor="middle" fill="#3D0E37">'+v.R+' Ω</text>'+
        '<circle cx="360" cy="130" r="'+(30+30*g)+'" fill="'+col+'" opacity="'+(0.25+0.6*g)+'"/><circle cx="360" cy="130" r="24" fill="#FBD064" stroke="#3D0E37" stroke-width="4"/>'+
        '<text x="200" y="135" font-size="34" font-weight="800" text-anchor="middle" fill="#631654">I = '+o.I.toFixed(2)+' A</text>'+
        '<text x="200" y="175" font-size="20" text-anchor="middle" fill="#6E6170">I = V ÷ R = '+v.V+' ÷ '+v.R+'</text></svg>';}},
    line:{calc:function(v){return {};},
      draw:function(v,o,goal){var S=20,X=function(x){return 200+x*S;},Y=function(y){return 200-y*S;};var s='<svg viewBox="0 0 400 400">';
        for(var i=-10;i<=10;i++){s+='<line x1="'+X(i)+'" y1="0" x2="'+X(i)+'" y2="400" stroke="'+(i?'#EADBD0':'#3D0E37')+'" stroke-width="'+(i?1:2.5)+'"/><line x1="0" y1="'+Y(i)+'" x2="400" y2="'+Y(i)+'" stroke="'+(i?'#EADBD0':'#3D0E37')+'" stroke-width="'+(i?1:2.5)+'"/>';}
        if(goal&&goal.line){var gm=goal.line[0],gc=goal.line[1];s+='<line x1="'+X(-10)+'" y1="'+Y(gm*-10+gc)+'" x2="'+X(10)+'" y2="'+Y(gm*10+gc)+'" stroke="#2E7D46" stroke-width="5" stroke-dasharray="12 8"/>';}
        s+='<line x1="'+X(-10)+'" y1="'+Y(v.m*-10+v.c)+'" x2="'+X(10)+'" y2="'+Y(v.m*10+v.c)+'" stroke="#CC3054" stroke-width="6"/>';
        s+='<rect x="8" y="8" width="210" height="44" rx="8" fill="#fff" opacity=".9"/><text x="18" y="40" font-size="26" font-weight="800" fill="#631654">y = '+v.m+'x '+(v.c<0?'− '+(-v.c):'+ '+v.c)+'</text>';
        return s+'</svg>';}},
    market:{calc:function(v){return {D:100-5*v.p,S:10+4*v.p};},
      draw:function(v,o){var H=function(q){return q*2.2;};var eq=Math.abs(o.D-o.S)<=1;
        return '<svg viewBox="0 0 400 300"><line x1="40" y1="260" x2="380" y2="260" stroke="#3D0E37" stroke-width="3"/>'+
        '<rect x="90" y="'+(260-H(o.D))+'" width="80" height="'+H(o.D)+'" fill="#CC3054"/><text x="130" y="'+(250-H(o.D))+'" font-size="22" font-weight="800" text-anchor="middle" fill="#CC3054">'+o.D+'</text><text x="130" y="285" font-size="18" text-anchor="middle">Buyers want</text>'+
        '<rect x="230" y="'+(260-H(o.S))+'" width="80" height="'+H(o.S)+'" fill="#E96E24"/><text x="270" y="'+(250-H(o.S))+'" font-size="22" font-weight="800" text-anchor="middle" fill="#E96E24">'+o.S+'</text><text x="270" y="285" font-size="18" text-anchor="middle">Sellers offer</text>'+
        (eq?'<text x="200" y="40" font-size="26" font-weight="800" text-anchor="middle" fill="#2E7D46">Balanced! Price ₹'+v.p+'</text>':'<text x="200" y="40" font-size="22" text-anchor="middle" fill="#6E6170">'+(o.D>o.S?'Shortage: buyers want more':'Surplus: unsold items')+'</text>')+'</svg>';}},
    // generic: the picture (or read-outs) comes from the activity file
    formula:{calc:function(){return {};},
      draw:function(v,o){var all=merge(v,o);
        if(d.picture) return X.fill(d.picture,all);
        var rows=(d.display||Object.keys(o).map(function(k){return {id:k,label:k};})),h=70,s='<svg viewBox="0 0 400 '+(rows.length*h+20)+'">';
        rows.forEach(function(r,i){var y=10+i*h,val=all[r.id],w=r.max?Math.max(0,Math.min(1,val/r.max))*370:0;
          s+='<text x="15" y="'+(y+24)+'" font-size="20" font-weight="700" fill="#631654">'+r.label+'</text>'+
             '<text x="385" y="'+(y+26)+'" font-size="26" font-weight="800" text-anchor="end" fill="#3D0E37">'+X.fmt(val,r.dp)+(r.unit?' '+r.unit:'')+'</text>'+
             (r.max?'<rect x="15" y="'+(y+36)+'" width="370" height="16" rx="8" fill="#EADBD0"/><rect x="15" y="'+(y+36)+'" width="'+w+'" height="16" rx="8" fill="'+(r.color||'#E96E24')+'"/>':'');});
        return s+'</svg>';}}
  };
  function merge(a,b){var o={},k;for(k in a)o[k]=a[k];for(k in b)o[k]=b[k];return o;}
  // model outputs, then the activity's own formulas (each may use the sliders and earlier outputs)
  function calc(v){var o=MODELS[d.model].calc(v);if(d.formulas){var all=merge(v,o);Object.keys(d.formulas).forEach(function(k){try{o[k]=all[k]=X.expr(d.formulas[k],all);}catch(e){o[k]=all[k]=NaN;}});}return o;}
  if(!MODELS[d.model]){area.textContent='Unknown simulation model: '+d.model;return;}
  var M=MODELS[d.model],goals=d.goals||[],preds=d.predict||[];
  var wrap=document.createElement('div');wrap.className='sim-wrap';
  var pic=document.createElement('div');pic.className='sim-pic';
  var side=document.createElement('div');side.className='sim-side';
  var goalEl=document.createElement('div');goalEl.className='sim-goal';
  var slWrap=document.createElement('div');slWrap.className='sim-sliders';
  var left=document.createElement('div');left.className='sim-left';left.appendChild(pic);
  wrap.appendChild(left);wrap.appendChild(side);area.appendChild(wrap);side.appendChild(goalEl);side.appendChild(slWrap);
  var solEl=null,solPrev=[];
  if(d.solution){solEl=document.createElement('div');solEl.className='sim-sol';left.appendChild(solEl);}
  // phase: "predict" (sliders locked, the app moves them) → "goals" (challenges) → "free"
  var phase=preds.length?'predict':(goals.length?'goals':'free');
  var gi=0,pi=0,goalTimer=null,anim=null,setters={};
  function all(){return merge(vals,calc(vals));}
  function render(){var o=calc(vals);pic.innerHTML=M.draw(vals,o,phase==='goals'?goals[gi]:null);var sv=pic.querySelector('svg');if(sv){sv.style.width='100%';sv.style.height='100%';}
    renderSolution();if(phase==='goals')checkGoal(o);}
  // live worked solution: each line is re-filled with the current numbers; changed lines flash
  function renderSolution(){if(!solEl)return;var a=all(),s=d.solution;
    var lines=(s.lines||[]).map(function(l){return X.fill(l,a);});
    solEl.innerHTML='<div class="sim-sol-t">'+(s.title||'Worked solution')+'</div>'+lines.map(function(l,i){
      return '<div class="sim-sol-l'+(i===lines.length-1?' last':'')+(solPrev.length&&solPrev[i]!==l?' chg':'')+'">'+l+'</div>';}).join('')+
      (s.note?'<div class="sim-sol-n">'+X.fill(s.note,a)+'</div>':'');
    solPrev=lines;}
  function met(g,o){var ok=true;(g.inputs||[]).forEach(function(c){if(Math.abs(vals[c.id]-c.equals)>(c.tol||1e-9))ok=false;});
    (g.outputs||[]).forEach(function(c){if(Math.abs(o[c.id]-c.equals)>(c.tol||1e-9))ok=false;});return ok;}
  function showGoal(){if(gi<goals.length){goalEl.className='sim-goal';goalEl.innerHTML='Challenge '+(gi+1)+' of '+goals.length+':<br>'+goals[gi].text;MT.score(gi+' / '+goals.length);}}
  function finish(){MT.later(function(){MT.done(area,d.doneText||'All challenges solved!',ctx.again);},1200);}
  function checkGoal(o){clearTimeout(goalTimer);if(gi>=goals.length)return;var g=goals[gi];
    if(met(g,o)) goalTimer=setTimeout(function(){if(!met(g,calc(vals)))return;MT.good('Challenge solved!',g.say||'');gi++;
      if(gi>=goals.length){MT.score(goals.length+' / '+goals.length);phase='free';finish();}else{showGoal();render();}},700);}
  function lock(on){slWrap.classList.toggle('sim-locked',!!on);}
  // move sliders smoothly to new values (used when revealing a prediction)
  function animateTo(target,ms,then){cancelAnimationFrame(anim);var from=merge(vals,{}),t0=performance.now();
    (function step(now){var k=Math.min(1,(now-t0)/ms),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
      Object.keys(target).forEach(function(id){if(setters[id])setters[id](from[id]+(target[id]-from[id])*e,true);});
      if(k<1)anim=requestAnimationFrame(step);else{Object.keys(target).forEach(function(id){if(setters[id])setters[id](target[id]);});then&&then();}})(t0);}
  function showPredict(){var p=preds[pi];lock(true);MT.score('Predict '+(pi+1)+' / '+preds.length);
    Object.keys(p.set||{}).forEach(function(id){if(setters[id])setters[id](p.set[id]);});
    goalEl.className='sim-goal sim-pred';
    goalEl.innerHTML='<div class="sim-tag">Predict first</div><div class="sim-q">'+X.fill(p.text,all())+'</div><div class="sim-opts"></div>';
    var box=goalEl.querySelector('.sim-opts'),picked=false;
    p.options.forEach(function(o,i){var b=document.createElement('button');b.className='sim-opt';b.textContent=o;box.appendChild(b);
      b.addEventListener('click',function(){if(picked)return;picked=true;MT.sfx.tap();b.classList.add('picked');
        [].forEach.call(box.children,function(x){x.disabled=true;});
        var ok=i===p.answer;var msg=document.createElement('div');msg.className='sim-q';msg.textContent='Now watch…';goalEl.appendChild(msg);
        MT.later(function(){animateTo(p.then||{},1400,function(){
          box.children[p.answer].classList.add('right');if(!ok)b.classList.add('wrong');
          if(ok)MT.good('Your prediction was right!');else MT.bad('Not quite. Look at what happened.');
          msg.className='sim-explain';msg.innerHTML=X.fill(p.explain||'',all());if(p.explain)MT.speak(msg.textContent);
          var nx=document.createElement('button');nx.className='mt-btn sim-next';nx.textContent=pi+1<preds.length?'Next prediction →':(goals.length?'Start the challenges →':'Explore freely →');
          nx.addEventListener('click',function(){pi++;if(pi<preds.length)showPredict();else startGoals();});goalEl.appendChild(nx);nx.scrollIntoView({block:'nearest'});});},500);});});}
  function startGoals(){lock(false);if(goals.length){phase='goals';gi=0;showGoal();render();}
    else{phase='free';goalEl.className='sim-goal';goalEl.innerHTML=d.freeText||'Move the sliders and watch the worked solution change.';MT.score('');if(preds.length&&!d.noDone)finish();}}
  d.sliders.forEach(function(s){
    var box=document.createElement('div');box.className='sim-sl';
    box.innerHTML='<div class="sim-sl-h"><span>'+s.label+'</span><span class="v"></span></div>'+
      '<div class="sim-sl-r"><button class="mt-btn alt minus">−</button>'+
      '<div class="trk"><div class="rail"></div><div class="knob"></div></div>'+
      '<button class="mt-btn alt plus">+</button></div>';
    slWrap.appendChild(box);
    var trk=box.querySelector('.trk'),knob=box.querySelector('.knob'),vEl=box.querySelector('.v');
    // raw=true while animating: show in-between values without snapping to the step
    function set(v,raw){v=Math.min(s.max,Math.max(s.min,v));if(!raw){v=Math.round((v-s.min)/s.step)*s.step+s.min;v=+v.toFixed(4);}
      var same=v===vals[s.id]&&knob.style.left;vals[s.id]=v;
      knob.style.left=((v-s.min)/(s.max-s.min)*100)+'%';vEl.textContent=X.fmt(v,raw?1:undefined)+(s.unit?' '+s.unit:'');if(!same)render();}
    setters[s.id]=set;
    function fromX(x){var r=trk.getBoundingClientRect();set(s.min+(x-r.left)/r.width*(s.max-s.min));}
    var active=false;
    trk.addEventListener('pointerdown',function(e){if(phase==='predict')return;active=true;fromX(e.clientX);});
    var mv=function(e){if(active)fromX(e.clientX);},up=function(){active=false;};
    document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up);
    offs.push(function(){document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up);});
    box.querySelector('.minus').addEventListener('click',function(){if(phase==='predict')return;set(vals[s.id]-s.step);MT.sfx.tap();});
    box.querySelector('.plus').addEventListener('click',function(){if(phase==='predict')return;set(vals[s.id]+s.step);MT.sfx.tap();});
    knob.style.left='';set(s.value);
  });
  if(phase==='predict')showPredict();else startGoals();
  render();
  return function(){clearTimeout(goalTimer);cancelAnimationFrame(anim);offs.forEach(function(f){f();});};
};
