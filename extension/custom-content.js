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
    const title = lesson || normalize(document.title.replace(/\s*[-|]\s*(인프런|Inflearn|Udemy).*$/i,'')) || course || '제목 없는 강의';
    return {title,course: course && course !== title ? course : '',platform,url:location.href};
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
