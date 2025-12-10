const { Telegraf, Markup } = require('telegraf');
const { createClient } = require('bedrock-protocol');
const fs = require('fs');
const path = require('path');

// قناة الاشتراك الإجباري
const REQUIRED_CHANNEL = -1003499194538;


// ⚠️ ضع توكن البوت
const botToken = '8198997283:AAHL_yWKazZf3Aa8OluwgjXV2goxtpwNPPQ';

// ⚠️ ضع رقم حسابك
const ownerId = 1421302016;

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

// فحص الاشتراك في القناة
async function checkSubscription(ctx) {
  try {
    const member = await ctx.telegram.getChatMember(REQUIRED_CHANNEL, ctx.from.id);

    if (member && ['member', 'creator', 'administrator'].includes(member.status)) {
      return true;
    }

    return false;
  } catch (err) {
    return false;
  }
}



// تحميل عند البدء
loadData();

// البداية
bot.start(async (ctx) => {
  const isSub = await checkSubscription(ctx);

  if (!isSub) {
    return ctx.reply(
      `  🔒 للوصول إلى البوت يجب الاشتراك في القناة:\n IBR Channel القناة الرسمية للبوت\n بعد الاشتراك اضغط على /start`,
      {
        ...Markup.inlineKeyboard([
          [Markup.button.url('📌 اشترك الآن', 'https://t.me/+c7sbwOViyhNmYzAy')],
          [Markup.button.callback('🔍 تحقق من الاشتراك', 'check_sub')]
        ])
      }
    );
  }

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
  ctx.reply('🎮 أهلاً بك في بوت Minecraft bu IBR!\n\nاختر إصدار اللعبة:', {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('1.21.50', 'ver_1.21.50')],
      [Markup.button.callback('1.21.72', 'ver_1.21.72')],
      [Markup.button.callback('1.21.80', 'ver_1.21.80')],
      [Markup.button.callback('1.21.84', 'ver_1.21.84')],
      [Markup.button.callback('1.21.93', 'ver_1.21.93')],
      [Markup.button.callback('1.21.100', 'ver_1.21.100')],
      [Markup.button.callback('1.21.120', 'ver_1.21.120')],
      [Markup.button.callback('1.21.123', 'ver_1.21.123')],
      [Markup.button.callback('1.21.124', 'ver_1.21.124')],
      [Markup.button.callback('1.21.124.2', 'ver_1.21.124.2')],
      [Markup.button.callback('1.21.130', 'ver_1.21.130')]
    ])
  });
});

// زر التحقق من الاشتراك
bot.action('check_sub', async (ctx) => {
  const isSub = await checkSubscription(ctx);

  if (!isSub) {
    return ctx.answerCbQuery('❌ لم تشترك بعد!', { show_alert: true });
  }

  ctx.answerCbQuery('✅ تم التحقق بنجاح!', { show_alert: true });
  bot.start(ctx); // إعادة تشغيل البداية
});

// اختيار الإصدار
bot.action(/ver_(.+)/, (ctx) => {
  const version = ctx.match[1];
  const userId = ctx.from.id;
  
  ctx.answerCbQuery(`✅ تم اختيار الاصدار ${version}`);
  
  servers[userId] = servers[userId] || {};
  servers[userId].version = version;
  saveServers();
  
  ctx.reply(`✅ الإصدار: ${version}\n\n📥 أرسل IP السيرفر وPort:\nمثال:\nplay.server.com:19132`);
});

