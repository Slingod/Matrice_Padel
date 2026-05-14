const fs = require('fs');
const path = require('path');

const relPath = 'src/components/Poule.jsx';
const filePath = path.join(process.cwd(), relPath);

if (!fs.existsSync(filePath)) {
    console.error(`❌ Fichier introuvable : ${relPath}`);
    process.exit(1);
}

const backupPath = `${filePath}.bak-pool-format-props`;
if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
}

let content = fs.readFileSync(filePath, 'utf8');
let changed = false;

function replaceAllLiteral(search, replacement) {
    if (content.includes(search)) {
        content = content.split(search).join(replacement);
        changed = true;
    }
}

// 1) Remplacer les anciens props éventuels du sélecteur.
content = content.replace(
    /<MatchFormatSelector\s*\/>/g,
    `<MatchFormatSelector
                value={ctx.matchFormatKey}
                onChange={ctx.handleMatchFormatChange}
            />`
);
if (content.includes(`value={ctx.matchFormatKey}`)) changed = true;

// Si le composant existe déjà avec des props incomplètes, on sécurise sans trop casser.
content = content.replace(
    /<MatchFormatSelector([^>]*)>/g,
    (full, props) => {
        if (full.includes('value=') && full.includes('onChange=')) return full;

        let next = '<MatchFormatSelector';
        next += props || '';

        if (!full.includes('value=')) {
            next += '\n                value={ctx.matchFormatKey}';
        }

        if (!full.includes('onChange=')) {
            next += '\n                onChange={ctx.handleMatchFormatChange}';
        }

        next += '\n            >';
        changed = true;
        return next;
    }
);

// 2) S'assurer que MatchScoreEditor reçoit le format global côté poules.
// Cas fréquent : <MatchScoreEditor match={match} onScoreChange=... />
content = content.replace(
    /<MatchScoreEditor([^>]*)>/g,
    (full, props) => {
        if (full.includes('globalFormatKey=') || full.includes('matchFormatKey=')) return full;

        changed = true;
        return `<MatchScoreEditor${props}
                                globalFormatKey={ctx.matchFormatKey || 'D1'}>`;
    }
);

// 3) Si Poule destructure ctx sans matchFormatKey, ce n'est pas grave car on utilise ctx.matchFormatKey.
// On ne force pas de destructuration.

if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Poule.jsx corrigé : le format des poules est passé au sélecteur et aux scores.');
    console.log('✅ Backup créé : src/components/Poule.jsx.bak-pool-format-props');
} else {
    console.log('✅ Aucun changement automatique appliqué à Poule.jsx.');
    console.log('Si le format reste bloqué, envoie-moi ton fichier src/components/Poule.jsx complet.');
}
