// ============================================================
//  Сервер игры «2D Бродилка: Звериная битва знаний»
//  Запуск:  npm start        (или напрямую: node server.js)
//  Возможности:
//   • раздача статики (index.html, content.js и любые ресурсы)
//   • журнал посещений: время, IP, браузер, страница, откуда пришёл
//   • геолокация по IP (город, регион, страна, провайдер)
//   • страница статистики  ->  http://localhost:PORT/stats
//  Внешних зависимостей нет — только встроенные модули Node.js.
// ============================================================

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
// .trim() — защита от ошибки cmd: команда
//   set HOST=0.0.0.0 && npm start
// записывает в переменную значение "0.0.0.0 " (с пробелом на конце).
// Node такой «адрес» не распознаёт, лезет в DNS и падает с ENOTFOUND.
const HOST = (process.env.HOST || '127.0.0.1').trim();
const ROOT = __dirname;

const DATA_DIR = path.join(ROOT, 'data');
const LOG_FILE = path.join(DATA_DIR, 'visits.log.jsonl');
const GEO_CACHE_FILE = path.join(DATA_DIR, 'geo-cache.json');

try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { /* не критично */ }

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function sendText(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

function sendHtml(res, status, html) {
  const buf = Buffer.from(html, 'utf8');
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': buf.length, 'Cache-Control': 'no-store' });
  res.end(buf);
}

function sendJson(res, status, json) {
  const buf = Buffer.from(json, 'utf8');
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': buf.length, 'Cache-Control': 'no-store' });
  res.end(buf);
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ==================== ГЕОЛОКАЦИЯ ПО IP ====================
let geoCache = {};
try { geoCache = JSON.parse(fs.readFileSync(GEO_CACHE_FILE, 'utf8')) || {}; } catch (e) { geoCache = {}; }
let geoCacheDirty = false;
setInterval(() => {
  if (!geoCacheDirty) return;
  geoCacheDirty = false;
  fs.writeFile(GEO_CACHE_FILE, JSON.stringify(geoCache, null, 2), () => {});
}, 20000).unref();

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  let ip = xff ? String(xff).split(',')[0].trim() : (req.socket.remoteAddress || '');
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') ip = '127.0.0.1';
  return ip || '—';
}

function isPrivateIp(ip) {
  return !ip || ip === '—' || ip === '127.0.0.1' || ip === 'localhost'
    || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('169.254.')
    || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
    || ip.startsWith('fc') || ip.startsWith('fd');
}

function lookupGeo(ip, cb) {
  if (isPrivateIp(ip)) {
    return cb({ country: '—', region: '—', city: '—', isp: '—', note: 'локальная сеть' });
  }
  if (geoCache[ip]) return cb(geoCache[ip]);

  const url = 'http://ip-api.com/json/' + encodeURIComponent(ip)
    + '?fields=status,country,regionName,city,isp,query&lang=ru';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  fetch(url, { signal: controller.signal })
    .then(r => r.json())
    .then(d => {
      clearTimeout(timer);
      const geo = (d && d.status === 'success')
        ? { country: d.country || '—', region: d.regionName || '—', city: d.city || '—', isp: d.isp || '—', note: '' }
        : { country: '—', region: '—', city: '—', isp: '—', note: 'не определено' };
      geoCache[ip] = geo;
      geoCacheDirty = true;
      cb(geo);
    })
    .catch(() => {
      clearTimeout(timer);
      cb({ country: '—', region: '—', city: '—', isp: '—', note: 'геосервис недоступен' });
    });
}

// ==================== ЖУРНАЛ ПОСЕЩЕНИЙ ====================
function writeVisit(entry) {
  fs.appendFile(LOG_FILE, JSON.stringify(entry) + '\n', (err) => {
    if (err) console.warn('⚠️  Не удалось записать посещение:', err.message);
  });
  console.log('👤 ' + entry.time + ' | ' + entry.ip + ' | ' + entry.city + ', ' + entry.country + ' | ' + entry.url);
}

function recordVisit(req, pathname) {
  const ip = clientIp(req);
  const base = {
    time: new Date().toLocaleString('ru-RU', { hour12: false }),
    ts: Date.now(),
    ip,
    ua: String(req.headers['user-agent'] || '—'),
    referer: String(req.headers['referer'] || req.headers['referrer'] || ''),
    url: pathname,
  };
  lookupGeo(ip, (geo) => {
    writeVisit(Object.assign(base, {
      country: geo.country,
      region: geo.region,
      city: geo.city,
      isp: geo.isp,
      geoNote: geo.note || '',
    }));
  });
}

function readLog(limit) {
  let raw = '';
  try { raw = fs.readFileSync(LOG_FILE, 'utf8'); } catch (e) { return []; }
  const lines = raw.split('\n').filter(Boolean);
  const out = [];
  for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
    try { out.push(JSON.parse(lines[i])); } catch (e) { /* пропускаем битую строку */ }
  }
  return out;
}

