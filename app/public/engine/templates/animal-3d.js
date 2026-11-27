// 3D animals (early years): a lit 3D animal stands on the stage. Hold Left or Right and it
// turns and walks; 360° spins it slowly round; Next animal swaps in the next one. Pens and
// mouse hold the walk buttons down; a hand walks the animal while it points at a button.
// Activity data:
//   animals: [{ word: "Elephant", emoji: "🐘", dir: "models/elephant/", kind: "subclip" |
//     "continuous" | "meshWalk", size: 13.8, normal: "normal.jpg", walk: "walk.glb",
//     idle: [from, to, fps], walkFrames: [from, to, fps] }]
//   kind: subclip = one take holding idle and walk (frame ranges given); continuous = one take
//   played on a loop; meshWalk = a still mesh plus a separate walk take (walk).
import * as THREE from "three";
import { GLTFLoader } from "/vendor/three/jsm/loaders/GLTFLoader.js";
import { MT } from "../js/kit.js";
import { frame } from "../js/early.js";
import { onPoints } from "/shared/input/pointer.js";
import { emojiImg } from "/shared/studio/emoji.js";

export const meta = { fullscreen: true, music: true, styles: ["early", "animal-3d"], points: 1 };

const WALK_SPEED = 1.35;
const TURN_RATE = 6;
const BOUNDS = 3.6;
const SPIN_S = 5;

