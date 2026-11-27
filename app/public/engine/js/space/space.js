// MagicTouch 3D space scenes (solar system, satellite orbit), shared by the wall template and the hologram page.
// All planet textures except Earth and Moon (NASA photos) are generated here by code.
import * as THREE from 'three';
import {EffectComposer} from '/vendor/three/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from '/vendor/three/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from '/vendor/three/jsm/postprocessing/UnrealBloomPass.js';
import {OutputPass} from '/vendor/three/jsm/postprocessing/OutputPass.js';

const BASE=new URL('../../assets/tex/',import.meta.url).href;

// ---------- noise (seamless around the globe) ----------
function makeNoise(seed){
  const p=new Uint8Array(512);let s=seed||1;
  const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647;};
  const perm=[...Array(256).keys()];for(let i=255;i>0;i--){const j=Math.floor(rnd()*(i+1));[perm[i],perm[j]]=[perm[j],perm[i]];}
  for(let i=0;i<512;i++)p[i]=perm[i&255];
  const g=new Float32Array(256);for(let i=0;i<256;i++)g[i]=rnd()*2-1;
  const fade=t=>t*t*(3-2*t),lerp=(a,b,t)=>a+(b-a)*t;
  const h=(x,y,z)=>g[p[p[p[x&255]+(y&255)]+(z&255)]];
  function n3(x,y,z){const X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z),fx=fade(x-X),fy=fade(y-Y),fz=fade(z-Z);
    return lerp(lerp(lerp(h(X,Y,Z),h(X+1,Y,Z),fx),lerp(h(X,Y+1,Z),h(X+1,Y+1,Z),fx),fy),
                lerp(lerp(h(X,Y,Z+1),h(X+1,Y,Z+1),fx),lerp(h(X,Y+1,Z+1),h(X+1,Y+1,Z+1),fx),fy),fz);}
  return function fbm(x,y,z,oct){let a=0,amp=.5,f=1;for(let o=0;o<(oct||5);o++){a+=amp*n3(x*f,y*f,z*f);f*=2;amp*=.5;}return a;};
}
const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const hex=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
function ramp(stops,t){t=Math.max(0,Math.min(1,t));for(let i=1;i<stops.length;i++){if(t<=stops[i][0]){const a=stops[i-1],b=stops[i];return mix(hex(a[1]),hex(b[1]),(t-a[0])/(b[0]-a[0]||1));}}return hex(stops[stops.length-1][1]);}

