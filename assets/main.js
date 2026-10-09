(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Disabled store buttons (until the app is live)
  document.querySelectorAll('a[aria-disabled="true"]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); });
  });

  // Header state, scroll progress and hero parallax
  var header = document.getElementById('top');
  var progress = document.getElementById('progress');
  var parallax = Array.prototype.slice.call(document.querySelectorAll('.parallax'));
  var ticking = false;
  function onScroll() {
    var y = window.scrollY;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    header.classList.toggle('scrolled', y > 10);
    progress.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';
    if (!reduceMotion) {
      parallax.forEach(function (el) {
        el.style.transform = 'translateY(' + y * parseFloat(el.dataset.speed || 0) + 'px)';
      });
    }
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  // Count-up numbers
  function countUp(el) {
    var target = parseInt(el.dataset.count, 10);
    if (reduceMotion || !target) return;
    var start = null;
    function step(t) {
      if (start === null) start = t;
      var p = Math.min((t - start) / 1200, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    }
    el.textContent = '0';
    requestAnimationFrame(step);
  }

  // Reveal on scroll
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        entry.target.querySelectorAll('[data-count]').forEach(countUp);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  // Screenshot gallery arrows
  var gallery = document.getElementById('gallery');
  document.querySelectorAll('.gallery-nav button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var shot = gallery.querySelector('.shot');
      var step = shot ? shot.getBoundingClientRect().width + 28 : 260;
      gallery.scrollBy({ left: step * 2 * parseInt(btn.dataset.dir, 10), behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });

  // Mini sculpture: swipe (or move the mouse) to blow autumn leaves into the heart
  var canvas = document.getElementById('toy');
  var ctx = canvas.getContext('2d');
  var msg = document.getElementById('toy-msg');
  var meter = document.getElementById('toy-meter');
  var pct = document.getElementById('toy-pct');
  var W = 640, H = 400, N = 480, CELL = 12, GOAL = 0.7;
  var HX = 430, HY = 196, HS = 108;
  var COLORS = ['#E4572E', '#F3A712', '#C1440E', '#E98A15', '#A8C256'];
  var parts = [], trail = [], cells = [], done = false, running = false, last = 0, coverage = 0;
  var pointer = null;

  // One path for drawing and for the fill test (classic parametric heart)
  var heart = new Path2D(), K = HS / 15.5;
  for (var ha = 0; ha <= Math.PI * 2; ha += 0.04) {
    var hx = 16 * Math.pow(Math.sin(ha), 3), hy = 13 * Math.cos(ha) - 5 * Math.cos(2 * ha) - 2 * Math.cos(3 * ha) - Math.cos(4 * ha);
    if (ha === 0) heart.moveTo(HX + hx * K, HY - (hy + 2.5) * K); else heart.lineTo(HX + hx * K, HY - (hy + 2.5) * K);
  }
  heart.closePath();
  var hit = document.createElement('canvas').getContext('2d');
  function inHeart(x, y) { return hit.isPointInPath(heart, x, y); }
  for (var cy = CELL / 2; cy < H; cy += CELL) {
    for (var cx = CELL / 2; cx < W; cx += CELL) if (inHeart(cx, cy)) cells.push(((cy / CELL) | 0) * 1000 + ((cx / CELL) | 0));
  }
  var cellSet = {};
  cells.forEach(function (c) { cellSet[c] = true; });

  function reset() {
    parts = [];
    for (var i = 0; i < N; i++) {
      // A loose pile of leaves in the bottom-left corner
      var x = 30 + Math.random() * 200, y = 250 + Math.random() * 130;
      parts.push({ x: x, y: y, vx: 0, vy: 0, r: Math.random() * 6.3, s: 0.8 + Math.random() * 0.5, c: COLORS[i % COLORS.length] });
    }
    done = false; trail = [];
    say('');
    measure();
    draw();
  }
  function say(text) {
    msg.textContent = text;
    msg.classList.remove('pop');
    void msg.offsetWidth;
    if (text) msg.classList.add('pop');
  }

  function gust(x0, y0, x1, y1, dt) {
    var vx = (x1 - x0) / dt, vy = (y1 - y0) / dt, sp = Math.sqrt(vx * vx + vy * vy);
    if (sp < 40) return;
    if (sp > 1100) { vx *= 1100 / sp; vy *= 1100 / sp; }
    var R2 = 75 * 75;
    parts.forEach(function (p) {
      // distance from the particle to the swipe segment
      var sx = x1 - x0, sy = y1 - y0, l2 = sx * sx + sy * sy || 1;
      var t = Math.max(0, Math.min(1, ((p.x - x0) * sx + (p.y - y0) * sy) / l2));
      var dx = p.x - (x0 + sx * t), dy = p.y - (y0 + sy * t), d2 = dx * dx + dy * dy;
      if (d2 > R2) return;
      // Leaves are carried along with the air: they approach the wind speed instead of gaining speed on every gust
      var w = Math.min(1, 0.6 * (1 - Math.sqrt(d2 / R2)) / p.s);
      p.vx += (vx * 0.75 - p.vx) * w; p.vy += (vy * 0.75 - p.vy) * w;
    });
    trail.push({ x: x1, y: y1, life: 1 });
  }

  var grid = {};
  function step(dt) {
    grid = {};
    parts.forEach(function (p, i) {
      var key = ((p.y / 10) | 0) * 1000 + ((p.x / 10) | 0);
      (grid[key] || (grid[key] = [])).push(i);
    });
    parts.forEach(function (p, i) {
      // Leaves inside the outline settle into the sculpture, loose ones keep drifting
      var inside = inHeart(p.x, p.y);
      var damp = Math.exp(-(inside ? 10 : 2.4) * dt);
      p.vy += (inside ? 0 : 18) * dt;
      p.vx *= damp; p.vy *= damp;
      // Gentle separation so the sculpture fills instead of clumping
      var gx = (p.x / 10) | 0, gy = (p.y / 10) | 0;
      for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) {
        var list = grid[(gy + oy) * 1000 + gx + ox];
        if (!list) continue;
        for (var j = 0; j < list.length; j++) {
          var q = parts[list[j]];
          if (list[j] <= i) continue;
          var dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy;
          if (d2 > 0 && d2 < 81) {
            var d = Math.sqrt(d2), push = (9 - d) * 0.25 / d;
            p.x -= dx * push; p.y -= dy * push; q.x += dx * push; q.y += dy * push;
          }
        }
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.r += p.vx * dt * 0.03;
      if (p.x < 4) { p.x = 4; p.vx = Math.abs(p.vx) * 0.4; }
      if (p.x > W - 4) { p.x = W - 4; p.vx = -Math.abs(p.vx) * 0.4; }
      if (p.y < 4) { p.y = 4; p.vy = Math.abs(p.vy) * 0.4; }
      if (p.y > H - 4) { p.y = H - 4; p.vy = -Math.abs(p.vy) * 0.3; p.vx *= 0.96; }
    });
    trail.forEach(function (t) { t.life -= dt * 2.5; });
    trail = trail.filter(function (t) { return t.life > 0; });
  }

  function measure() {
    var seen = {}, n = 0;
    parts.forEach(function (p) {
      var c = ((p.y / CELL) | 0) * 1000 + ((p.x / CELL) | 0);
      if (cellSet[c] && !seen[c]) { seen[c] = true; n++; }
    });
    coverage = n / cells.length;
    var shown = Math.min(100, Math.round(coverage / GOAL * 100));
    meter.style.width = shown + '%';
    pct.textContent = 'Match ' + Math.round(coverage * 100) + '%';
    if (!done && coverage >= GOAL) {
      done = true;
      say('Sculpture complete! ★★★');
      if (navigator.vibrate) navigator.vibrate([30, 60, 30]);
    }
  }

  function draw() {
    var s = canvas.width / W;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // Target outline
    ctx.save();
    ctx.fillStyle = done ? 'rgba(59,196,122,.18)' : 'rgba(255,255,255,.35)';
    ctx.fill(heart);
    ctx.setLineDash([8, 7]); ctx.lineWidth = 3;
    ctx.strokeStyle = done ? '#3BC47A' : 'rgba(36,50,74,.45)';
    ctx.stroke(heart);
    ctx.restore();
    // Wind trail
    if (trail.length > 1) {
      ctx.save();
      ctx.lineCap = 'round';
      for (var i = 1; i < trail.length; i++) {
        ctx.strokeStyle = 'rgba(255,255,255,' + (trail[i].life * 0.8).toFixed(2) + ')';
        ctx.lineWidth = 2 + trail[i].life * 6;
        ctx.beginPath(); ctx.moveTo(trail[i - 1].x, trail[i - 1].y); ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke();
      }
      ctx.restore();
    }
    // Leaves
    parts.forEach(function (p) {
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.ellipse(0, 0, 5 * p.s, 2.6 * p.s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  }

  var frames = 0;
  function frame(t) {
    if (!running) return;
    var dt = Math.min(0.05, (t - last) / 1000 || 0);
    last = t;
    var sub = Math.ceil(dt / (1 / 60));
    for (var i = 0; i < sub; i++) step(dt / sub);
    if (++frames % 6 === 0) measure();
    draw();
    requestAnimationFrame(frame);
  }
  function start() {
    if (running) return;
    running = true; last = performance.now();
    requestAnimationFrame(frame);
  }

  function toLocal(e) {
    var rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width * W, y: (e.clientY - rect.top) / rect.height * H, t: performance.now() };
  }
  canvas.addEventListener('pointerdown', function (e) {
    canvas.setPointerCapture(e.pointerId);
    pointer = toLocal(e);
  });
  canvas.addEventListener('pointermove', function (e) {
    var now = toLocal(e);
    // Mouse blows just by moving; touch and pen blow while pressed
    if (pointer && (e.pointerType === 'mouse' || e.buttons)) {
      var dt = Math.max(0.008, (now.t - pointer.t) / 1000);
      gust(pointer.x, pointer.y, now.x, now.y, dt);
    }
    pointer = now;
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
    canvas.addEventListener(ev, function (e) { if (e.pointerType !== 'mouse' || ev === 'pointerleave') pointer = null; });
  });
  document.getElementById('toy-reset').addEventListener('click', reset);

  reset();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.isIntersecting) start(); else running = false; });
    }).observe(canvas);
  } else {
    start();
  }
})();
