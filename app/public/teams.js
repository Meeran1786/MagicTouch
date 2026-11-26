// MagicTouch team play: split the class into 2–4 teams, give stars, take turns, celebrate
// the winner. The score strip floats over any activity on the wall; the teacher can run it
// from the wall or from the phone remote. Team names and mascots come from the school
// (School view → Teams); every school starts with Peacocks, Tigers, Elephants and Parrots.
// Only team names and points are kept, on the wall's own state: nothing about any child.
(function () {
  const COLORS = ["#631654", "#E96E24", "#2fa86a", "#2f7fc4"];
  const DEFAULTS = [{ name: "Peacocks", mascot: "🦚" }, { name: "Tigers", mascot: "🐅" }, { name: "Elephants", mascot: "🐘" }, { name: "Parrots", mascot: "🦜" }];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // Uploaded mascots are data: URLs checked by the server (PNG, JPG or WebP only).
  const mascot = t => t.image && /^data:image\/(png|jpeg|webp);base64,/.test(t.image)
    ? `<img src="${esc(t.image)}" alt="" draggable="false">` : MTCardArt.img(t.mascot);

  async function load(api) {
    try { return (await api("GET", "/api/school/settings")).teams || DEFAULTS; } catch (e) { return DEFAULTS; }
  }

  // Game rules, shared by the wall and the phone.
  const rules = {
    start: n => ({ on: true, n, scores: Array(n).fill(0), turn: 0, ended: false }),
    award: (g, i, d = 1) => ({ ...g, scores: g.scores.map((s, k) => k === i ? Math.max(0, Math.min(999, s + d)) : s), turn: d > 0 ? (i + 1) % g.n : g.turn }),
    next: g => ({ ...g, turn: (g.turn + 1) % g.n }),
    end: g => ({ ...g, ended: true }),
    stop: () => ({ on: false }),
    winners: g => { const top = Math.max(...g.scores); return top > 0 ? g.scores.map((s, i) => s === top ? i : -1).filter(i => i >= 0) : []; },
  };

  let sfx = null;
  import("/shared/studio/soft-music.js").then(m => { sfx = m.sfx; }).catch(() => {});
  const sound = name => { if (localStorage.getItem("mtSfxOn") !== "0" && sfx && sfx[name]) try { sfx[name](); } catch (e) { /* no audio yet */ } };

  // ── on the wall ──────────────────────────────────────────────────────
  function wall({ bar, celebrate, teams, send }) {
    let game = { on: false }, shownEnd = false;
    const T = () => teams();

    function render(g, prev) {
      game = g || { on: false };
      bar.classList.toggle("hidden", !game.on);
      document.body.classList.toggle("teams-on", !!game.on);
      if (!game.on) { celebrate.classList.add("hidden"); shownEnd = false; return; }
      const t = T();
      bar.innerHTML = `<div class="tb-teams">${game.scores.map((s, i) => `
          <button type="button" class="tb-team${i === game.turn && !game.ended ? " turn" : ""}" data-award="${i}" style="--c:${COLORS[i]}" aria-label="Give ${esc(t[i].name)} a star">
            <span class="tb-m">${mascot(t[i])}</span>
            <span class="tb-n">${esc(t[i].name)}</span>
            <span class="tb-s"><svg aria-hidden="true"><use href="#i-star"/></svg><b>${s}</b></span>
          </button>`).join("")}</div>
        <div class="tb-acts">
          <button type="button" data-act="next" aria-label="Next team's turn">Next turn</button>
          <button type="button" data-act="end">${game.ended ? "New game" : "Finish"}</button>
          <button type="button" data-act="stop" aria-label="Close team play">✕</button>
        </div>`;
      // A point just landed: bounce that team and play a chime.
      if (prev && prev.on && prev.scores && !game.ended) game.scores.forEach((s, i) => {
        if (s > (prev.scores[i] || 0)) { const el = bar.querySelectorAll(".tb-team")[i]; el && el.classList.add("scored"); burst(el, COLORS[i]); sound("correct"); }
      });
      if (game.ended && !shownEnd) { shownEnd = true; party(); }
      if (!game.ended) { shownEnd = false; celebrate.classList.add("hidden"); }
    }

    function burst(el, color) {
      if (!el) return;
      const r = el.getBoundingClientRect();
      for (let k = 0; k < 10; k++) {
        const s = document.createElement("i");
        s.className = "spark";
        s.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 3}px;--dx:${Math.cos(k / 10 * 6.28) * 70}px;--dy:${Math.sin(k / 10 * 6.28) * 70 - 30}px;background:${k % 2 ? color : "#F3A328"}`;
        document.body.appendChild(s);
        setTimeout(() => s.remove(), 900);
      }
    }

    function party() {
      const t = T(), win = rules.winners(game);
      const title = !win.length ? "Well played, everyone!" : win.length > 1 ? `It's a tie: ${win.map(i => esc(t[i].name)).join(" and ")}!` : `${esc(t[win[0]].name)} win!`;
      celebrate.innerHTML = `<div class="cel-card">
          <div class="cel-m">${(win.length ? win : [0, 1].slice(0, game.n)).map(i => `<span style="--c:${COLORS[i]}">${mascot(t[i])}</span>`).join("")}</div>
          <h2>${title}</h2>
          <p>${game.scores.map((s, i) => `${esc(t[i].name)} ${s}`).join(" · ")}</p>
          <button type="button" class="btn btn-primary" data-act="closecel">Back to the activity</button>
        </div>${Array.from({ length: 60 }, (_, k) => `<i class="confetti" style="--x:${(k * 37) % 100}vw;--d:${(k % 12) * .18}s;--r:${(k * 53) % 360}deg;background:${COLORS[k % 4]}"></i>`).join("")}`;
      celebrate.classList.remove("hidden");
      sound("celebrate");
      clearTimeout(party.t); party.t = setTimeout(() => celebrate.classList.add("hidden"), 9000);
    }

    bar.addEventListener("click", e => {
      const a = e.target.closest("[data-award]"), act = e.target.closest("[data-act]");
      if (a && !game.ended) return send(rules.award(game, +a.dataset.award));
      if (!act) return;
      if (act.dataset.act === "next") send(rules.next(game));
      if (act.dataset.act === "end") send(game.ended ? rules.start(game.n) : rules.end(game));
      if (act.dataset.act === "stop") send(rules.stop());
    });
    celebrate.addEventListener("click", e => { if (e.target.closest("[data-act=closecel]") || e.target === celebrate) celebrate.classList.add("hidden"); });
    return { render, get game() { return game; } };
  }

  // ── on the phone ─────────────────────────────────────────────────────
  function remote({ el, teams, send }) {
    let game = { on: false }, n = 2;
    function render(g) {
      game = g || { on: false };
      const t = teams();
      if (!game.on) {
        el.innerHTML = `<p class="r-sub">Team play</p><div class="rt-start">${[2, 3, 4].map(k => `<button type="button" data-n="${k}" aria-pressed="${k === n}">${k} teams</button>`).join("")}<button type="button" class="go" data-act="start">Start</button></div>`;
        return;
      }
      el.innerHTML = `<p class="r-sub">Team play${game.ended ? " · finished" : ""}</p>${game.scores.map((s, i) => `
          <div class="rt-row${i === game.turn && !game.ended ? " turn" : ""}" style="--c:${COLORS[i]}">
            <span class="rt-m">${mascot(t[i])}</span><b>${esc(t[i].name)}</b>
            <button type="button" data-minus="${i}" aria-label="Take a star from ${esc(t[i].name)}">−</button><em>${s}</em><button type="button" data-plus="${i}" aria-label="Give ${esc(t[i].name)} a star">+</button>
          </div>`).join("")}
        <div class="rt-acts"><button type="button" data-act="next">Next turn</button><button type="button" data-act="end">${game.ended ? "New game" : "Finish and celebrate"}</button><button type="button" data-act="stop">Stop</button></div>`;
    }
    el.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.n) { n = +b.dataset.n; return render(game); }
      if (b.dataset.plus) return !game.ended && send(rules.award(game, +b.dataset.plus, 1));
      if (b.dataset.minus) return send(rules.award(game, +b.dataset.minus, -1));
      const a = b.dataset.act;
      if (a === "start") send(rules.start(n));
      if (a === "next") send(rules.next(game));
      if (a === "end") send(game.ended ? rules.start(game.n) : rules.end(game));
      if (a === "stop") send(rules.stop());
    });
    return { render };
  }

  window.MTTeams = { load, rules, wall, remote, mascot, COLORS, DEFAULTS };
})();
