const fs = require('fs');
const path = require('path');

const relPath = 'src/hooks/useTournamentState.js';
const filePath = path.join(process.cwd(), relPath);

if (!fs.existsSync(filePath)) {
    console.error(`❌ Fichier introuvable : ${relPath}`);
    process.exit(1);
}

const backupPath = `${filePath}.bak-pool-format-state`;
if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
}

let content = fs.readFileSync(filePath, 'utf8');
let changed = false;

function ensureMatchFormatsImport() {
    const needed = ['getStoredMatchFormat', 'setStoredMatchFormat', 'sanitizeMatchFormatKey'];
    const importRegex = /import\s*\{([^}]+)\}\s*from\s*['"]\.\.\/utils\/matchFormats['"];?/;

    if (importRegex.test(content)) {
        content = content.replace(importRegex, (full, imports) => {
            const current = imports
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean);

            needed.forEach((name) => {
                if (!current.includes(name)) current.push(name);
            });

            changed = true;
            return `import { ${current.join(', ')} } from '../utils/matchFormats';`;
        });
        return;
    }

    const firstImportMatch = content.match(/^import .+$/m);
    const importLine = `import { getStoredMatchFormat, setStoredMatchFormat, sanitizeMatchFormatKey } from '../utils/matchFormats';`;

    if (firstImportMatch) {
        content = content.replace(firstImportMatch[0], `${firstImportMatch[0]}\n${importLine}`);
    } else {
        content = `${importLine}\n${content}`;
    }

    changed = true;
}

function insertInsideUseTournamentState(code) {
    const regex = /(export\s+)?function\s+useTournamentState\s*\([^)]*\)\s*\{/;
    const match = content.match(regex);

    if (!match) {
        throw new Error('Fonction useTournamentState introuvable.');
    }

    const insertIndex = match.index + match[0].length;
    content = content.slice(0, insertIndex) + `\n${code}` + content.slice(insertIndex);
    changed = true;
}

function insertBeforeReturnObject(code) {
    const index = content.lastIndexOf('    return {');
    if (index === -1) {
        throw new Error('Bloc return { introuvable dans useTournamentState.js');
    }

    content = content.slice(0, index) + code + '\n' + content.slice(index);
    changed = true;
}

function addReturnEntries(entries) {
    const returnIndex = content.lastIndexOf('    return {');
    if (returnIndex === -1) {
        throw new Error('Bloc return { introuvable dans useTournamentState.js');
    }

    const before = content.slice(0, returnIndex);
    let after = content.slice(returnIndex);

    const missing = entries.filter((entry) => {
        const name = entry.split(':')[0].trim();
        return !new RegExp(`\\b${name}\\s*[:,]`).test(after);
    });

    if (missing.length === 0) return;

    const injection = missing.map((entry) => `        ${entry},`).join('\n');

    after = after.replace('    return {', `    return {\n${injection}`);
    content = before + after;
    changed = true;
}

ensureMatchFormatsImport();

if (!content.includes('const [matchFormatKey, setMatchFormatKey]')) {
    insertInsideUseTournamentState(`    const [matchFormatKey, setMatchFormatKey] = useState(() => getStoredMatchFormat());

    useEffect(() => {
        const handleExternalPoolFormatChange = (event) => {
            const nextFormat = sanitizeMatchFormatKey(event?.detail?.formatKey);
            setMatchFormatKey(nextFormat);
            setStoredMatchFormat(nextFormat);
        };

        window.addEventListener('padelingo:match-format-change', handleExternalPoolFormatChange);

        return () => {
            window.removeEventListener('padelingo:match-format-change', handleExternalPoolFormatChange);
        };
    }, []);
`);
}

if (!content.includes('function handleMatchFormatChange(')) {
    insertBeforeReturnObject(`    function handleMatchFormatChange(value) {
        const nextFormat = sanitizeMatchFormatKey(value);
        setMatchFormatKey(nextFormat);
        setStoredMatchFormat(nextFormat);
    }
`);
}

addReturnEntries([
    'matchFormatKey',
    'selectedMatchFormatKey: matchFormatKey',
    'formatKey: matchFormatKey',
    'handleMatchFormatChange',
    'onMatchFormatChange: handleMatchFormatChange',
    'setMatchFormatKey: handleMatchFormatChange'
]);

if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Correctif format des poules appliqué dans src/hooks/useTournamentState.js');
    console.log('✅ Backup créé : src/hooks/useTournamentState.js.bak-pool-format-state');
} else {
    console.log('✅ Aucun changement nécessaire : le format des poules semble déjà configuré.');
}