// استقبال IP وPort
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  const userId = ctx.from.id;
  
  if (text.includes(':')) {
    const parts = text.split(':');
    if (parts.length === 2) {
      const ip = parts[0].trim();
      const port = parseInt(parts[1].trim());
      
      if (!isNaN(port)) {
        servers[userId] = servers[userId] || {};
        servers[userId].ip = ip;
        servers[userId].port = port;
        saveServers();
        
        ctx.reply(
          `✅ تم حفظ السيرفر!\n🌐 IP: ${ip}\n🔌 Port: ${port}`,
          {
            ...Markup.inlineKeyboard([
              [Markup.button.callback('▶️ تشغيل البوت', 'run_bot')],
              [Markup.button.callback('➕ إضافة بوت', 'add_bot')],
              [Markup.button.callback('🛑 إيقاف البوت', 'stop_bot')],
              [Markup.button.callback('🗑️ حذف السيرفر', 'del_server')]
            ])
          }
        );
      } else {
        ctx.reply('❌ Port يجب أن يكون رقم!');
      }
    }
  }
  
  // معالجة رسائل البث (خاصة بالمالك فقط)
  if (ctx.from.id === ownerId) {
    // إذا كان المستخدم يرد على رسالة بث سابقة
    if (ctx.message.reply_to_message) {
      const repliedMsg = ctx.message.reply_to_message;
      if (repliedMsg.text && repliedMsg.text.includes('📤 أرسل الرسالة الآن:')) {
        const broadcastMessage = ctx.message.text;
        await handleBroadcast(ctx, broadcastMessage);
        return;
      }
    }
  }
});

// تشغيل البوت
bot.action('run_bot', async (ctx) => {
  const userId = ctx.from.id;
  
  if (!servers[userId] || !servers[userId].ip) {
    return ctx.answerCbQuery('❌ أضف السيرفر أولاً!', { show_alert: true });
  }
  
  const { ip, port, version } = servers[userId];
  
  ctx.answerCbQuery('🚀 جاري التشغيل...');
  ctx.reply(`🔗 الاتصال بـ:\n${ip}:${port}`);
  
  try {
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
      bot.telegram.sendMessage(userId, '🔥 دخل البوت بنجاح!').catch(() => {});
    });
    
    client.on('disconnect', (reason) => {
      bot.telegram.sendMessage(userId, `❌ تم الفصل: ${reason}`).catch(() => {});
      delete clients[userId];
    });
    
    client.on('error', (err) => {
      bot.telegram.sendMessage(userId, `❌ خطأ: ${err.message}`).catch(() => {});
      delete clients[userId];
    });
    
  } catch (error) {
    ctx.reply(`❌ خطأ: ${error.message}`);
  }
});

// إضافة بوت إضافي
bot.action('add_bot', async (ctx) => {
  const userId = ctx.from.id;
  
  if (!servers[userId] || !servers[userId].ip) {
    return ctx.answerCbQuery('❌ أضف السيرفر أولاً!', { show_alert: true });
  }
  
  const { ip, port, version } = servers[userId];
  
  ctx.answerCbQuery('➕ إضافة بوت...');
  
  try {
    const botNames = ['IBR_Bot_2', 'IBR_Bot_3', 'IBR_Bot_4', 'IBR_Bot_5'];
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
      bot.telegram.sendMessage(userId, `✅ ${botName} دخل`).catch(() => {});
    });
    
    client.on('disconnect', () => {
      bot.telegram.sendMessage(userId, `❌ ${botName} تم فصله`).catch(() => {});
      delete clients[clientKey];
    });
    
  } catch (error) {
    ctx.reply(`❌ فشل إضافة البوت: ${error.message}`);
  }
});

// إيقاف البوتات
bot.action('stop_bot', (ctx) => {
  const userId = ctx.from.id;
  
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
  
  ctx.answerCbQuery(`🛑 تم إيقاف ${stopped} بوت`);
  ctx.reply(`✅ تم إيقاف ${stopped} بوت`);
});

