const lessons = [
  {
    id: 'dan-shadow', type: 'Downton Abbey · Matthew Crawley', title: 'Dan Stevens：對話嘅腔調', duration: '每段 10–20 秒', nav: 'Dan Stevens / Matthew',
    context: 'Matthew Meets Mary for the First Time，官方劇集片段。先搵 Matthew 一段完整英文回答，用播放器定開始同結束；集中跟佢喺劇中嘅講法。',
    provider: 'youtube', videoId: '8TS-amRJZEU', lines: [],
    focus: '留意一個意思點樣成為一個語調單位、句尾升降，同 and / to / of 點樣融入前後嘅字。照原聲模仿，唔好每個字都讀得一樣重。',
    steps: ['聽兩次，記低主要重音同停頓；只揀 Matthew 嘅聲音。', '0.75× 聽完即跟讀三次，再返原速，落後原聲少少同步講。', '暫停原聲，獨立錄第一版。第二版只修句尾起伏或弱讀其中一樣。'],
    reference: 'https://www.youtube.com/watch?v=8TS-amRJZEU', referenceLabel: '開 Downton Abbey 官方原片',
    sourceNote: '真人原聲，冇改聲。原片可能要求 YouTube 登入；播唔到可用上面連結喺手機瀏覽器／YouTube 開。'
  },
  {
    id: 'siu-shadow', type: 'Uncle Siu · 港台原聲', title: 'Uncle Siu：長句嘅節奏', duration: '每段 10–20 秒', nav: 'Uncle Siu',
    context: '港台 EP 1580（such + noun + that + clause）。用當中英文完整例句做跟讀材料，練前後分句嘅重音安排。先聽全段，再定你要跟嘅英文範圍。',
    provider: 'audio', media: 'https://podcasts.rthk.hk/podcast/media/dailydoseofbritishenglish/1632_2509301320_72692.mp3', lines: [],
    focus: '唔需要重學文法；今次聽主句邊個字最突出、that 後面點帶出結果，同兩句之間嘅音高同停頓。跟到原速後，再修元音同字尾連接。',
    steps: ['略過粵語講解，揀一至兩句連續英文，記低開始／結束時間。', '先 echo：聽一句、停、照住講；再開循環，用原速同步跟三次。', '獨立錄兩版；第二版只修一個重音位置，或者一處連讀。'],
    reference: 'https://podcast.rthk.hk/podcast/item.php?pid=1632&eid=266226', referenceLabel: '開港台原聲集數',
    sourceNote: '由港台直接串流，冇改聲。港台重溫有保存期限；失效時請揀最新原聲，或者交你鍾意嘅 IG 片段連結。'
  },
  {
    id: 'architecture-transfer', type: '建築 presentation · 腔調轉用', title: '用你嘅設計，講出同一種節奏', duration: '約 30 秒', nav: '建築 presentation',
    context: '完成一段真人跟讀後，保留佢嘅分句同語調，換成呢段原創建築稿；再改成你自己項目嘅設計決定。', provider: 'transfer',
    lines: ["We began by treating the ground floor as part of the city's public realm.", 'Drawing that space through the site gives the neighbourhood a more continuous route.', 'The recessed entrance creates a moment of shelter before the visitor moves into the courtyard.', 'Together, these decisions make a dense urban scheme feel generous at street level.'],
    focus: '每句揀一個核心重音：public REALM / continuous ROUTE / SHELTER / GENEROUS。其餘字收輕，令設計意圖有層次。呢個係建議演繹，唔係兩位真人嘅錄音。',
    steps: ['先返上一條路線聽 10 秒，記住佢嘅語調輪廓。', '將同一種輪廓放入建築稿；按意思分句，唔好逐字讀。', '第二版換成你嘅項目，用具體設計決定解釋使用者體驗。'],
    reference: 'https://www.ted.com/talks/thomas_heatherwick_building_the_seed_cathedral', referenceLabel: '睇 Thomas Heatherwick TED 原片'
  }
];

const $ = (id) => document.getElementById(id);
const DB_NAME = 'english-studio-recordings';
let currentLesson = lessons[0];
let db;
let recorder;
let stream;
let recordingStarted = 0;
let timerInterval;
let audioUrls = [];
let sourceAudio;
let youtubePlayer;
let sourceReady = false;
let sourceGeneration = 0;
let youtubeAPI;
let clipActive = false;
let activeRange;
let sourceInterval;
let lessonGeneration = 0;
let startingRecording = false;

