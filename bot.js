const { Telegraf, Markup } = require('telegraf');
const { createClient } = require('bedrock-protocol');
const fs = require('fs');
const path = require('path');

/* ================== الإعدادات ================== */
const REQUIRED_CHANNEL = -1003499194538;
const botToken = 'PUT_YOUR_TOKEN_HERE';
const ownerId = 1421302016;

const bot = new Telegraf(botToken);

/* ================== التخزين ================== */
let servers = {};
let users = [];
let clients = {};
const DATA_DIR = './data';

/* ================== البروتوكولات ================== */
const PROTOCOL_MAP = {
  '1.21.130': 870,
  '1.21.124': 860,
  '1.21.100': 827,
  '1.21.80': 800
};

function spoof(version) {
  if (version === '1.21.130') {
    return { fake: '1.21.124', protocol: 870 };
  }
  return { fake: version, protocol: PROTOCOL_MAP[version] };
}

/* ================== ملفات ================== */
function load() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (fs.existsSync(`${DATA_DIR}/servers.json`))
    servers = JSON.parse(fs.readFileSync(`${DATA_DIR}/servers.json`));
  if (fs.existsSync(`${DATA_DIR}/users.json`))
    users = JSON.parse(fs.readFileSync(`${DATA_DIR}/users.json`));
}
function saveServers() {
  fs.writeFileSync(`${DATA_DIR}/servers.json`, JSON.stringify(servers, null, 2));
}
function saveUsers() {
  fs.writeFileSync(`${DATA_DIR}/users.json`, JSON.stringify(users, null, 2));
}

/* ================== اشتراك ================== */
async function checkSub(ctx) {
  try {
    const m = await ctx.telegram.getChatMember(REQUIRED_CHANNEL, ctx.from.id);
    return ['member', 'administrator', 'creator'].includes(m.status);
  } catch {
    return false;
  }
}

/* ================== اتصال مضمون ================== */
async function connectGuaranteed(ip, port, version, username) {
  const order = ['1.21.130', '1.21.124', '1.21.100', '1.21.80'];

  for (const v of order) {
    const { fake, protocol } = spoof(v);
    try {
      const client = createClient({
        host: ip,
        port,
        username,
        version: fake,
        protocolVersion: protocol,
        offline: true,
        skipPing: true
      });

      const ok = await new Promise((resolve) => {
        let done = false;

        const timer = setTimeout(() => {
          if (!done) {
            done = true;
            resolve(true); // نعتبره ناجح
          }
        }, 6000);

        client.once('error', () => {
          if (!done) {
            done = true;
            clearTimeout(timer);
            resolve(false);
          }
        });

        client.once('disconnect', () => {
          if (!done) {
            done = true;
            clearTimeout(timer);
            resolve(false);
          }
        });
      });

      if (ok) {
        return { success: true, client, used: v };
      }
    } catch {}
  }

  return { success: false };
}

/* ================== بدء ================== */
load();

bot.start(async (ctx) => {
  if (!(await checkSub(ctx))) {
    return ctx.reply(
      '🔒 يجب الاشتراك في IBR Channel',
      Markup.inlineKeyboard([
        [Markup.button.url('📌 اشترك', 'https://t.me/+c7sbwOViyhNmYzAy')],
        [Markup.button.callback('تحقق', 'check')]
      ])
    );
  }

  if (!users.includes(ctx.from.id)) {
    users.push(ctx.from.id);
    saveUsers();
  }

  ctx.reply('أرسل IP:PORT');
});

bot.action('check', async (ctx) => {
  if (await checkSub(ctx)) {
    ctx.answerCbQuery('✅ تم');
    ctx.deleteMessage();
    bot.start(ctx);
  } else {
    ctx.answerCbQuery('❌ لم تشترك', { show_alert: true });
  }
});

/* ================== IP ================== */
bot.on('text', async (ctx) => {
  if (!ctx.message.text.includes(':')) return;
  const [ip, port] = ctx.message.text.split(':');
  servers[ctx.from.id] = { ip, port: Number(port) };
  saveServers();

  ctx.reply(
    `تم الحفظ ${ip}:${port}`,
    Markup.inlineKeyboard([
      [Markup.button.callback('▶️ تشغيل', 'run')]
    ])
  );
});

/* ================== تشغيل ================== */
bot.action('run', async (ctx) => {
  const s = servers[ctx.from.id];
  if (!s) return;

  ctx.reply('⏳ جاري الدخول...');
  const res = await connectGuaranteed(s.ip, s.port, '1.21.130', 'IBR_Bot');

  if (!res.success) {
    return ctx.reply('❌ فشل الدخول بكل المحاولات');
  }

  clients[ctx.from.id] = res.client;
  ctx.reply(`✅ دخل البوت (باستخدام ${res.used})`);

  res.client.on('disconnect', () => {
    delete clients[ctx.from.id];
    ctx.reply('❌ تم الفصل');
  });
});

/* ================== تشغيل ================== */
bot.launch({ dropPendingUpdates: true });
console.log('🚀 البوت يعمل');
