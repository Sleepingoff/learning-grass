(() => {
  if (window.__learningGrassActive) return;
  window.__learningGrassActive = true;
  const HOST = location.hostname.toLowerCase();
  const platform = HOST.includes('inflearn.com') ? '인프런' : HOST.includes('udemy.com') ? 'Udemy' : HOST.includes('knou.ac.kr') ? '방통대' : HOST;
  const normalize = text => (text || '').replace(/\s+/g, ' ').trim().slice(0,250);
  const textOf = selectors => { for (const selector of selectors) { try { const t = normalize(document.querySelector(selector)?.textContent); if (t) return t; } catch {} } return ''; };
  function metadata() {
    const course = textOf(['[data-purpose="course-header-title"]', '.course-title', 'h1', '[class*="courseTitle"]']);
    const lesson = textOf(['[data-purpose="curriculum-item-title"]', '[data-purpose="video-title"]', '.lecture-title', '[class*="lessonTitle"]', 'h2']);
    const pageTitle = normalize(document.title.replace(/\s*[-|]\s*(인프런|Inflearn|Udemy).*$/i,''));
    const title = platform === '방통대' ? (course || '방통대 과목명 확인 필요') : (lesson || pageTitle || course || '제목 없는 강의');
    return {title,course: course && course !== title ? course : '',platform,url:location.href};
  }
  // KNOU: the course name is the accordion heading ABOVE the lesson rows.
  // Store the heading associated with the clicked lecture, not the lesson row.
  if (platform === '방통대') {
    const invalid = t => !t || /^(학습하기|강의보기|마이페이지|학습목록|강의 홈|강의자료)$/.test(t);
    function findCourse(button) {
      let row = button.closest('tr, li, [role="row"]');
      if (!row) {
        let node = button;
        for (let i = 0; node && i < 7; i++, node = node.parentElement) {
          if (/\d+\s*강[.．:]?/.test(node.innerText || '') && node.querySelectorAll('button,a').length < 10) { row = node; break; }
        }
      }
      // Search upwards for an accordion/card containing the lesson list and its heading.
      for (let node = row || button; node && node !== document.body; node = node.parentElement) {
        const text = node.innerText || '';
        if (!/\d+\s*강[.．:]?/.test(text)) continue;
        const headings = [...node.querySelectorAll('h1,h2,h3,h4,h5,[class*="accordion-header"],[class*="accordionHeader"],[class*="panel-title"],[class*="card-header"],[class*="subject"],[class*="course-name"],[aria-controls]')];
        for (const heading of headings) {
          const label = normalize(heading.innerText || heading.textContent).replace(/\s*\d+(?:\.\d+)?%\s*$/, '');
          if (label && label.length < 100 && !invalid(label) && !/\d+\s*강[.．:]?/.test(label) && !/학습영상|연습문제|학습시간/.test(label)) return label;
        }
        // In some KNOU layouts, the accordion title is a direct preceding sibling.
        for (let prev = node.previousElementSibling, i=0; prev && i<3; prev=prev.previousElementSibling,i++) {
          const label = normalize(prev.innerText || prev.textContent).replace(/\s*\d+(?:\.\d+)?%\s*$/, '');
          if (label && label.length < 100 && !invalid(label) && !/\d+\s*강/.test(label)) return label;
        }
      }
      return '';
    }
    document.addEventListener('click', event => {
      const button = event.target.closest('button, a, input[type="button"], [role="button"]');
      if (!button || !/강의\s*보기|학습\s*하기|재생/.test(normalize(button.innerText || button.textContent || button.value))) return;
      const course = findCourse(button);
      if (course) chrome.runtime.sendMessage({type:'KNOU_COURSE_SELECTED',course,sourceUrl:location.href,at:Date.now()}).catch(()=>{});
    }, true);
  }
  const states = new WeakMap();
  const ids = new WeakMap();
  let counter = 0;
  function tick() {
    document.querySelectorAll('video').forEach(video => {
      if (!ids.has(video)) ids.set(video, String(++counter));
      const now = performance.now();
      const prev = states.get(video);
      const active = !video.paused && !video.ended && video.readyState >= 2 && video.playbackRate > 0 && !video.seeking && video.videoWidth >= 0;
      if (prev && prev.active && active && document.visibilityState === 'visible') {
        const elapsed = Math.min((now - prev.time) / 1000, 5);
        const advanced = Math.max(0, video.currentTime - prev.position);
        // Ignore stalled video and huge seek jumps. Count real elapsed wall time, not media time.
        if (elapsed > 0 && advanced > 0 && advanced <= elapsed * Math.max(video.playbackRate, 0.25) * 1.8 + 0.75) {
          const seconds = Math.min(elapsed, 5);
          chrome.runtime.sendMessage({type:'LEARNING_TICK',seconds,videoId:ids.get(video),...metadata()}).catch(()=>{});
        }
      }
      states.set(video,{time:now,position:video.currentTime,active});
    });
  }
  setInterval(tick, 4000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') document.querySelectorAll('video').forEach(v => states.delete(v)); });
  tick();
})();
