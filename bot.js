
const { Telegraf, Markup } = require('telegraf');
const { createClient } = require('bedrock-protocol');
const fs = require('fs');
const path = require('path');

// ============== [الإعدادات] ==============
const REQUIRED_CHANNEL = -1003499194538; // قناة الاشتراك الإجباري
const botToken = '8198997283:AAHL_yWKazZf3Aa8OluwgjXV2goxtpwNPPQ'; // ⚠️ غيّر هذا
const ownerId = 1421302016; // ⚠️ غيّر هذا

const bot = new Telegraf(botToken);

// ============== [تخزين البيانات] ==============
let servers = {};
let users = [];
let clients = {};
const DATA_DIR = './data';

// ============== [خريطة الإصدارات الذكية] ==============
// ============== [خريطة الإصدارات الذكية - محدثة] ==============
const PROTOCOL_MAP = {
  // إصدارات حديثة جداً (محدثة يدوياً)
  '1.21.140': 880, '1.21.139': 879, '1.21.138': 878, '1.21.137': 877,
  '1.21.136': 876, '1.21.135': 875, '1.21.134': 874, '1.21.133': 873,
  '1.21.132': 872, '1.21.131': 871, // ⬅️ أضفنا 1.21.131 هنا!
  '1.21.130': 870,
  
  // بقية الإصدارات كما هي...
  '1.21.124.2': 860, '1.21.124': 860, '1.21.123': 859,
  '1.21.120': 859, '1.21.111': 844, '1.21.100': 827,
  '1.21.93': 819, '1.21.90': 818, '1.21.80': 800,
  '1.21.72': 786, '1.21.70': 786, '1.21.60': 776,
  '1.21.50': 766, '1.21.42': 748, '1.21.30': 729,
  '1.21.20': 712, '1.21.2': 686, '1.21.0': 685,
  
  // إصدارات سابقة
  '1.20.80': 671, '1.20.71': 662, '1.20.61': 649,
  '1.20.50': 630, '1.20.40': 622, '1.20.30': 618,
  '1.20.15': 594, '1.20.10': 594, '1.20.0': 589,
  '1.19.80': 582, '1.19.70': 575, '1.19.63': 568,
  '1.19.62': 567, '1.19.60': 567, '1.19.50': 560,
  '1.19.40': 557, '1.19.30': 554, '1.19.21': 545,
  '1.19.20': 544, '1.19.10': 534, '1.19.1': 527
};

// دالة للحصول على أقرب إصدار مدعوم
function getClosestVersion(requestedVersion) {
  if (PROTOCOL_MAP[requestedVersion]) {
    return requestedVersion;
  }
  
  // تحليل الإصدار المطلوب
  const parts = requestedVersion.split('.').map(Number);
  const [major, minor, patch] = parts;
  
  // البحث عن إصدار بنفس المستوى الرئيسي
  for (let p = patch; p >= 0; p--) {
    const testVersion = `${major}.${minor}.${p}`;
    if (PROTOCOL_MAP[testVersion]) return testVersion;
  }
  
  // البحث في الإصدارات الأقدم
  for (let m = minor - 1; m >= 0; m--) {
    for (let p = 200; p >= 0; p--) {
      const testVersion = `${major}.${m}.${p}`;
      if (PROTOCOL_MAP[testVersion]) return testVersion;
    }
  }
  
  return '1.21.124'; // افتراضي
}

// ============== [وظائف الملفات] ==============
function loadData() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    
    const serversPath = path.join(DATA_DIR, 'servers.json');
    const usersPath = path.join(DATA_DIR, 'users.json');
    
    if (fs.existsSync(serversPath)) {
      servers = JSON.parse(fs.readFileSync(serversPath, 'utf8'));
    }
    
    if (fs.existsSync(usersPath)) {
      users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    }
  } catch (error) {
    console.log('📂 لا توجد بيانات سابقة أو خطأ في التحميل');
  }
}

