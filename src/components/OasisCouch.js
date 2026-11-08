"use client";

import { useEffect, useRef } from "react";

const W = 156;
const H = 88;
const GRAVITY = 2800;
const BOUNCE = 0.45;
const REST_Z = -4;
const TOSSES = [-20, -10, 0, 10, 20];
const COM_Y = 14;

function rot(x, y, deg) {
  const t = (deg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return { x: x * c - y * s, y: x * s + y * c };
}

function wrap(deg) {
  return ((deg + 180) % 360 + 360) % 360 - 180;
}

// In the air the bottom is only a little heavier, so a flick can carry a flip.
// On the ground, landing past the tipping point settles onto that end and stays there.
function rollTorque(offsetDeg, speed, onGround) {
  const a = wrap(offsetDeg);
  const rad = (a * Math.PI) / 180;
  if (!onGround) return -200 * Math.sin(rad) - speed * 0.45;
  const target = Math.abs(a) < 56 ? 0 : a >= 0 ? 90 : -90;
  return (target - a) * 26 - speed * 8;
}

function Box({ x, y, z, w, h, d, color, edge }) {
  const half = d / 2;
  const face = {
    position: "absolute",
    left: 0,
    top: 0,
    background: color,
    border: `2px solid ${edge}`,
    boxSizing: "border-box",
  };
  return (
    <div style={{ position: "absolute", width: w, height: h, transform: `translate3d(${x}px, ${y}px, ${z}px)`, transformStyle: "preserve-3d" }}>
      <div style={{ ...face, width: w, height: h, transform: `translateZ(${half}px)` }} />
      <div style={{ ...face, width: w, height: h, background: edge, transform: `rotateY(180deg) translateZ(${half}px)` }} />
      <div style={{ ...face, width: d, height: h, background: edge, transform: `rotateY(90deg) translateZ(${w - half}px)` }} />
      <div style={{ ...face, width: d, height: h, transform: `rotateY(-90deg) translateZ(${half}px)` }} />
      <div style={{ ...face, width: w, height: d, transform: `rotateX(90deg) translateZ(${half}px)` }} />
      <div style={{ ...face, width: w, height: d, background: edge, transform: `rotateX(-90deg) translateZ(${h - half}px)` }} />
    </div>
  );
}

export default function OasisCouch() {
  const areaRef = useRef(null);
  const couchRef = useRef(null);
  const spinRef = useRef(null);
  const binRef = useRef(null);
  const scoreRef = useRef(null);
  const scoreWrapRef = useRef(null);
  const lidRef = useRef(null);
  const shellRef = useRef(null);
  const bodyPolyRef = useRef(null);
  const cavityRef = useRef(null);
  const bandRef = useRef(null);
  const postLRef = useRef(null);
  const postRRef = useRef(null);
  const slotRef = useRef(null);
  const skirtRef = useRef(null);
  const wheelLRef = useRef(null);
  const wheelRRef = useRef(null);
  const ghostsRef = useRef(null);
  const lipRef = useRef(null);

  useEffect(() => {
    const area = areaRef.current;
    const couch = couchRef.current;
    const body = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      rx: 14,
      ry: -32,
      rz: REST_Z,
      wx: 0,
      wy: 0,
      wz: 0,
      held: false,
      pin: { x: 0, y: 0 },
      pressX: 0,
      pressY: 0,
      dragged: 0,
      cursor: { x: 0, y: 0, vx: 0, vy: 0, pvx: 0, pvy: 0, fresh: false },
      running: false,
    };
    let frame = 0;
    let prev = 0;
    let toss = 0;
    let points = 0;
    let sunk = false;
    let prevCenter = null;

    // The mesh sits inside the box, so the floor is low enough for the feet to meet the footer border.
    const floor = () => area.clientHeight - H + 9;
    const right = () => area.clientWidth - W;
    // Keep whichever face is down sitting on the same floor line.
    const contact = () => {
      const rad = (wrap(body.rz) * Math.PI) / 180;
      const c = Math.abs(Math.cos(rad));
      const s = Math.abs(Math.sin(rad));
      return floor() + H / 2 - (H / 2) * c - (W / 2) * s;
    };
    // The top of the couch can rise until it meets the bottom of the comparison cards.
    const ceiling = () => {
      const cards = document.querySelector("#compare .grid");
      if (!cards) return 0;
      return cards.getBoundingClientRect().bottom - area.getBoundingClientRect().top;
    };

    // One set of numbers for the drawing and the collision, kept clear of the heading and the button.
    function measureBin() {
      const w = area.clientWidth;
      const h = area.clientHeight;
      const ar = area.getBoundingClientRect();
      const blocks = [...document.querySelectorAll("#start > h2, #start > p")].map((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const b = range.getBoundingClientRect();
        return { l: b.left - ar.left - 10, r: b.right - ar.left + 10, b: b.bottom - ar.top + 16 };
      });
      const btn = document.querySelector("#start > div a");
      if (btn) {
        const b = btn.getBoundingClientRect();
        blocks.push({ l: b.left - ar.left - 12, r: b.right - ar.left + 12, b: b.bottom - ar.top + 12 });
      }
      const narrow = w < 720;
      const wall = narrow ? 16 : 20;
      const innerW = Math.round(Math.min(narrow ? 176 : 228, Math.max(168, w - wall * 2 - 36)));
      let binH = narrow ? 128 : 158;
      const outerW = innerW + wall * 2;
      const left = Math.max(8, w - 16 - outerW);
      const bottom = h - 2;
      let top = bottom - binH;
      const limit = blocks.reduce((m, bl) => (bl.r < left || bl.l > left + outerW ? m : Math.max(m, bl.b)), 8);
      if (top < limit) {
        binH = Math.max(112, bottom - limit);
        top = bottom - binH;
      }
      const draft = narrow ? 16 : 28;
      return { left, top, bottom, binH, wall, innerW, outerW, innerLeft: left + wall, innerRight: left + wall + innerW, draft };
    }

    function placeBox(el, x, y, w, h) {
      if (!el) return;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
    }

    function setPoints(el, pairs) {
      if (!el) return;
      el.setAttribute("points", pairs.map((p) => `${p[0]},${p[1]}`).join(" "));
    }

    function layoutBin(g) {
      const root = binRef.current;
      if (!root) return;
      root.style.opacity = "1";
      const score = scoreWrapRef.current;
      score.style.left = `${g.left}px`;
      score.style.width = `${g.outerW}px`;
      const btn = document.querySelector("#start a");
      const ar = area.getBoundingClientRect();
      const btnB = btn.getBoundingClientRect();
      const scoreTop = g.top - 66;
      const overlapsBtn = !(g.left + g.outerW < btnB.left - ar.left || g.left > btnB.right - ar.left || scoreTop + 40 < btnB.top - ar.top || scoreTop > btnB.bottom - ar.top);
      score.style.top = `${overlapsBtn ? g.top + 6 : Math.max(4, scoreTop)}px`;
      score.style.fontSize = overlapsBtn ? "1.6rem" : "";
      const lidW = Math.round(Math.min(g.outerW * 0.42, 108));
      const lid = lidRef.current;
      placeBox(lid, g.left + g.outerW - lidW - 4, g.top - 18, lidW, 18);
      lid.style.transformOrigin = "right bottom";
      if (lid.dataset.bump !== "1") lid.style.transform = "rotate(-28deg)";
      const svg = shellRef.current;
      placeBox(svg, g.left, g.top, g.outerW, g.binH);
      svg.setAttribute("viewBox", `0 0 ${g.outerW} ${g.binH}`);
      const bw = g.outerW;
      const bh = g.binH;
      const d = g.draft;
      const lean = (y) => (d * y) / bh;
      setPoints(bodyPolyRef.current, [
        [2, 2],
        [bw - 2, 2],
        [bw - d - 2, bh - 2],
        [d + 2, bh - 2],
      ]);
      const mouthY = 22;
      const mouthH = Math.max(22, Math.round(bh * 0.2));
      setPoints(bandRef.current, [
        [10 + lean(8), 8],
        [bw - 10 - lean(8), 8],
        [bw - 10 - lean(18), 18],
        [10 + lean(18), 18],
      ]);
      setPoints(cavityRef.current, [
        [g.wall + lean(mouthY), mouthY],
        [bw - g.wall - lean(mouthY), mouthY],
        [bw - g.wall - lean(mouthY + mouthH), mouthY + mouthH],
        [g.wall + lean(mouthY + mouthH), mouthY + mouthH],
      ]);
      const y0 = mouthY + mouthH + 10;
      const y1 = bh - 24;
      const rw = 14;
      const lx = g.wall + 10;
      setPoints(postLRef.current, [
        [lx + lean(y0), y0],
        [lx + rw + lean(y0), y0],
        [lx + rw + lean(y1), y1],
        [lx + lean(y1), y1],
      ]);
      const rx = bw - g.wall - 10 - rw;
      setPoints(postRRef.current, [
        [rx - lean(y0), y0],
        [rx + rw - lean(y0), y0],
        [rx + rw - lean(y1), y1],
        [rx - lean(y1), y1],
      ]);
      const sw = 42;
      const sy = y0 + 4;
      setPoints(slotRef.current, [
        [bw / 2 - sw / 2, sy],
        [bw / 2 + sw / 2, sy],
        [bw / 2 + sw / 2 - 3, sy + 14],
        [bw / 2 - sw / 2 + 3, sy + 14],
      ]);
      setPoints(skirtRef.current, [
        [d + 10, bh - 18],
        [bw - d - 10, bh - 18],
        [bw - d - 6, bh - 6],
        [d + 6, bh - 6],
      ]);
      const wheel = 26;
      placeBox(wheelLRef.current, g.left + d + 4, g.bottom - wheel + 6, wheel, wheel);
      placeBox(wheelRRef.current, g.left + g.outerW - d - 4 - wheel, g.bottom - wheel + 6, wheel, wheel);
      placeBox(lipRef.current, g.left - 8, g.top, g.outerW + 16, 16);
    }

    function paint() {
      couch.style.transform = `translate3d(${body.x}px, ${body.y}px, 0)`;
      spinRef.current.style.transform = `rotateX(${body.rx}deg) rotateY(${body.ry}deg) rotateZ(${body.rz}deg)`;
      layoutBin(measureBin());
    }

    function place() {
      body.x = clearOfBin(Math.max(8, (area.clientWidth - W) / 2));
      body.y = contact();
      paint();
    }

    function centerOf() {
      return { x: body.x + W / 2, y: body.y + H / 2 };
    }

    function award() {
      points += 1;
      sunk = true;
      if (scoreRef.current) {
        scoreRef.current.textContent = String(points);
        scoreWrapRef.current?.classList.add("scale-125");
        window.setTimeout(() => scoreWrapRef.current?.classList.remove("scale-125"), 450);
      }
      const lid = lidRef.current;
      if (lid) {
        lid.dataset.bump = "1";
        lid.style.transform = "rotate(-38deg)";
        window.setTimeout(() => {
          if (!lidRef.current) return;
          lidRef.current.dataset.bump = "";
          lidRef.current.style.transform = "rotate(-28deg)";
        }, 180);
      }
    }

    // The couch that went in stays in the bin. A new one drops in to throw.
    function bankIt(g) {
      award();
      const ghosts = ghostsRef.current;
      if (ghosts) {
        const ghost = document.createElement("div");
        ghost.className = "pointer-events-none absolute top-0 left-0";
        ghost.style.width = `${W}px`;
        ghost.style.height = `${H}px`;
        ghost.style.transform = couch.style.transform;
        ghost.appendChild(spinRef.current.cloneNode(true));
        const n = ghosts.children.length;
        ghosts.appendChild(ghost);
        const landX = Math.max(g.left + g.draft + 6, Math.min(body.x + (n % 2) * 14 - 6, g.left + g.outerW - g.draft - W - 6));
        const landY = g.bottom - g.wall - H + 8 - Math.min(n, 3) * 12;
        requestAnimationFrame(() => {
          ghost.style.transition = "transform .42s cubic-bezier(.2,.85,.3,1)";
          ghost.style.transform = `translate3d(${landX}px, ${landY}px, 0)`;
        });
        while (ghosts.children.length > 5) ghosts.firstChild.remove();
      }
      if (shellRef.current) {
        shellRef.current.style.translate = "0 5px";
        window.setTimeout(() => {
          if (shellRef.current) shellRef.current.style.translate = "";
        }, 120);
      }
      body.vx = body.vy = body.wx = body.wy = body.wz = 0;
      body.rx = 14;
      body.ry = -32;
      body.rz = REST_Z;
      body.held = false;
      body.x = clearOfBin(Math.max(8, (area.clientWidth - W) / 2));
      body.y = Math.max(ceiling(), contact() - 110);
      prevCenter = centerOf();
      paint();
    }

    function bounce(nx, ny) {
      const into = body.vx * nx + body.vy * ny;
      if (into < 0) {
        body.vx -= (1 + BOUNCE) * into * nx;
        body.vy -= (1 + BOUNCE) * into * ny;
        body.wz = Math.max(-840, Math.min(840, body.wz + (nx * body.vy - ny * body.vx) * 0.02));
      }
      body.vx = Math.max(-2400, Math.min(2400, body.vx));
      body.vy = Math.max(-2400, Math.min(2400, body.vy));
    }

    // Side walls lean in toward the floor. The opening at the rim stays the wide one.
    function pushSlopedWalls(c, g, r) {
      if (c.y < g.top - r || c.y > g.bottom) return c;
      const y = Math.max(g.top, Math.min(g.bottom, c.y));
      const t = (y - g.top) / Math.max(1, g.binH);
      const inset = g.draft * t;
      const leftOuter = g.left + inset;
      const leftInner = leftOuter + g.wall;
      const rightOuter = g.left + g.outerW - inset;
      const rightInner = rightOuter - g.wall;
      const len = Math.hypot(g.binH, g.draft) || 1;
      const nx = g.binH / len;
      const ny = -g.draft / len;
      let x = c.x;
      if (x > leftOuter - r && x < leftInner + r) {
        if (x <= (leftOuter + leftInner) / 2) {
          bounce(-nx, ny);
          x = leftOuter - r;
        } else {
          bounce(nx, -ny);
          x = leftInner + r;
        }
      } else if (x > rightInner - r && x < rightOuter + r) {
        if (x >= (rightInner + rightOuter) / 2) {
          bounce(nx, ny);
          x = rightOuter + r;
        } else {
          bounce(-nx, -ny);
          x = rightInner - r;
        }
      }
      return { x, y: c.y };
    }

    function binPhysics(prevC, curr) {
      const g = measureBin();
      const r = 14;
      const margin = r + 6;
      const crossed = prevC.y < g.top && curr.y >= g.top;
      const xAtLip = crossed ? prevC.x + (curr.x - prevC.x) * ((g.top - prevC.y) / (curr.y - prevC.y || 1)) : curr.x;
      const inMouth = xAtLip > g.innerLeft + margin && xAtLip < g.innerRight - margin;
      if (!sunk && crossed && inMouth) {
        sunk = true;
        bankIt(g);
        return;
      }
      if (curr.x < g.left - 24 || curr.x > g.left + g.outerW + 24 || curr.y < g.top - 70) sunk = false;
      let c = pushSlopedWalls(curr, g, r);
      body.x = c.x - W / 2;
      body.y = c.y - H / 2;
    }

    function step(now) {
      const dt = Math.min(0.032, (now - (prev || now)) / 1000);
      prev = now;
      const wall = right();
      if (body.held) {
        if (body.dragged >= 8) pivot(dt);
      } else {
        const onGround = body.y >= contact() - 2;
        body.vy += GRAVITY * dt;
        body.wz += rollTorque(body.rz - REST_Z, body.wz, onGround) * dt;
        body.wy -= body.wy * 1.5 * dt;
        body.x += body.vx * dt;
        body.y += body.vy * dt;
        body.rx += body.wx * dt;
        body.ry += body.wy * dt;
        body.rz += body.wz * dt;
        body.rx = wrap(body.rx);
        body.ry = wrap(body.ry);
        body.rz = wrap(body.rz);
        const lid = ceiling();
        if (body.y < lid) {
          body.y = lid;
          body.vy = Math.abs(body.vy) * BOUNCE;
        }
        if (body.x < 0) {
          body.x = 0;
          body.vx = Math.abs(body.vx) * BOUNCE;
        }
        if (body.x > wall) {
          body.x = wall;
          body.vx = -Math.abs(body.vx) * BOUNCE;
        }
        const curr = centerOf();
        if (prevCenter) binPhysics(prevCenter, curr);
        const ground = contact();
        if (body.y > ground) {
          body.y = ground;
          if (body.vy > 50) {
            body.vy = -body.vy * BOUNCE;
            body.vx *= 0.7;
            body.wx *= 0.55;
            body.wy *= 0.55;
            body.wz *= 0.5;
          } else {
            body.vy = 0;
          }
        }
        if (body.x < 0) body.x = 0;
        if (body.x > wall) body.x = wall;
        prevCenter = centerOf();
      }
      if (body.held) prevCenter = centerOf();
      paint();
      const roll = Math.abs(wrap(body.rz - REST_Z));
      const balanced = roll < 6 || Math.abs(roll - 90) < 6;
      const resting = !body.held && body.y >= contact() - 0.5 && balanced && Math.hypot(body.vx, body.vy) < 8 && Math.abs(body.wx) < 10 && Math.abs(body.wy) < 10 && Math.abs(body.wz) < 10;
      if (resting) {
        body.vx = body.vy = body.wx = body.wy = body.wz = 0;
        body.running = false;
        paint();
        return;
      }
      frame = requestAnimationFrame(step);
    }

    function wake() {
      if (body.running) return;
      body.running = true;
      prev = 0;
      frame = requestAnimationFrame(step);
    }

    place();
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      body.y = Math.max(ceiling(), contact() - 90);
      wake();
    }

    function clearOfBin(x) {
      const g = measureBin();
      if (x + W > g.left - 16) return Math.max(8, g.left - W - 20);
      return x;
    }

    function onResize() {
      body.x = clearOfBin(Math.min(Math.max(0, body.x), right()));
      body.y = Math.min(Math.max(body.y, ceiling()), contact());
      paint();
    }

    // The grabbed point stays on the cursor. Gravity and the flick swing the couch around it.
    function pivot(dt) {
      const safe = Math.max(dt, 0.001);
      let ax = 0;
      let ay = 0;
      if (body.cursor.fresh) {
        ax = (body.cursor.vx - body.cursor.pvx) / safe;
        ay = (body.cursor.vy - body.cursor.pvy) / safe;
        ax = Math.max(-28000, Math.min(28000, ax));
        ay = Math.max(-28000, Math.min(28000, ay));
        body.cursor.pvx = body.cursor.vx;
        body.cursor.pvy = body.cursor.vy;
        body.cursor.fresh = false;
      }
      const rel = { x: -body.pin.x, y: COM_Y - body.pin.y };
      const r = rot(rel.x, rel.y, body.rz);
      const inertia = (W * W + H * H) / 12 + r.x * r.x + r.y * r.y;
      const torque = GRAVITY * r.x - (r.x * ay - r.y * ax);
      body.wz += ((torque / inertia) * (180 / Math.PI) - body.wz * 3.2) * safe;
      body.wz = Math.max(-840, Math.min(840, body.wz));
      body.rz = wrap(body.rz + body.wz * safe);
      const pinW = rot(body.pin.x, body.pin.y, body.rz);
      body.x = body.cursor.x - pinW.x - W / 2;
      body.y = body.cursor.y - pinW.y - H / 2;
      body.x = Math.max(-20, Math.min(right() + 20, body.x));
      body.y = Math.max(ceiling(), Math.min(body.y, contact()));
      const w = (body.wz * Math.PI) / 180;
      body.vx = body.cursor.vx + w * pinW.y;
      body.vy = body.cursor.vy - w * pinW.x;
    }

    function pointer(event) {
      const rect = area.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function down(event) {
      event.preventDefault();
      window.getSelection()?.removeAllRanges();
      couch.setPointerCapture(event.pointerId);
      const point = pointer(event);
      const local = rot(point.x - (body.x + W / 2), point.y - (body.y + H / 2), -body.rz);
      body.pin = local;
      body.cursor.x = point.x;
      body.cursor.y = point.y;
      body.cursor.vx = body.cursor.vy = body.cursor.pvx = body.cursor.pvy = 0;
      body.cursor.fresh = false;
      body.pressX = point.x;
      body.pressY = point.y;
      body.dragged = 0;
      body.held = true;
      body.vx = body.vy = body.wx = body.wy = body.wz = 0;
      wake();
    }

    function move(event) {
      if (!body.held) return;
      const point = pointer(event);
      body.dragged = Math.max(body.dragged, Math.hypot(point.x - body.pressX, point.y - body.pressY));
      if (body.dragged < 8) return;
      const dt = 0.016;
      body.cursor.vx = (point.x - body.cursor.x) / dt;
      body.cursor.vy = (point.y - body.cursor.y) / dt;
      body.cursor.x = point.x;
      body.cursor.y = point.y;
      body.cursor.fresh = true;
      const pinW = rot(body.pin.x, body.pin.y, body.rz);
      body.x = body.cursor.x - pinW.x - W / 2;
      body.y = body.cursor.y - pinW.y - H / 2;
      body.y = Math.max(ceiling(), body.y);
    }

    function up() {
      if (!body.held) return;
      if (body.dragged < 8) {
        body.held = false;
        const deg = TOSSES[toss % TOSSES.length];
        toss += 1;
        const rad = (deg * Math.PI) / 180;
        const speed = 740;
        body.vx = Math.sin(rad) * speed;
        body.vy = -Math.cos(rad) * speed;
        body.wz = deg * 1.1;
        body.wy = body.wz * 0.18;
        body.wx = 0;
        wake();
        return;
      }
      pivot(0.016);
      body.held = false;
      body.vx = Math.max(-2400, Math.min(2400, body.vx));
      body.vy = Math.max(-2400, Math.min(2400, body.vy));
      body.wz = Math.max(-840, Math.min(840, body.wz));
      body.wy = body.wz * 0.18;
    }

    window.addEventListener("resize", onResize);
    couch.addEventListener("pointerdown", down);
    couch.addEventListener("pointermove", move);
    couch.addEventListener("pointerup", up);
    couch.addEventListener("pointercancel", up);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      couch.removeEventListener("pointerdown", down);
      couch.removeEventListener("pointermove", move);
      couch.removeEventListener("pointerup", up);
      couch.removeEventListener("pointercancel", up);
    };
  }, []);

  const cloth = "#ff6b4a";
  const edge = "#e45436";
  const leg = "#3a2418";

  return (
    <div ref={areaRef} className="pointer-events-none absolute inset-0 z-10" style={{ perspective: "900px" }}>
      <div ref={binRef} className="absolute inset-0 opacity-0">
        <div ref={lidRef} className="absolute rounded-sm border-[3px] border-ink bg-[#7eb0ff] transition-transform" />
        <svg ref={shellRef} className="absolute overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id="dumpster-blue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5b94f8" />
              <stop offset="34%" stopColor="#2f6adf" />
              <stop offset="100%" stopColor="#1e4cb4" />
            </linearGradient>
          </defs>
          <polygon ref={bodyPolyRef} fill="url(#dumpster-blue)" stroke="#1a1a1a" strokeWidth="3" strokeLinejoin="round" />
          <polygon ref={bandRef} fill="#8ebaff" />
          <polygon ref={cavityRef} fill="#10284f" />
          <polygon ref={postLRef} fill="#1b4eae" stroke="#1a1a1a" strokeWidth="2.5" strokeLinejoin="round" />
          <polygon ref={postRRef} fill="#1b4eae" stroke="#1a1a1a" strokeWidth="2.5" strokeLinejoin="round" />
          <polygon ref={slotRef} fill="#0d2244" stroke="#1a1a1a" strokeWidth="2.5" strokeLinejoin="round" />
          <polygon ref={skirtRef} fill="#163a80" />
        </svg>
        <div ref={wheelLRef} className="absolute rounded-full border-[3px] border-ink bg-[#d7e4ff] shadow-[inset_0_0_0_7px_#1a1a1a]" />
        <div ref={wheelRRef} className="absolute rounded-full border-[3px] border-ink bg-[#d7e4ff] shadow-[inset_0_0_0_7px_#1a1a1a]" />
        <p ref={scoreWrapRef} className="absolute m-0 text-center font-display text-4xl leading-none text-hot transition-transform md:text-5xl" aria-live="polite">
          <span ref={scoreRef}>0</span>
          <span className="sr-only"> points. Throw the couch in the dumpster.</span>
        </p>
      </div>
      <div ref={ghostsRef} className="pointer-events-none absolute inset-0 z-[5]" />
      <div
        ref={couchRef}
        className="pointer-events-auto absolute top-0 left-0 z-10 cursor-grab touch-none active:cursor-grabbing"
        style={{ width: W, height: H }}
        role="img"
        aria-label="A couch. Click to toss it, or grab it and throw it in the dumpster."
      >
        <div ref={spinRef} className="relative h-full w-full" style={{ transformStyle: "preserve-3d" }}>
          <Box x={24} y={46} z={0} w={16} h={28} d={16} color={leg} edge="#24160f" />
          <Box x={116} y={46} z={0} w={16} h={28} d={16} color={leg} edge="#24160f" />
          <Box x={24} y={46} z={36} w={16} h={28} d={16} color={leg} edge="#24160f" />
          <Box x={116} y={46} z={36} w={16} h={28} d={16} color={leg} edge="#24160f" />
          <Box x={18} y={34} z={8} w={120} h={24} d={52} color={cloth} edge={edge} />
          <Box x={30} y={8} z={6} w={96} h={36} d={18} color={cloth} edge={edge} />
          <Box x={6} y={22} z={10} w={22} h={32} d={46} color={edge} edge="#c73d28" />
          <Box x={128} y={22} z={10} w={22} h={32} d={46} color={edge} edge="#c73d28" />
        </div>
      </div>
      <div ref={lipRef} className="absolute z-20 rounded-t-md border-[3px] border-ink bg-[#4d8cf6] shadow-[0_4px_0_#1d4a9e]" />
    </div>
  );
}
