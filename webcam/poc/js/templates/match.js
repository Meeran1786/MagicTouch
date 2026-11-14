// T2 Match pairs: move each left card onto its partner on the right (drag, or tap then tap).
MT.templates.match=function(area,d,ctx){
  var n=d.pairs.length,matched=0;
  var wrap=document.createElement('div');wrap.style.cssText='display:flex;justify-content:space-around;height:100%;gap:60px;';
  function col(){var c=document.createElement('div');c.style.cssText='display:flex;flex-direction:column;justify-content:space-around;gap:12px;flex:0 0 30%;';return c;}
  var L=col(),R=col();wrap.appendChild(L);wrap.appendChild(R);area.appendChild(wrap);
  var h='calc((100% - '+(n-1)*12+'px)/'+n+')';
  MT.shuffle(d.pairs.map(function(p,i){return i;})).forEach(function(i){
    var c=document.createElement('div');c.className='mt-card';c.dataset.item=i;c.style.height=h;c.innerHTML=MT.face(d.pairs[i][0]);L.appendChild(c);});
  MT.shuffle(d.pairs.map(function(p,i){return i;})).forEach(function(i){
    var c=document.createElement('div');c.className='mt-card mt-drop';c.dataset.drop=i;c.style.height=h;c.innerHTML=MT.face(d.pairs[i][1]);R.appendChild(c);});
  MT.score('0 / '+n);
  var dr=MTDrag(area,function(it,t){
    if(t.classList.contains('correct')) return;
    if(it.dataset.item===t.dataset.drop){
      it.classList.add('correct','placed');t.classList.add('correct');matched++;MT.score(matched+' / '+n);
      var p=d.pairs[+it.dataset.item];MT.good('Correct!',p[2]||'');
      if(matched===n) MT.later(function(){MT.done(area,d.doneText||'All matched!',ctx.again);},900);
    } else { it.classList.add('wrong');setTimeout(function(){it.classList.remove('wrong');},450);MT.bad('Not a match, try again'); }
  });
  return dr.destroy;
};
