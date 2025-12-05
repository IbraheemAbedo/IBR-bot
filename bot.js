const { Telegraf, Markup } = require('telegraf');
const { createClient } = require('bedrock-protocol');
const fs = require('fs');
const path = require('path');

// ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️
// ضع توكن البوت هنا (احصل عليه من @BotFather)
const botToken = '8270739982:AAFbleW6nlVqyxJMFxu_8c_ni34mzNIev_w';
// ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️

// ضع رقم حسابك (احصل عليه من @userinfobot)
const ownerId = 1421302016; // غير هذا الرقم

const bot = new Telegraf(botToken);

// تخزين البيانات
let servers = {};
let users = [];
let clients = {};

// مجلد البيانات
const DATA_DIR = './data';

// تحميل البيانات
function loadData() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const serversPath = path.join(DATA_DIR, 'servers.json');
    const usersPath = path.join(DATA_DIR, 'users.json');

    if (fs.existsSync(serversPath)) {
      const data = fs.readFileSync(serversPath, 'utf8');
      servers = JSON.parse(data);
    }

    if (fs.existsSync(usersPath)) {
      const data = fs.readFileSync(usersPath, 'utf8');
      users = JSON.parse(data);
    }
  } catch (error) {
    console.log('لا توجد بيانات سابقة');
  }
}

// حفظ البيانات
function saveServers() {
  try {
    fs.writeFileSync(path.join(DATA_DIR, 'servers.json'), JSON.stringify(servers, null, 2));
  } catch (error) {}
}

function saveUsers() {
  try {
    fs.writeFileSync(path.join(DATA_DIR, 'users.json'), JSON.stringify(users, null, 2));
  } catch (error) {}
}

// تحميل عند البدء
loadData();

// البداية
bot.start(async (ctx) => {
  const user = ctx.from;
  const userId = user.id;
  
  // إضافة المستخدم الجديد
  if (!users.includes(userId)) {
    users.push(userId);
    saveUsers();
    
    // إرسال إشعار للمالك
    try {
      await bot.telegram.sendMessage(ownerId, 
        `👤 مستخدم جديد\n` +
        `الاسم: ${user.first_name}\n` +
        `المعرف: @${user.username || 'لا يوجد'}\n` +
        `ID: ${userId}\n` +
        `المجموع: ${users.length}`
      );
    } catch (err) {}
  }
  
  // عرض قائمة الإصدارات
  ctx.reply('🎮 أهلاً بك في بوت Minecraft!\n\nاختر إصدار اللعبة:', {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('1.21.50', 'ver_1.21.50')],
      [Markup.button.callback('1.21.72', 'ver_1.21.72')],
      [Markup.button.callback('1.21.80', 'ver_1.21.80')],
      [Markup.button.callback('1.21.84', 'ver_1.21.84')],
      [Markup.button.callback('1.21.93', 'ver_1.21.93')],
      [Markup.button.callback('1.21.100', 'ver_1.21.100')],
      [Markup.button.callback('1.21.120', 'ver_1.21.120')],
      [Markup.button.callback('1.21.123', 'ver_1.21.123')]
    ])
  });
});

// اختيار الإصدار
bot.action(/ver_(.+)/, (ctx) => {
  const version = ctx.match[1];
  const userId = ctx.from.id;
  
  ctx.answerCbQuery(`✅ تم اختيار الصدار بنجاح${version}`);
  
  // حفظ الإصدار
  servers[userId] = servers[userId] || {};
  servers[userId].version = version;
  saveServers();
  
  // طلب بيانات السيرفر
  ctx.reply(`✅ الإصدار: ${version}\n\n📥 أرسل IP السيرفر وPort:\nمثال:\nplay.server.com:19132\n\nأو:\nlocalhost:19132`);
});

// استقبال IP وPort
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  const userId = ctx.from.id;
  
  // إذا كان النص يحتوي على : فهو IP:Port
  if (text.includes(':')) {
    const parts = text.split(':');
    if (parts.length === 2) {
      const ip = parts[0].trim();
      const port = parseInt(parts[1].trim());
      
      if (!isNaN(port)) {
        // حفظ السيرفر
        servers[userId] = servers[userId] || {};
        servers[userId].ip = ip;
        servers[userId].port = port;
        saveServers();
        
        // عرض لوحة التحكم
        ctx.reply(`✅ تم حفظ السيرفر!\n\n🌐 IP: ${ip}\n🔌 Port: ${port}\n\nاختر الإجراء:`, {
          ...Markup.inlineKeyboard([
            [Markup.button.callback('▶️ تشغيل البوت', 'run_bot')],
            [Markup.button.callback('➕ إضافة بوت', 'add_bot')],
            [Markup.button.callback('🛑 إيقاف البوت', 'stop_bot')],
            [Markup.button.callback('🗑️ حذف السيرفر', 'del_server')]
          ])
        });
      } else {
        ctx.reply('(حاول مرة اخرى)❌ Port يجب أن يكون رقم!');
      }
    }
  }
});

