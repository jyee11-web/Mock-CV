/* textillate-anime.js
   Textillate remake on anime.js
   - Emoji-safe splitting (Intl.Segmenter fallback)
   - Full preset parity (fade/bounce/rotate/flip/lightSpeed/roll/zoom + hinge)
   - Textillate-accurate delay semantics (sync, shuffle, reverse, delayScale, function delay)
   - Easing normalizer to avoid unsupported-easing crashes
   ©2025 MIT License
*/
(function (global) {
  // ---------------- Utilities ----------------
  function wait(ms) { return new Promise(res => setTimeout(res, ms)); }

  function shuffleArray(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function deepMerge(target, src) {
    const out = Array.isArray(target) ? target.slice() : { ...target };
    for (const [k, v] of Object.entries(src || {})) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        out[k] = deepMerge(out[k] || {}, v);
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  // Map unsupported easings (like *Bounce) to safe anime.js easings
  function normalizeEasing(e) {
    if (!e) return e;
    if (typeof e === 'string' && /bounce/i.test(e)) {
      // anime.js does not implement bounce; approximate with back/elastic
      return e.toLowerCase().includes('in') ? 'easeInBack' : 'easeOutBack';
    }
    return e;
  }

  // Emoji/grapheme-safe split
  function splitGraphemes(str) {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      return Array.from(seg.segment(str), s => s.segment);
    }
    // Fallback tolerant of ZWJ/VS/skin tones (not full UAX#29)
    const ZWJ = /\u200D/;
    const VS = /[\uFE0E\uFE0F]/;
    const SKIN = /[\u{1F3FB}-\u{1F3FF}]/u;
    const out = [];
    let i = 0;
    while (i < str.length) {
      let g = '';
      const cp = str.codePointAt(i);
      const ch = String.fromCodePoint(cp);
      g += ch;
      i += ch.length;
      while (i < str.length) {
        const nextCp = str.codePointAt(i);
        const next = String.fromCodePoint(nextCp);
        if (VS.test(next) || SKIN.test(next)) {
          g += next; i += next.length;
        } else if (str[i] && ZWJ.test(str[i])) {
          g += str[i]; i++;
          const afterCp = str.codePointAt(i);
          const after = String.fromCodePoint(afterCp);
          g += after; i += after.length;
        } else break;
      }
      out.push(g);
    }
    return out;
  }

  function splitText(el, mode = 'chars') {
    const text = el.textContent;
    el.textContent = '';
    const frag = document.createDocumentFragment();
    const spans = [];

    function mkSpan(txt, cls) {
      const s = document.createElement('span');
      s.className = 'tlt-unit ' + (cls || '');
      s.textContent = txt;
      return s;
    }

    if (mode === 'words' || mode === 'lines') {
      const tokens = text.split(/(\s+)/);
      tokens.forEach(tok => {
        if (/^\s+$/.test(tok)) frag.appendChild(document.createTextNode(tok));
        else frag.appendChild(mkSpan(tok, 'tlt-word'));
      });
      el.appendChild(frag);

      if (mode === 'words') return Array.from(el.querySelectorAll('.tlt-word'));

      // lines: group words by visual line (top coordinate)
      const wordNodes = Array.from(el.querySelectorAll('.tlt-word'));
      const lines = [];
      let currentTop = null, current = [];
      wordNodes.forEach(node => {
        const { top } = node.getBoundingClientRect();
        if (currentTop === null) currentTop = top;
        if (Math.abs(top - currentTop) > 1) {
          const wrap = document.createElement('span');
          wrap.className = 'tlt-line';
          current.forEach(n => wrap.appendChild(n));
          el.insertBefore(wrap, current[0] || null);
          lines.push(wrap);
          current = [];
          currentTop = top;
        }
        current.push(node);
      });
      if (current.length) {
        const wrap = document.createElement('span');
        wrap.className = 'tlt-line';
        current.forEach(n => wrap.appendChild(n));
        el.insertBefore(wrap, current[0] || null);
        lines.push(wrap);
      }
      return lines;
    }

    // chars (graphemes)
    const tokens = text.split(/(\s+)/);
    tokens.forEach(tok => {
      if (/^\s+$/.test(tok)) {
        frag.appendChild(document.createTextNode(tok));
      } else {
        const wordWrap = document.createElement('span');
        wordWrap.className = 'tlt-word';
        splitGraphemes(tok).forEach(g => {
          const c = mkSpan(g, 'tlt-char');
          wordWrap.appendChild(c);
          spans.push(c);
        });
        frag.appendChild(wordWrap);
      }
    });
    el.appendChild(frag);
    return spans;
  }

  // ---------------- Presets ----------------
  const PRESETS = {
    // Fades
    fadeIn:         { in:  { opacity: [0,1], translateY: [10,0], easing: 'easeOutQuad' } },
    fadeInUp:       { in:  { opacity: [0,1], translateY: [20,0], easing: 'easeOutCubic' } },
    fadeInDown:     { in:  { opacity: [0,1], translateY: [-20,0], easing: 'easeOutCubic' } },
    fadeInLeft:     { in:  { opacity: [0,1], translateX: [-20,0], easing: 'easeOutCubic' } },
    fadeInRight:    { in:  { opacity: [0,1], translateX: [20,0], easing: 'easeOutCubic' } },
    fadeInUpBig:    { in:  { opacity: [0,1], translateY: [60,0], easing: 'easeOutCubic' } },
    fadeInDownBig:  { in:  { opacity: [0,1], translateY: [-60,0], easing: 'easeOutCubic' } },
    fadeInLeftBig:  { in:  { opacity: [0,1], translateX: [-60,0], easing: 'easeOutCubic' } },
    fadeInRightBig: { in:  { opacity: [0,1], translateX: [60,0], easing: 'easeOutCubic' } },

    fadeOut:         { out: { opacity: [1,0], translateY: [0,-10], easing: 'easeInQuad' } },
    fadeOutDown:     { out: { opacity: [1,0], translateY: [0,20],  easing: 'easeInCubic' } },
    fadeOutUp:       { out: { opacity: [1,0], translateY: [0,-20], easing: 'easeInCubic' } },
    fadeOutLeft:     { out: { opacity: [1,0], translateX: [0,-20], easing: 'easeInCubic' } },
    fadeOutRight:    { out: { opacity: [1,0], translateX: [0,20],  easing: 'easeInCubic' } },
    fadeOutUpBig:    { out: { opacity: [1,0], translateY: [0,-60], easing: 'easeInCubic' } },
    fadeOutDownBig:  { out: { opacity: [1,0], translateY: [0,60],  easing: 'easeInCubic' } },
    fadeOutLeftBig:  { out: { opacity: [1,0], translateX: [0,-60], easing: 'easeInCubic' } },
    fadeOutRightBig: { out: { opacity: [1,0], translateX: [0,60],  easing: 'easeInCubic' } },

    // Bounce (approx with back/elastic; anime.js has no 'bounce')
    bounceIn:        { in:  { opacity: [0,1], scale: [0.8,1], easing: 'easeOutElastic(1,.6)' } },
    bounceInDown:    { in:  { opacity: [0,1], translateY: [-80,0], easing: 'easeOutBack' } },
    bounceInUp:      { in:  { opacity: [0,1], translateY: [80,0],  easing: 'easeOutBack' } },
    bounceInLeft:    { in:  { opacity: [0,1], translateX: [-80,0], easing: 'easeOutBack' } },
    bounceInRight:   { in:  { opacity: [0,1], translateX: [80,0],  easing: 'easeOutBack' } },

    bounceOut:       { out: { opacity: [1,0], scale: [1,0.8], easing: 'easeInBack' } },
    bounceOutDown:   { out: { opacity: [1,0], translateY: [0,80],  easing: 'easeInBack' } },
    bounceOutUp:     { out: { opacity: [1,0], translateY: [0,-80], easing: 'easeInBack' } },
    bounceOutLeft:   { out: { opacity: [1,0], translateX: [0,-80], easing: 'easeInBack' } },
    bounceOutRight:  { out: { opacity: [1,0], translateX: [0,80],  easing: 'easeInBack' } },

    // Rotate
    rotateIn:             { in:  { opacity: [0,1], rotate: [-15,0], easing: 'easeOutCubic' } },
    rotateInDownLeft:     { in:  { opacity: [0,1], rotate: [-45,0], transformOrigin: 'left bottom',  easing: 'easeOutCubic' } },
    rotateInDownRight:    { in:  { opacity: [0,1], rotate: [45,0],  transformOrigin: 'right bottom', easing: 'easeOutCubic' } },
    rotateInUpLeft:       { in:  { opacity: [0,1], rotate: [45,0],  transformOrigin: 'left bottom',  easing: 'easeOutCubic' } },
    rotateInUpRight:      { in:  { opacity: [0,1], rotate: [-45,0], transformOrigin: 'right bottom', easing: 'easeOutCubic' } },

    rotateOut:            { out: { opacity: [1,0], rotate: [0,15],  easing: 'easeInCubic' } },
    rotateOutDownLeft:    { out: { opacity: [1,0], rotate: [0,45],  transformOrigin: 'left bottom',  easing: 'easeInCubic' } },
    rotateOutDownRight:   { out: { opacity: [1,0], rotate: [0,-45], transformOrigin: 'right bottom', easing: 'easeInCubic' } },
    rotateOutUpLeft:      { out: { opacity: [1,0], rotate: [0,-45], transformOrigin: 'left bottom',  easing: 'easeInCubic' } },
    rotateOutUpRight:     { out: { opacity: [1,0], rotate: [0,45],  transformOrigin: 'right bottom', easing: 'easeInCubic' } },

    // Flip
    flip:        { in:  { opacity: [0,1], rotateY: [-180,0], easing: 'easeOutBack' } },
    flipInX:     { in:  { opacity: [0,1], rotateX: [-90,0],  easing: 'easeOutBack' } },
    flipInY:     { in:  { opacity: [0,1], rotateY: [-90,0],  easing: 'easeOutBack' } },
    flipOutX:    { out: { opacity: [1,0], rotateX: [0,90],   easing: 'easeInBack' } },
    flipOutY:    { out: { opacity: [1,0], rotateY: [0,90],   easing: 'easeInBack' } },

    // LightSpeed
    lightSpeedIn:  { in:  { opacity: [0,1], translateX: [50,0], skewX: [-20,0], easing: 'easeOutCubic' } },
    lightSpeedOut: { out: { opacity: [1,0], translateX: [0,50],  skewX: [0,20],  easing: 'easeInCubic' } },

    // Roll
    rollIn:   { in:  { opacity: [0,1], translateX: [-60,0], rotate: [-120,0], easing: 'easeOutCubic' } },
    rollOut:  { out: { opacity: [1,0], translateX: [0,60],  rotate: [0,120],  easing: 'easeInCubic' } },

    // Zoom
    zoomIn:   { in:  { opacity: [0,1], scale: [0.8,1], easing: 'easeOutBack' } },
    zoomOut:  { out: { opacity: [1,0], scale: [1,0.8], easing: 'easeInBack' } },

    // Hinge (out-only)
    hinge: { out: {
      duration: 1200, easing: 'linear',
      rotate: [0, 80],
      transformOrigin: 'top left',
      opacity: [
        { value: 1, duration: 200 },
        { value: 0, duration: 200, delay: 800 }
      ],
      translateY: [
        { value: 0, duration: 800 },
        { value: 700, duration: 200 }
      ]
    }},
  };

  // ---------------- Core ----------------
  class TextillateAnime {
    constructor(el, opts = {}) {
      this.el = typeof el === 'string' ? document.querySelector(el) : el;
      if (!this.el) throw new Error('TextillateAnime: element not found');

      const defaults = {
        selector: null,
        split: 'chars',          // 'chars' | 'words' | 'lines'
        minDisplayTime: 2000,
        initialDelay: 0,
        loop: false,
        autoplay: true,
        in:  { effect: 'fadeIn',  duration: 600, delayScale: 1.0, delay: 50, sync: false, shuffle: false, reverse: false, easing: 'easeOutQuad' },
        out: { effect: 'fadeOut', duration: 400, delayScale: 1.0, delay: 20, sync: false, shuffle: false, reverse: false, easing: 'easeInQuad' },
        callbackIn: null,
        callbackOut: null,
        onComplete: null,
      };

      this.o = deepMerge(defaults, opts);
      const contentEl = this.o.selector ? this.el.querySelector(this.o.selector) : this.el;

      this.units = splitText(contentEl, this.o.split);
      this._running = false;

      // base styles
      this.units.forEach(u => {
        u.style.display = 'inline-block';
        u.style.opacity = 0;
        u.style.transformOrigin = '50% 50%';
      });

      if (this.o.autoplay) setTimeout(() => this.start(), this.o.initialDelay);
    }

    start() {
      if (this._running) return;
      this._running = true;
      this._playCycle();
    }

    stop() { this._running = false; }

    destroy() {
      this.stop();
      const text = this.units.map(u => u.textContent).join('');
      this.el.textContent = text;
    }

    async _playCycle() {
      const { in: inCfg, out: outCfg, loop, minDisplayTime, onComplete } = this.o;

      await this._animateGroup('in', inCfg);
      if (typeof this.o.callbackIn === 'function') this.o.callbackIn();

      if (outCfg && outCfg.effect) {
        await wait(minDisplayTime);
        await this._animateGroup('out', outCfg);
        if (typeof this.o.callbackOut === 'function') this.o.callbackOut();
      }

      if (loop && this._running) {
        this.units.forEach(u => { u.style.opacity = 0; u.style.transform = 'none'; });
        return this._playCycle();
      } else {
        this._running = false;
        if (typeof onComplete === 'function') onComplete();
      }
    }

    _animateGroup(direction, cfg) {
      const base = Object.assign({}, cfg);
      const fromPreset = PRESETS[base.effect] && PRESETS[base.effect][direction]
        ? PRESETS[base.effect][direction]
        : {};

      let targets = this.units.slice();

      // Order (Textillate behavior)
      if (base.shuffle) shuffleArray(targets);
      if (base.reverse) targets = targets.reverse();

      // Transform origin
      if (fromPreset.transformOrigin) {
        targets.forEach(t => t.style.transformOrigin = fromPreset.transformOrigin);
      } else {
        targets.forEach(t => t.style.transformOrigin = '50% 50%');
      }

      // Delay semantics: sync ? 0 : delayScale * ( fn(el,i) OR (Number(delay)*i) )
      const computedDelay = (el, i) => {
        if (base.sync) return 0;
        const d = (typeof base.delay === 'function')
          ? base.delay(el, i)
          : (Number(base.delay) || 0) * i;
        return base.delayScale * d;
      };

      const animeOpts = {
        targets,
        duration: fromPreset.duration || base.duration,
        easing: normalizeEasing(base.easing || fromPreset.easing || (direction === 'in' ? 'easeOutQuad' : 'easeInQuad')),
        ...fromPreset,
        delay: computedDelay,
      };

      return new Promise(resolve => {
        anime({
          ...animeOpts,
          complete: resolve
        });
      });
    }
  }

  // Convenience
  function textillate(el, options) { return new TextillateAnime(el, options); }

  // Export
  global.TextillateAnime = TextillateAnime;
  global.textillate = textillate;
})(window);
