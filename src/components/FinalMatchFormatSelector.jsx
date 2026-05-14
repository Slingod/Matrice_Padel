import { useMemo } from 'react';
import {
    getMatchFormat,
    getMatchFormatOptions,
    sanitizeMatchFormatKey,
} from '../utils/matchFormats';

function getSelectorValue(props) {
    return sanitizeMatchFormatKey(
        props.value ||
        props.finalMatchFormatKey ||
        props.matchFormatKey ||
        props.formatKey ||
        props.ctx?.safeFinalStage?.settings?.finalMatchFormatKey ||
        props.ctx?.finalStage?.settings?.finalMatchFormatKey ||
        'D1'
    );
}

function callPossibleHandlers(props, nextValue) {
    const handlers = [
        props.onChange,
        props.onFinalMatchFormatChange,
        props.handleFinalMatchFormatChange,
        props.setFinalMatchFormatKey,
        props.ctx?.handleFinalMatchFormatChange,
        props.ctx?.onFinalMatchFormatChange,
        props.ctx?.setFinalMatchFormatKey,
    ];

    let called = false;

    handlers.forEach((handler) => {
        if (typeof handler === 'function') {
            handler(nextValue);
            called = true;
        }
    });

    window.dispatchEvent(
        new CustomEvent('padelingo:final-match-format-change', {
            detail: { formatKey: nextValue },
        })
    );

    return called;
}

function FinalMatchFormatSelector(props) {
    const selectedKey = getSelectorValue(props);
    const selectedFormat = getMatchFormat(selectedKey);
    const formatOptions = useMemo(() => getMatchFormatOptions(), []);

    function handleChange(event) {
        callPossibleHandlers(props, event.target.value);
    }

    return (
        <div className="final-format-card">
            <label className="field final-settings-field">
                <span>Format du tableau final</span>
                <select
                    value={selectedFormat.key}
                    onChange={handleChange}
                >
                    {formatOptions.map((format) => (
                        <option key={`final-format-option-${format.key}`} value={format.key}>
                            {format.label}
                        </option>
                    ))}
                </select>
            </label>

            <p className="final-settings-help">
                <strong>Format {selectedFormat.key} :</strong> {selectedFormat.description}
                <br />
                Ce format s’applique aux huitièmes, quarts, demis, finale, petite finale et matchs de classement.
                Les matchs déjà saisis gardent leur format.
            </p>
        </div>
    );
}

export default FinalMatchFormatSelector;