// paint an equirectangular texture: fn(lon,lat,x3,y3,z3) -> [r,g,b,a?]
function paint(W,H,fn){
  const c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d');const im=ctx.createImageData(W,H),d=im.data;
  for(let y=0;y<H;y++){const lat=(0.5-(y+.5)/H)*Math.PI,cl=Math.cos(lat),sl=Math.sin(lat);
    for(let x=0;x<W;x++){const lon=(x+.5)/W*Math.PI*2,X=cl*Math.cos(lon),Z=cl*Math.sin(lon);
      const col=fn(lon,lat,X,sl,Z),i=(y*W+x)*4;d[i]=col[0];d[i+1]=col[1];d[i+2]=col[2];d[i+3]=col.length>3?col[3]:255;}}
  ctx.putImageData(im,0,0);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
const TEX={
  sun:()=>{const n=makeNoise(7);return paint(512,256,(lo,la,x,y,z)=>{const v=n(x*6,y*6,z*6,5)*.5+.5,w=n(x*22,y*22,z*22,3)*.5+.5;return ramp([[0,'#B5300B'],[.45,'#F06A12'],[.7,'#FFB52E'],[1,'#FFF3B0']],v*.75+w*.35);});},
  mercury:()=>{const n=makeNoise(11);return paint(512,256,(lo,la,x,y,z)=>{let v=n(x*4,y*4,z*4,6)*.5+.5;const cr=Math.abs(n(x*14,y*14,z*14,2));v-=cr<.03?.18:0;return ramp([[0,'#4A4542'],[.5,'#8C8580'],[1,'#C9C2BA']],v);});},
  venus:()=>{const n=makeNoise(23);return paint(512,256,(lo,la,x,y,z)=>{const w=n(x*2,y*2,z*2,4);const v=Math.sin(la*9+w*5)*.25+.5+n(x*5,y*5,z*5,4)*.4;return ramp([[0,'#A8743A'],[.5,'#E3BB76'],[1,'#F7E2B0']],v);});},
  mars:()=>{const n=makeNoise(5);return paint(1024,512,(lo,la,x,y,z)=>{const v=n(x*3,y*3,z*3,6)*.5+.5;let c=ramp([[0,'#5A2412'],[.45,'#9A4422'],[.65,'#C1693A'],[1,'#E0A06A']],v);
    const cap=Math.abs(la)>1.25+n(x*8,y*8,z*8,3)*.15;if(cap)c=mix(c,[240,236,230],.85);return c;});},
  jupiter:()=>{const n=makeNoise(3);return paint(1024,512,(lo,la,x,y,z)=>{const w=n(x*3,y*8,z*3,5);let t=Math.sin(la*14+w*2.2)*.5+.5;
    let c=ramp([[0,'#7A4E2D'],[.3,'#C08A5A'],[.55,'#E8D2B0'],[.8,'#D9A877'],[1,'#F5ECDD']],t*.85+n(x*12,y*12,z*12,3)*.25);
    // a big oval storm
    const dl=(lo-4.1),dla=(la+0.38);const e=(dl*dl)/(0.22*0.22)+(dla*dla)/(0.09*0.09);if(e<1)c=mix(c,[178,72,48],Math.min(1,(1-e)*1.6));return c;});},
  saturn:()=>{const n=makeNoise(9);return paint(1024,512,(lo,la,x,y,z)=>{const w=n(x*2,y*6,z*2,4);const t=Math.sin(la*18+w*1.5)*.5+.5;return ramp([[0,'#9C7D4E'],[.5,'#D8C08C'],[1,'#F2E4BE']],t*.8+.15);});},
  uranus:()=>{const n=makeNoise(13);return paint(512,256,(lo,la,x,y,z)=>{const t=Math.sin(la*6+n(x*2,y*2,z*2,3))*.08+.5+n(x*4,y*4,z*4,3)*.1;return ramp([[0,'#5FB3C1'],[.5,'#9ADDE3'],[1,'#D2F3F3']],t);});},
  neptune:()=>{const n=makeNoise(17);return paint(512,256,(lo,la,x,y,z)=>{const t=Math.sin(la*10+n(x*3,y*6,z*3,4)*2)*.18+.5+n(x*6,y*6,z*6,3)*.15;let c=ramp([[0,'#1B2F8F'],[.5,'#2F5BD8'],[1,'#8FB4F5']],t);
    const dl=lo-2.3,dla=la+0.35,e=dl*dl/.04+dla*dla/.012;if(e<1)c=mix(c,[20,25,70],.7*(1-e));return c;});},
  clouds:()=>{const n=makeNoise(29);return paint(1024,512,(lo,la,x,y,z)=>{const w=n(x*1.5,y*1.5,z*1.5,2);let v=n(x*5+w,y*9,z*5,6)-.06;v=Math.max(0,Math.min(1,v*3.2));return [255,255,255,Math.round(v*175)];});},
  ring:()=>{const c=document.createElement('canvas');c.width=512;c.height=8;const ctx=c.getContext('2d');const n=makeNoise(41);
    for(let x=0;x<512;x++){const t=x/511;let a=.55+n(t*40,0.3,0.7,3)*.6;if(t>.56&&t<.62)a*=.08;if(t<.04||t>.97)a*=.2;
      const col=ramp([[0,'#8F7A5C'],[.5,'#E6D3A8'],[1,'#BFA57E']],t);ctx.fillStyle='rgba('+col.map(Math.round).join(',')+','+Math.max(0,Math.min(1,a))+')';ctx.fillRect(x,0,1,8);}
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;},
  glow:(rgb)=>{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');const gr=g.createRadialGradient(128,128,0,128,128,128);
    gr.addColorStop(0,'rgba('+rgb+',1)');gr.addColorStop(.25,'rgba('+rgb+',.55)');gr.addColorStop(1,'rgba('+rgb+',0)');g.fillStyle=gr;g.fillRect(0,0,256,256);return new THREE.CanvasTexture(c);},
  panel:()=>{const c=document.createElement('canvas');c.width=256;c.height=512;const g=c.getContext('2d');g.fillStyle='#C9CED6';g.fillRect(0,0,256,512);
    for(let y=0;y<8;y++)for(let x=0;x<4;x++){const gr=g.createLinearGradient(0,y*64,0,y*64+60);gr.addColorStop(0,'#1F3F9A');gr.addColorStop(1,'#0E1F5C');g.fillStyle=gr;g.fillRect(x*64+3,y*64+3,58,58);
      g.strokeStyle='rgba(140,170,255,.35)';g.beginPath();g.moveTo(x*64+32,y*64+3);g.lineTo(x*64+32,y*64+61);g.moveTo(x*64+3,y*64+32);g.lineTo(x*64+61,y*64+32);g.stroke();}
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;},
  foil:()=>{const n=makeNoise(51);return paint(256,256,(lo,la,x,y,z)=>{const v=n(x*14,y*14,z*14,4)*.5+.5;return ramp([[0,'#7A5410'],[.5,'#D9A520'],[1,'#FFE79A']],v);});}
};
function atmosphere(radius,rgb,power){
  return new THREE.Mesh(new THREE.SphereGeometry(radius,64,32),new THREE.ShaderMaterial({
    uniforms:{c:{value:new THREE.Color(rgb)},p:{value:power||3}},
    vertexShader:'varying vec3 vN;varying vec3 vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
    fragmentShader:'uniform vec3 c;uniform float p;varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.-max(dot(vN,vV),0.),p);gl_FragColor=vec4(c*f*1.6,f);}',
    blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,side:THREE.FrontSide}));
}
function stars(n,r){const g=new THREE.BufferGeometry(),pos=new Float32Array(n*3),col=new Float32Array(n*3);
  for(let i=0;i<n;i++){const u=Math.random()*2-1,t=Math.random()*Math.PI*2,s=Math.sqrt(1-u*u),rr=r*(0.8+Math.random()*.2);
    pos[i*3]=rr*s*Math.cos(t);pos[i*3+1]=rr*u;pos[i*3+2]=rr*s*Math.sin(t);const b=.5+Math.random()*.5,w=Math.random();col[i*3]=b*(w>.8?1:.85);col[i*3+1]=b*.9;col[i*3+2]=b*(w<.2?.8:1);}
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));
  return new THREE.Points(g,new THREE.PointsMaterial({size:2.2,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.85,depthWrite:false,map:TEX.glow('255,255,255'),alphaTest:.02}));}
