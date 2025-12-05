# استخدام Node.js 20 (أحدث وأكثر استقراراً)
FROM node:20-alpine

# إنشاء مجلد العمل
WORKDIR /app

# نسخ ملف package.json أولاً (لتحسين caching)
COPY package.json package-lock.json* ./

# تثبيت المكتبات مع تحديث npm أولاً
RUN npm install -g npm@latest && \
    npm ci --only=production --legacy-peer-deps --no-audit

# نسخ باقي الملفات
COPY bot.js ./

# منفذ التطبيق
EXPOSE 3000

# تشغيل البوت
CMD ["node", "bot.js"]