function saveServers() {
  try {
    fs.writeFileSync(path.join(DATA_DIR, 'servers.json'), JSON.stringify(servers, null, 2));
  } catch (error) {
    console.log('❌ خطأ في حفظ السيرفرات');
  }
}

function saveUsers() {
  try {
    fs.writeFileSync(path.join(DATA_DIR, 'users.json'), JSON.stringify(users, null, 2));
  } catch (error) {
    console.log('❌ خطأ في حفظ المستخدمين');
  }
}

// ============== [فحص الاشتراك] ==============
async function checkSubscription(ctx) {
  try {
    const member = await ctx.telegram.getChatMember(REQUIRED_CHANNEL, ctx.from.id);
    return ['member', 'creator', 'administrator'].includes(member.status);
  } catch (err) {
    return false;
  }
}

// ============== [نظام منع النسخ المتعددة] ==============
let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log(`\n🛑 استقبال إشارة ${signal}...`);
  
  // إيقاف اتصالات ماينكرافت
  console.log('🛑 إيقاف اتصالات ماينكرافت...');
  Object.keys(clients).forEach(key => {
    try {
      clients[key].end();
      console.log(`✓ تم إيقاف: ${key}`);
    } catch (err) {}
  });
  
  // إعطاء وقت للحفظ
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // إيقاف البوت
  console.log('🛑 إيقاف بوت تلغرام...');
  try {
    await bot.stop(signal);
    console.log('✅ تم إيقاف البوت بنجاح');
  } catch (err) {
    console.error('❌ خطأ في إيقاف البوت:', err.message);
  }
  
  process.exit(0);
}

// ============== [الاتصال الذكي] ==============
async function smartConnect(ip, port, requestedVersion, userId, botName = 'IBR_Bot') {
  const versionsToTry = [];
  const closestVersion = getClosestVersion(requestedVersion);
  
  // إضافة الإصدارات للمحاولة
  versionsToTry.push(requestedVersion); // حاول الإصدار المطلوب أولاً
  
  if (requestedVersion !== closestVersion) {
    versionsToTry.push(closestVersion);
  }
  
  // إضافة إصدارات شائعة أخرى
  const commonVersions = ['1.21.130', '1.21.124', '1.21.100', '1.21.80'];
  commonVersions.forEach(v => {
    if (!versionsToTry.includes(v)) versionsToTry.push(v);
  });
  
  let lastError = null;
  
  for (const version of versionsToTry) {
    const protocol = PROTOCOL_MAP[version] || autoDetectProtocol(version);
    
    try {
      console.log(`🔗 محاولة ${version} (بروتوكول: ${protocol})`);
      
      const client = createClient({
        host: ip,
        port: port,
        username: botName,
        version: version,
        offline: true,
        connectTimeout: 15000,
        protocolVersion: protocol,
        skipPing: true,
        raknetBackoff: false
      });
      
      // انتظار الاتصال
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('انتهت مهلة الاتصال'));
        }, 15000);
        
        client.once('join', () => {
          clearTimeout(timeout);
          resolve(client);
        });
        
        client.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
        
        client.once('disconnect', (reason) => {
          clearTimeout(timeout);
          reject(new Error(`انقطع الاتصال: ${reason}`));
        });
      });
      
      return {
        success: true,
        client,
        versionUsed: version,
        protocolUsed: protocol,
        requestedVersion,
        message: version === requestedVersion ? 
          `✅ تم الاتصال بالإصدار ${version}` :
          `✅ تم الاتصال بالإصدار ${version} (بديل عن ${requestedVersion})`
      };
      
    } catch (error) {
      lastError = error;
      console.log(`❌ فشل ${version}: ${error.message}`);
      continue;
    }
  }
  
  return {
    success: false,
    error: lastError?.message || 'فشل جميع المحاولات',
    requestedVersion
  };
}

// ============== [تحميل البيانات] ==============
loadData();

// ============== [أوامر البوت] ==============

