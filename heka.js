/* HEKA showcase — behaviors
 * - typewriter on titles of the active slide
 * - particles (dust + sparks) for title + finale slides
 * - global progress bar
 * - audio toggle (ambient pad + click SFX) using WebAudio (synthesized, no assets)
 */

(() => {
  // ============= TYPEWRITER =============
  const typeTitle = (el, opts = {}) => {
    if (!el) return;
    const speed = opts.speed ?? 38; // ms per char
    const finalHTML = el.getAttribute('data-final') || el.innerHTML;
    el.setAttribute('data-final', finalHTML);

    // Build a list of "atoms": either plain chars, or HTML element wrappers.
    // We parse the final HTML into a DOM tree, then walk and accumulate characters.
    const temp = document.createElement('div');
    temp.innerHTML = finalHTML;

    // collect plan: each entry is {type: 'open'|'close'|'char', value}
    const plan = [];
    const walk = (node) => {
      if (node.nodeType === 3) {
        for (const ch of node.nodeValue) plan.push({ type: 'char', value: ch });
      } else if (node.nodeType === 1) {
        const tag = node.tagName.toLowerCase();
        const attrs = [...node.attributes].map(a => `${a.name}="${a.value}"`).join(' ');
        plan.push({ type: 'open', tag, attrs });
        node.childNodes.forEach(walk);
        plan.push({ type: 'close', tag });
      }
    };
    temp.childNodes.forEach(walk);

    // Render incrementally
    el.innerHTML = '';
    let html = '';
    let i = 0;
    const cursor = '<span class="tw-cursor"></span>';

    const step = () => {
      if (i >= plan.length) {
        el.innerHTML = html + cursor;
        // remove cursor after a moment
        setTimeout(() => {
          el.innerHTML = html;
        }, 1200);
        return;
      }
      const p = plan[i++];
      if (p.type === 'open') {
        html += `<${p.tag}${p.attrs ? ' ' + p.attrs : ''}>`;
        step();
        return;
      }
      if (p.type === 'close') {
        html += `</${p.tag}>`;
        step();
        return;
      }
      // char
      html += p.value === ' ' ? ' ' : escapeHTML(p.value);
      el.innerHTML = html + cursor;
      const delay = p.value === ' ' ? speed * 0.5 : (Math.random() < 0.06 ? speed * 4 : speed);
      setTimeout(step, delay);
    };
    step();
  };

  const escapeHTML = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // run typewriter for the active slide's titles
  const runTypewriter = (slide) => {
    if (!slide) return;
    const speedMult = window.__HEKA_SPEED__ ?? 1;
    slide.querySelectorAll('[data-tw]').forEach((el, idx) => {
      // restart anim each time it becomes active
      const speed = parseFloat(el.dataset.tw) || 36;
      setTimeout(() => typeTitle(el, { speed: speed / speedMult }), idx * 80);
    });
  };

  // ============= PARTICLES =============
  class ParticleField {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.opts = { density: 0.8, sparks: true, ...opts };
      this.dust = [];
      this.sparks = [];
      this.running = false;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.resize();
      this.init();
    }
    resize() {
      const w = this.canvas.clientWidth || 1920;
      const h = this.canvas.clientHeight || 1080;
      this.canvas.width = w * this.dpr;
      this.canvas.height = h * this.dpr;
      this.w = w; this.h = h;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
    init() {
      const count = Math.floor(140 * this.opts.density);
      this.dust = [];
      for (let i = 0; i < count; i++) {
        this.dust.push(this.spawnDust(true));
      }
    }
    spawnDust(initial = false) {
      return {
        x: Math.random() * this.w,
        y: initial ? Math.random() * this.h : this.h + 20,
        vx: (Math.random() - 0.5) * 0.15,
        vy: -0.05 - Math.random() * 0.25,
        r: 0.6 + Math.random() * 2.2,
        a: 0.15 + Math.random() * 0.55,
        twPhase: Math.random() * Math.PI * 2,
        twSpeed: 0.005 + Math.random() * 0.012,
        hue: Math.random() < 0.7 ? 'blue' : 'copper',
      };
    }
    spawnSpark() {
      const fromEdge = Math.random();
      let x, y, vx, vy;
      if (fromEdge < 0.5) {
        x = Math.random() * this.w;
        y = Math.random() < 0.5 ? -5 : this.h + 5;
        vx = (Math.random() - 0.5) * 2;
        vy = y < 0 ? 0.5 + Math.random() * 1.2 : -(0.5 + Math.random() * 1.2);
      } else {
        x = Math.random() < 0.5 ? -5 : this.w + 5;
        y = Math.random() * this.h;
        vx = x < 0 ? 0.5 + Math.random() * 1.5 : -(0.5 + Math.random() * 1.5);
        vy = (Math.random() - 0.5) * 1.0;
      }
      return { x, y, vx, vy, life: 1, decay: 0.006 + Math.random() * 0.01, len: 18 + Math.random() * 28 };
    }
    start() {
      if (this.running) return;
      this.running = true;
      this.lastSpark = 0;
      const tick = (t) => {
        if (!this.running) return;
        this.draw(t);
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    }
    stop() {
      this.running = false;
      if (this.raf) cancelAnimationFrame(this.raf);
    }
    draw(t) {
      const ctx = this.ctx;
      // light trail by overdrawing semi-transparent bg
      ctx.fillStyle = 'rgba(7, 8, 13, 0.18)';
      ctx.fillRect(0, 0, this.w, this.h);

      // dust
      for (const p of this.dust) {
        p.x += p.vx + Math.sin(p.twPhase) * 0.3;
        p.y += p.vy;
        p.twPhase += p.twSpeed;
        if (p.y < -10 || p.x < -10 || p.x > this.w + 10) {
          Object.assign(p, this.spawnDust(false));
        }
        const aa = p.a * (0.6 + 0.4 * Math.sin(p.twPhase));
        const color = p.hue === 'blue'
          ? `rgba(120, 210, 255, ${aa})`
          : `rgba(217, 162, 76, ${aa * 0.7})`;
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        if (p.r > 1.6) {
          ctx.beginPath();
          ctx.fillStyle = color.replace(/[\d.]+\)$/, `${aa * 0.15})`);
          ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // sparks (occasional)
      if (this.opts.sparks) {
        if (t - this.lastSpark > 700 + Math.random() * 1800) {
          this.sparks.push(this.spawnSpark());
          this.lastSpark = t;
        }
        for (let i = this.sparks.length - 1; i >= 0; i--) {
          const s = this.sparks[i];
          s.x += s.vx; s.y += s.vy; s.life -= s.decay;
          if (s.life <= 0) { this.sparks.splice(i, 1); continue; }
          const tx = s.x - s.vx * s.len * 0.4;
          const ty = s.y - s.vy * s.len * 0.4;
          const grad = ctx.createLinearGradient(tx, ty, s.x, s.y);
          grad.addColorStop(0, `rgba(0, 191, 255, 0)`);
          grad.addColorStop(1, `rgba(180, 230, 255, ${s.life})`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(s.x, s.y);
          ctx.stroke();
          // glow head
          ctx.beginPath();
          ctx.fillStyle = `rgba(220, 245, 255, ${s.life * 0.8})`;
          ctx.arc(s.x, s.y, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  const particleFields = new Map();
  const initParticles = (slide) => {
    const canvas = slide.querySelector('canvas.particles');
    if (!canvas) return;
    if (particleFields.has(canvas)) return;
    const field = new ParticleField(canvas, {
      density: parseFloat(canvas.dataset.density) || 0.9,
      sparks: canvas.dataset.sparks !== 'false',
    });
    particleFields.set(canvas, field);
  };
  const startParticlesFor = (slide) => {
    initParticles(slide);
    particleFields.forEach((f, c) => {
      if (slide && slide.contains(c)) f.start();
      else f.stop();
    });
  };

  // ============= AUDIO =============
  const audio = {
    ctx: null,
    master: null,
    on: false,
    sources: [],
    init() {
      if (this.ctx) return;
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
    },
    startAmbient() {
      this.init();
      if (this.ambientPlaying) return;
      this.ambientPlaying = true;
      const ctx = this.ctx;
      // Ambient: low drone + slow shimmer
      const drone = ctx.createOscillator();
      drone.type = 'sine';
      drone.frequency.value = 55; // A1
      const droneG = ctx.createGain();
      droneG.gain.value = 0.14;
      drone.connect(droneG).connect(this.master);
      drone.start();

      const drone2 = ctx.createOscillator();
      drone2.type = 'triangle';
      drone2.frequency.value = 82.5; // perfect fifth
      const drone2G = ctx.createGain();
      drone2G.gain.value = 0.06;
      drone2.connect(drone2G).connect(this.master);
      drone2.start();

      // shimmer LFO
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 0.04;
      lfo.connect(lfoG).connect(droneG.gain);
      lfo.start();

      // subtle high pad
      const pad = ctx.createOscillator();
      pad.type = 'sine';
      pad.frequency.value = 220;
      const padG = ctx.createGain();
      padG.gain.value = 0.012;
      const padFilt = ctx.createBiquadFilter();
      padFilt.type = 'lowpass';
      padFilt.frequency.value = 800;
      pad.connect(padG).connect(padFilt).connect(this.master);
      pad.start();

      this.sources.push(drone, drone2, lfo, pad);

      // fade in
      this.master.gain.cancelScheduledValues(ctx.currentTime);
      this.master.gain.setValueAtTime(0, ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 1.4);
    },
    stopAmbient() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      this.master.gain.cancelScheduledValues(ctx.currentTime);
      this.master.gain.setValueAtTime(this.master.gain.value, ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
      setTimeout(() => {
        this.sources.forEach(s => { try { s.stop(); } catch(e){} });
        this.sources = [];
        this.ambientPlaying = false;
      }, 700);
    },
    click() {
      if (!this.on) return;
      this.init();
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = 1200;
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 800;
      o.connect(f).connect(g).connect(ctx.destination);
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.08, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      o.frequency.exponentialRampToValueAtTime(400, t + 0.08);
      o.start(t);
      o.stop(t + 0.1);
    },
    type() {
      if (!this.on) return;
      this.init();
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = 1800 + Math.random() * 600;
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1800;
      f.Q.value = 4;
      o.connect(f).connect(g).connect(ctx.destination);
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.015, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      o.start(t);
      o.stop(t + 0.05);
    },
    setOn(on) {
      this.on = on;
      const btn = document.getElementById('audio-toggle');
      if (btn) {
        if (on) btn.setAttribute('data-on', '');
        else btn.removeAttribute('data-on');
        btn.querySelector('.label').textContent = on ? 'Audio · ON' : 'Audio · OFF';
      }
      if (on) this.startAmbient();
      else this.stopAmbient();
    },
  };

  // typewriter sound hook
  const originalSetTimeout = window.setTimeout;
  // We hook into character rendering: easier approach — periodically poll typing cursor
  // Simpler: dispatch a custom 'tw-char' event from typewriter
  // (For now skip per-char audio to avoid overhead; just click on slide change.)

  // ============= PROGRESS BAR =============
  const buildProgress = (total) => {
    const wrap = document.createElement('div');
    wrap.className = 'deck-progress';
    wrap.innerHTML = `<div class="fill"></div><div class="dots"></div>`;
    const dots = wrap.querySelector('.dots');
    for (let i = 0; i < total; i++) dots.appendChild(document.createElement('span'));
    document.body.appendChild(wrap);
    return wrap;
  };

  const updateProgress = (wrap, idx, total) => {
    const pct = ((idx + 1) / total) * 100;
    wrap.querySelector('.fill').style.width = pct + '%';
  };

  // ============= INIT =============
  document.addEventListener('DOMContentLoaded', () => {
    const stage = document.querySelector('deck-stage');
    if (!stage) return;
    const slides = [...stage.querySelectorAll(':scope > section.slide')];
    const total = slides.length;
    const progress = buildProgress(total);

    // audio toggle button
    const btn = document.createElement('button');
    btn.className = 'audio-toggle';
    btn.id = 'audio-toggle';
    btn.innerHTML = `<span class="ico"></span><span class="label">Audio · OFF</span>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      audio.setOn(!audio.on);
    });
    document.body.appendChild(btn);

    // keyboard hint
    const hint = document.createElement('div');
    hint.className = 'kbd-hint';
    hint.innerHTML = `<span class="kbd">←</span><span class="kbd">→</span><span>NAVEGAR</span>`;
    document.body.appendChild(hint);

    // game website nav bar
    const nav = document.createElement('nav');
    nav.className = 'game-nav';
    nav.setAttribute('aria-hidden', 'true');
    nav.innerHTML = `
      <div class="game-nav-logo">HEKA<span>· Islas en Sombra</span></div>
      <div class="game-nav-center"><span class="game-nav-pill" id="gnav-label">DEFENSA TFG</span></div>
      <div class="game-nav-right">
        <span class="game-nav-tag">GODOT 4.6</span>
        <span class="game-nav-tag">DAM · CEU FP</span>
      </div>`;
    document.body.appendChild(nav);
    const updateNav = (slide, idx) => {
      const pill = nav.querySelector('#gnav-label');
      if (pill) pill.textContent = slide.dataset.screenLabel || String(idx + 1).padStart(2, '0');
      // Hide on coming soon cover (slide 0), show on content slides
      nav.style.opacity = idx === 0 ? '0' : '1';
      nav.style.pointerEvents = idx === 0 ? 'none' : 'auto';
    };

    // listen for slide changes via custom event on stage
    const onChange = (slide, idx) => {
      updateProgress(progress, idx, total);
      runTypewriter(slide);
      startParticlesFor(slide);
      updateNav(slide, idx);
      audio.click();
    };

    stage.addEventListener('slidechange', (e) => {
      onChange(e.detail.slide, e.detail.index);
    });

    // fallback initial trigger after a tick (in case slidechange fired before listener)
    setTimeout(() => {
      const active = slides.find(s => s.hasAttribute('data-deck-active')) || slides[0];
      const idx = slides.indexOf(active);
      onChange(active, idx);
    }, 50);
  });

  // expose simple API for tweaks
  window.HEKA = {
    setSpeed(mult) { window.__HEKA_SPEED__ = mult; },
    setParticleDensity(d) {
      document.querySelectorAll('canvas.particles').forEach(c => {
        c.dataset.density = d;
        const f = particleFields.get(c);
        if (f) { f.opts.density = d; f.init(); }
      });
    },
    audio,
  };
})();
