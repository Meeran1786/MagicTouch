// MagicTouch engine: loads activities (data), builds the class menu, runs the right template.
(function(){
  var menu=document.getElementById('mt-menu'),stage=document.getElementById('mt-stage'),area=document.getElementById('mt-area');
  var instr=document.getElementById('mt-instr'),crumb=document.getElementById('mt-crumb'),back=document.getElementById('mt-back');
  var acts=[],cleanup=null;
  var SUBJ={maths:'Maths',science:'Science',social:'Social',evs:'EVS'};
  // Demo mode (open /poc/?demo): only activities the reviewer has marked "approved" are listed.
  // Normal mode lists everything and marks the rest with a "Draft" badge.
  var DEMO=/[?&]demo\b/.test(location.search);
  function showMenu(){
    MT.clearLater();if(cleanup){try{cleanup();}catch(e){} cleanup=null;}
    area.innerHTML='';stage.classList.add('hidden');menu.classList.remove('hidden');back.classList.add('hidden');crumb.textContent='';MT.score('');
  }
  function run(a){
    MT.clearLater();if(cleanup){try{cleanup();}catch(e){} cleanup=null;}
    area.innerHTML='';menu.classList.add('hidden');stage.classList.remove('hidden');back.classList.remove('hidden');
    crumb.textContent='— Class '+a.grade+' · '+a.title; instr.textContent=a.instruction||''; MT.score('');
    var tpl=MT.templates[a.template];
    if(!tpl){area.textContent='Unknown template: '+a.template;return;}
    cleanup=tpl(area,a,{again:function(){run(a);}})||null;
    if(a.intro) MT.speak(a.intro);
  }
  function build(){
    menu.innerHTML='';
    function head(txt){var h=document.createElement('div');h.className='mt-sec';h.textContent=txt;menu.appendChild(h);}
    var list=DEMO?acts.filter(function(a){return a.status==='approved';}):acts;
    if(DEMO&&!list.length){menu.innerHTML='<div class="mt-demo-note">Demo mode shows approved activities only, and none are approved yet. Set "status": "approved" in an activity file, or open the page without ?demo.</div>';return;}
    var show=list.filter(function(a){return a.showcase;}),rest=list.filter(function(a){return !a.showcase;});
    if(show.length) head('✨ Showcase');
    show.concat(['--']).concat(rest.sort(function(x,y){return x.grade-y.grade;})).forEach(function(a){
      if(a==='--'){if(show.length)head('Classes 1–12');return;}
      var t=document.createElement('div');t.className='mt-tile'+(a.showcase?' mt-show':'');
      t.innerHTML='<span class="cls subj-'+a.subject+'">Class '+a.grade+' · '+(SUBJ[a.subject]||a.subject)+'</span><div class="ttl">'+a.title+'</div><div class="sub">'+(a.topic||'')+'</div>'+(a.status==='approved'?'':'<span class="mt-draft">Draft</span>');
      t.addEventListener('click',function(){try{audioCtx.resume();}catch(e){} run(a);});
      menu.appendChild(t);
    });
  }
  back.addEventListener('click',showMenu);
  fetch('activities/index.json').then(function(r){return r.json();}).then(function(list){
    return Promise.all(list.map(function(f){return fetch('activities/'+f).then(function(r){return r.json();});}));
  }).then(function(all){acts=all;build();showMenu();})
    .catch(function(e){menu.innerHTML='<div style="font-size:22px">Could not load activities: '+e.message+'<br>Open this through http://localhost:8080/poc/</div>';});
  window.MTEngine={run:function(id){var a=acts.find(function(x){return x.id===id;});if(a)run(a);},list:function(){return acts;},menu:showMenu};
})();
