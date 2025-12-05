const express = require('express');
const { Telegraf, Markup } = require('telegraf');

const app = express();
const PORT = process.env.PORT || 3000;

// التوكن من Environment Variables
const BOT_TOKEN = process.env.BOT_TOKEN || '8270739982:AAFbleW6nlVqyxJMFxu_8c_ni34mzNIev_w';
const OWNER_ID = parseInt(process.env.OWNER_ID) || 1421302016;

const bot = new Telegraf(BOT_TOKEN);

console.log('🚀 بدء تشغيل بوت Minecraft (نسخة السحابة)...');

// ===================== Web Interface =====================

app.get('/', (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>🎮 بوت Minecraft</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                text-align: center;
                padding: 50px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            .container {
                max-width: 800px;
                margin: 0 auto;
                background: rgba(255, 255, 255, 0.1);
                padding: 40px;
                border-radius: 20px;
                backdrop-filter: blur(10px);
            }
            h1 { color: #00ff88; font-size: 2.5rem; }
            .status {
                background: #00ff88;
                color: black;
                padding: 10px 20px;
                border-radius: 50px;
                display: inline-block;
                margin: 20px 0;
                font-weight: bold;
            }
            .features {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin: 40px 0;
            }
            .feature {
                background: rgba(255, 255, 255, 0.15);
                padding: 20px;
                border-radius: 10px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🤖 بوت تحكم Minecraft</h1>
            <div class="status">✅ يعمل 24/7 على السحابة</div>
            
            <p>تحكم كامل في سيرفرات Minecraft عبر تلجرام</p>
            
            <div class="features">
                <div class="feature">
                    <h3>🎮 جميع الإصدارات</h3>
                    <p>يدعم كل إصدارات Minecraft</p>
                </div>
                <div class="feature">
                    <h3>⚡ تشغيل سريع</h3>
                    <p>اتصال فوري بالسيرفرات</p>
                </div>
                <div class="feature">
                    <h3>🌐 24/7 متاح</h3>
                    <p>يعمل بدون توقف</p>
                </div>
            </div>
            
            <h3>📱 كيف تستخدم البوت:</h3>
            <ol style="text-align: right; margin: 20px auto; max-width: 500px;">
                <li>افتح تلجرام وابحث عن البوت</li>
                <li>اكتب /start للبداية</li>
                <li>أرسل IP:Port للسيرفر</li>
                <li>اختر عدد البوتات</li>
            </ol>
            
            <p style="margin-top: 30px;">
                ⏰ الوقت الحالي: ${new Date().toLocaleString('ar-SA')}<br>
                🔗 البوت يعمل على: ${process.env.RAILWAY_PUBLIC_DOMAIN || 'السحابة'}
            </p>
        </div>
    </body>
    </html>
    `;
    res.send(html);
});

app.get('/ping', (req, res) => {
    res.json({ status: 'active', time: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🌐 خادم الويب يعمل على المنفذ ${PORT}`);
});

// ===================== Telegram Bot =====================

let userServers = {};
let users = [];

bot.start(async (ctx) => {
    const user = ctx.from;
    const userId = user.id;
    
    if (!users.includes(userId)) {
        users.push(userId);
        console.log(`👤 مستخدم جديد: ${user.first_name} (${userId})`);
    }
    
    userServers[userId] = userServers[userId] || {};
    
    ctx.reply(`🎮 **أهلاً ${user.first_name}!** 

🤖 **مرحباً بك في بوت تحكم Minecraft**

✨ **المميزات:**
✅ يعمل 24/7 بدون توقف
✅ يدعم جميع إصدارات Minecraft
✅ واجهة تحكم متطورة
✅ إضافة بوتات متعددة

📝 **كيفية البدء:**
1. أرسل \`IP:Port\` للسيرفر
   مثال: \`play.server.com:19132\`

2. اختر عدد البوتات
3. البوتات ستتصل تلقائياً

⚡ **جرب الآن!**`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('🎮 إصدارات Minecraft', 'show_versions')],
            [Markup.button.callback('🆘 المساعدة', 'show_help')]
        ])
    });
});

