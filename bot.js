const { Telegraf, Markup } = require('telegraf');
const { createClient } = require('bedrock-protocol');
const fs = require('fs');
const path = require('path');

// ============== [نظام قاعدة البيانات] ==============
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

let db;

// دالة لفتح قاعدة البيانات
async function initDatabase() {
  try {
    db = await open({
      filename: './data/users.db',
      driver: sqlite3.Database
    });
    
    // إنشاء جدول المستخدمين
    await db.exec(`
      CREATE TABLE IF NOT EXISTS bot_users (
        user_id INTEGER PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        join_date TEXT,
        last_seen TEXT,
        message_count INTEGER DEFAULT 1
      )
    `);
    
    // إنشاء جدول الإحصائيات
    await db.exec(`
      CREATE TABLE IF NOT EXISTS bot_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        new_users INTEGER,
        total_users INTEGER
      )
    `);
    
    console.log('✅ قاعدة بيانات المستخدمين جاهزة');
    return true;
  } catch (error) {
    console.log('❌ خطأ في إنشاء قاعدة البيانات:', error.message);
    return false;
  }
}

// دالة لحفظ المستخدم
async function saveUserToDB(user) {
  try {
    if (!db) {
      console.log('⚠️ قاعدة البيانات غير جاهزة');
      return false;
    }
    
    const now = new Date().toISOString();
    
    // تحقق إذا المستخدم موجود
    const existing = await db.get(
      'SELECT user_id FROM bot_users WHERE user_id = ?',
      [user.id]
    );
    
    if (existing) {
      // تحديث المستخدم
      await db.run(
        `UPDATE bot_users SET 
         username = ?, first_name = ?, last_name = ?,
         last_seen = ?, message_count = message_count + 1
         WHERE user_id = ?`,
        [user.username || '', user.first_name || '', user.last_name || '', now, user.id]
      );
      return 'updated';
    } else {
      // إضافة مستخدم جديد
      await db.run(
        `INSERT INTO bot_users 
         (user_id, username, first_name, last_name, join_date, last_seen, message_count)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [user.id, user.username || '', user.first_name || '', user.last_name || '', now, now]
      );
      
      // تحديث الإحصائيات اليومية
      const today = new Date().toISOString().split('T')[0];
      const stats = await db.get('SELECT * FROM bot_stats WHERE date = ?', [today]);
      
      if (stats) {
        await db.run(
          'UPDATE bot_stats SET new_users = new_users + 1, total_users = total_users + 1 WHERE date = ?',
          [today]
        );
      } else {
        const totalUsers = await db.get('SELECT COUNT(*) as count FROM bot_users');
        await db.run(
          'INSERT INTO bot_stats (date, new_users, total_users) VALUES (?, 1, ?)',
          [today, totalUsers.count]
        );
      }
      
      return 'added';
    }
  } catch (error) {
    console.log('❌ خطأ في حفظ المستخدم:', error.message);
    return 'error';
  }
}

// دالة لجلب عدد المستخدمين
async function getTotalUsers() {
  try {
    if (!db) return 0;
    const result = await db.get('SELECT COUNT(*) as count FROM bot_users');
    return result.count || 0;
  } catch {
    return 0;
  }
}

// دالة لجلب آخر المستخدمين
async function getRecentUsers(limit = 20) {
  try {
    if (!db) return [];
    const users = await db.all(
      'SELECT * FROM bot_users ORDER BY join_date DESC LIMIT ?',
      [limit]
    );
    return users;
  } catch {
    return [];
  }
}

// ============== [الإعدادات] ==============
const REQUIRED_CHANNEL = -1003499194538;
const botToken = '8198997283:AAHL_yWKazZf3Aa8OluwgjXV2goxtpwNPPQ';
const ownerId = 1421302016;

const bot = new Telegraf(botToken);

// ============== [تخزين البيانات] ==============
let servers = {};
let users = [];
let clients = {};
const DATA_DIR = './data';

// ============== [خريطة الإصدارات الذكية] ==============
const PROTOCOL_MAP = {
  // إصدارات حديثة جداً
  '1.21.140': 880, '1.21.139': 879, '1.21.138': 878, '1.21.137': 877,
  '1.21.136': 876, '1.21.135': 875, '1.21.134': 874, '1.21.133': 873,
  '1.21.132': 872, '1.21.131': 871,
  '1.21.130': 870,
  
  // بقية الإصدارات
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
  
  const parts = requestedVersion.split('.').map(Number);
  const [major, minor, patch] = parts;
  
  for (let p = patch; p >= 0; p--) {
    const testVersion = `${major}.${minor}.${p}`;
    if (PROTOCOL_MAP[testVersion]) return testVersion;
  }
  
  for (let m = minor - 1; m >= 0; m--) {
    for (let p = 200; p >= 0; p--) {
      const testVersion = `${major}.${m}.${p}`;
      if (PROTOCOL_MAP[testVersion]) return testVersion;
    }
  }
  
  return '1.21.124';
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
  
  console.log('🛑 إيقاف اتصالات ماينكرافت...');
  Object.keys(clients).forEach(key => {
    try {
      clients[key].end();
      console.log(`✓ تم إيقاف: ${key}`);
    } catch (err) {}
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
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
  try {
    const versionsToTry = [];
    const closestVersion = getClosestVersion(requestedVersion);
    
    versionsToTry.push(requestedVersion);
    
    if (requestedVersion !== closestVersion) {
      versionsToTry.push(closestVersion);
    }
    
    const commonVersions = ['1.21.124', '1.21.100', '1.21.80'];
    commonVersions.forEach(v => {
      if (!versionsToTry.includes(v) && PROTOCOL_MAP[v]) {
        versionsToTry.push(v);
      }
    });
    
    console.log(`🔄 محاولة الإصدارات: ${versionsToTry.join(', ')}`);
    
    let lastError = null;
    
    for (const version of versionsToTry) {
      const protocol = PROTOCOL_MAP[version];
      if (!protocol) continue;
      
      try {
        console.log(`🔗 محاولة ${version} (بروتوكول: ${protocol})`);
        
        const client = createClient({
          host: ip,
          port: port,
          username: botName,
          version: version,
          offline: true,
          connectTimeout: 10000,
          protocolVersion: protocol,
          skipPing: false,
          raknetBackoff: true
        });
        
        const connectionResult = await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            client.end().catch(() => {});
            resolve({ success: false, error: 'انتهت مهلة الاتصال' });
          }, 10000);
          
          client.once('join', () => {
            clearTimeout(timeout);
            resolve({ success: true, client });
          });
          
          client.once('error', (err) => {
            clearTimeout(timeout);
            try { client.end(); } catch (e) {}
            resolve({ success: false, error: err.message });
          });
          
          client.once('disconnect', (reason) => {
            clearTimeout(timeout);
            try { client.end(); } catch (e) {}
            resolve({ success: false, error: 'انقطع الاتصال' });
          });
        });
        
        if (connectionResult.success) {
          return {
            success: true,
            client: connectionResult.client,
            versionUsed: version,
            protocolUsed: protocol,
            requestedVersion,
            message: version === requestedVersion ? 
              `✅ تم الاتصال بالإصدار ${version}` :
              `✅ تم الاتصال بالإصدار ${version} (بديل عن ${requestedVersion})`
          };
        } else {
          lastError = connectionResult.error;
          console.log(`❌ فشل ${version}: ${connectionResult.error}`);
        }
        
      } catch (error) {
        lastError = error.message;
        console.log(`💥 خطأ في محاولة ${version}: ${error.message}`);
        continue;
      }
    }
    
    return {
      success: false,
      error: lastError || 'فشل جميع المحاولات',
      requestedVersion
    };
    
  } catch (error) {
    console.error(`🔥 خطأ محتوى في smartConnect: ${error.message}`);
    return {
      success: false,
      error: 'حدث خطأ داخلي',
      requestedVersion
    };
  }
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
  
  // حفظ المستخدم في قاعدة البيانات SQLite
  const dbResult = await saveUserToDB(user);
  
  if (dbResult === 'added') {
    const totalUsers = await getTotalUsers();
    console.log(`👤 مستخدم جديد: ${user.first_name} (${user.id}) - الإجمالي: ${totalUsers}`);
  }
  
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
  
  ctx.reply(`🔍 بدء الاتصال الذكي:\n${ip}:${port}\nالإصدار المطلوب: ${version}`)
    .catch(() => {});
  
  setTimeout(async () => {
    try {
      const result = await smartConnect(ip, port, version, userId);
      
      if (result.success) {
        const clientKey = `${userId}_main`;
        clients[clientKey] = result.client;
        
        ctx.reply(result.message).catch(() => {});
        
        result.client.on('join', () => {
          bot.telegram.sendMessage(userId,
            `🔥 تم دخول البوت!\n` +
            `▫️ الإصدار المستخدم: ${result.versionUsed}\n` +
            `▫️ البروتوكول: ${result.protocolUsed}\n` +
            `▫️ الحالة: ${result.versionUsed === result.requestedVersion ? 'مباشر' : 'بديل'}`
          ).catch(() => {});
        });
        
        result.client.on('disconnect', (reason) => {
          bot.telegram.sendMessage(userId, `❌ تم الفصل: ${reason}`).catch(() => {});
          delete clients[clientKey];
        });
        
        result.client.on('error', (err) => {
          bot.telegram.sendMessage(userId, `⚠️ خطأ: ${err.message.substring(0, 100)}`).catch(() => {});
          delete clients[clientKey];
        });
        
      } else {
        ctx.reply(
          `❌ فشل الاتصال\n\n` +
          `خطأ: ${result.error}\n\n` +
          `💡 جرب:\n` +
          `1. تحقق من تشغيل السيرفر\n` +
          `2. جرب إصداراً مختلفاً\n` +
          `3. استخدم الزر "▶️ تشغيل البوت"`
        ).catch(() => {});
      }
      
    } catch (error) {
      console.error('🔥 خطأ محتوى في run_smart:', error.message);
    }
  }, 100);
});

// ============== [نظام حماية من التوقف] ==============
process.on('uncaughtException', (error) => {
  console.error(`🚨 خطأ غير متوقع (محتوى): ${error.message}`);
  console.error('💡 البوت يستمر بالعمل...');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 وعد مرفوض غير معالج (محتوى):', reason);
});

// ============== [أوامر الإدارة الجديدة] ==============

// لوحة التحكم الإدارية
bot.command('admin', async (ctx) => {
  if (ctx.from.id !== ownerId) {
    return ctx.reply('⛔ ليس لديك صلاحية.');
  }
  
  try {
    const totalUsers = await getTotalUsers();
    const recentUsers = await getRecentUsers(10);
    
    let message = `📊 *لوحة التحكم الإدارية*\n\n`;
    message += `👥 *المستخدمين الإجماليين:* ${totalUsers}\n`;
    message += `📅 *آخر 10 مستخدمين:*\n\n`;
    
    if (recentUsers.length > 0) {
      recentUsers.forEach((user, index) => {
        const date = new Date(user.join_date).toLocaleDateString('ar-SA');
        message += `${index + 1}. ${user.first_name}`;
        if (user.username) message += ` (@${user.username})`;
        message += `\n   🆔: ${user.user_id} | 📅: ${date}\n\n`;
      });
    } else {
      message += `📭 لا يوجد مستخدمين مسجلين بعد.\n`;
    }
    
    message += `\n📊 *أوامر التحكم:*\n`;
    message += `/stats_db - إحصائيات مفصلة\n`;
    message += `/export - تصدير البيانات\n`;
    message += `/find [آيدي] - البحث عن مستخدم\n`;
    message += `/users_db - عرض جميع المستخدمين\n`;
    message += `/servers - السيرفرات المحفوظة`;
    
    ctx.reply(message, { parse_mode: 'Markdown' });
    
  } catch (error) {
    ctx.reply(`❌ خطأ: ${error.message}`);
  }
});

// إحصائيات قاعدة البيانات
bot.command('stats_db', async (ctx) => {
  if (ctx.from.id !== ownerId) return;
  
  try {
    const totalUsers = await getTotalUsers();
    const today = new Date().toISOString().split('T')[0];
    
    const todayStats = await db.get(
      'SELECT new_users FROM bot_stats WHERE date = ?',
      [today]
    );
    
    const newToday = todayStats ? todayStats.new_users : 0;
    
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const activeUsers = await db.get(
      'SELECT COUNT(*) as count FROM bot_users WHERE last_seen > ?',
      [weekAgo]
    );
    
    const message = `
📊 *إحصائيات قاعدة البيانات:*

👥 المستخدمين الإجماليين: ${totalUsers}
🆕 مستخدمين جدد اليوم: ${newToday}
🎯 مستخدمين نشطين (أسبوع): ${activeUsers.count || 0}
💾 التخزين: SQLite (data/users.db)

📌 *الأوامر المتاحة:*
• /admin - لوحة التحكم
• /export - تصدير البيانات
• /users_db - عرض المستخدمين
• /find [آيدي] - البحث عن مستخدم
    `;
    
    ctx.reply(message, { parse_mode: 'Markdown' });
    
  } catch (error) {
    ctx.reply(`❌ خطأ: ${error.message}`);
  }
});

// تصدير البيانات
bot.command('export', async (ctx) => {
  if (ctx.from.id !== ownerId) return;
  
  try {
    const users = await getRecentUsers(1000);
    
    if (users.length === 0) {
      return ctx.reply('📭 لا يوجد بيانات للتصدير.');
    }
    
    let csv = 'ID,Username,First Name,Last Name,Join Date,Last Seen,Messages\n';
    
    users.forEach(user => {
      csv += `${user.user_id},${user.username || ''},${user.first_name || ''},${user.last_name || ''},${user.join_date},${user.last_seen},${user.message_count}\n`;
    });
    
    const filename = `users_${Date.now()}.csv`;
    fs.writeFileSync(filename, csv);
    
    await ctx.replyWithDocument({
      source: fs.createReadStream(filename),
      filename: filename
    }, {
      caption: `📁 تم تصدير ${users.length} مستخدم`
    });
    
    fs.unlinkSync(filename);
    
  } catch (error) {
    ctx.reply(`❌ خطأ في التصدير: ${error.message}`);
  }
});

// البحث عن مستخدم
bot.command('find', async (ctx) => {
  if (ctx.from.id !== ownerId) return;
  
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    return ctx.reply('❌ استخدم: /find [آيدي أو اسم]');
  }
  
  const searchTerm = args[1];
  
  try {
    let user;
    
    if (!isNaN(searchTerm)) {
      user = await db.get(
        'SELECT * FROM bot_users WHERE user_id = ?',
        [parseInt(searchTerm)]
      );
    } else {
      user = await db.get(
        'SELECT * FROM bot_users WHERE username LIKE ? OR first_name LIKE ?',
        [`%${searchTerm}%`, `%${searchTerm}%`]
      );
    }
    
    if (user) {
      const joinDate = new Date(user.join_date).toLocaleString('ar-SA');
      const lastSeen = new Date(user.last_seen).toLocaleString('ar-SA');
      
      const message = `
✅ *تم العثور على المستخدم:*

👤 الاسم: ${user.first_name} ${user.last_name || ''}
📧 اليوزر: @${user.username || 'لا يوجد'}
🆔 الآيدي: ${user.user_id}
📅 تاريخ الانضمام: ${joinDate}
🕒 آخر ظهور: ${lastSeen}
💬 عدد الرسائل: ${user.message_count}
      `;
      
      ctx.reply(message, { parse_mode: 'Markdown' });
    } else {
      ctx.reply('❌ لم يتم العثور على المستخدم.');
    }
    
  } catch (error) {
    ctx.reply(`❌ خطأ في البحث: ${error.message}`);
  }
});

// عرض جميع المستخدمين من قاعدة البيانات
bot.command('users_db', async (ctx) => {
  if (ctx.from.id !== ownerId) return;
  
  const args = ctx.message.text.split(' ');
  const page = args[1] ? parseInt(args[1]) : 1;
  const limit = 20;
  const offset = (page - 1) * limit;
  
  try {
    const users = await db.all(
      'SELECT * FROM bot_users ORDER BY join_date DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    
    const totalUsers = await getTotalUsers();
    const totalPages = Math.ceil(totalUsers / limit);
    
    if (users.length === 0) {
      return ctx.reply('📭 لا يوجد مستخدمين.');
    }
    
    let message = `👥 *المستخدمين* (الصفحة ${page}/${totalPages})\n\n`;
    
    users.forEach((user, index) => {
      const num = offset + index + 1;
      const date = new Date(user.join_date).toLocaleDateString('ar-SA');
      
      message += `${num}. ${user.first_name}`;
      if (user.username) message += ` (@${user.username})`;
      message += `\n   🆔: ${user.user_id} | 📅: ${date}\n\n`;
    });
    
    message += `📊 الإجمالي: ${totalUsers} مستخدم\n`;
    
    const keyboard = [];
    
    if (page > 1) {
      keyboard.push([Markup.button.callback('◀️ الصفحة السابقة', `page_${page - 1}`)]);
    }
    
    if (page < totalPages) {
      keyboard.push([Markup.button.callback('الصفحة التالية ▶️', `page_${page + 1}`)]);
    }
    
    if (keyboard.length > 0) {
      ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(keyboard)
      });
    } else {
      ctx.reply(message, { parse_mode: 'Markdown' });
    }
    
  } catch (error) {
    ctx.reply(`❌ خطأ: ${error.message}`);
  }
});

// معالجة أزرار الصفحات
bot.action(/page_(\d+)/, async (ctx) => {
  if (ctx.from.id !== ownerId) return;
  
  const page = parseInt(ctx.match[1]);
  ctx.answerCbQuery();
  
  await ctx.deleteMessage();
  await bot.telegram.sendMessage(ctx.from.id, `/users_db ${page}`);
});

// ============== [أوامر خاصة أخرى] ==============
// (الأوامر القديمة تبقى كما هي مع إضافة أمر /admin أعلاه)

// أمر مراقبة الحالة
bot.command('status', (ctx) => {
  if (ctx.from.id !== ownerId) return;
  
  const stats = `📊 حالة البوت:\n` +
    `👥 المستخدمين: ${users.length}\n` +
    `🌐 السيرفرات: ${Object.keys(servers).length}\n` +
    `🤖 اتصالات: ${Object.keys(clients).length}\n` +
    `✅ الحالة: نشط`;
  
  ctx.reply(stats);
});

// عرض جميع المستخدمين (من JSON القديم)
bot.command('users', (ctx) => {
  if (ctx.from.id !== ownerId) return;
  
  const userList = users.slice(0, 50).map((id, index) => 
    `${index + 1}. ID: ${id}`
  ).join('\n');
  
  ctx.reply(
    `👥 المستخدمين (${users.length}):\n\n${userList}\n\n` +
    `📊 أول 50 مستخدم من أصل ${users.length}`
  );
});

// حذف مستخدم
bot.command('remove', (ctx) => {
  if (ctx.from.id !== ownerId) return;
  
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    return ctx.reply('❌ استخدم: /remove [رقم المستخدم]');
  }
  
  const userId = parseInt(args[1]);
  if (isNaN(userId)) {
    return ctx.reply('❌ رقم المستخدم يجب أن يكون رقماً');
  }
  
  const userIndex = users.indexOf(userId);
  if (userIndex !== -1) {
    users.splice(userIndex, 1);
  }
  
  if (servers[userId]) {
    delete servers[userId];
  }
  
  Object.keys(clients).forEach(key => {
    if (key.startsWith(userId + '_')) {
      try {
        clients[key].end();
      } catch (err) {}
      delete clients[key];
    }
  });
  
  saveUsers();
  saveServers();
  
  ctx.reply(`✅ تم حذف المستخدم ${userId} وبياناته`);
});

// عرض السيرفرات المحفوظة
bot.command('servers', (ctx) => {
  if (ctx.from.id !== ownerId) return;
  
  let serverList = '';
  let count = 0;
  
  for (const userId in servers) {
    if (servers[userId].ip) {
      count++;
      serverList += `${count}. ${servers[userId].ip}:${servers[userId].port} (الإصدار: ${servers[userId].version || 'غير محدد'})\n`;
      
      if (count >= 20) {
        serverList += '... والمزيد\n';
        break;
      }
    }
  }
  
  ctx.reply(
    `🌐 السيرفرات المحفوظة (${Object.keys(servers).length}):\n\n${serverList || 'لا توجد سيرفرات'}\n\n` +
    `📊 عرض أول 20 سيرفر`
  );
});

// إعادة التشغيل
bot.command('restart', (ctx) => {
  if (ctx.from.id !== ownerId) return;
  
  ctx.reply('🔄 جاري إعادة التشغيل...');
  
  Object.keys(clients).forEach(key => {
    try {
      clients[key].end();
    } catch (err) {}
  });
  
  setTimeout(() => {
    console.log('🔄 إعادة التشغيل عن بعد بواسطة المالك');
    process.exit(0);
  }, 2000);
});

// نسخ احتياطي
bot.command('backup', (ctx) => {
  if (ctx.from.id !== ownerId) return;
  
  try {
    const backupData = {
      users: users,
      servers: servers,
      timestamp: new Date().toISOString(),
      count: {
        users: users.length,
        servers: Object.keys(servers).length
      }
    };
    
    const backupJson = JSON.stringify(backupData, null, 2);
    
    ctx.reply(
      `💾 النسخ الاحتياطي:\n\n` +
      `👥 المستخدمين: ${users.length}\n` +
      `🌐 السيرفرات: ${Object.keys(servers).length}\n` +
      `⏰ الوقت: ${new Date().toLocaleString()}\n\n` +
      `📋 البيانات جاهزة للنسخ`
    );
    
  } catch (error) {
    ctx.reply(`❌ خطأ في النسخ الاحتياطي: ${error.message}`);
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

// تحديث الإصدارات
bot.command('update_versions', async (ctx) => {
  if (ctx.from.id !== ownerId) return;
  
  ctx.reply('🔄 جاري تحديث خريطة الإصدارات...');
  
  try {
    let newVersions = '';
    
    for (let i = 131; i <= 140; i++) {
      const version = `1.21.${i}`;
      const protocolNum = 870 + (i - 130);
      
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

// الإحصائيات
bot.command('stats', (ctx) => {
  if (ctx.from.id !== ownerId) return;
  
  const stats = `📊 *إحصائيات البوت:*\n` +
    `👥 المستخدمين: ${users.length}\n` +
    `🌐 السيرفرات النشطة: ${Object.keys(servers).length}\n` +
    `🤖 البوتات النشطة: ${Object.keys(clients).length}\n` +
    `📀 أحدث إصدار: 1.21.131`;
  
  ctx.reply(stats, { parse_mode: 'Markdown' });
});

// البث
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

// بدء البوت
bot.launch({
  dropPendingUpdates: true,
  allowedUpdates: ['message', 'callback_query']
})
.then(async () => {
  console.log('🚀 البوت يعمل الآن!');
  
  // تهيئة قاعدة البيانات
  await initDatabase();
  
  console.log('📊 نظام قاعدة البيانات مفعل');
  console.log('📀 الإصدارات المدعومة:', Object.keys(PROTOCOL_MAP).length);
  
  const latest = Object.keys(PROTOCOL_MAP)
    .filter(v => v.startsWith('1.21.1'))
    .sort()
    .reverse()[0];
  
  console.log(`🎯 أحدث إصدار: ${latest} (بروتوكول: ${PROTOCOL_MAP[latest]})`);
  console.log(`👑 المالك: ${ownerId}`);
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