function loadPractice(id) {
  try { return JSON.parse(localStorage.getItem(`english-studio-practice-${id}`)) || {}; }
  catch (_) { return {}; }
}

function savePractice() {
  const practice = { start: $('clip-start').value, end: $('clip-end').value, text: $('shadow-text').value };
  try { localStorage.setItem(`english-studio-practice-${currentLesson.id}`, JSON.stringify(practice)); }
  catch (_) { $('source-status').textContent = '筆記未能儲存。請下載筆記，避免關頁後遺失。'; }
}

function setSourceControls(ready) {
  sourceReady = ready;
  for (const id of ['mark-start', 'mark-end', 'replay-button', 'pause-source', 'playback-speed', 'loop-toggle']) $(id).disabled = !ready;
}

function pauseSource() {
  clipActive = false;
  sourceAudio?.pause();
  if (sourceReady) youtubePlayer?.pauseVideo?.();
}

function destroySource() {
  pauseSource();
  sourceGeneration++;
  clearInterval(sourceInterval);
  if (sourceAudio) { sourceAudio.removeAttribute('src'); sourceAudio.load(); }
  sourceAudio = null;
  youtubePlayer?.destroy?.();
  youtubePlayer = null;
  activeRange = null;
  setSourceControls(false);
}

function loadYouTubeAPI() {
  if (window.YT?.Player) return Promise.resolve();
  if (youtubeAPI) return youtubeAPI;
  youtubeAPI = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('YouTube 載入逾時')), 12000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timeout); resolve(); };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => { clearTimeout(timeout); reject(new Error('YouTube 未能載入')); };
    document.head.append(script);
  });
  return youtubeAPI;
}

function currentSourceTime() {
  return sourceAudio ? sourceAudio.currentTime : youtubePlayer?.getCurrentTime?.() || 0;
}

function sourceDuration() {
  return sourceAudio ? sourceAudio.duration : youtubePlayer?.getDuration?.() || 0;
}

function seekSource(seconds) {
  if (sourceAudio) sourceAudio.currentTime = seconds;
  else youtubePlayer?.seekTo?.(seconds, true);
}

async function playSource() {
  if (sourceAudio) await sourceAudio.play();
  else youtubePlayer?.playVideo?.();
}

function monitorClip() {
  if (!clipActive || !activeRange) return;
  if (currentSourceTime() < activeRange.end) return;
  if ($('loop-toggle').checked) {
    seekSource(activeRange.start);
    playSource().catch(() => { pauseSource(); $('source-status').textContent = '請再按「播放選段」繼續。'; });
  } else {
    pauseSource();
    $('source-status').textContent = '選段播完。停原聲後試自己講一次，或者開循環同步跟讀。';
  }
}

async function renderSource(lesson) {
  destroySource();
  const generation = sourceGeneration;
  const container = $('source-player');
  container.replaceChildren();
  $('source-section').hidden = lesson.provider === 'transfer';
  if (lesson.provider === 'transfer') return;
  $('source-note').textContent = lesson.sourceNote;
  $('source-status').textContent = '載入原聲中…';
  sourceInterval = setInterval(monitorClip, 120);
  if (lesson.provider === 'audio') {
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.preload = 'metadata';
    audio.src = lesson.media;
    audio.setAttribute('aria-label', '播放 Uncle Siu 港台原聲');
    audio.addEventListener('loadedmetadata', () => {
      if (generation !== sourceGeneration) return;
      setSourceControls(true);
      $('source-status').textContent = '先聽全段。到英文例句時按「設為開始」同「設為結束」，再播放選段。';
    });
    audio.addEventListener('error', () => {
      if (generation !== sourceGeneration) return;
      setSourceControls(false);
      $('source-status').textContent = '港台原聲未能載入，可能已過重溫期限。請用原聲集數或左邊「更多原聲」連結。';
    });
    sourceAudio = audio;
    container.append(audio);
    return;
  }
  const placeholder = document.createElement('div');
  placeholder.id = 'youtube-source';
  placeholder.className = 'youtube-placeholder';
  placeholder.textContent = 'Downton Abbey 官方原片';
  container.append(placeholder);
  try {
    await loadYouTubeAPI();
    if (generation !== sourceGeneration) return;
    youtubePlayer = new YT.Player(placeholder, {
      width: '100%', height: '280', videoId: lesson.videoId,
      playerVars: { playsinline: 1, origin: location.origin },
      events: {
        onReady: () => {
          if (generation !== sourceGeneration) return;
          setSourceControls(true);
          $('source-status').textContent = '先播原片，再揀 Matthew 一段完整回答。可用「設為開始／結束」定範圍。';
        },
        onError: () => {
          if (generation !== sourceGeneration) return;
          setSourceControls(false);
          $('source-status').textContent = 'YouTube 暫時唔允許內嵌播放。請用上面連結喺 YouTube 開；照樣可以錄音，再記低秒數交畀我。';
        },
        onStateChange: (event) => {
          if (generation === sourceGeneration && event.data === 0 && clipActive && activeRange) {
            if ($('loop-toggle').checked) { seekSource(activeRange.start); playSource(); }
            else pauseSource();
          }
        }
      }
    });
  } catch (_) {
    if (generation !== sourceGeneration) return;
    $('source-status').textContent = 'YouTube 未能載入。請用原片連結繼續跟讀，仍然可以喺下面錄音。';
  }
}

