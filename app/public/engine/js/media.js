// Plug-and-play media slot (design system §3). An activity may name a local file:
//   "media": { "type": "mp4" | "webm" | "lottie" | "rive", "src": "clip.mp4", "caption": "In the lab" }
// src is relative to the activity folder, or an absolute local path such as "/assets/…".
// Every template must look complete without it: mountMedia() resolves to null when there is no
// media, the file is missing, or the runtime for that type is not installed, and the template
// keeps its code-drawn picture. Videos are muted 2–4 s loops and pause while the page is hidden.
//
//   const m = await mountMedia(holder, d.media, ctx.base);  // null → keep the code-only visual
//   m.stop();                                               // on cleanup
//
// Lottie and Rive need their runtimes in /vendor/lottie/ and /vendor/rive/ (served by our own
// server, never a CDN). Until they are installed those types fall back to code.

const RUNTIME = {
  lottie: { src: "/vendor/lottie/lottie_light.min.js", global: "lottie" },
  rive: { src: "/vendor/rive/rive.js", global: "rive" },
};

function url(src, base) {
  if (!src || /^[a-z]+:|^\/\//i.test(src)) return null; // local files only, nothing remote
  return src.startsWith("/") ? src : (base || "") + src;
}

function loadScript(src, global) {
  if (window[global]) return Promise.resolve(window[global]);
  return new Promise(function (resolve) {
    const s = document.createElement("script");
    s.src = src;
    s.onload = function () {
      resolve(window[global] || null);
    };
    s.onerror = function () {
      resolve(null);
    };
    document.head.appendChild(s);
  });
}

function video(holder, src) {
  return new Promise(function (resolve) {
    const v = document.createElement("video");
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.autoplay = true;
    v.preload = "auto";
    v.setAttribute("aria-hidden", "true");
    v.className = "mt-media";
    let done = false;
    function finish(ok) {
      if (done) return;
      done = true;
      if (!ok) {
        v.remove();
        return resolve(null);
      }
      function vis() {
        if (document.hidden) v.pause();
        else v.play().catch(function () {});
      }
      document.addEventListener("visibilitychange", vis);
      resolve({
        el: v,
        stop: function () {
          document.removeEventListener("visibilitychange", vis);
          v.pause();
          v.removeAttribute("src");
          v.load();
          v.remove();
        },
      });
    }
    v.addEventListener("loadeddata", function () {
      finish(true);
      v.play().catch(function () {});
    });
    v.addEventListener("error", function () {
      finish(false);
    });
    setTimeout(function () {
      finish(v.readyState >= 2);
    }, 4000);
    v.src = src;
    holder.appendChild(v);
  });
}

async function lottie(holder, src) {
  const L = await loadScript(RUNTIME.lottie.src, RUNTIME.lottie.global);
  if (!L) return null;
  const box = document.createElement("div");
  box.className = "mt-media";
  holder.appendChild(box);
  try {
    const anim = L.loadAnimation({ container: box, renderer: "svg", loop: true, autoplay: true, path: src });
    const vis = function () {
      if (document.hidden) anim.pause();
      else anim.play();
    };
    document.addEventListener("visibilitychange", vis);
    return {
      el: box,
      stop: function () {
        document.removeEventListener("visibilitychange", vis);
        anim.destroy();
        box.remove();
      },
    };
  } catch {
    box.remove();
    return null;
  }
}

async function rive(holder, src, media) {
  const R = await loadScript(RUNTIME.rive.src, RUNTIME.rive.global);
  if (!R) return null;
  const c = document.createElement("canvas");
  c.className = "mt-media";
  holder.appendChild(c);
  try {
    const r = new R.Rive({ src: src, canvas: c, autoplay: true, stateMachines: media.stateMachine });
    const vis = function () {
      if (document.hidden) r.pause();
      else r.play();
    };
    document.addEventListener("visibilitychange", vis);
    return {
      el: c,
      stop: function () {
        document.removeEventListener("visibilitychange", vis);
        r.cleanup();
        c.remove();
      },
    };
  } catch {
    c.remove();
    return null;
  }
}

/** Puts the activity's media into holder. Resolves to {el, stop} or null (keep the code visual). */
export async function mountMedia(holder, media, base) {
  if (!media || !media.src) return null;
  const src = url(media.src, base);
  if (!src) return null;
  const type = media.type || (/\.webm$/i.test(src) ? "webm" : "mp4");
  if (type === "mp4" || type === "webm") return video(holder, src);
  if (type === "lottie") return lottie(holder, src);
  if (type === "rive") return rive(holder, src, media);
  return null;
}