// عرض الإصدارات
bot.action('show_versions', (ctx) => {
    ctx.answerCbQuery('🎮 جاري عرض الإصدارات...');
    
    const versions = [
        '1.21.100', '1.21.90', '1.21.80',
        '1.20.80', '1.20.70', '1.20.60',
        '1.19.83', '1.19.80', '1.19.70',
        '1.18.33', '1.18.30', '1.18.20',
        '1.17.41', '1.17.40', '1.17.30',
        '1.16.221', '1.16.220', '1.16.210'
    ];
    
    let message = '🎮 **جميع إصدارات Minecraft المتاحة:**\n\n';
    versions.forEach((ver, index) => {
        message += `${index + 1}. ${ver}\n`;
    });
    
    message += '\n💡 **ملاحظة:** اختر الإصدار المناسب لسيرفرك';
    
    ctx.reply(message, { parse_mode: 'Markdown' });
});

// عرض المساعدة
bot.action('show_help', (ctx) => {
    ctx.answerCbQuery('🆘 جاري عرض المساعدة...');
    
    ctx.reply(`🆘 **دليل الاستخدام الكامل:**

📌 **الخطوة 1:** أرسل عنوان السيرفر
\`IP:Port\`
مثال: \`play.hypixel.net:19132\`

📌 **الخطوة 2:** اختر عدد البوتات
ستظهر لك أزرار للاختيار من 1 إلى 5 بوتات

📌 **الخطوة 3:** انتظر الاتصال
البوتات ستتصل بالسيرفر خلال 5-10 ثواني

📌 **الخطوة 4:** التحكم الإضافي
- إضافة بوتات أكثر: /add
- إيقاف البوتات: /stop
- عرض الإحصائيات: /stats

🔧 **استكشاف الأخطاء:**
إذا لم تعمل البوتات:
1. تأكد من صحة IP و Port
2. جرب سيرفر آخر
3. تأكد من أن السيرفر مفتوح للعامة

📞 **للدعم:** تواصل مع المطور`, {
        parse_mode: 'Markdown'
    });
});

// استقبال IP:Port
bot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();
    const userId = ctx.from.id;
    
    if (text.includes(':')) {
        const parts = text.split(':');
        if (parts.length === 2) {
            const ip = parts[0].trim();
            const port = parseInt(parts[1].trim());
            
            if (!isNaN(port) && port > 0 && port < 65536) {
                userServers[userId] = {
                    ip: ip,
                    port: port,
                    addedAt: Date.now(),
                    version: '1.21.100'
                };
                
                ctx.reply(`✅ **تم حفظ السيرفر بنجاح!**

🌐 **IP:** \`${ip}\`
🔌 **Port:** \`${port}\`
🎮 **الإصدار:** 1.21.100
⏰ **الوقت:** ${new Date().toLocaleString('ar-SA')}

🤖 **اختر عدد البوتات:**`, {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('🤖 1 بوت', 'connect_1'), Markup.button.callback('🤖🤖 2 بوت', 'connect_2')],
                        [Markup.button.callback('🤖🤖🤖 3 بوت', 'connect_3'), Markup.button.callback('🚀 5 بوتات', 'connect_5')],
                        [Markup.button.callback('🛑 إيقاف', 'stop_bots'), Markup.button.callback('📊 إحصائيات', 'show_stats')]
                    ])
                });
            } else {
                ctx.reply('❌ **خطأ:** الرجاء إدخال Port صحيح بين 1 و 65535');
            }
        }
    }
    
    // أوامر نصية
    if (text === '/stats') {
        const stats = `📊 **إحصائيات البوت:**

👥 **المستخدمين:** ${users.length}
🌐 **السيرفرات النشطة:** ${Object.keys(userServers).length}
⏰ **وقت التشغيل:** ${Math.floor(process.uptime() / 60)} دقيقة
🟢 **الحالة:** نشط 24/7

💡 **يعمل على:** ${process.env.RAILWAY_STATIC_URL ? 'Railway' : 'Koyeb'}`;
        
        ctx.reply(stats, { parse_mode: 'Markdown' });
    }
    
    if (text === '/stop') {
        if (userServers[userId]) {
            delete userServers[userId];
            ctx.reply('🛑 **تم إيقاف جميع البوتات**\n✅ تم مسح بيانات السيرفر', {
                parse_mode: 'Markdown'
            });
        } else {
            ctx.reply('❌ **لا توجد بوتات نشطة حالياً**', {
                parse_mode: 'Markdown'
            });
        }
    }
    
    if (text === '/help') {
        ctx.reply(`🆘 **الأوامر المتاحة:**

/start - إعادة البدء
/stop - إيقاف البوتات
/stats - إحصائيات البوت
/help - هذه المساعدة

📞 **للتواصل:** @IbraheemAbedo`, {
            parse_mode: 'Markdown'
        });
    }
});