async function replayClip() {
  const startText = $('clip-start').value, endText = $('clip-end').value;
  const start = Number(startText), end = Number(endText), duration = sourceDuration();
  if (!startText || !endText || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || (duration > 0 && end > duration)) {
    $('source-status').textContent = '請填有效開始／結束秒數；結束要大過開始，而且喺原片長度之內。';
    return;
  }
  savePractice();
  activeRange = { start, end };
  clipActive = true;
  seekSource(start);
  try {
    await playSource();
    $('source-status').textContent = `跟讀 ${start}–${end} 秒。${$('loop-toggle').checked ? '循環已開，戴耳機同步跟。' : '播完會暫停，試自己講一次。'}`;
  } catch (_) { pauseSource(); $('source-status').textContent = '請先按原聲播放器嘅播放掣，再試選段。'; }
}

function setPlaybackSpeed() {
  const rate = Number($('playback-speed').value);
  if (sourceAudio) sourceAudio.playbackRate = rate;
  else if (youtubePlayer?.getAvailablePlaybackRates?.().includes(rate)) youtubePlayer.setPlaybackRate(rate);
  else { $('playback-speed').value = '1'; $('source-status').textContent = '呢段原片未提供慢速，先用原速跟讀。'; }
}

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
  if (startingRecording || recorder?.state === 'recording') return setStatus('請先停止錄音，再轉練習。', true);
  const generation = ++lessonGeneration;
  currentLesson = lessons.find((lesson) => lesson.id === id) || lessons[0];
  renderLessons();
  $('lesson-type').textContent = currentLesson.type;
  $('lesson-title').textContent = currentLesson.title;
  $('lesson-duration').textContent = currentLesson.duration;
  $('lesson-context').textContent = currentLesson.context;
  $('focus-text').textContent = currentLesson.focus;
  $('transfer-script').hidden = currentLesson.provider !== 'transfer';
  const practice = loadPractice(currentLesson.id);
  $('clip-start').value = practice.start || '';
  $('clip-end').value = practice.end || '';
  $('shadow-text').value = practice.text || '';
  $('loop-toggle').checked = false;
  $('playback-speed').value = '1';
  $('practice-steps').replaceChildren(...currentLesson.steps.map((text) => {
    const li = document.createElement('li'); li.textContent = text; return li;
  }));
  $('script-text').replaceChildren(...currentLesson.lines.map((line) => {
    const p = document.createElement('p');
    p.textContent = line;
    return p;
  }));
  $('reference-link').href = currentLesson.reference;
  $('reference-link').innerHTML = `${currentLesson.referenceLabel} <span aria-hidden="true">↗</span>`;
  $('take-select').value = '1';
  renderSource(currentLesson);
  await renderTakes();
  if (generation !== lessonGeneration) return;
}