function loadTex(name){const t=new THREE.TextureLoader().load(BASE+name);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}

// ---------- stage: renderer + camera + bloom + orbit-style camera control ----------
export function createStage(host,opts={}){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:!!opts.record});
  renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));renderer.setClearColor(0x000000,1);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  host.appendChild(renderer.domElement);renderer.domElement.style.cssText='display:block;width:100%;height:100%;touch-action:none;';
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,1,0.05,4000);
  const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(256,256),opts.bloom||0.9,0.6,0.72);composer.addPass(bloom);composer.addPass(new OutputPass());
  const view={target:new THREE.Vector3(),theta:0.6,phi:1.15,dist:80,want:null,auto:opts.autoRotate||0};
  function resize(){const w=host.clientWidth||1,h=host.clientHeight||1;renderer.setSize(w,h,false);composer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
  resize();const ro=new ResizeObserver(resize);ro.observe(host);
  let raf=0,last=performance.now(),tick=null,alive=true;
  function frame(now){if(!alive)return;const dt=Math.min(.05,(now-last)/1000);last=now;
    if(view.want){const k=1-Math.pow(.02,dt);view.target.lerp(view.want.target,k);view.dist+=(view.want.dist-view.dist)*k;}
    view.theta+=view.auto*dt;
    const sp=Math.sin(view.phi);camera.position.set(view.target.x+view.dist*sp*Math.sin(view.theta),view.target.y+view.dist*Math.cos(view.phi),view.target.z+view.dist*sp*Math.cos(view.theta));
    camera.lookAt(view.target);if(tick)tick(dt,now);composer.render();raf=requestAnimationFrame(frame);}
  raf=requestAnimationFrame(frame);
  // drag to turn the view, tap to pick
  const el=renderer.domElement;let drag=null;
  el.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,t:view.theta,p:view.phi,moved:false};});
  const mv=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>12)drag.moved=true;
    if(drag.moved){view.theta=drag.t-dx*0.006;view.phi=Math.max(0.25,Math.min(2.9,drag.p-dy*0.005));}};
  const up=e=>{if(!drag)return;const d=drag;drag=null;if(!d.moved&&stage.onTap){const r=el.getBoundingClientRect();stage.onTap((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1,e);}};
  document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up);
  const stage={THREE,renderer,scene,camera,view,bloom,el,onTap:null,
    set tick(f){tick=f;},
    pick(nx,ny,objs){const rc=new THREE.Raycaster();rc.setFromCamera(new THREE.Vector2(nx,ny),camera);const h=rc.intersectObjects(objs,false);return h.length?h[0].object:null;},
    project(v){const p=v.clone().project(camera);const r=el.getBoundingClientRect();return {x:(p.x*.5+.5)*r.width,y:(-p.y*.5+.5)*r.height,behind:p.z>1};},
    dispose(){alive=false;cancelAnimationFrame(raf);ro.disconnect();document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up);
      scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){[].concat(o.material).forEach(m=>{for(const k in m){if(m[k]&&m[k].isTexture)m[k].dispose();}m.dispose();});}});
      composer.dispose&&composer.dispose();renderer.dispose();renderer.forceContextLoss&&renderer.forceContextLoss();el.remove();}};
  return stage;
}

