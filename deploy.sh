#!/bin/bash
echo "🔄 تحديث bedrock-protocol إلى أحدث إصدار من GitHub..."
npm uninstall bedrock-protocol
npm install prismarinejs/bedrock-protocol --save
echo "✅ تم التحديث! أعد تشغيل البوت."