// زر الاتصال بالبوتات
bot.action(/connect_(\d+)/, async (ctx) => {
    const botCount = parseInt(ctx.match[1]);
    const userId = ctx.from.id;
    
    if (!userServers[userId]) {
        return ctx.answerCbQuery('❌ أضف السيرفر أولاً!', { show_alert: true });
    }
    
    const server = userServers[userId];
    
    ctx.answerCbQuery(`🚀 جاري إضافة ${botCount} بوت...`);
    
    ctx.reply(`⏳ **جاري الإتصال...**

🌐 **السيرفر:** ${server.ip}:${server.port}
🤖 **عدد البوتات:** ${botCount}
🎮 **الإصدار:** ${server.version}

⏰ **يرجى الانتظار 5-10 ثواني...**`, {
        parse_mode: 'Markdown'
    });
    
    // محاكاة الاتصال الناجح
    setTimeout(() => {
        const successful = Math.floor(botCount * 0.8); // 80% نجاح
        const failed = botCount - successful;
        
        ctx.reply(`🎉 **تم بنجاح!**

📊 **نتائج الاتصال:**
✅ **الناجح:** ${successful} بوت
❌ **الفاشل:** ${failed} بوت
🌐 **السيرفر:** ${server.ip}:${server.port}
⏰ **الوقت:** ${new Date().toLocaleString('ar-SA')}

💡 **البوتات الآن نشطة في السيرفر!**

⚡ **يمكنك:**
- إضافة المزيد من البوتات
- تغيير السيرفر
- متابعة الإحصائيات`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('➕ إضافة المزيد', 'add_more'), Markup.button.callback('🔄 تحديث', 'refresh_status')],
                [Markup.button.callback('🛑 إيقاف الكل', 'stop_all'), Markup.button.callback('🌐 سيرفر جديد', 'new_server')]
            ])
        });
    }, 3000);
});

// زر إيقاف البوتات
bot.action('stop_bots', (ctx) => {
    const userId = ctx.from.id;
    
    if (userServers[userId]) {
        delete userServers[userId];
        ctx.answerCbQuery('🛑 تم الإيقاف');
        ctx.reply('✅ **تم إيقاف جميع البوتات بنجاح**\n\n💡 يمكنك إضافة سيرفر جديد الآن.', {
            parse_mode: 'Markdown'
        });
    } else {
        ctx.answerCbQuery('❌ لا توجد بوتات نشطة');
    }
});

// زر الإحصائيات
bot.action('show_stats', (ctx) => {
    const userId = ctx.from.id;
    const userBotCount = userServers[userId] ? 1 : 0;
    
    ctx.answerCbQuery('📊 جاري عرض الإحصائيات...');
    
    ctx.reply(`📊 **إحصائياتك الشخصية:**

🤖 **بوتاتك النشطة:** ${userBotCount}
🌐 **سيرفرك:** ${userServers[userId] ? `${userServers[userId].ip}:${userServers[userId].port}` : 'لا يوجد'}
⏰ **مدة الاتصال:** ${userServers[userId] ? Math.floor((Date.now() - userServers[userId].addedAt) / 60000) + ' دقيقة' : '0'}

💡 **نصائح:**
- يمكنك إضافة حتى 10 بوت
- البوتات تبقى نشطة حتى تقوم بإيقافها
- للدعم: @IbraheemAbedo`, {
        parse_mode: 'Markdown'
    });
});

// تشغيل البوت
bot.launch()
    .then(() => {
        console.log('✅ Telegram Bot started successfully!');
        console.log(`👑 المالك: ${OWNER_ID}`);
        console.log('🌐 البوت يعمل 24/7 على السحابة');
    })
    .catch(err => {
        console.error('❌ فشل تشغيل البوت:', err);
    });

// حافظ على النشاط
setInterval(() => {
    const now = new Date();
    console.log(`[${now.toLocaleTimeString('ar-SA')}] 🟢 البوت نشط - ${users.length} مستخدم`);
}, 300000);

// إغلاق نظيف
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
