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

// ============== [الجديد] خريطة الإصدارات الذكية ==============
const VERSION_MAP = {
  // إصدارات حديثة جداً (قد تحتاج خريطة بروتوكول مخصصة)
  '1.21.130': { protocol: 870, fallback: '1.21.124' },
  '1.21.124.2': { protocol: 860, fallback: '1.21.124' },
  '1.21.124': { protocol: 860, fallback: '1.21.120' },
  '1.21.123': { protocol: 860, fallback: '1.21.120' },
  '1.21.120': { protocol: 859, fallback: '1.21.100' },
  '1.21.100': { protocol: 827, fallback: '1.21.93' },
  '1.21.93': { protocol: 819, fallback: '1.21.80' },
  '1.21.84': { protocol: 819, fallback: '1.21.80' },
  '1.21.80': { protocol: 800, fallback: '1.21.72' },
  '1.21.72': { protocol: 786, fallback: '1.21.50' },
  '1.21.50': { protocol: 766, fallback: '1.21.0' },
  
  // إصدارات أساسية كاحتياطي
  '1.21.0': { protocol: 685, fallback: '1.20.80' },
  '1.20.80': { protocol: 671, fallback: '1.20.50' },
  '1.20.50': { protocol: 630, fallback: '1.20.0' },
  '1.20.0': { protocol: 589, fallback: '1.19.80' },
  '1.19.80': { protocol: 582, fallback: '1.19.50' }
};

// ============== [الجديد] دالة الاتصال الذكية ==============
async function smartConnect(ip, port, requestedVersion, userId, botName = 'IBR_Bot') {
  let attempts = [];
  let success = false;
  let finalClient = null;
  let usedVersion = requestedVersion;
  
  // الخطوة 1: حاول بالإصدار المطلوب أولاً
  const versionInfo = VERSION_MAP[requestedVersion];
  if (versionInfo) {
    try {
      console.log(`🔧 محاولة الاتصال بالإصدار: ${requestedVersion} (بروتوكول: ${versionInfo.protocol})`);
      
      const client = createClient({
        host: ip,
        port: port,
        username: botName,
        version: requestedVersion,
        offline: true,
        connectTimeout: 15000,
        // إضافة خيارات متقدمة للتوافق
        skipPing: true,
        protocolVersion: versionInfo.protocol,
        // إعدادات إضافية للاستقرار
        autoInitPlayer: false,
        useCustomPackets: false
      });
      
      // انتظار الاتصال
      await new Promise((resolve, reject) => {
        client.once('join', resolve);
        client.once('disconnect', reject);
        client.once('error', reject);
        setTimeout(() => reject(new Error('انتهت مهلة الاتصال')), 15000);
      });
      
      success = true;
      finalClient = client;
      usedVersion = requestedVersion;
      attempts.push(`✅ ${requestedVersion} - نجاح`);
      
    } catch (error) {
      attempts.push(`❌ ${requestedVersion} - فشل: ${error.message}`);
      
      // الخطوة 2: حاول بالإصدار البديل
      if (versionInfo.fallback && VERSION_MAP[versionInfo.fallback]) {
        const fallbackInfo = VERSION_MAP[versionInfo.fallback];
        try {
          console.log(`🔄 تجربة الإصدار البديل: ${versionInfo.fallback}`);
          
          const fallbackClient = createClient({
            host: ip,
            port: port,
            username: botName,
            version: versionInfo.fallback,
            offline: true,
            connectTimeout: 15000,
            protocolVersion: fallbackInfo.protocol,
            skipPing: true
          });
          
          await new Promise((resolve, reject) => {
            fallbackClient.once('join', resolve);
            fallbackClient.once('disconnect', reject);
            fallbackClient.once('error', reject);
            setTimeout(() => reject(new Error('انتهت مهلة الاتصال')), 15000);
          });
          
          success = true;
          finalClient = fallbackClient;
          usedVersion = versionInfo.fallback;
          attempts.push(`✅ ${versionInfo.fallback} - نجاح (بديل)`);
          
        } catch (fallbackError) {
          attempts.push(`❌ ${versionInfo.fallback} - فشل بديل: ${fallbackError.message}`);
        }
      }
    }
  }
  
  // الخطوة 3: إذا فشل كل شيء، جرب الإصدارات الشائعة
  if (!success) {
    const commonVersions = ['1.21.124', '1.21.100', '1.21.80', '1.21.50', '1.20.80'];
    
    for (const commonVer of commonVersions) {
      if (commonVer === requestedVersion) continue; // تجنب تكرار المحاولة
      
      const commonInfo = VERSION_MAP[commonVer];
      if (!commonInfo) continue;
      
      try {
        console.log(`🎯 تجربة الإصدار الشائع: ${commonVer}`);
        
        const commonClient = createClient({
          host: ip,
          port: port,
          username: botName,
          version: commonVer,
          offline: true,
          connectTimeout: 10000,
          protocolVersion: commonInfo.protocol,
          skipPing: true
        });
        
        await new Promise((resolve, reject) => {
          commonClient.once('join', resolve);
          commonClient.once('disconnect', reject);
          commonClient.once('error', reject);
          setTimeout(() => reject(new Error('انتهت مهلة الاتصال')), 10000);
        });
        
        success = true;
        finalClient = commonClient;
        usedVersion = commonVer;
        attempts.push(`✅ ${commonVer} - نجاح (شائع)`);
        break;
        
      } catch (commonError) {
        attempts.push(`❌ ${commonVer} - فشل: ${commonError.message}`);
      }
    }
  }
  
  return { success, client: finalClient, usedVersion, attempts };
}

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

