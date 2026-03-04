const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());

// ========== Validasi Environment ==========
const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = process.env.OWNER_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;           // "username/repo"
const GITHUB_FILE_PATH = process.env.GITHUB_FILE_PATH; // "scripts.json"
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const BACKGROUND_IMAGE_URL = process.env.BACKGROUND_IMAGE_URL; // opsional

if (!BOT_TOKEN || !OWNER_ID || !GITHUB_TOKEN || !GITHUB_REPO || !GITHUB_FILE_PATH) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// ========== Helper: Update JSON di GitHub ==========
async function updateGitHubJSON(newName, newLink) {
  const fileUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}?ref=${GITHUB_BRANCH}`;

  const fileRes = await fetch(fileUrl, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!fileRes.ok) {
    throw new Error(`Gagal mengambil file: ${fileRes.status} ${fileRes.statusText}`);
  }

  const fileData = await fileRes.json();
  const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
  const currentSha = fileData.sha;

  let scripts;
  try {
    scripts = JSON.parse(currentContent);
    if (!Array.isArray(scripts)) scripts = [];
  } catch (e) {
    scripts = [];
  }

  scripts.push({ name: newName, link: newLink });

  const newContent = Buffer.from(JSON.stringify(scripts, null, 2)).toString('base64');

  const commitRes = await fetch(fileUrl, {
    method: 'PUT',
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Tambah script: ${newName}`,
      content: newContent,
      sha: currentSha,
      branch: GITHUB_BRANCH,
    }),
  });

  if (!commitRes.ok) {
    const err = await commitRes.json();
    throw new Error(`GitHub commit gagal: ${commitRes.status} – ${err.message}`);
  }

  return true;
}

// ========== Helper: Kirim pesan Telegram ==========
async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
    }),
  });
}

// ========== Endpoint Webhook Telegram ==========
app.post('/webhook', async (req, res) => {
  const update = req.body;

  if (!update.message || !update.message.text) {
    return res.sendStatus(200);
  }

  const chatId = update.message.chat.id;
  const userId = update.message.from.id;
  const text = update.message.text.trim();

  if (userId.toString() !== OWNER_ID) {
    await sendTelegramMessage(chatId, '⛔ Anda tidak diizinkan menggunakan bot ini.');
    return res.sendStatus(200);
  }

  if (text.startsWith('/addsc')) {
    const args = text.replace('/addsc', '').trim();
    const parts = args.split('|').map(s => s.trim());

    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      await sendTelegramMessage(chatId, '❌ Format salah. Gunakan:\n/addsc Nama Script|https://link...');
      return res.sendStatus(200);
    }

    const [name, link] = parts;

    try {
      await updateGitHubJSON(name, link);
      await sendTelegramMessage(chatId, `✅ Script **${name}** berhasil ditambahkan!`);
    } catch (error) {
      console.error(error);
      await sendTelegramMessage(chatId, `❌ Error: ${error.message}`);
    }
  } else {
    await sendTelegramMessage(chatId, 'ℹ️ Gunakan /addsc Nama|Link untuk menambah script.');
  }

  res.sendStatus(200);
});

