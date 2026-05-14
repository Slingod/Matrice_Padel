const fs = require('fs');
const path = require('path');

const relPath = 'src/utils/finalStage.js';
const filePath = path.join(process.cwd(), relPath);

if (!fs.existsSync(filePath)) {
    console.error(`❌ Fichier introuvable : ${relPath}`);
    process.exit(1);
}

const backupPath = `${filePath}.bak-sanitize-format`;
if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
}

let content = fs.readFileSync(filePath, 'utf8');

if (content.includes('function sanitizeMatchFormatKey(')) {
    console.log('✅ sanitizeMatchFormatKey existe déjà. Rien à modifier.');
    process.exit(0);
}

const target = `function sanitizeQualifierMode(value) {
    return ['winners', 'top2', 'best4', 'all'].includes(value) ? value : 'top2';
}`;

const replacement = `${target}

function sanitizeMatchFormatKey(value) {
    return ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2', 'E'].includes(value)
        ? value
        : 'D1';
}`;

if (!content.includes(target)) {
    console.error('❌ Bloc sanitizeQualifierMode introuvable. Envoie-moi ton fichier finalStage.js si ça arrive.');
    process.exit(1);
}

content = content.replace(target, replacement);
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Correctif appliqué : sanitizeMatchFormatKey ajouté dans src/utils/finalStage.js');
console.log('✅ Backup créé : src/utils/finalStage.js.bak-sanitize-format');