// حذف السيرفر
bot.action('del_server', (ctx) => {
  const userId = ctx.from.id;
  
  if (servers[userId]) {
    delete servers[userId];
    saveServers();
    
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

// إحصائيات
bot.command('stats', (ctx) => {
  if (ctx.from.id !== ownerId) return;
  
  const stats = `📊 إحصائيات البوت:
👥 المستخدمين: ${users.length}
🌐 السيرفرات النشطة: ${Object.keys(servers).length}
🤖 البوتات النشطة: ${Object.keys(clients).length}`;
  
  ctx.reply(stats);
});

// الأمر الخاص بك /bodcast (بدلاً من /broadcast)
bot.command('bodcast', async (ctx) => {
  if (ctx.from.id !== ownerId) return;
  
  const message = ctx.message.text.replace('/bodcast ', '').replace('/bodcast', '');
  
  if (!message.trim()) {
    // إذا لم تكن هناك رسالة، طلب إدخال الرسالة
    return ctx.reply('📤 أرسل الرسالة الآن:\n(يمكنك إرسال نص، صورة، فيديو، أو أي وسائط)', {
      reply_markup: {
        force_reply: true,
        selective: true
      }
    });
  }
  
  // إذا كانت هناك رسالة مع الأمر مباشرة
  await handleBroadcast(ctx, message);
});

// دالة معالجة البث
async function handleBroadcast(ctx, message) {
  if (ctx.from.id !== ownerId) return;
  
  if (!message || message.trim() === '') {
    return ctx.reply('❌ الرسالة فارغة!');
  }
  
  const totalUsers = users.length;
  if (totalUsers === 0) {
    return ctx.reply('❌ لا يوجد مستخدمين حتى الآن!');
  }
  
  await ctx.reply(`📢 جاري إرسال الرسالة لـ ${totalUsers} مستخدم...\n\nالرسالة:\n${message}\n\n⏳ قد يستغرق ذلك بعض الوقت...`);
  
  let sent = 0;
  let failed = 0;
  const startTime = Date.now();
  
  for (let i = 0; i < users.length; i++) {
    const userId = users[i];
    
    try {
      await bot.telegram.sendMessage(userId, `📢 إشعار من الإدارة:\n\n${message}`);
      sent++;
      
      // إرسال تحديث كل 50 مستخدم
      if (sent % 50 === 0) {
        await ctx.reply(`📤 تم إرسال ${sent}/${totalUsers} حتى الآن...`);
      }
      
      // تأخير بسيط لتجنب حظر تيليجرام
      await new Promise(resolve => setTimeout(resolve, 50));
      
    } catch (err) {
      failed++;
      
      // إذا كان المستخدم حظر البوت، إزالته من القائمة
      if (err.code === 403 || err.description === 'Forbidden: bot was blocked by the user') {
        users.splice(i, 1);
        i--;
        saveUsers();
      }
    }
  }
  
  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);
  
  const report = `✅ تم الانتهاء من البث:\n\n📊 النتائج:\n✅ تم الإرسال بنجاح: ${sent}\n❌ فشل الإرسال: ${failed}\n👥 العدد الإجمالي: ${totalUsers}\n⏱️ المدة: ${duration} ثانية`;
  
  await ctx.reply(report);
  
  // تحديث الإحصائيات للمالك
  try {
    await bot.telegram.sendMessage(ownerId, 
      `📢 تقرير البث الأخير:\n` +
      `تاريخ: ${new Date().toLocaleString()}\n` +
      `المستخدمين: ${totalUsers}\n` +
      `تم الإرسال: ${sent}\n` +
      `فشل: ${failed}`
    );
  } catch (err) {}
}

// بث (النسخة القديمة - للحفاظ على التوافق)
bot.command('broadcast', async (ctx) => {
  if (ctx.from.id !== ownerId) return;
  
  const message = ctx.message.text.replace('/broadcast ', '');
  if (!message) return ctx.reply('❌ أرسل الرسالة بعد الأمر');
  
  ctx.reply(`📢 إرسال الرسالة لـ ${users.length} مستخدم...`);
  
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
    console.log('✅ البوت يعمل الآن!');
    console.log(`👑 المالك: ${ownerId}`);
    console.log(`👥 عدد المستخدمين المحملين: ${users.length}`);
  })
  .catch((err) => {
    console.error('❌ خطأ في تشغيل البوت:', err);
  });

// إغلاق آمن
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
