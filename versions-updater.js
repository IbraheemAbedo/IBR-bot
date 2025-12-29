// ملف: versions-updater.js
const fs = require('fs');

console.log('🔄 مولد خريطة الإصدارات التلقائي');

function generateProtocolMap() {
  const protocolMap = {};
  
  // إصدارات 1.21.xxx
  for (let i = 100; i <= 150; i++) {
    const version = `1.21.${i}`;
    // قاعدة حسابية: 827 (لـ 1.21.100) + (i - 100)
    const protocol = 827 + (i - 100);
    protocolMap[version] = protocol;
  }
  
  // إصدارات 1.20.xxx
  for (let i = 0; i <= 80; i += 10) {
    const version = `1.20.${i}`;
    protocolMap[version] = 589 + Math.floor(i / 10) * 10;
  }
  
  return protocolMap;
}

const newMap = generateProtocolMap();
console.log(`✅ تم إنشاء ${Object.keys(newMap).length} إصدار`);
console.log('📋 أحدث 10 إصدارات:');
Object.keys(newMap)
  .sort()
  .reverse()
  .slice(0, 10)
  .forEach(v => console.log(`  ${v}: ${newMap[v]}`));

// حفظ في ملف
fs.writeFileSync('protocol-map.json', JSON.stringify(newMap, null, 2));
console.log('💾 تم الحفظ في protocol-map.json');