// ============== [الجديد] دالة إرسال تقرير محاولات ==============
function sendAttemptsReport(userId, requestedVersion, usedVersion, attempts) {
  let report = `📊 *تقرير الاتصال:*\n`;
  report += `▫️ الإصدار المطلوب: ${requestedVersion}\n`;
  report += `▫️ الإصدار المستخدم: ${usedVersion}\n\n`;
  
  if (usedVersion !== requestedVersion) {
    report += `⚠️ *تم استخدام إصدار بديل للتوافق*\n\n`;
  }
  
  report += `🔍 *المحاولات:*\n`;
  attempts.forEach((attempt, index) => {
    report += `${index + 1}. ${attempt}\n`;
  });
  
  bot.telegram.sendMessage(userId, report, { parse_mode: 'Markdown' }).catch(() => {});
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
      [Markup.button.callback('1.21.130', 'ver_1.21.130')],
      [Markup.button.callback('1.21.124.2', 'ver_1.21.124.2')],
      [Markup.button.callback('1.21.124', 'ver_1.21.124')],
      [Markup.button.callback('1.21.123', 'ver_1.21.123')],
      [Markup.button.callback('1.21.120', 'ver_1.21.120')],
      [Markup.button.callback('1.21.100', 'ver_1.21.100')],
      [Markup.button.callback('1.21.93', 'ver_1.21.93')],
      [Markup.button.callback('1.21.84', 'ver_1.21.84')],
      [Markup.button.callback('1.21.80', 'ver_1.21.80')],
      [Markup.button.callback('1.21.72', 'ver_1.21.72')],
      [Markup.button.callback('1.21.50', 'ver_1.21.50')],
      [Markup.button.callback('المزيد ⬇️', 'more_versions')]
    ])
  });
});

// زر الإصدارات الإضافية
bot.action('more_versions', (ctx) => {
  ctx.editMessageText('🎮 اختر إصدار اللعبة:', {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('1.21.0', 'ver_1.21.0')],
      [Markup.button.callback('1.20.80', 'ver_1.20.80')],
      [Markup.button.callback('1.20.50', 'ver_1.20.50')],
      [Markup.button.callback('1.20.0', 'ver_1.20.0')],
      [Markup.button.callback('1.19.80', 'ver_1.19.80')],
      [Markup.button.callback('1.19.50', 'ver_1.19.50')],
      [Markup.button.callback('1.19.0', 'ver_1.19.0')],
      [Markup.button.callback('العودة ⬆️', 'back_versions')]
    ])
  });
});

