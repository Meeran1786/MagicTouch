// MagicTouch: runs first in every activity page (linked by tools/localize.js).
//
// 1. Marks the page so the Studio theme (studio-theme.css) applies.
// 2. "Mouse / touch" input mode (chosen in the launcher's settings, or ?input=mouse):
//    for a laptop, interactive panel or demo with no IR camera. The camera is
//    replaced by a blank picture, so activities start straight away without
//    asking for it, and the mouse or touch screen does the tapping.
(function () {
  var doc = document.documentElement;
  doc.classList.add("mt-app");
  try { if (window.top !== window) doc.classList.add("mt-in-wall"); } catch (e) { doc.classList.add("mt-in-wall"); }

  function param(name) {
    var wins = [window];
    try { if (window.top && window.top !== window) wins.push(window.top); } catch (e) { /* ignore */ }
    for (var i = 0; i < wins.length; i++) {
      try { var v = new URLSearchParams(wins[i].location.search).get(name); if (v) return v; } catch (e) { /* ignore */ }
    }
    return null;
  }
  var mode = null;
  try {
    var p = (param("input") || "").toLowerCase();
    if (p === "mouse" || p === "hand" || p === "irpen") localStorage.setItem("wallInputMode", p);
    mode = localStorage.getItem("wallInputMode");
  } catch (e) { /* storage blocked: leave the camera alone */ }
  if (mode !== "mouse") return;
  doc.classList.add("mt-input-mouse");

  // A calibration placeholder for the mouse "device", so no app asks for the 9-dot setup.
  try {
    if (!localStorage.getItem("wallSharedCalibrationMouse")) {
      localStorage.setItem("wallSharedCalibrationMouse", JSON.stringify({
        homography: [[1 / 640, 0, 0], [0, 1 / 480, 0], [0, 0, 1]], pairs: [], screen: true, mouse: true,
      }));
    }
  } catch (e) { /* ignore */ }

  function blankStream() {
    var c = document.createElement("canvas"); c.width = 640; c.height = 480;
    var g = c.getContext("2d");
    var paint = function () { g.fillStyle = "#000"; g.fillRect(0, 0, 640, 480); };
    paint(); setInterval(paint, 500);
    var s = c.captureStream(5);
    s.getVideoTracks().forEach(function (t) { try { Object.defineProperty(t, "label", { value: "Mouse / touch (no camera)" }); } catch (e) { /* ignore */ } });
    return s;
  }
  var md = navigator.mediaDevices || (navigator.mediaDevices = {});
  md.getUserMedia = function () { return Promise.resolve(blankStream()); };
  md.enumerateDevices = function () {
    return Promise.resolve([{ deviceId: "mouse", groupId: "mouse", kind: "videoinput", label: "Mouse / touch (no camera)", toJSON: function () { return this; } }]);
  };
  if (navigator.permissions && navigator.permissions.query) {
    var q = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = function (d) {
      return d && d.name === "camera" ? Promise.resolve({ state: "granted", onchange: null, addEventListener: function () {}, removeEventListener: function () {} }) : q(d);
    };
  }
})();
