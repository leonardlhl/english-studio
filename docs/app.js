const lessons = [
  {
    id: 'aspiration', type: '發音入門', title: '送氣音：p、t、k', duration: '約 30 秒', nav: '送氣音測試',
    context: '先用三組詞比較開頭嗰一口氣。每組讀兩次，保持自然語速。',
    lines: ['pin, spin', 'top, stop', 'key, ski'],
    focus: 'pin / top / key 開頭通常有較明顯送氣；跟在 s 後面嘅 p / t / k 會弱好多。',
    reference: 'https://assets.cambridge.org/052186/2302/frontmatter/0521862302_frontmatter.pdf',
    referenceLabel: '睇 Cambridge 發音說明'
  },
  {
    id: 'city', type: '建築短講', title: '建築點樣回應城市', duration: '約 35 秒', nav: '城市與公共空間',
    context: '原創練習稿，取材自建築演講常見嘅「設計對人有咩影響」講法。',
    lines: ['A good building should give something back to the city.', 'It can create a place where people pause, meet, and feel welcome.', 'In this project, the public space is as important as the tower itself.'],
    focus: '重讀 good building、give back、public space；每句講完停一停。留意 people、place、project 開頭嘅 p。',
    reference: 'https://www.ted.com/talks/ole_scheeren_why_great_architecture_should_tell_a_story',
    referenceLabel: '睇 Ole Scheeren TED 原片'
  },
  {
    id: 'idea', type: 'Presentation', title: '講清楚設計決定', duration: '約 40 秒', nav: '設計理念',
    context: '用「問題 → 決定 → 效果」講設計。讀熟之後，將內容換成你自己嘅項目。',
    lines: ['The site needed more shade and a clearer public entrance.', 'So we moved the main volume back and opened the ground floor.', 'This gives people a cooler, more welcoming route through the building.'],
    focus: '重讀 needed、moved、opened、gives；so we 之後稍停，令聽眾跟到因果關係。',
    reference: 'https://www.ted.com/talks/alejandro_aravena_my_architectural_philosophy_bring_the_community_into_the_process',
    referenceLabel: '睇 Alejandro Aravena TED 原片'
  }
];

