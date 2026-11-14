// T6 Simulation with sliders: change values, watch the result, solve small challenges.
// d.model picks the picture: "circuit" | "line" | "market". Sliders and challenges are data.
MT.templates.simulate=function(area,d,ctx){
  var offs=[];
  var vals={};d.sliders.forEach(function(s){vals[s.id]=s.value;});
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
        (eq?'<text x="200" y="40" font-size="26" font-weight="800" text-anchor="middle" fill="#2E7D46">Balanced! Price ₹'+v.p+'</text>':'<text x="200" y="40" font-size="22" text-anchor="middle" fill="#6E6170">'+(o.D>o.S?'Shortage: buyers want more':'Surplus: unsold items')+'</text>')+'</svg>';}}
  };
  var M=MODELS[d.model];
  var wrap=document.createElement('div');wrap.style.cssText='display:flex;gap:28px;height:100%;';
  var pic=document.createElement('div');pic.style.cssText='flex:1.4;background:#fff;border-radius:20px;padding:10px;display:flex;align-items:center;justify-content:center;';
  var side=document.createElement('div');side.style.cssText='flex:1;display:flex;flex-direction:column;gap:18px;justify-content:center;';
  var goalEl=document.createElement('div');goalEl.style.cssText='font-size:24px;font-weight:700;color:#3D0E37;background:#FBD064;border-radius:16px;padding:14px 18px;';
  wrap.appendChild(pic);wrap.appendChild(side);area.appendChild(wrap);side.appendChild(goalEl);
  var gi=0,goalTimer=null;
  function render(){var o=M.calc(vals);pic.innerHTML=M.draw(vals,o,d.goals[gi]);var sv=pic.querySelector('svg');sv.style.width='100%';sv.style.height='100%';checkGoal(o);}
  function met(g,o){var ok=true;(g.inputs||[]).forEach(function(c){if(Math.abs(vals[c.id]-c.equals)>(c.tol||1e-9))ok=false;});
    (g.outputs||[]).forEach(function(c){if(Math.abs(o[c.id]-c.equals)>(c.tol||1e-9))ok=false;});return ok;}
  function showGoal(){if(gi<d.goals.length){goalEl.innerHTML='Challenge '+(gi+1)+' of '+d.goals.length+':<br>'+d.goals[gi].text;MT.score(gi+' / '+d.goals.length);}}
  function checkGoal(o){clearTimeout(goalTimer);if(gi>=d.goals.length)return;var g=d.goals[gi];
    if(met(g,o)) goalTimer=setTimeout(function(){if(!met(g,M.calc(vals)))return;MT.good('Challenge solved!',g.say||'');gi++;
      if(gi>=d.goals.length){MT.score(d.goals.length+' / '+d.goals.length);MT.later(function(){MT.done(area,d.doneText||'All challenges solved!',ctx.again);},1200);}else{showGoal();render();}},700);}
  d.sliders.forEach(function(s){
    var box=document.createElement('div');box.style.cssText='background:#fff;border-radius:16px;padding:12px 16px;';
    box.innerHTML='<div style="display:flex;justify-content:space-between;font-size:22px;font-weight:700;color:#631654"><span>'+s.label+'</span><span class="v"></span></div>'+
      '<div style="display:flex;align-items:center;gap:12px;margin-top:8px"><button class="mt-btn alt minus" style="padding:6px 18px">−</button>'+
      '<div class="trk" style="position:relative;flex:1;height:44px;cursor:pointer;touch-action:none"><div style="position:absolute;left:0;right:0;top:18px;height:8px;border-radius:4px;background:#EADBD0"></div><div class="knob" style="position:absolute;top:4px;width:36px;height:36px;margin-left:-18px;border-radius:50%;background:#CC3054;border:4px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.25)"></div></div>'+
      '<button class="mt-btn alt plus" style="padding:6px 18px">+</button></div>';
    side.appendChild(box);
    var trk=box.querySelector('.trk'),knob=box.querySelector('.knob'),vEl=box.querySelector('.v');
    function set(v){v=Math.round(Math.min(s.max,Math.max(s.min,v))/s.step)*s.step;v=+v.toFixed(4);if(v===vals[s.id]&&knob.style.left)return;vals[s.id]=v;
      knob.style.left=((v-s.min)/(s.max-s.min)*100)+'%';vEl.textContent=v+(s.unit?' '+s.unit:'');render();}
    function fromX(x){var r=trk.getBoundingClientRect();set(s.min+(x-r.left)/r.width*(s.max-s.min));}
    var active=false;
    trk.addEventListener('pointerdown',function(e){active=true;fromX(e.clientX);});
    var mv=function(e){if(active)fromX(e.clientX);},up=function(){active=false;};
    document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up);
    offs.push(function(){document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up);});
    box.querySelector('.minus').addEventListener('click',function(){set(vals[s.id]-s.step);MT.sfx.tap();});
    box.querySelector('.plus').addEventListener('click',function(){set(vals[s.id]+s.step);MT.sfx.tap();});
    knob.style.left='';set(s.value);
  });
  showGoal();render();
  return function(){clearTimeout(goalTimer);offs.forEach(function(f){f();});};
};