// تشغيل البوت
bot.action('run_bot', async (ctx) => {
  const userId = ctx.from.id;
  
  if (!servers[userId] || !servers[userId].ip) {
    return ctx.answerCbQuery('(حاول مرة اخرى)❌ أضف السيرفر أولاً!', { show_alert: true });
  }
  
  const { ip, port, version } = servers[userId];
  
  ctx.answerCbQuery('🚀 جاري التشغيل...');
  ctx.reply(`🔗 جاري الاتصال بـ:\n${ip}:${port}`);
  
  try {
    // إنشاء البوت الأول
    const client = createClient({
      host: ip,
      port: port,
      username: 'IBR_Bot',
      version: version || '1.21.100',
      offline: true,
      connectTimeout: 10000
    });
    
    clients[userId] = client;
    
    client.on('join', () => {
      bot.telegram.sendMessage(userId, ' استمتع يا صديقي 🔥✅ البوت دخل السيرفر بنجاح!').catch(() => {});
    });
    
    client.on('disconnect', (reason) => {
      bot.telegram.sendMessage(userId, `(حاول مرة اخرى)❌ تم الفصل: ${reason}`).catch(() => {});
      delete clients[userId];
    });
    
    client.on('error', (err) => {
      bot.telegram.sendMessage(userId, `(حاول مرة اخرى)❌ خطأ: ${err.message}`).catch(() => {});
      delete clients[userId];
    });
    
  } catch (error) {
    ctx.reply(`(حاول مرة اخرى)❌ خطأ: ${error.message}`);
  }
});

// إضافة بوت إضافي
bot.action('add_bot', async (ctx) => {
  const userId = ctx.from.id;
  
  if (!servers[userId] || !servers[userId].ip) {
    return ctx.answerCbQuery('(حاول مرة اخرى)❌ أضف السيرفر أولاً!', { show_alert: true });
  }
  
  const { ip, port, version } = servers[userId];
  
  ctx.answerCbQuery('➕ جاري إضافة بوت...');
  
  try {
    const botNames = ['Bot_2', 'Bot_3', 'Bot_4', 'Bot_5'];
    const botName = botNames[Math.floor(Math.random() * botNames.length)];
    
    const client = createClient({
      host: ip,
      port: port,
      username: botName,
      version: version || '1.21.100',
      offline: true,
      connectTimeout: 10000
    });
    
    const clientKey = `${userId}_${botName}`;
    clients[clientKey] = client;
    
    client.on('join', () => {
      bot.telegram.sendMessage(userId, `✅ ${botName} دخل السيرفر`).catch(() => {});
    });
    
    client.on('disconnect', (reason) => {
      bot.telegram.sendMessage(userId, `❌ ${botName} تم فصله`).catch(() => {});
      delete clients[clientKey];
    });
    
  } catch (error) {
    ctx.reply(`(حاول مرة اخرى)❌ فشل إضافة البوت: ${error.message}`);
  }
});

// إيقاف البوت
bot.action('stop_bot', (ctx) => {
  const userId = ctx.from.id;
  
  // إيقاف جميع بوتات المستخدم
  let stopped = 0;
  for (let key in clients) {
    if (key === userId.toString() || key.startsWith(userId + '_')) {
      try {
        clients[key].end();
        stopped++;
      } catch (err) {}
      delete clients[key];
    }
  }
  
  ctx.answerCbQuery(`🛑 تم إيقاف البوت بنجاح${stopped} بوت`);
  ctx.reply(`✅ تم إيقاف ${stopped} بوت`);
});

// حذف السيرفر
bot.action('del_server', (ctx) => {
  const userId = ctx.from.id;
  
  if (servers[userId]) {
    delete servers[userId];
    saveServers();
    
    // إيقاف البوتات
    for (let key in clients) {
      if (key === userId.toString() || key.startsWith(userId + '_')) {
        try {
          clients[key].end();
        } catch (err) {}
        delete clients[key];
      }
    }
    
    ctx.answerCbQuery('🗑️ تم الحذف');
    ctx.reply('✅ تم حذف السيرفر وإيقاف البوتات');
  } else {
    ctx.answerCbQuery('❌ لا يوجد سيرفر');
  }
});

// أمر stats للمالك
bot.command('stats', (ctx) => {
  if (ctx.from.id !== ownerId) return;
  
  const stats = `📊 إحصائيات البوت:
👥 المستخدمين: ${users.length}
🌐 السيرفرات النشطة: ${Object.keys(servers).length}
🤖 البوتات النشطة: ${Object.keys(clients).length}`;
  
  ctx.reply(stats);
});

// أمر broadcast للمالك
bot.command('broadcast', async (ctx) => {
  if (ctx.from.id !== ownerId) return;
  
  const message = ctx.message.text.replace('/broadcast ', '');
  if (!message) return ctx.reply('❌ أرسل الرسالة مع الأمر');
  
  ctx.reply(`📢 جاري الإرسال لـ ${users.length} مستخدم...`);
  
  let sent = 0;
  for (let user of users) {
    try {
      await bot.telegram.sendMessage(user, `📢 إشعار:\n\n${message}`);
      sent++;
    } catch (err) {}
  }
  
  ctx.reply(`✅ تم الإرسال لـ ${sent}/${users.length} مستخدم`);
});

// معالجة الأخطاء
bot.catch((err) => {
  console.error('Bot error:', err);
});

// تشغيل البوت
console.log('🚀 جاري تشغيل البوت...');
bot.launch()
  .then(() => {
    console.log('✅ البوت يعمل بنجاح!');
    console.log('📱 افتح تليجرام وابحث عن بوتك');
  })
  .catch((err) => {
    console.error('❌ فشل تشغيل البوت:', err);
    console.log('🔧 تحقق من التوكن وإعادة المحاولة');
  });

// إغلاق أنيق
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
