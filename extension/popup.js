const format = s => { const m=Math.floor(s/60);return m>=60?`${Math.floor(m/60)}시간 ${m%60}분`:`${m}분`;};
const dateKey = ts => {const d=new Date(ts);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
chrome.storage.local.get('learningGrassSessions').then(data=>{const sessions=data.learningGrassSessions||[];const today=sessions.filter(x=>dateKey(x.start)===dateKey(Date.now()));document.getElementById('popupToday').textContent=format(today.reduce((n,x)=>n+x.seconds,0));document.getElementById('popupCount').textContent=`오늘 ${today.length}개 학습 세션 기록`;});
document.getElementById('openDashboard').onclick=()=>chrome.runtime.openOptionsPage();