async function renderTakes() {
  const lesson = currentLesson;
  const generation = lessonGeneration;
  const savedTakes = await Promise.all([1, 2].map((number) => db ? getTake(`${lesson.id}-${number}`) : null));
  if (generation !== lessonGeneration) return;
  audioUrls.forEach(URL.revokeObjectURL);
  audioUrls = [];
  const container = $('takes');
  container.replaceChildren();
  for (const number of [1, 2]) {
    const saved = savedTakes[number - 1];
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
      link.download = `english-studio-${lesson.id}-take-${number}.${extension}`;
      link.click();
      setStatus('錄音已下載。請將音檔附喺 Codex 對話，我就可以批改。');
    });
    actions.append(download);
    article.append(top, audio, actions);
    if (saved.practice?.start && saved.practice?.end) {
      const range = document.createElement('p');
      range.className = 'take-range';
      range.textContent = `原聲 ${saved.practice.start}–${saved.practice.end} 秒`;
      article.append(range);
    }
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
    setStatus('咪高峰需要安全連線。請用 English Studio 嘅正式 HTTPS 網址。', true);
    return;
  }
  if (!window.MediaRecorder) return setStatus('呢個瀏覽器未支援錄音，請試 Chrome、Edge 或 Safari 最新版。', true);
  if (startingRecording) return;
  startingRecording = true;
  $('record-button').disabled = true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false } });
    const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((item) => MediaRecorder.isTypeSupported?.(item));
    const sessionRecorder = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
    recorder = sessionRecorder;
    const recordingChunks = [];
    const lessonId = currentLesson.id;
    const takeNumber = $('take-select').value;
    savePractice();
    const practice = { ...loadPractice(lessonId), reference: currentLesson.reference };
    let recordingFailed = false;
    sessionRecorder.ondataavailable = (event) => { if (event.data.size) recordingChunks.push(event.data); };
    sessionRecorder.onerror = () => {
      recordingFailed = true;
      clearInterval(timerInterval);
      stopTracks();
      $('record-button').disabled = false;
      $('record-button').textContent = '開始錄音';
      $('record-button').classList.remove('is-recording');
      $('mic-indicator').textContent = '未啟動咪高峰';
      $('mic-indicator').classList.remove('live');
      $('take-select').disabled = false;
      setStatus('錄音發生錯誤，請再試一次。', true);
    };
    sessionRecorder.onstop = async () => {
      clearInterval(timerInterval);
      stopTracks();
      $('record-button').textContent = '開始錄音';
      $('record-button').classList.remove('is-recording');
      $('mic-indicator').textContent = '未啟動咪高峰';
      $('mic-indicator').classList.remove('live');
      $('take-select').disabled = false;
      if (recordingFailed) return;
      const blob = new Blob(recordingChunks, { type: sessionRecorder.mimeType || 'audio/webm' });
      if (!blob.size) { $('record-button').disabled = false; return setStatus('今次錄音係空嘅，請再試一次。', true); }
      try {
        if (!db) throw new Error('本機儲存未能啟動');
        await putTake({ key: `${lessonId}-${takeNumber}`, blob, createdAt: Date.now(), practice });
        setStatus(`第 ${takeNumber} 次已儲存喺呢個瀏覽器。可以重聽或下載。`);
        if (currentLesson.id === lessonId) await renderTakes();
      } catch (_) { setStatus('錄音未能儲存。請檢查瀏覽器私隱設定，再試一次。', true); }
      finally { $('record-button').disabled = false; }
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
  } finally { startingRecording = false; $('record-button').disabled = false; }
}

function downloadPractice() {
  savePractice();
  const text = `${currentLesson.title}\n原聲：${currentLesson.reference}\n選段：${$('clip-start').value || '未定'}–${$('clip-end').value || '未定'} 秒\n\n筆記：\n${$('shadow-text').value}\n\n請連同兩版錄音附到對話。`;
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = `english-studio-${currentLesson.id}-notes.txt`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('record-button').addEventListener('click', () => {
  if (recorder?.state === 'recording') { $('record-button').disabled = true; recorder.stop(); }
  else startRecording();
});
$('replay-button').addEventListener('click', replayClip);
$('pause-source').addEventListener('click', pauseSource);
$('playback-speed').addEventListener('change', setPlaybackSpeed);
$('download-notes').addEventListener('click', downloadPractice);
for (const id of ['clip-start', 'clip-end', 'shadow-text']) $(id).addEventListener('input', () => { clipActive = false; savePractice(); });
for (const point of ['start', 'end']) $(`mark-${point}`).addEventListener('click', () => {
  clipActive = false;
  $(`clip-${point}`).value = currentSourceTime().toFixed(1);
  savePractice();
  $('source-status').textContent = `已記低${point === 'start' ? '開始' : '結束'}時間。兩個時間定好後，按「播放選段」。`;
});
window.addEventListener('pagehide', () => { pauseSource(); stopTracks(); clearInterval(sourceInterval); audioUrls.forEach(URL.revokeObjectURL); });
window.addEventListener('pageshow', (event) => { if (event.persisted) { clearInterval(sourceInterval); sourceInterval = setInterval(monitorClip, 120); } });

(async () => {
  try { db = await openDatabase(); }
  catch (_) { setStatus('呢個瀏覽器未能儲存錄音。請用一般瀏覽模式，避免無痕模式。', true); }
  await selectLesson('dan-shadow');
})();
