const fs = require('fs');
const path = require('path');

const relPath = 'src/hooks/useTournamentState.js';
const filePath = path.join(process.cwd(), relPath);

if (!fs.existsSync(filePath)) {
    console.error(`❌ Fichier introuvable : ${relPath}`);
    process.exit(1);
}

const backupPath = `${filePath}.bak-format-handlers`;
if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
}

let content = fs.readFileSync(filePath, 'utf8');
let changed = false;

function insertBeforeReturnObject(fnCode) {
    const index = content.lastIndexOf('    return {');
    if (index === -1) {
        throw new Error('Bloc "return {" introuvable dans useTournamentState.js');
    }
    content = content.slice(0, index) + fnCode + '\n' + content.slice(index);
    changed = true;
}

function addToReturnObject(name) {
    if (new RegExp(`\\b${name}\\s*,`).test(content)) return;

    const returnIndex = content.lastIndexOf('    return {');
    if (returnIndex === -1) {
        throw new Error('Bloc "return {" introuvable dans useTournamentState.js');
    }

    const before = content.slice(0, returnIndex);
    const after = content.slice(returnIndex);

    const insertAfterReturn = after.replace('    return {', `    return {\n        ${name},`);
    content = before + insertAfterReturn;
    changed = true;
}

// Handler format des poules.
if (!content.includes('function handleMatchFormatChange(')) {
    const hasSetter = content.includes('setMatchFormatKey');
    if (!hasSetter) {
        console.warn('⚠️ setMatchFormatKey introuvable : je ne peux pas ajouter handleMatchFormatChange automatiquement.');
    } else {
        insertBeforeReturnObject(`    function handleMatchFormatChange(value) {
        setMatchFormatKey(value);
    }
`);
        addToReturnObject('handleMatchFormatChange');
    }
} else {
    addToReturnObject('handleMatchFormatChange');
}

// Handler format phase finale.
if (!content.includes('function handleFinalMatchFormatChange(')) {
    const hasSetFinalStage = content.includes('setFinalStage');
    const hasSync = content.includes('syncFinalStageWithTeams');
    const hasSetOption = content.includes('setFinalStageOption');

    if (!hasSetFinalStage || !hasSync || !hasSetOption) {
        console.warn('⚠️ Impossible d’ajouter handleFinalMatchFormatChange automatiquement : setFinalStage/syncFinalStageWithTeams/setFinalStageOption introuvable.');
    } else {
        insertBeforeReturnObject(`    function handleFinalMatchFormatChange(value) {
        setFinalStage((prev) =>
            syncFinalStageWithTeams(
                setFinalStageOption(prev || createEmptyFinalStage(), 'finalMatchFormatKey', value),
                allTeams
            )
        );
    }
`);
        addToReturnObject('handleFinalMatchFormatChange');
    }
} else {
    addToReturnObject('handleFinalMatchFormatChange');
}

if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Handlers de formats vérifiés/ajoutés dans src/hooks/useTournamentState.js');
    console.log('✅ Backup créé : src/hooks/useTournamentState.js.bak-format-handlers');
} else {
    console.log('✅ Aucun changement nécessaire : les handlers semblent déjà présents.');
}