// بداية البوت
bot.start(async (ctx) => {
  const isSub = await checkSubscription(ctx);
  
  if (!isSub) {
    return ctx.reply(
      `🔒 للوصول إلى البوت يجب الاشتراك في القناة:\nIBR Channel\nبعد الاشتراك اضغط على /start`,
      Markup.inlineKeyboard([
        [Markup.button.url('📌 اشترك الآن', 'https://t.me/+c7sbwOViyhNmYzAy')],
        [Markup.button.callback('🔍 تحقق من الاشتراك', 'check_sub')]
      ])
    );
  }
  
  const user = ctx.from;
  const userId = user.id;
  
  if (!users.includes(userId)) {
    users.push(userId);
    saveUsers();
    
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
  
  // عرض الإصدارات
  ctx.reply('🎮 أهلاً بك في بوت Minecraft by IBR!\n\nاختر إصدار اللعبة:', {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([

      [Markup.button.callback('✨NEW 1.21.131', 'ver_1.21.131')],
      [Markup.button.callback('🚀 1.21.130', 'ver_1.21.130')],
      [Markup.button.callback('✅ 1.21.124', 'ver_1.21.124')],
      [Markup.button.callback('1.21.123', 'ver_1.21.123')],
      [Markup.button.callback('1.21.120', 'ver_1.21.120')],
      [Markup.button.callback('1.21.100', 'ver_1.21.100')],
      [Markup.button.callback('1.21.93', 'ver_1.21.93')],
      [Markup.button.callback('1.21.84', 'ver_1.21.84')],
      [Markup.button.callback('1.21.80', 'ver_1.21.80')],
      [Markup.button.callback('المزيد ⬇️', 'more_versions')]
    ])
  });
});

// المزيد من الإصدارات
bot.action('more_versions', (ctx) => {
  ctx.editMessageText('🎮 اختر إصدار اللعبة:', {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('1.21.72', 'ver_1.21.72')],
      [Markup.button.callback('1.21.50', 'ver_1.21.50')],
      [Markup.button.callback('1.21.0', 'ver_1.21.0')],
      [Markup.button.callback('1.20.80', 'ver_1.20.80')],
      [Markup.button.callback('1.20.50', 'ver_1.20.50')],
      [Markup.button.callback('1.20.0', 'ver_1.20.0')],
      [Markup.button.callback('1.19.80', 'ver_1.19.80')],
      [Markup.button.callback('العودة ⬆️', 'back_versions')]
    ])
  });
});

bot.action('back_versions', (ctx) => {
  ctx.editMessageText('🎮 اختر إصدار اللعبة:', {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('✨NEW 1.21.131', 'ver_1.21.131')],
      [Markup.button.callback('🚀 1.21.130', 'ver_1.21.130')],
      [Markup.button.callback('✅ 1.21.124', 'ver_1.21.124')],
      [Markup.button.callback('1.21.123', 'ver_1.21.123')],
      [Markup.button.callback('1.21.120', 'ver_1.21.120')],
      [Markup.button.callback('1.21.100', 'ver_1.21.100')],
      [Markup.button.callback('1.21.93', 'ver_1.21.93')],
      [Markup.button.callback('1.21.84', 'ver_1.21.84')],
      [Markup.button.callback('1.21.80', 'ver_1.21.80')],
      [Markup.button.callback('المزيد ⬇️', 'more_versions')]
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
  ctx.deleteMessage();
  bot.start(ctx);
});

// اختيار الإصدار
bot.action(/ver_(.+)/, (ctx) => {
  const version = ctx.match[1];
  const userId = ctx.from.id;
  
  ctx.answerCbQuery(`✅ تم اختيار ${version}`);
  
  servers[userId] = servers[userId] || {};
  servers[userId].version = version;
  saveServers();
  
  ctx.reply(`✅ الإصدار: ${version}\n\n📥 أرسل IP السيرفر وPort:\nمثال:\nplay.server.com:19132`);
});

// استقبال IP وPort
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  const userId = ctx.from.id;
  
  if (text.startsWith('/')) return;
  
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
        
        const version = servers[userId].version || '1.21.124';
        
        ctx.reply(
          `✅ تم حفظ السيرفر!\n` +
          `🌐 IP: ${ip}\n` +
          `🔌 Port: ${port}\n` +
          `📀 الإصدار: ${version}`,
          Markup.inlineKeyboard([
            [Markup.button.callback('▶️ تشغيل البوت', 'run_bot')],
            [Markup.button.callback('➕ إضافة بوت', 'add_bot')],
            [Markup.button.callback('🔧 تشغيل ذكي', 'run_smart')],
            [Markup.button.callback('🛑 إيقاف البوت', 'stop_bot')],
            [Markup.button.callback('🗑️ حذف السيرفر', 'del_server')],
            [Markup.button.url('تفاعل في قناة البوت والا يتم حظرك نهائيا🚫 ', 'https://t.me/+c7sbwOViyhNmYzAy')]
            
          ])
        );
      } else {
        ctx.reply('❌ Port يجب أن يكون رقم!');
      }
    }
  }
});