function renderStatsPage(limit) {
  const rows = readLog(limit);
  let total = 0;
  try { total = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean).length; } catch (e) { total = 0; }
  const uniqueIps = new Set(rows.map(r => r.ip)).size;

  const tr = rows.map(r => '<tr>'
    + '<td>' + escapeHtml(r.time) + '</td>'
    + '<td>' + escapeHtml(r.ip) + '</td>'
    + '<td>' + escapeHtml([r.city, r.region, r.country].filter(x => x && x !== '—').join(', ') || '—') + '</td>'
    + '<td>' + escapeHtml(r.isp || '—') + '</td>'
    + '<td>' + escapeHtml(r.url) + '</td>'
    + '<td style="max-width:360px;word-break:break-all">' + escapeHtml(r.ua) + '</td>'
    + '<td style="max-width:240px;word-break:break-all">' + escapeHtml(r.referer || '—') + '</td>'
    + '</tr>').join('\n');

  return '<!DOCTYPE html>\n'
    + '<html lang="ru"><head><meta charset="UTF-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
    + '<meta http-equiv="refresh" content="20">\n'
    + '<title>Статистика посещений</title>\n'
    + '<style>\n'
    + " body{background:#0d0d0d;color:#cfe8cf;font-family:'Courier New',monospace;margin:0;padding:20px}\n"
    + ' h1{color:#33ff33;text-shadow:0 0 12px #33ff33;font-size:1.3rem}\n'
    + ' .cards{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}\n'
    + ' .card{background:#141f14;border:2px solid #2a5a2a;border-radius:10px;padding:10px 16px}\n'
    + ' .card b{color:#ffdd33;font-size:1.2rem}\n'
    + ' table{border-collapse:collapse;width:100%;font-size:0.78rem}\n'
    + ' th,td{border:1px solid #2a5a2a;padding:6px 8px;text-align:left;vertical-align:top}\n'
    + ' th{background:#132413;color:#88ff88}\n'
    + ' tr:nth-child(even){background:#101810}\n'
    + ' a{color:#66ff66}\n'
    + '</style></head>\n'
    + '<body>\n'
    + '<h1>🐾 Статистика посещений</h1>\n'
    + '<div class="cards">\n'
    + '  <div class="card">Всего посещений: <b>' + total + '</b></div>\n'
    + '  <div class="card">Показано (последние): <b>' + rows.length + '</b></div>\n'
    + '  <div class="card">Уникальных IP (в выборке): <b>' + uniqueIps + '</b></div>\n'
    + '</div>\n'
    + '<p>Данные хранятся в файле <code>data/visits.log.jsonl</code>. JSON-версия: <a href="/stats.json">/stats.json</a></p>\n'
    + '<table>\n'
    + '<thead><tr><th>Время</th><th>IP</th><th>Локация</th><th>Провайдер</th><th>Страница</th><th>Браузер</th><th>Откуда пришёл</th></tr></thead>\n'
    + '<tbody>\n'
    + (tr || '<tr><td colspan="7">Пока нет записей.</td></tr>') + '\n'
    + '</tbody>\n</table>\n</body></html>';
}

// ==================== HTTP-СЕРВЕР ====================
const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendText(res, 405, '405 — метод не поддерживается');
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    return sendText(res, 400, '400 — некорректный запрос');
  }

  // ---- служебные страницы статистики ----
  if (pathname === '/stats' || pathname === '/stats/') {
    return sendHtml(res, 200, renderStatsPage(200));
  }
  if (pathname === '/stats.json') {
    return sendJson(res, 200, JSON.stringify(readLog(1000), null, 2));
  }

  // ---- журнал посещений (только заходы на страницы) ----
  const isPage = pathname === '/' || pathname === '' || pathname.endsWith('.html');
  if (isPage) recordVisit(req, pathname);

  // Главная страница -> index.html
  if (pathname === '/' || pathname === '') pathname = '/index.html';

  const relative = pathname.replace(/^[/\\]+/, '');
  const filePath = path.resolve(ROOT, relative);

  // Защита от выхода за пределы папки проекта (.. и абсолютные пути)
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    return sendText(res, 403, '403 — доступ запрещён');
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      return sendText(res, 404, '404 — файл не найден');
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache',
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => sendText(res, 500, '500 — ошибка чтения файла'));
    stream.pipe(res);
  });
});

function startServer(port, attemptsLeft) {
  server.removeAllListeners('listening');
  server.removeAllListeners('error');

  server.once('listening', () => {
    console.log('\n🎮 Игра запущена:      http://localhost:' + port);
    console.log('📊 Статистика:         http://localhost:' + port + '/stats');
    if (HOST === '127.0.0.1' || HOST === 'localhost') {
      console.log('ℹ️  Сайт доступен только с этого компьютера.');
      console.log('   Чтобы принимать посетителей из сети: set HOST=0.0.0.0 && npm start');
    }
    console.log('   Остановить сервер: Ctrl+C\n');
  });

  server.once('error', (err) => {
    const retryable = err.code === 'EADDRINUSE' || err.code === 'EACCES';
    if (retryable && attemptsLeft > 0) {
      console.warn('⚠️  Порт ' + port + ' занят (' + err.code + '), пробую ' + (port + 1) + '...');
      setImmediate(() => startServer(port + 1, attemptsLeft - 1));
    } else if (retryable) {
      console.error('\n❌ Порты ' + PORT + '–' + port + ' заняты. Задайте другой порт, например:\n   set PORT=8080 && npm start\n');
      process.exit(1);
    } else {
      console.error('\n❌ Ошибка сервера:', err.message, '\n');
      process.exit(1);
    }
  });

  server.listen(port, HOST);
}

startServer(PORT, 10);