// ---------- the solar system ----------
export const PLANETS=[
  {id:'sun',name:'The Sun',r:6,dist:0,year:0,spin:25,tex:'sun',
   facts:['A star: a giant ball of very hot gas','About 109 Earths would fit across it','Its light takes about 8 minutes to reach Earth'],say:'The Sun is a star. Its light takes about eight minutes to reach us.'},
  {id:'mercury',name:'Mercury',r:.5,dist:11,year:.241,spin:58.6,tex:'mercury',
   facts:['Closest planet to the Sun','One year = 88 Earth days','No moons; no air to hold heat, so nights are freezing'],say:'Mercury is the closest planet to the Sun. Its year is just eighty eight days.'},
  {id:'venus',name:'Venus',r:.95,dist:15,year:.615,spin:-243,tex:'venus',
   facts:['Hottest planet: thick clouds trap the heat','Spins backwards, very slowly','One year = 225 Earth days'],say:'Venus is the hottest planet, because its thick clouds trap the heat.'},
  {id:'earth',name:'Earth',r:1,dist:20,year:1,spin:1,tex:'earth',
   facts:['Our home: the only planet known to have life','About 70% of its surface is water','One year = 365 days; one day = 24 hours'],say:'Earth is our home, the only planet we know with life.'},
  {id:'mars',name:'Mars',r:.62,dist:25,year:1.88,spin:1.03,tex:'mars',
   facts:['The red planet: its dust is rich in iron oxide (rust)','Has the tallest volcano in the solar system','Two small moons'],say:'Mars is called the red planet because its dust is rusty.'},
  {id:'jupiter',name:'Jupiter',r:3,dist:35,year:11.86,spin:.41,tex:'jupiter',
   facts:['Biggest planet: a giant ball of gas','Its red spot is a storm bigger than Earth','One year = about 12 Earth years'],say:'Jupiter is the biggest planet. Its red spot is a storm bigger than Earth.'},
  {id:'saturn',name:'Saturn',r:2.5,dist:46,year:29.46,spin:.44,tex:'saturn',ring:true,
   facts:['Famous for its rings of ice and rock','So light it would float on water, if a bath were big enough','One year = about 29 Earth years'],say:'Saturn has beautiful rings made of ice and rock.'},
  {id:'uranus',name:'Uranus',r:1.6,dist:56,year:84,spin:-.72,tex:'uranus',tilt:1.71,
   facts:['An ice giant that spins on its side','One year = 84 Earth years','Very cold and windy'],say:'Uranus spins on its side as it goes round the Sun.'},
  {id:'neptune',name:'Neptune',r:1.55,dist:64,year:164.8,spin:.67,tex:'neptune',
   facts:['Farthest planet from the Sun','Strongest winds in the solar system','One year = about 165 Earth years'],say:'Neptune is the farthest planet, with the strongest winds.'}
];
export function buildSolar(stage,opts={}){
  const {scene}=stage;const root=new THREE.Group();scene.add(root);
  root.add(stars(4000,1200));
  scene.add(new THREE.AmbientLight(0xffffff,opts.holo?.35:.06));
  const light=new THREE.PointLight(0xfff2dd,3.2,0,0);scene.add(light);
  const bodies=[];
  PLANETS.forEach((p,i)=>{
    const pivot=new THREE.Group();root.add(pivot);const holder=new THREE.Group();holder.position.x=p.dist;pivot.add(holder);
    pivot.rotation.y=i*1.7;
    let mat;
    if(p.id==='sun') mat=new THREE.MeshBasicMaterial({map:TEX.sun(),color:0xffffff});
    else if(p.id==='earth') mat=new THREE.MeshStandardMaterial({map:loadTex('earth.jpg'),roughness:.85,metalness:0});
    else mat=new THREE.MeshStandardMaterial({map:TEX[p.tex](),roughness:.95,metalness:0});
    const m=new THREE.Mesh(new THREE.SphereGeometry(p.r,64,32),mat);m.userData.planet=p;
    const tiltG=new THREE.Group();tiltG.rotation.z=p.tilt||0.41*(p.id==='earth'?1:0.5);if(p.id==='sun')tiltG.rotation.z=0;tiltG.add(m);holder.add(tiltG);
    if(p.id==='sun'){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:TEX.glow('255,170,60'),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));s.scale.set(19,19,1);s.material.opacity=.75;holder.add(s);}
    if(p.id==='earth'){const cl=new THREE.Mesh(new THREE.SphereGeometry(p.r*1.015,64,32),new THREE.MeshStandardMaterial({map:TEX.clouds(),transparent:true,depthWrite:false}));tiltG.add(cl);m.userData.clouds=cl;
      holder.add(atmosphere(p.r*1.06,0x4FA3FF,3.2));
      const moonPivot=new THREE.Group();holder.add(moonPivot);const moon=new THREE.Mesh(new THREE.SphereGeometry(.27,32,16),new THREE.MeshStandardMaterial({map:loadTex('moon.jpg'),roughness:1}));moon.position.x=2.2;moonPivot.add(moon);m.userData.moon=moonPivot;}
    if(p.id==='venus') holder.add(atmosphere(p.r*1.05,0xFFD9A0,3));
    if(p.id==='neptune'||p.id==='uranus') holder.add(atmosphere(p.r*1.05,p.id==='neptune'?0x5C8DFF:0x9AF0F0,3));
    if(p.ring){const g=new THREE.RingGeometry(p.r*1.3,p.r*2.3,128,1);const pos=g.attributes.position,uv=g.attributes.uv,v=new THREE.Vector3();
      for(let k=0;k<pos.count;k++){v.fromBufferAttribute(pos,k);uv.setXY(k,(v.length()-p.r*1.3)/(p.r*1.0),.5);}
      const ring=new THREE.Mesh(g,new THREE.MeshStandardMaterial({map:TEX.ring(),transparent:true,side:THREE.DoubleSide,depthWrite:false,roughness:1}));ring.rotation.x=-Math.PI/2;tiltG.rotation.z=.47;tiltG.add(ring);}
    if(p.dist>0){const pts=[];for(let k=0;k<=256;k++){const a=k/256*Math.PI*2;pts.push(new THREE.Vector3(Math.cos(a)*p.dist,0,Math.sin(a)*p.dist));}
      root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x8a6fb0,transparent:true,opacity:opts.holo?.25:.35})));}
    // bigger invisible ball, so small planets are easy to hit with a pen
    const hit=new THREE.Mesh(new THREE.SphereGeometry(Math.max(p.r*1.4,1.6),12,8),new THREE.MeshBasicMaterial({visible:false}));hit.userData.planet=p;holder.add(hit);
    bodies.push({p,pivot,holder,mesh:m,hit});
  });
  const S={root,bodies,speed:1,paused:false,focus:null,
    update(dt){const yrs=(S.paused?0:dt*S.speed)/10; // 10 seconds = one Earth year at speed 1
      bodies.forEach(b=>{if(b.p.year)b.pivot.rotation.y+=yrs*Math.PI*2/b.p.year;
        if(!S.paused)b.mesh.rotation.y+=dt*S.speed*(b.p.id==='sun'?.05:Math.sign(b.p.spin)*Math.min(3,1.2/Math.abs(b.p.spin)));
        if(b.mesh.userData.clouds)b.mesh.userData.clouds.rotation.y+=dt*.02;if(b.mesh.userData.moon&&!S.paused)b.mesh.userData.moon.rotation.y+=yrs*Math.PI*2*13.37;});
      if(S.focus){const w=new THREE.Vector3();S.focus.holder.getWorldPosition(w);stage.view.want={target:w,dist:Math.max(4.5,S.focus.p.r*(S.focus.p.ring?6:5))};}},
    worldPos(b){const w=new THREE.Vector3();b.holder.getWorldPosition(w);return w;},
    pickAt(nx,ny){const o=stage.pick(nx,ny,bodies.map(b=>b.hit));return o?bodies.find(b=>b.hit===o):null;},
    setFocus(b){S.focus=b;if(!b)stage.view.want={target:new THREE.Vector3(),dist:opts.overview||95};}
  };
  stage.view.dist=opts.overview||95;stage.view.phi=1.12;
  return S;
}

