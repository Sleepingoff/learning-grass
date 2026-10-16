chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}).catch(console.error);
const KEY = 'learningGrassSessions';
const NAME_KEY = 'learningGrassManualCourses';
const cleanTitle = value => (typeof value === 'string' ? value.replace(/\s+/g,' ').trim() : '');
const knouSelections = new Map();
async function resolveKnouMetadata(tab, msg) {
  if (msg.platform !== '방통대') return {title:cleanTitle(msg.title),course:cleanTitle(msg.course)};
  const now = Date.now();
  const selected = [...knouSelections.values()].filter(x => now-x.at < 30*60*1000 &&
    (x.tabId === tab.openerTabId || x.windowId === tab.windowId || now-x.at < 30000))
    .sort((a,b)=>b.at-a.at)[0];
  const explicit = cleanTitle(msg.course);
  const course = selected?.course || (explicit && !/^(마이페이지|학습하기|학습목록)/.test(explicit) ? explicit : '');
  return {title:course || '방통대 과목명 확인 필요',course:''};
}
const MAX_SESSIONS = 30000;
const VALID_PROTOCOL = /^https?:$/;
const asString = (v, n=250) => typeof v === 'string' ? v.slice(0,n) : '';
const dayKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
let writeQueue = Promise.resolve();
function queueWrite(fn) { writeQueue = writeQueue.then(fn).catch(console.error); return writeQueue; }
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type === 'OPEN_DASHBOARD') { chrome.sidePanel.open({windowId: sender.tab?.windowId}).then(()=>reply({ok:true})).catch(()=>reply({ok:false})); return; }
  if (msg?.type === 'KNOU_COURSE_SELECTED') {
    if (!sender.tab?.id || !/knou\.ac\.kr$/i.test(new URL(sender.url || sender.tab.url).hostname)) { reply({ok:false}); return; }
    const course = cleanTitle(msg.course).slice(0,250);
    if (!course || /^(마이페이지|학습하기|학습목록)/.test(course)) { reply({ok:false}); return; }
    knouSelections.set(sender.tab.id,{tabId:sender.tab.id,windowId:sender.tab.windowId,course,at:Date.now()});
    reply({ok:true}); return;
  }
  if (msg?.type === 'SET_MANUAL_COURSE') {
    const name = cleanTitle(msg.name).slice(0,120);
    const oldTitle = cleanTitle(msg.oldTitle);
    if (!name || !oldTitle || !/^방통대 (과목명 확인 필요|강의)/.test(oldTitle)) { reply({ok:false}); return; }
    queueWrite(async () => {
      const data = await chrome.storage.local.get([KEY, NAME_KEY]);
      const names = data[NAME_KEY] || {};
      // Associate the fallback label with the exact source URL, not every KNOU course.
      const target = (data[KEY] || []).find(x => x.id === msg.sessionId && x.platform === '방통대');
      if (!target) return false;
      const match = x => x.platform === '방통대' && x.title === oldTitle && x.url === target.url;
      const sessions = data[KEY].map(x => match(x) ? {...x,title:name,course:''} : x);
      names[target.url] = name;
      await chrome.storage.local.set({[KEY]:sessions,[NAME_KEY]:names});
      return true;
    }).then(ok => reply({ok}),()=>reply({ok:false}));
    return true;
  }
  if (msg?.type !== 'LEARNING_TICK') return;
  if (!sender.tab?.id || !sender.url) { reply({ok:false}); return; }
  let u;
  try { u = new URL(sender.url); } catch { reply({ok:false}); return; }
  if (!VALID_PROTOCOL.test(u.protocol)) { reply({ok:false}); return; }
  const duration = Number(msg.seconds);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 15) { reply({ok:false}); return; }
  const frameId = sender.frameId ?? 0;
  const stamp = Date.now();
  const source = asString(msg.platform, 80) || u.hostname;
  const rawTitle = asString(msg.title, 250) || '제목 없는 강의';
  const rawCourse = asString(msg.course, 250);
  const url = asString(msg.url, 1500);
  queueWrite(async () => {
    const resolved = await resolveKnouMetadata(sender.tab, {platform:source,title:rawTitle,course:rawCourse});
    const nameMap = (await chrome.storage.local.get(NAME_KEY))[NAME_KEY] || {};
    const title = source === '방통대' && nameMap[url] ? nameMap[url] : (resolved.title || rawTitle);
    const course = resolved.course || rawCourse;
    const data = await chrome.storage.local.get(KEY);
    const sessions = Array.isArray(data[KEY]) ? data[KEY] : [];
    const key = `${sender.tab.id}:${frameId}:${asString(msg.videoId,120)}`;
    const last = sessions[sessions.length-1];
    // Split sessions after pauses, navigation, or local midnight.
    if (last && last.key === key && last.title === title && stamp - last.end < 30000 && dayKey(last.end) === dayKey(stamp)) {
      last.seconds += duration;
      last.end = stamp;
    } else {
      sessions.push({id:crypto.randomUUID(),key,platform:source,title,course,url,seconds:duration,start:stamp-duration*1000,end:stamp});
    }
    await chrome.storage.local.set({[KEY]: sessions.slice(-MAX_SESSIONS)});
  }).then(() => reply({ok:true}), () => reply({ok:false}));
  return true;
});