bot.action('back_versions', (ctx) => {
  ctx.editMessageText('🎮 أهلاً بك في بوت Minecraft bu IBR!\n\nاختر إصدار اللعبة:', {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('1.21.130', 'ver_1.21.130')],
      [Markup.button.callback('1.21.124.2', 'ver_1.21.124.2')],
      [Markup.button.callback('1.21.124', 'ver_1.21.124')],
      [Markup.button.callback('1.21.123', 'ver_1.21.123')],
      [Markup.button.callback('1.21.120', 'ver_1.21.120')],
      [Markup.button.callback('1.21.100', 'ver_1.21.100')],
      [Markup.button.callback('1.21.93', 'ver_1.21.93')],
      [Markup.button.callback('1.21.84', 'ver_1.21.84')],
      [Markup.button.callback('1.21.80', 'ver_1.21.80')],
      [Markup.button.callback('1.21.72', 'ver_1.21.72')],
      [Markup.button.callback('1.21.50', 'ver_1.21.50')],
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
        
        // ============== [الجديد] التحقق من الإصدار ==============
        const version = servers[userId].version || '1.21.124';
        const versionInfo = VERSION_MAP[version];
        let versionNote = '';
        
        if (versionInfo && versionInfo.fallback) {
          versionNote = `\n⚠️ *ملاحظة:* إذا فشل ${version}، سيتم تجربة ${versionInfo.fallback}`;
        }
        
        ctx.reply(
          `✅ تم حفظ السيرفر!\n🌐 IP: ${ip}\n🔌 Port: ${port}\n📀 الإصدار: ${version}${versionNote}`,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('▶️ تشغيل البوت', 'run_bot')],
              [Markup.button.callback('🔧 تشغيل ذكي', 'run_smart')],
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
});

// ============== [الجديد] تشغيل ذكي ==============
bot.action('run_smart', async (ctx) => {
  const userId = ctx.from.id;
  
  if (!servers[userId] || !servers[userId].ip) {
    return ctx.answerCbQuery('❌ أضف السيرفر أولاً!', { show_alert: true });
  }
  
  const { ip, port, version = '1.21.124' } = servers[userId];
  
  ctx.answerCbQuery('🤖 جاري التشغيل الذكي...');
  ctx.reply(`🔍 *بدء الاتصال الذكي:*\n${ip}:${port}\nالإصدار: ${version}`, { parse_mode: 'Markdown' });
  
  try {
    const result = await smartConnect(ip, port, version, userId, 'IBR_Smart_Bot');
    
    if (result.success) {
      clients[userId] = result.client;
      
      // إرسال تقرير المحاولات
      sendAttemptsReport(userId, version, result.usedVersion, result.attempts);
      
      // إعداد معالجات الأحداث
      result.client.on('join', () => {
        bot.telegram.sendMessage(userId, '🔥 تم دخول البوت بنجاح!').catch(() => {});
      });
      
      result.client.on('disconnect', (reason) => {
        bot.telegram.sendMessage(userId, `❌ تم الفصل: ${reason}`).catch(() => {});
        delete clients[userId];
      });
      
      result.client.on('error', (err) => {
        bot.telegram.sendMessage(userId, `⚠️ خطأ في التشغيل: ${err.message}`).catch(() => {});
        delete clients[userId];
      });
      
    } else {
      ctx.reply(
        `❌ *فشل جميع محاولات الاتصال*\n\n` +
        `🔍 *المحاولات:*\n${result.attempts.join('\n')}\n\n` +
        `💡 *الحلول المقترحة:*\n` +
        `1. تحقق من تشغيل السيرفر\n` +
        `2. جرب إصداراً مختلفاً\n` +
        `3. تأكد من فتح البورت\n` +
        `4. استخدم /connect_test لفحص الاتصال`,
        { parse_mode: 'Markdown' }
      );
    }
    
  } catch (error) {
    ctx.reply(`💥 خطأ غير متوقع: ${error.message}`);
  }
});

// تشغيل البوت (الطريقة العادية)
bot.action('run_bot', async (ctx) => {
  const userId = ctx.from.id;
  
  if (!servers[userId] || !servers[userId].ip) {
    return ctx.answerCbQuery('❌ أضف السيرفر أولاً!', { show_alert: true });
  }
  
  const { ip, port, version = '1.21.124' } = servers[userId];
  
  ctx.answerCbQuery('🚀 جاري التشغيل...');
  ctx.reply(`🔗 الاتصال بـ:\n${ip}:${port}\nالإصدار: ${version}`);
  
  try {
    const versionInfo = VERSION_MAP[version];
    const protocolVersion = versionInfo ? versionInfo.protocol : 860;
    
    const client = createClient({
      host: ip,
      port: port,
      username: 'IBR_Bot',
      version: version,
      offline: true,
      connectTimeout: 15000,
      protocolVersion: protocolVersion,
      skipPing: true
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
      // ============== [الجديد] معالجة أفضل للأخطاء ==============
      let errorMsg = `❌ خطأ: ${err.message}`;
      
      if (err.message.includes('Unsupported version')) {
        const versionInfo = VERSION_MAP[version];
        if (versionInfo && versionInfo.fallback) {
          errorMsg += `\n\n💡 جرب:\n`;
          errorMsg += `1. استخدم الزر "🔧 تشغيل ذكي"\n`;
          errorMsg += `2. أو غير الإصدار إلى ${versionInfo.fallback}`;
        }
      }
      
      bot.telegram.sendMessage(userId, errorMsg).catch(() => {});
      delete clients[userId];
    });
    
  } catch (error) {
    ctx.reply(`❌ خطأ: ${error.message}`);
  }
});

// ============== [الجديد] أمر اختبار الاتصال ==============
bot.command('connect_test', async (ctx) => {
  const userId = ctx.from.id;
  
  if (!servers[userId] || !servers[userId].ip) {
    return ctx.reply('❌ أضف السيرفر أولاً!');
  }
  
  const { ip, port } = servers[userId];
  
  ctx.reply(`🔬 *بدء اختبار الاتصال:*\n${ip}:${port}`, { parse_mode: 'Markdown' });
  
  // اختبار الإصدارات الشائعة
  const testVersions = ['1.21.124', '1.21.100', '1.21.80', '1.21.50', '1.20.80'];
  let results = [];
  
  for (const testVer of testVersions) {
    try {
      const versionInfo = VERSION_MAP[testVer];
      if (!versionInfo) continue;
      
      const testClient = createClient({
        host: ip,
        port: port,
        username: 'Test_Bot',
        version: testVer,
        offline: true,
        connectTimeout: 5000,
        protocolVersion: versionInfo.protocol
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
      
      results.push(`${connected ? '✅' : '❌'} ${testVer} - ${connected ? 'ناجح' : 'فاشل'}`);
      
    } catch (err) {
      results.push(`❌ ${testVer} - خطأ`);
    }
  }
  
  ctx.reply(
    `📊 *نتائج اختبار الاتصال:*\n\n${results.join('\n')}\n\n` +
    `💡 *التوصية:*\nاستخدم الإصدار الأول الناجح في القائمة`,
    { parse_mode: 'Markdown' }
  );
});

// إضافة بوت إضافي
bot.action('add_bot', async (ctx) => {
  const userId = ctx.from.id;
  
  if (!servers[userId] || !servers[userId].ip) {
    return ctx.answerCbQuery('❌ أضف السيرفر أولاً!', { show_alert: true });
  }
  
  const { ip, port, version = '1.21.124' } = servers[userId];
  
  ctx.answerCbQuery('➕ إضافة بوت...');
  
  try {
    const botNames = ['IBR_Bot_2', 'IBR_Bot_3', 'IBR_Bot_4', 'IBR_Bot_5'];
    const botName = botNames[Math.floor(Math.random() * botNames.length)];
    
    // ============== [الجديد] استخدام الاتصال الذكي للإضافة ==============
    const result = await smartConnect(ip, port, version, userId, botName);
    
    if (result.success) {
      const clientKey = `${userId}_${botName}`;
      clients[clientKey] = result.client;
      
      bot.telegram.sendMessage(userId, 
        `✅ ${botName} تمت إضافته بنجاح!\n` +
        `الإصدار المستخدم: ${result.usedVersion}`
      ).catch(() => {});
      
      result.client.on('disconnect', () => {
        bot.telegram.sendMessage(userId, `❌ ${botName} تم فصله`).catch(() => {});
        delete clients[clientKey];
      });
      
    } else {
      ctx.reply(`❌ فشل إضافة البوت: جميع المحاولات فشلت`);
    }
    
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
🤖 البوتات النشطة: ${Object.keys(clients).length}
📀 الإصدارات المحددة: ${Object.values(servers).map(s => s.version).filter(v => v).join(', ')}`;
  
  ctx.reply(stats);
});

// ============== [الجديد] أمر تحديث المكتبة ==============
bot.command('update_lib', async (ctx) => {
  if (ctx.from.id !== ownerId) return;
  
  ctx.reply('🔄 جاري التحقق من تحديثات المكتبة...');
  
  // يمكن إضافة تحديث ديناميكي هنا
  // أو إعادة تثبيت المكتبة بأحدث إصدار
  const currentVersions = Object.keys(VERSION_MAP).slice(0, 5).join(', ');
  
  ctx.reply(
    `📦 *معلومات المكتبة الحالية:*\n` +
    `▫️ الإصدارات المدعومة: ${currentVersions}...\n` +
    `▫️ أحدث إصدار في الخريطة: 1.21.130\n` +
    `▫️ لترقية المكتبة: عدل package.json إلى "bedrock-protocol": "latest"\n\n` +
    `🔧 *لإضافة إصدار جديد:*\n` +
    `أضف سطراً جديداً في VERSION_MAP مثل:\n` +
    `'1.21.131': { protocol: 871, fallback: '1.21.130' }`,
    { parse_mode: 'Markdown' }
  );
});

// بث
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
console.log('📀 الإصدارات المدعومة:', Object.keys(VERSION_MAP).join(', '));

bot.launch()
  .then(() => {
    console.log('✅ البوت يعمل الآن!');
  })
  .catch((err) => {
    console.error('❌ خطأ في تشغيل البوت:', err);
  });

// إغلاق آمن
process.once('SIGINT', () => {
  console.log('🛑 إيقاف البوت...');
  for (let key in clients) {
    try { clients[key].end(); } catch (err) {}
  }
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('🛑 إيقاف البوت...');
  for (let key in clients) {
    try { clients[key].end(); } catch (err) {}
  }
  bot.stop('SIGTERM');
});