// ---------- a satellite going round Earth (real physics, Earth to scale) ----------
export const GM=398600.4418,RE=6371; // km^3/s^2, km
export function orbit(hKm){const r=RE+hKm,v=Math.sqrt(GM/r),T=2*Math.PI*r/v;return {r,v,T};}
function satelliteModel(){
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(1,1.1,1),new THREE.MeshStandardMaterial({map:TEX.foil(),metalness:.75,roughness:.35}));g.add(body);
  const pmat=new THREE.MeshStandardMaterial({map:TEX.panel(),metalness:.4,roughness:.45,side:THREE.DoubleSide});
  [-1,1].forEach(s=>{const arm=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.7,8),new THREE.MeshStandardMaterial({color:0xcccccc,metalness:.8,roughness:.3}));arm.rotation.z=Math.PI/2;arm.position.x=s*.85;g.add(arm);
    const pnl=new THREE.Mesh(new THREE.BoxGeometry(2.6,.03,1),pmat);pnl.position.x=s*2.5;g.add(pnl);});
  const dish=new THREE.Mesh(new THREE.LatheGeometry([...Array(12)].map((_,i)=>new THREE.Vector2(i/11*.55,(i/11)*(i/11)*.3)),32),new THREE.MeshStandardMaterial({color:0xf2f2f2,metalness:.3,roughness:.4,side:THREE.DoubleSide}));
  dish.rotation.x=Math.PI;dish.position.y=-.75;g.add(dish);
  const ant=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,.6,6),new THREE.MeshStandardMaterial({color:0xdddddd}));ant.position.y=.85;g.add(ant);
  const tip=new THREE.Mesh(new THREE.SphereGeometry(.06,8,8),new THREE.MeshBasicMaterial({color:0xff5533}));tip.position.y=1.15;g.add(tip);
  return g;
}
export function buildSatellite(stage,opts={}){
  const {scene}=stage;const K=1/1000; // 1 unit = 1000 km, Earth to scale
  scene.add(stars(4000,1200));scene.add(new THREE.AmbientLight(0xffffff,opts.holo?.3:.07));
  const sun=new THREE.DirectionalLight(0xffffff,2.8);sun.position.set(-25,18,60);scene.add(sun);
  const earthG=new THREE.Group();earthG.rotation.z=0;scene.add(earthG); // equatorial orbit, so no tilt shown
  const earth=new THREE.Mesh(new THREE.SphereGeometry(RE*K,96,48),new THREE.MeshStandardMaterial({map:loadTex('earth.jpg'),roughness:.85}));earthG.add(earth);
  const clouds=new THREE.Mesh(new THREE.SphereGeometry(RE*K*1.012,96,48),new THREE.MeshStandardMaterial({map:TEX.clouds(),transparent:true,depthWrite:false}));earthG.add(clouds);
  scene.add(atmosphere(RE*K*1.05,0x4FA3FF,3));
  // a marker over India (about 78°E on the equator band the satellite passes over)
  const lon=78*Math.PI/180,mk=new THREE.Mesh(new THREE.SphereGeometry(.13,16,8),new THREE.MeshBasicMaterial({color:0xFFD34D}));
  const u=0.5+lon/(Math.PI*2); // texture u for 78°E (u=0.5 is 0°)
  const ang=u*Math.PI*2; // three.js sphere: x=-cos(phi)*sin(theta), z=sin(phi)*sin(theta), with phi=u*2PI
  mk.position.set(-Math.cos(ang)*RE*K*1.01,0,Math.sin(ang)*RE*K*1.01);earth.add(mk);
  const mkGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:TEX.glow('255,210,80'),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));mkGlow.scale.set(1.1,1.1,1);mk.add(mkGlow);
  const sat=satelliteModel();sat.scale.setScalar(opts.satScale||.8);scene.add(sat);
  const satGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:TEX.glow('255,200,120'),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:.6}));satGlow.scale.set(3,3,1);sat.add(satGlow);
  const ringMat=new THREE.LineBasicMaterial({color:0xF3A328,transparent:true,opacity:.7});let ring=null;
  const beam=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineDashedMaterial({color:0x9ad8ff,dashSize:.3,gapSize:.2,transparent:true,opacity:.6}));scene.add(beam);
  const S={h:400,timeScale:3600,angle:ang+Math.PI, // start above India
    earth,sat,
    setHeight(h){S.h=h;const r=(RE+h)*K;if(ring){scene.remove(ring);ring.geometry.dispose();}
      const pts=[];for(let k=0;k<=256;k++){const a=k/256*Math.PI*2;pts.push(new THREE.Vector3(Math.cos(a)*r,0,Math.sin(a)*r));}
      ring=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),ringMat);scene.add(ring);
      if(!opts.holo)stage.view.want={target:new THREE.Vector3(),dist:Math.max(26,r*2.9)};},
    info(){return orbit(S.h);},
    update(dt){const o=orbit(S.h),sim=dt*S.timeScale;
      earth.rotation.y+=sim*2*Math.PI/86164;clouds.rotation.y=earth.rotation.y*1.02;
      S.angle+=sim*2*Math.PI/o.T; // same direction as Earth turns (eastward)
      const r=(RE+S.h)*K;sat.scale.setScalar((opts.satScale||.8)*Math.max(1,r/14));sat.position.set(Math.cos(S.angle)*r,0,-Math.sin(S.angle)*r);sat.lookAt(0,0,0);sat.rotateX(-Math.PI/2);
      const p=beam.geometry.attributes.position;p.setXYZ(0,sat.position.x,0,sat.position.z);const e=sat.position.clone().setLength(RE*K);p.setXYZ(1,e.x,0,e.z);p.needsUpdate=true;beam.computeLineDistances();}
  };
  S.setHeight(400);stage.view.dist=40;stage.view.phi=1.2;
  return S;
}