const $ = (id) => document.getElementById(id);
const DB_NAME = 'english-studio-recordings';
let currentLesson = lessons[0];
let db;
let recorder;
let stream;
let chunks = [];
let recordingStarted = 0;
let timerInterval;
let audioUrls = [];

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('呢個瀏覽器唔支援本機錄音儲存。'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('takes', { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getTake(key) {
  return new Promise((resolve, reject) => {
    const request = db.transaction('takes').objectStore('takes').get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function putTake(value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('takes', 'readwrite');
    tx.objectStore('takes').put(value);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

function setStatus(message, error = false) {
  $('record-status').textContent = message;
  $('record-status').classList.toggle('error', error);
}

function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function renderLessons() {
  $('lesson-list').replaceChildren(...lessons.map((lesson) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lesson-item';
    button.setAttribute('aria-current', String(lesson.id === currentLesson.id));
    button.innerHTML = `<strong>${lesson.nav}</strong><small>${lesson.type} · ${lesson.duration}</small>`;
    button.addEventListener('click', () => selectLesson(lesson.id));
    return button;
  }));
}

async function selectLesson(id) {
  if (recorder?.state === 'recording') return setStatus('請先停止錄音，再轉練習。', true);
  window.speechSynthesis?.cancel();
  currentLesson = lessons.find((lesson) => lesson.id === id) || lessons[0];
  renderLessons();
  $('lesson-type').textContent = currentLesson.type;
  $('lesson-title').textContent = currentLesson.title;
  $('lesson-duration').textContent = currentLesson.duration;
  $('lesson-context').textContent = currentLesson.context;
  $('focus-text').textContent = currentLesson.focus;
  $('script-text').replaceChildren(...currentLesson.lines.map((line) => {
    const p = document.createElement('p');
    p.textContent = line;
    return p;
  }));
  $('reference-link').href = currentLesson.reference;
  $('reference-link').innerHTML = `${currentLesson.referenceLabel} <span aria-hidden="true">↗</span>`;
  $('take-select').value = '1';
  await renderTakes();
}

async function renderTakes() {
  audioUrls.forEach(URL.revokeObjectURL);
  audioUrls = [];
  const container = $('takes');
  container.replaceChildren();
  for (const number of [1, 2]) {
    const saved = db ? await getTake(`${currentLesson.id}-${number}`) : null;
    if (!saved) {
      const empty = document.createElement('div');
      empty.className = 'take-empty';
      empty.textContent = `第 ${number} 次 · 未有錄音`;
      container.append(empty);
      continue;
    }
    const url = URL.createObjectURL(saved.blob);
    audioUrls.push(url);
    const article = document.createElement('article');
    article.className = 'take';
    const top = document.createElement('div');
    top.className = 'take-top';
    const label = document.createElement('strong');
    label.textContent = `第 ${number} 次`;
    const date = document.createElement('small');
    date.textContent = new Date(saved.createdAt).toLocaleString('zh-HK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    top.append(label, date);
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.preload = 'metadata';
    audio.src = url;
    audio.setAttribute('aria-label', `播放第 ${number} 次錄音`);
    const actions = document.createElement('div');
    actions.className = 'take-actions';
    const download = document.createElement('button');
    download.type = 'button';
    download.textContent = '下載錄音';
    download.addEventListener('click', () => {
      const link = document.createElement('a');
      const extension = saved.blob.type.includes('mp4') ? 'm4a' : 'webm';
      link.href = url;
      link.download = `english-studio-${currentLesson.id}-take-${number}.${extension}`;
      link.click();
      setStatus('錄音已下載。請將音檔附喺 Codex 對話，我就可以批改。');
    });
    actions.append(download);
    article.append(top, audio, actions);
    container.append(article);
  }
}

function updateTimer() {
  $('record-timer').textContent = formatTime(Math.floor((Date.now() - recordingStarted) / 1000));
}

function stopTracks() {
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
}

async function startRecording() {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    setStatus('咪高峰需要安全連線。電腦請用 localhost；手機請用本機 HTTPS 網址。', true);
    return;
  }
  if (!window.MediaRecorder) return setStatus('呢個瀏覽器未支援錄音，請試 Chrome、Edge 或 Safari 最新版。', true);
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false } });
    const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((item) => MediaRecorder.isTypeSupported?.(item));
    recorder = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
    chunks = [];
    const lessonId = currentLesson.id;
    const takeNumber = $('take-select').value;
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onerror = () => { setStatus('錄音發生錯誤，請再試一次。', true); stopTracks(); };
    recorder.onstop = async () => {
      clearInterval(timerInterval);
      stopTracks();
      $('record-button').textContent = '開始錄音';
      $('record-button').classList.remove('is-recording');
      $('mic-indicator').textContent = '未啟動咪高峰';
      $('mic-indicator').classList.remove('live');
      $('take-select').disabled = false;
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      if (!blob.size) return setStatus('今次錄音係空嘅，請再試一次。', true);
      try {
        if (!db) throw new Error('本機儲存未能啟動');
        await putTake({ key: `${lessonId}-${takeNumber}`, blob, createdAt: Date.now() });
        setStatus(`第 ${takeNumber} 次已儲存喺呢個瀏覽器。可以重聽或下載。`);
        if (currentLesson.id === lessonId) await renderTakes();
      } catch (_) { setStatus('錄音未能儲存。請檢查瀏覽器私隱設定，再試一次。', true); }
    };
    recorder.start(250);
    recordingStarted = Date.now();
    $('record-timer').textContent = '00:00';
    timerInterval = setInterval(updateTimer, 500);
    $('record-button').textContent = '停止錄音';
    $('record-button').classList.add('is-recording');
    $('mic-indicator').textContent = '正在錄音';
    $('mic-indicator').classList.add('live');
    $('take-select').disabled = true;
    setStatus('錄緊音。讀完按「停止錄音」。');
  } catch (error) {
    stopTracks();
    setStatus(error?.name === 'NotAllowedError' ? '咪高峰權限未開。請喺瀏覽器允許使用咪高峰，再試一次。' : '未能開啟咪高峰。請檢查咪高峰連接，再試一次。', true);
  }
}

function playDemonstration() {
  if (!window.speechSynthesis) return;
  const voices = speechSynthesis.getVoices();
  const voice = voices.find((item) => item.lang?.toLowerCase() === 'en-gb');
  if (!voice) return setStatus('裝置未有英式系統語音。你可以先聽原片，或安裝英式語音後重開頁面。', true);
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(currentLesson.lines.join('. '));
  utterance.voice = voice;
  utterance.lang = 'en-GB';
  utterance.rate = .86;
  speechSynthesis.speak(utterance);
}

$('record-button').addEventListener('click', () => recorder?.state === 'recording' ? recorder.stop() : startRecording());
$('speak-button').addEventListener('click', playDemonstration);
window.addEventListener('pagehide', () => { stopTracks(); window.speechSynthesis?.cancel(); audioUrls.forEach(URL.revokeObjectURL); });

(async () => {
  try { db = await openDatabase(); }
  catch (_) { setStatus('呢個瀏覽器未能儲存錄音。請用一般瀏覽模式，避免無痕模式。', true); }
  await selectLesson('aspiration');
  if (!window.speechSynthesis) {
    $('speak-button').disabled = true;
    $('voice-note').textContent = '呢個瀏覽器冇系統語音，請用右邊連結聽原片／字典。';
  }
})();
