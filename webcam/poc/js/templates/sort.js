// T3 Sort into groups: move each card into the right bin.
MT.templates.sort=function(area,d,ctx){
  var total=d.items.length,done=0;
  var wrap=document.createElement('div');wrap.style.cssText='display:flex;flex-direction:column;height:100%;gap:18px;';
  var pool=document.createElement('div');pool.style.cssText='display:flex;flex-wrap:wrap;justify-content:center;gap:14px;min-height:150px;';
  var bins=document.createElement('div');bins.style.cssText='display:flex;gap:22px;flex:1;';
  wrap.appendChild(pool);wrap.appendChild(bins);area.appendChild(wrap);
  d.bins.forEach(function(b){var e=document.createElement('div');e.className='mt-drop';e.dataset.drop=b.id;
    e.style.cssText='flex:1;display:flex;flex-direction:column;align-items:center;padding:12px;gap:10px;background:rgba(255,255,255,.6);';
    e.innerHTML='<div style="font-size:28px;font-weight:800;color:#631654">'+b.label+'</div><div class="in" style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center"></div>';bins.appendChild(e);});
  MT.shuffle(d.items).forEach(function(it){var c=document.createElement('div');c.className='mt-card';c.dataset.item=it.bin;
    c.style.cssText='width:150px;height:140px;';c.innerHTML=MT.face(it);c._it=it;pool.appendChild(c);});
  MT.score('0 / '+total);
  var dr=MTDrag(area,function(it,t){
    if(it.dataset.item===t.dataset.drop){
      it.classList.add('correct','placed');it.style.width='110px';it.style.height='100px';it.style.transform='scale(.9)';
      t.querySelector('.in').appendChild(it);done++;MT.score(done+' / '+total);MT.good('Yes!',it._it.say||'');
      if(done===total) MT.later(function(){MT.done(area,d.doneText||'All sorted!',ctx.again);},900);
    } else {it.classList.add('wrong');setTimeout(function(){it.classList.remove('wrong');},450);MT.bad('Not that group');}
  });
  return dr.destroy;
};