// ========== Halaman Website dengan UI Super Modern ==========
app.get('/', (req, res) => {
  const [owner, repo] = GITHUB_REPO.split('/');
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${GITHUB_BRANCH}/${GITHUB_FILE_PATH}`;

  let backgroundStyle = '';
  if (BACKGROUND_IMAGE_URL) {
    backgroundStyle = `
      background-image: url('${BACKGROUND_IMAGE_URL}');
      background-size: cover;
      background-position: center;
      background-attachment: fixed;
    `;
  } else {
    backgroundStyle = 'background: linear-gradient(135deg, #0f0c1f 0%, #1a1a2e 100%);';
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Script Downloader · Modern UI</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        body {
            min-height: 100vh;
            ${backgroundStyle}
            color: #f0f0f0;
            position: relative;
            line-height: 1.6;
        }

        /* Overlay gelap jika menggunakan gambar background */
        ${BACKGROUND_IMAGE_URL ? `
        body::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(4px);
            z-index: 0;
        }
        ` : ''}

        /* Pattern halus untuk kedalaman */
        body::after {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: radial-gradient(circle at 20% 30%, rgba(255,255,255,0.02) 0%, transparent 20%),
                              radial-gradient(circle at 80% 70%, rgba(255,255,255,0.02) 0%, transparent 20%);
            pointer-events: none;
            z-index: 1;
        }

        .container {
            max-width: 1300px;
            margin: 0 auto;
            padding: 3rem 2rem;
            position: relative;
            z-index: 10;
        }

        /* Header dengan efek glow */
        h1 {
            font-size: 3.2rem;
            font-weight: 800;
            letter-spacing: -0.02em;
            margin-bottom: 2rem;
            text-align: center;
            background: linear-gradient(145deg, #a78bfa, #ec4899, #f59e0b);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-shadow: 0 0 30px rgba(168, 85, 247, 0.3);
            animation: fadeInDown 0.8s ease-out;
        }

        @keyframes fadeInDown {
            from {
                opacity: 0;
                transform: translateY(-30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 2rem;
            margin-top: 2rem;
        }

        /* Card dengan efek glassmorphism + hover */
        .card {
            background: rgba(20, 20, 35, 0.7);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 2rem;
            padding: 2rem 1.8rem;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.02) inset;
            transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
            display: flex;
            flex-direction: column;
            animation: fadeInUp 0.6s ease-out backwards;
            position: relative;
            overflow: hidden;
        }

        .card:nth-child(odd) { animation-delay: 0.1s; }
        .card:nth-child(even) { animation-delay: 0.2s; }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(40px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .card:hover {
            transform: translateY(-8px) scale(1.02);
            border-color: rgba(168, 85, 247, 0.6);
            box-shadow: 0 30px 60px rgba(0, 0, 0, 0.8), 0 0 0 2px rgba(168, 85, 247, 0.3) inset;
        }

        /* Efek kilau saat hover */
        .card::after {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.1), transparent 70%);
            opacity: 0;
            transition: opacity 0.5s;
            pointer-events: none;
        }

        .card:hover::after {
            opacity: 1;
        }

        .card h3 {
            font-size: 1.8rem;
            font-weight: 700;
            margin-bottom: 1.5rem;
            color: #fff;
            line-height: 1.3;
            word-break: break-word;
            text-shadow: 0 2px 5px rgba(0,0,0,0.5);
            flex: 1;
        }

        /* Tombol download dengan efek neon */
        .btn {
            display: inline-block;
            background: linear-gradient(115deg, #8b5cf6, #d946ef, #f97316);
            background-size: 200% auto;
            color: white;
            text-decoration: none;
            padding: 0.9rem 2rem;
            border-radius: 3rem;
            font-weight: 600;
            font-size: 1.1rem;
            letter-spacing: 0.3px;
            border: none;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 8px 20px rgba(139, 92, 246, 0.4);
            text-align: center;
            border: 1px solid rgba(255,255,255,0.2);
            backdrop-filter: blur(4px);
            align-self: flex-start;
        }

        .btn:hover {
            background-position: right center;
            box-shadow: 0 10px 25px rgba(236, 72, 153, 0.6);
            transform: scale(1.05);
        }

        .btn:active {
            transform: scale(0.98);
        }

        /* Loading & error states */
        .loading, .error {
            text-align: center;
            padding: 4rem;
            font-size: 1.4rem;
            background: rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(10px);
            border-radius: 2rem;
            border: 1px solid rgba(255,255,255,0.1);
            grid-column: 1 / -1;
            color: #ddd;
        }

        .error {
            color: #fca5a5;
            border-color: #ef4444;
            background: rgba(127, 29, 29, 0.3);
        }

        /* Animasi loading */
        .loading::after {
            content: '';
            width: 20px;
            height: 20px;
            margin-left: 10px;
            border: 3px solid #a78bfa;
            border-top-color: transparent;
            border-radius: 50%;
            display: inline-block;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        /* Responsif */
        @media (max-width: 640px) {
            h1 { font-size: 2.4rem; }
            .container { padding: 2rem 1rem; }
            .card { padding: 1.5rem; }
            .card h3 { font-size: 1.5rem; }
            .btn { padding: 0.8rem 1.5rem; font-size: 1rem; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📦 Script Downloader</h1>
        <div id="grid" class="grid">
            <div class="loading">Memuat script</div>
        </div>
    </div>

    <script>
        const GITHUB_RAW_URL = '${rawUrl}';

        async function fetchScripts() {
            try {
                const res = await fetch(GITHUB_RAW_URL);
                if (!res.ok) throw new Error('Gagal mengambil data');
                const scripts = await res.json();
                renderGrid(scripts);
            } catch (err) {
                document.getElementById('grid').innerHTML = \`
                    <div class="error">
                        ⚠️ Tidak dapat memuat script.<br>
                        <small style="opacity:0.8; font-size:0.9rem;">\${err.message}</small>
                    </div>
                \`;
            }
        }

        function renderGrid(scripts) {
            const grid = document.getElementById('grid');
            if (!scripts || scripts.length === 0) {
                grid.innerHTML = '<div class="error">📭 Belum ada script. Tambah via Telegram /addsc</div>';
                return;
            }

            const cards = scripts.map((script, index) => \`
                <div class="card" style="animation-delay: \${index * 0.1}s;">
                    <h3>\${escapeHtml(script.name)}</h3>
                    <a href="\${escapeHtml(script.link)}" target="_blank" class="btn" rel="noopener">Download</a>
                </div>
            \`).join('');

            grid.innerHTML = cards;
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        fetchScripts();
    </script>
</body>
</html>
  `;

  res.send(html);
});

// ========== Untuk pengembangan lokal ==========
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server berjalan di http://localhost:${port}`);
});

// Export untuk Vercel
module.exports = app;