// The camera-to-screen maths behind the IR pen and hand input (shared/input/homography.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyHomography, computeHomography } from "../public/shared/input/homography.js";

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} is not ${b}`);

// a camera that sees the wall as a tilted four-sided shape: maps unit-square corners there
const CORNERS = [
  [
    [112, 64],
    [0, 0],
  ],
  [
    [548, 90],
    [1, 0],
  ],
  [
    [580, 430],
    [1, 1],
  ],
  [
    [70, 400],
    [0, 1],
  ],
];

test("four corners map exactly onto the screen corners", () => {
  const H = computeHomography(CORNERS.map(([cam, scr]) => ({ cam, proj: scr })));
  for (const [cam, [x, y]] of CORNERS) {
    const p = applyHomography(H, cam);
    close(p[0], x);
    close(p[1], y);
  }
});

test("the nine-dot calibration recovers a known perspective", () => {
  // a made-up projector-and-camera perspective, and nine dots seen through it
  const T = [
    [1.6, 0.1, 40],
    [0.05, 1.5, 30],
    [0.0004, 0.0002, 1],
  ];
  const pairs = [];
  for (const sy of [0.1, 0.5, 0.9])
    for (const sx of [0.1, 0.5, 0.9]) {
      const [cx, cy] = applyHomography(T, [sx * 400, sy * 300]);
      pairs.push({ cam: [cx, cy], proj: [sx, sy] });
    }
  const H = computeHomography(pairs);
  for (const { cam, proj: screen } of pairs) {
    const p = applyHomography(H, cam);
    close(p[0], screen[0], 1e-4);
    close(p[1], screen[1], 1e-4);
  }
  // a point between the dots lands where it should too
  const mid = applyHomography(T, [0.3 * 400, 0.7 * 300]);
  const p = applyHomography(H, mid);
  close(p[0], 0.3, 1e-3);
  close(p[1], 0.7, 1e-3);
});

test("no calibration means no point", () => {
  assert.equal(applyHomography(null, [10, 10]), null);
});