// ---------- one planet on its own (for the hologram fan) ----------
export function buildSingle(stage,id){
  const {scene}=stage;const p=PLANETS.find(q=>q.id===id)||PLANETS[3];
  scene.add(new THREE.AmbientLight(0xffffff,.25));const sun=new THREE.DirectionalLight(0xffffff,2.8);sun.position.set(-30,10,40);scene.add(sun);
  const R=4,tilt=new THREE.Group();tilt.rotation.z=p.ring?.47:(p.tilt||.41);scene.add(tilt);
  const mat=id==='earth'?new THREE.MeshStandardMaterial({map:loadTex('earth.jpg'),roughness:.85}):id==='sun'?new THREE.MeshBasicMaterial({map:TEX.sun()}):new THREE.MeshStandardMaterial({map:TEX[p.tex](),roughness:.95});
  const m=new THREE.Mesh(new THREE.SphereGeometry(R,96,48),mat);tilt.add(m);let clouds=null,moonPivot=null;
  if(id==='earth'){clouds=new THREE.Mesh(new THREE.SphereGeometry(R*1.012,96,48),new THREE.MeshStandardMaterial({map:TEX.clouds(),transparent:true,depthWrite:false}));tilt.add(clouds);
    scene.add(atmosphere(R*1.06,0x4FA3FF,3));moonPivot=new THREE.Group();scene.add(moonPivot);const moon=new THREE.Mesh(new THREE.SphereGeometry(1.1,48,24),new THREE.MeshStandardMaterial({map:loadTex('moon.jpg'),roughness:1}));moon.position.x=8;moonPivot.add(moon);moonPivot.rotation.z=.09;}
  if(id==='sun'){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:TEX.glow('255,170,60'),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:.8}));s.scale.set(14,14,1);scene.add(s);}
  if(p.ring){const g=new THREE.RingGeometry(R*1.3,R*2.3,128,1);const pos=g.attributes.position,uv=g.attributes.uv,v=new THREE.Vector3();
    for(let k=0;k<pos.count;k++){v.fromBufferAttribute(pos,k);uv.setXY(k,(v.length()-R*1.3)/R,.5);}
    const ring=new THREE.Mesh(g,new THREE.MeshStandardMaterial({map:TEX.ring(),transparent:true,side:THREE.DoubleSide,depthWrite:false,roughness:1}));ring.rotation.x=-Math.PI/2;tilt.add(ring);}
  if(['venus','uranus','neptune'].includes(id))scene.add(atmosphere(R*1.05,id==='venus'?0xFFD9A0:id==='neptune'?0x5C8DFF:0x9AF0F0,3));
  stage.view.dist=p.ring?27:id==='earth'?25:14;stage.view.phi=1.35;
  return {update(dt){m.rotation.y+=dt*.25;if(clouds)clouds.rotation.y+=dt*.27;if(moonPivot)moonPivot.rotation.y+=dt*.15;}};
}
