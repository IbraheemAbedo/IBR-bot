# استخدام Node.js 18 (أكثر استقراراً)
FROM node:18-alpine

# إنشاء مجلد العمل
WORKDIR /app

# نسخ ملفات المشروع
COPY package*.json ./
COPY bot.js ./

# تثبيت المكتبات
RUN npm install --production --legacy-peer-deps

# منفذ التطبيق
EXPOSE 3000

# تشغيل البوت
CMD ["node", "bot.js"]