// تشغيل البوت الذكي
bot.action('run_smart', async (ctx) => {
  const userId = ctx.from.id;
  
  if (!servers[userId] || !servers[userId].ip) {
    return ctx.answerCbQuery('❌ أضف السيرفر أولاً!', { show_alert: true });
  }
  
  const { ip, port, version = '1.21.124' } = servers[userId];
  
  ctx.answerCbQuery('🤖 جاري التشغيل الذكي...');
  ctx.reply(`🔍 *بدء الاتصال الذكي:*\n${ip}:${port}\nالإصدار المطلوب: ${version}`, 
    { parse_mode: 'Markdown' });
  
  const result = await smartConnect(ip, port, version, userId);
  
  if (result.success) {
    const clientKey = `${userId}_main`;
    clients[clientKey] = result.client;
    
    ctx.reply(result.message);
    
    result.client.on('join', () => {
      bot.telegram.sendMessage(userId,
        `🔥 *تم دخول البوت!*\n تفاعل في قناة البوت والا يتم حظرك` +
        `▫️ الإصدار المستخدم: ${result.versionUsed}\n` +
        `▫️ البروتوكول: ${result.protocolUsed}\n` +
        `▫️ الحالة: ${result.versionUsed === result.requestedVersion ? 'مباشر' : 'بديل'}`
      , { parse_mode: 'Markdown' }).catch(() => {});
    });
    
    result.client.on('disconnect', (reason) => {
      bot.telegram.sendMessage(userId, `❌ تم الفصل: ${reason}`).catch(() => {});
      delete clients[clientKey];
    });
    
    result.client.on('error', (err) => {
      bot.telegram.sendMessage(userId, `⚠️ خطأ: ${err.message}`).catch(() => {});
      delete clients[clientKey];
    });
    
  } else {
    ctx.reply(
      `❌ *فشل الاتصال*\n\n` +
      `خطأ: ${result.error}\n\n` +
      `💡 *جرب:*\n` +
      `1. تحقق من تشغيل السيرفر\n` +
      `2. جرب إصداراً مختلفاً\n` +
      `3. استخدم /test للفحص`
    , { parse_mode: 'Markdown' });
  }
});