export default function animal3d(area, d, ctx) {
  const f = frame(area, { icon: d.icon, title: d.title });
  const wrap = document.createElement("div");
  wrap.className = "a3";
  wrap.innerHTML =
    '<div class="a3-view"><div class="a3-shadow"></div><div class="a3-name"></div><div class="a3-wait">Loading…</div></div>' +
    '<button class="ey-btn alt a3-walk" data-dir="-1" type="button">◀ Walk</button>' +
    '<div class="a3-mid"><button class="ey-btn alt a3-spin" type="button">↻ 360°</button>' +
    '<button class="ey-btn a3-next" type="button">Next animal 🐾</button></div>' +
    '<button class="ey-btn alt a3-walk" data-dir="1" type="button">Walk ▶</button>';
  f.stage.appendChild(wrap);
  const view = wrap.querySelector(".a3-view");
  const nameEl = wrap.querySelector(".a3-name");
  const waitEl = wrap.querySelector(".a3-wait");
  const shadow = wrap.querySelector(".a3-shadow");

  const renderer = new THREE.WebGLRenderer({ antialias: !MT.lowSpec(), alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MT.lowSpec() ? 1 : 2));
  view.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 1000);
  camera.position.set(0, 5, 23);
  camera.lookAt(0, 3.6, 0);
  scene.add(new THREE.HemisphereLight(0xfff2d9, 0x8a7a4a, 2.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(5, 8, 4);
  scene.add(sun);
  const loader = new GLTFLoader();
  const textures = new THREE.TextureLoader();
  const clock = new THREE.Clock();

  let at = 0;
  let animal = null; // { root, mixer, idle, walk, state, facing, spin, cfg }
  let dir = 0;
  let raf = 0;
  let token = 0;
  let viewW = 0;

  function resize() {
    const r = view.getBoundingClientRect();
    if (!r.width || !r.height) return;
    viewW = r.width;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(view);

  const gltf = (file) => new Promise((ok, fail) => loader.load(ctx.base + file, ok, undefined, fail));

  function dispose(a) {
    if (!a) return;
    scene.remove(a.root);
    a.mixer.stopAllAction();
    a.root.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      if (o.material.map) o.material.map.dispose();
      if (o.material.normalMap) o.material.normalMap.dispose();
      o.material.dispose();
    });
  }

  async function show(i) {
    at = (i + d.animals.length) % d.animals.length;
    const cfg = d.animals[at];
    const mine = ++token;
    dispose(animal);
    animal = null;
    waitEl.hidden = false;
    nameEl.replaceChildren(emojiImg(cfg.emoji, ""), document.createTextNode(" " + cfg.word));
    f.progress(`${at + 1} / ${d.animals.length}`);
    MT.speak(cfg.word);
    try {
      const main = await gltf(cfg.dir + "model.glb");
      const walkTake = cfg.kind === "meshWalk" && cfg.walk ? await gltf(cfg.dir + cfg.walk) : null;
      if (mine !== token) return;
      const map = textures.load(ctx.base + cfg.dir + "diffuse.jpg");
      map.colorSpace = THREE.SRGBColorSpace;
      map.flipY = false;
      const normalMap = cfg.normal ? textures.load(ctx.base + cfg.dir + cfg.normal) : null;
      if (normalMap) normalMap.flipY = false;
      const root = main.scene;
      root.traverse((o) => {
        if (!o.isMesh) return;
        o.material = new THREE.MeshStandardMaterial({ map, normalMap, roughness: 0.88, metalness: 0 });
        o.frustumCulled = false;
      });
      const bounds = new THREE.Box3().setFromObject(root);
      const size = bounds.getSize(new THREE.Vector3());
      root.scale.setScalar(cfg.size / Math.max(size.x, size.y, size.z, 1e-4));
      bounds.setFromObject(root);
      root.position.set(0, -bounds.min.y, 0);
      const mixer = new THREE.AnimationMixer(root);
      let idleClip = null;
      let walkClip = null;
      const take = main.animations[0];
      if (cfg.kind === "subclip" && take) {
        idleClip = THREE.AnimationUtils.subclip(take, "idle", ...cfg.idle);
        walkClip = THREE.AnimationUtils.subclip(take, "walk", ...cfg.walkFrames);
      } else if (cfg.kind === "continuous") {
        idleClip = take || null;
      } else if (walkTake) {
        walkClip = walkTake.animations[0] || null;
      }
      const idle = idleClip && mixer.clipAction(idleClip).play();
      const walk = walkClip && mixer.clipAction(walkClip).play();
      if (walk) walk.setEffectiveWeight(idle ? 0 : 1);
      if (walk && !idle) walk.paused = true; // a mesh with only a walk take stands still until it walks
      scene.add(root);
      animal = { root, mixer, idle, walk, state: "idle", facing: 0, spin: -1, cfg };
      waitEl.hidden = true;
    } catch (e) {
      waitEl.textContent = "This animal could not load.";
      console.warn("[animal-3d]", e);
    }
  }

  function setState(a, state) {
    if (a.state === state || a.cfg.kind === "continuous") return;
    a.state = state;
    const on = state === "walk" ? a.walk : a.idle;
    const offA = state === "walk" ? a.idle : a.walk;
    if (a.walk && !a.idle) {
      a.walk.paused = state !== "walk";
      return;
    }
    if (on) on.reset().setEffectiveWeight(1).play();
    if (offA) offA.setEffectiveWeight(0);
  }

  function update(dt) {
    const a = animal;
    if (!a) return;
    a.mixer.update(dt);
    if (a.spin >= 0) {
      a.spin += dt;
      const t = Math.min(1, a.spin / SPIN_S);
      a.root.rotation.y = a.facing + t * t * (3 - 2 * t) * Math.PI * 2;
      setState(a, "idle");
      if (t >= 1) {
        a.spin = -1;
        a.root.rotation.y = a.facing;
      }
    } else if (dir) {
      setState(a, "walk");
      const target = (dir * Math.PI) / 2;
      a.facing += (target - a.facing) * Math.min(1, TURN_RATE * dt);
      a.root.rotation.y = a.facing;
      if (Math.abs(target - a.facing) < 0.35) a.root.position.x = Math.max(-BOUNDS, Math.min(BOUNDS, a.root.position.x + dir * WALK_SPEED * dt));
    } else {
      setState(a, "idle");
    }
    // the ground shadow follows the animal (world x to screen x at the ground)
    shadow.style.transform = `translateX(calc(-50% + ${a.root.position.x * viewW * 0.019}px))`;
  }

  function tick() {
    update(Math.min(clock.getDelta(), 0.05));
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  const onVisible = () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) {
      clock.getDelta();
      raf = requestAnimationFrame(tick);
    }
  };
  document.addEventListener("visibilitychange", onVisible);

  // walking: a press holds the button; a camera point over it holds it too
  const held = { press: 0, cam: 0 };
  const walkBtns = [...wrap.querySelectorAll(".a3-walk")];
  const sync = () => {
    dir = held.press || held.cam;
    walkBtns.forEach((b) => b.classList.toggle("on", +b.dataset.dir === dir));
  };
  for (const b of walkBtns) {
    b.addEventListener("pointerdown", (e) => {
      if (!e.isTrusted) return;
      held.press = +b.dataset.dir;
      sync();
    });
  }
  const letGo = () => {
    held.press = 0;
    sync();
  };
  window.addEventListener("pointerup", letGo);
  window.addEventListener("pointercancel", letGo);
  const off = onPoints((pts) => {
    const el = pts[0] && document.elementFromPoint(pts[0].x, pts[0].y);
    const b = el && el.closest && el.closest(".a3-walk");
    held.cam = b ? +b.dataset.dir : 0;
    sync();
  });
  wrap.querySelector(".a3-spin").addEventListener("click", () => {
    if (animal && animal.spin < 0) {
      animal.spin = 0;
      MT.sfx.tap();
    }
  });
  wrap.querySelector(".a3-next").addEventListener("click", () => show(at + 1));

  resize();
  show(0);
  raf = requestAnimationFrame(tick);
  return () => {
    token++;
    cancelAnimationFrame(raf);
    ro.disconnect();
    off();
    window.removeEventListener("pointerup", letGo);
    window.removeEventListener("pointercancel", letGo);
    document.removeEventListener("visibilitychange", onVisible);
    dispose(animal);
    renderer.dispose();
  };
}
