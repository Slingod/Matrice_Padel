const fs = require('fs');
const path = require('path');

const relPath = 'src/components/Poule.jsx';
const filePath = path.join(process.cwd(), relPath);

if (!fs.existsSync(filePath)) {
    console.error(`❌ Fichier introuvable : ${relPath}`);
    process.exit(1);
}

const backupPath = `${filePath}.bak-fix-jsx-matchscore`;
if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
}

let content = fs.readFileSync(filePath, 'utf8');
let changed = false;

// Répare le cas cassé exactement vu dans ton erreur :
// onScoreChange={(field, value, scoreDetail) =
//     globalFormatKey={ctx.matchFormatKey || 'D1'}>
//         handleMatchScoreChange(...)
// }
const brokenPattern = /onScoreChange=\{\(field,\s*value,\s*scoreDetail\)\s*=\s*\n\s*globalFormatKey=\{ctx\.matchFormatKey\s*\|\|\s*['"]D1['"]\}>\s*\n\s*handleMatchScoreChange\(([^)]*)\)\s*\n\s*\}/g;

content = content.replace(brokenPattern, (full, args) => {
    changed = true;
    return `globalFormatKey={ctx.matchFormatKey || 'D1'}
                                                onScoreChange={(field, value, scoreDetail) =>
                                                    handleMatchScoreChange(${args})
                                                }`;
});

// Répare un cas proche si le > est resté sur la ligne globalFormatKey.
const brokenPattern2 = /onScoreChange=\{\(field,\s*value,\s*scoreDetail\)\s*=\s*globalFormatKey=\{ctx\.matchFormatKey\s*\|\|\s*['"]D1['"]\}>\s*handleMatchScoreChange\(([^)]*)\)\s*\}/g;

content = content.replace(brokenPattern2, (full, args) => {
    changed = true;
    return `globalFormatKey={ctx.matchFormatKey || 'D1'}
                                                onScoreChange={(field, value, scoreDetail) =>
                                                    handleMatchScoreChange(${args})
                                                }`;
});

// Sécurise les MatchScoreEditor qui n'ont pas encore globalFormatKey,
// mais uniquement quand la balise est déjà bien formée.
content = content.replace(/<MatchScoreEditor([\s\S]*?)\/>/g, (full, inner) => {
    if (full.includes('globalFormatKey=')) return full;

    changed = true;
    return `<MatchScoreEditor${inner}
                                                globalFormatKey={ctx.matchFormatKey || 'D1'}
                                            />`;
});

// Nettoie l'erreur possible : double chevron > dans une balise autofermante.
content = content.replace(/globalFormatKey=\{ctx\.matchFormatKey\s*\|\|\s*['"]D1['"]\}>\s*\/>/g, () => {
    changed = true;
    return `globalFormatKey={ctx.matchFormatKey || 'D1'}
                                            />`;
});

if (!changed) {
    console.log('⚠️ Aucun bloc cassé détecté automatiquement.');
    console.log('Envoie-moi les lignes 150 à 180 de src/components/Poule.jsx si ça bloque encore.');
    process.exit(0);
}

fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Poule.jsx réparé : JSX MatchScoreEditor corrigé.');
console.log('✅ Backup créé : src/components/Poule.jsx.bak-fix-jsx-matchscore');