// تشغيل البوت العادي
bot.action('run_bot', async (ctx) => {
  const userId = ctx.from.id;
  
  if (!servers[userId] || !servers[userId].ip) {
    return ctx.answerCbQuery('❌ أضف السيرفر أولاً!', { show_alert: true });
  }
  
  const { ip, port, version = '1.21.124' } = servers[userId];
  const protocol = PROTOCOL_MAP[version] || 860;
  
  ctx.answerCbQuery('🚀 جاري التشغيل...');
  ctx.reply(`🔗 الاتصال بـ:\n${ip}:${port}\nالإصدار: ${version}`);
  
  try {
    const client = createClient({
      host: ip,
      port: port,
      username: 'IBR_Bot',
      version: version,
      offline: true,
      connectTimeout: 15000,
      protocolVersion: protocol,
      skipPing: true
    });
    
    const clientKey = `${userId}_main`;
    clients[clientKey] = client;
    
    client.on('join', () => {
      bot.telegram.sendMessage(userId, '🔥 دخل البوت بنجاح!').catch(() => {});
      
    });
    
    client.on('disconnect', (reason) => {
      bot.telegram.sendMessage(userId, `❌ تم الفصل: ${reason}`).catch(() => {});
      delete clients[clientKey];
    });
    
    client.on('error', (err) => {
      let errorMsg = `❌ خطأ: ${err.message}`;
      
      if (err.message.includes('Unsupported version')) {
        const closest = getClosestVersion(version);
        errorMsg += `\n\n💡 جرب:\n`;
        errorMsg += `• الزر "🔧 تشغيل ذكي"\n`;
        errorMsg += `• أو الإصدار ${closest}`;
      }
      
      bot.telegram.sendMessage(userId, errorMsg).catch(() => {});
      delete clients[clientKey];
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
  
  const { ip, port, version = '1.21.124' } = servers[userId];
  
  ctx.answerCbQuery('➕ جاري إضافة بوت...');
  
  try {
    const botNames = ['IBR_Bot_2', 'IBR_Bot_3', 'IBR_Bot_4', 'IBR_Bot_5'];
    const botName = botNames[Math.floor(Math.random() * botNames.length)];
    
    const result = await smartConnect(ip, port, version, userId, botName);
    
    if (result.success) {
      const clientKey = `${userId}_${botName}`;
      clients[clientKey] = result.client;
      
      ctx.reply(`✅ ${botName} - ${result.message}`);
      
      result.client.on('disconnect', () => {
        bot.telegram.sendMessage(userId, `❌ ${botName} تم فصله`).catch(() => {});
        delete clients[clientKey];
      });
      
    } else {
      ctx.reply(`❌ فشل إضافة ${botName}: ${result.error}`);
    }
    
  } catch (error) {
    ctx.reply(`❌ خطأ في إضافة البوت: ${error.message}`);
  }
});

// إيقاف البوتات
bot.action('stop_bot', (ctx) => {
  const userId = ctx.from.id;
  
  let stopped = 0;
  Object.keys(clients).forEach(key => {
    if (key.startsWith(userId + '_')) {
      try {
        clients[key].end();
        stopped++;
      } catch (err) {}
      delete clients[key];
    }
  });
  
  ctx.answerCbQuery(`🛑 تم إيقاف ${stopped} بوت`);
  ctx.reply(`✅ تم إيقاف ${stopped} بوت`);
});

// حذف السيرفر
bot.action('del_server', (ctx) => {
  const userId = ctx.from.id;
  
  if (servers[userId]) {
    delete servers[userId];
    saveServers();
    
    Object.keys(clients).forEach(key => {
      if (key.startsWith(userId + '_')) {
        try {
          clients[key].end();
        } catch (err) {}
        delete clients[key];
      }
    });
    
    ctx.answerCbQuery('🗑️ تم الحذف');
    ctx.reply('✅ تم حذف السيرفر وإيقاف البوتات');
  } else {
    ctx.answerCbQuery('❌ لا يوجد سيرفر');
  }
});

// ============== [أوامر خاصة] ==============

// اختبار الاتصال
bot.command('test', async (ctx) => {
  const userId = ctx.from.id;
  
  if (!servers[userId] || !servers[userId].ip) {
    return ctx.reply('❌ أضف السيرفر أولاً!');
  }
  
  const { ip, port } = servers[userId];
  
  ctx.reply(`🔬 *بدء اختبار الاتصال:*\n${ip}:${port}`, { parse_mode: 'Markdown' });
  
  const testVersions = ['1.21.130', '1.21.124', '1.21.100', '1.21.80', '1.20.80'];
  let results = [];
  
  for (const version of testVersions) {
    const protocol = PROTOCOL_MAP[version];
    if (!protocol) {
      results.push(`❓ ${version} - غير معروف`);
      continue;
    }
    
    try {
      const testClient = createClient({
        host: ip,
        port: port,
        username: 'Test_Bot',
        version: version,
        offline: true,
        connectTimeout: 5000,
        protocolVersion: protocol,
        skipPing: true
      });
      
      const connected = await new Promise((resolve) => {
        testClient.once('join', () => {
          testClient.end();
          resolve(true);
        });
        
        testClient.once('error', () => {
          testClient.end();
          resolve(false);
        });
        
        setTimeout(() => {
          testClient.end();
          resolve(false);
        }, 5000);
      });
      
      results.push(`${connected ? '✅' : '❌'} ${version} - ${connected ? 'ناجح' : 'فاشل'}`);
      
    } catch (error) {
      results.push(`💥 ${version} - خطأ`);
    }
  }
  
  ctx.reply(
    `📊 *نتائج الاختبار:*\n\n${results.join('\n')}\n\n` +
    `💡 استخدم الإصدار الأول الناجح`,
    { parse_mode: 'Markdown' }
  );
});
// أضف هذا الأمر في قسم الأوامر الخاصة
bot.command('update_versions', async (ctx) => {
  if (ctx.from.id !== ownerId) return;
  
  ctx.reply('🔄 جاري تحديث خريطة الإصدارات...');
  
  try {
    // محاولة الحصول على أحدث إصدارات من المكتبة
    const protocol = require('bedrock-protocol');
    
    let newVersions = '';
    
    // إضافة إصدارات 1.21.131 - 1.21.140 تلقائياً
    for (let i = 131; i <= 140; i++) {
      const version = `1.21.${i}`;
      const protocolNum = 870 + (i - 130); // حساب تلقائي
      
      if (!PROTOCOL_MAP[version]) {
        PROTOCOL_MAP[version] = protocolNum;
        newVersions += `• ${version}: ${protocolNum}\n`;
      }
    }
    
    if (newVersions) {
      ctx.reply(
        `✅ *تمت إضافة إصدارات جديدة:*\n\n${newVersions}\n` +
        `📊 الإجمالي: ${Object.keys(PROTOCOL_MAP).length} إصدار\n\n` +
        `🔄 أعد تشغيل البوت للتطبيق`,
        { parse_mode: 'Markdown' }
      );
    } else {
      ctx.reply('✅ خريطة الإصدارات محدثة بالفعل');
    }
    
  } catch (error) {
    ctx.reply(`❌ خطأ: ${error.message}`);
  }
});
// تعيين إصدار سريع
bot.command('set130', (ctx) => {
  const userId = ctx.from.id;
  
  if (!servers[userId] || !servers[userId].ip) {
    return ctx.reply('❌ أضف السيرفر أولاً!');
  }
  
  servers[userId].version = '1.21.130';
  saveServers();
  
  ctx.reply(
    `✅ تم تعيين الإصدار إلى 1.21.130\n\n` +
    `🚀 *معلومات:*\n` +
    `• البروتوكول: ${PROTOCOL_MAP['1.21.130'] || 870}\n` +
    `• اضغط "🔧 تشغيل ذكي" للبدء\n\n` +
    `⚠️ إذا لم يعمل، سيحاول البوت إصداراً بديلاً تلقائياً`
  , { parse_mode: 'Markdown' });
});

bot.command('set124', (ctx) => {
  const userId = ctx.from.id;
  
  if (!servers[userId] || !servers[userId].ip) {
    return ctx.reply('❌ أضف السيرفر أولاً!');
  }
  
  servers[userId].version = '1.21.124';
  saveServers();
  
  ctx.reply('✅ تم تعيين الإصدار إلى 1.21.124 (مضمون)\nاضغط "▶️ تشغيل البوت"');
});

// الإحصائيات (للمالك فقط)
bot.command('stats', (ctx) => {
  if (ctx.from.id !== ownerId) return;
  
  const stats = `📊 *إحصائيات البوت:*\n` +
    `👥 المستخدمين: ${users.length}\n` +
    `🌐 السيرفرات النشطة: ${Object.keys(servers).length}\n` +
    `🤖 البوتات النشطة: ${Object.keys(clients).length}\n` +
    `📀 أحدث إصدار: 1.21.130`;
  
  ctx.reply(stats, { parse_mode: 'Markdown' });
});

// البث (للمالك فقط)
bot.command('broadcast', async (ctx) => {
  if (ctx.from.id !== ownerId) return;
  
  const message = ctx.message.text.replace('/broadcast ', '');
  if (!message) return ctx.reply('❌ أرسل الرسالة بعد الأمر');
  
  ctx.reply(`📢 إرسال لـ ${users.length} مستخدم...`);
  
  let sent = 0;
  for (let user of users) {
    try {
      await bot.telegram.sendMessage(user, `📢 إشعار:\n\n${message}`);
      sent++;
    } catch (err) {}
  }
  
  ctx.reply(`✅ تم الإرسال لـ ${sent}/${users.length} مستخدم`);
});

// معلومات المكتبة
bot.command('libinfo', (ctx) => {
  if (ctx.from.id !== ownerId) return;
  
  const latestVersions = Object.keys(PROTOCOL_MAP)
    .filter(v => v.startsWith('1.21.'))
    .sort()
    .reverse()
    .slice(0, 10);
  
  ctx.reply(
    `📦 *معلومات المكتبة:*\n\n` +
    `▫️ الإصدارات المدعومة: ${Object.keys(PROTOCOL_MAP).length}\n` +
    `▫️ أحدث 10 إصدارات:\n${latestVersions.join('\n')}\n\n` +
    `🔧 1.21.130 → بروتوكول: ${PROTOCOL_MAP['1.21.130'] || '?'}`,
    { parse_mode: 'Markdown' }
  );
});

// ============== [تشغيل البوت] ==============
process.once('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

// أضف هذا في بداية تشغيل البوت (قبل bot.launch)
console.log('🔍 التحقق من الإصدارات المدعومة...');

// عرض الإصدارات الحديثة المدعومة
const modernVersions = Object.keys(PROTOCOL_MAP)
  .filter(v => v.startsWith('1.21.1'))
  .sort()
  .reverse();

console.log(`📀 الإصدارات الحديثة المدعومة (1.21.1xx):`);
modernVersions.slice(0, 15).forEach(v => {
  console.log(`  ${v}: ${PROTOCOL_MAP[v]}`);
});

if (modernVersions.length === 0) {
  console.log('⚠️ لا توجد إصدارات 1.21.1xx في الخريطة!');
  console.log('💡 أضفها يدوياً إلى PROTOCOL_MAP');
}

// بدء البوت
bot.launch({
  dropPendingUpdates: true,
  allowedUpdates: ['message', 'callback_query']
})
.then(() => {
  console.log('🚀 البوت يعمل الآن!');
  console.log('📀 الإصدارات المدعومة:', Object.keys(PROTOCOL_MAP).length);
  
  const latest = Object.keys(PROTOCOL_MAP)
    .filter(v => v.startsWith('1.21.1'))
    .sort()
    .reverse()[0];
  
  console.log(`🎯 أحدث إصدار: ${latest} (بروتوكول: ${PROTOCOL_MAP[latest]})`);
})
.catch((err) => {
  console.error('❌ خطأ في تشغيل البوت:', err.message);
  
  if (err.response?.error_code === 409) {
    console.error('\n💡 *الحل:*');
    console.error('1. اذهب إلى Railway Dashboard');
    console.error('2. أوقف الخدمة (Pause Service)');
    console.error('3. انتظر 30 ثانية');
    console.error('4. أعد التشغيل (Resume Service)');
  }
});
