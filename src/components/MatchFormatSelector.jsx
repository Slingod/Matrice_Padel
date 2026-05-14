import { useEffect, useMemo, useState } from 'react';
import {
    getMatchFormat,
    getMatchFormatOptions,
    getStoredMatchFormat,
    sanitizeMatchFormatKey,
    setStoredMatchFormat,
} from '../utils/matchFormats';

function getSelectorValue(props) {
    return sanitizeMatchFormatKey(
        props.value ||
        props.matchFormatKey ||
        props.selectedFormatKey ||
        props.formatKey ||
        props.currentFormatKey ||
        props.ctx?.matchFormatKey ||
        props.ctx?.selectedMatchFormatKey ||
        props.ctx?.formatKey ||
        getStoredMatchFormat()
    );
}

function callPossibleHandlers(props, nextValue) {
    const handlers = [
        props.onChange,
        props.onFormatChange,
        props.onMatchFormatChange,
        props.handleMatchFormatChange,
        props.setMatchFormatKey,
        props.setFormatKey,
        props.ctx?.handleMatchFormatChange,
        props.ctx?.onMatchFormatChange,
        props.ctx?.setMatchFormatKey,
        props.ctx?.setFormatKey,
    ];

    handlers.forEach((handler) => {
        if (typeof handler === 'function') {
            handler(nextValue);
        }
    });

    setStoredMatchFormat(nextValue);

    window.dispatchEvent(
        new CustomEvent('padelingo:match-format-change', {
            detail: { formatKey: nextValue },
        })
    );
}

function MatchFormatSelector(props) {
    const propValue = getSelectorValue(props);
    const [localValue, setLocalValue] = useState(propValue);

    useEffect(() => {
        setLocalValue(propValue);
    }, [propValue]);

    useEffect(() => {
        const handleExternalChange = (event) => {
            const nextValue = sanitizeMatchFormatKey(event?.detail?.formatKey);
            setLocalValue(nextValue);
        };

        window.addEventListener('padelingo:match-format-change', handleExternalChange);

        return () => {
            window.removeEventListener('padelingo:match-format-change', handleExternalChange);
        };
    }, []);

    const selectedFormat = getMatchFormat(localValue);
    const formatOptions = useMemo(() => getMatchFormatOptions(), []);

    function handleChange(event) {
        const nextValue = sanitizeMatchFormatKey(event.target.value);
        setLocalValue(nextValue);
        callPossibleHandlers(props, nextValue);
    }

    return (
        <section className="card live-section match-format-selector-card">
            <div className="section-head">
                <div>
                    <h2>Format des matchs</h2>
                    <p className="note">
                        Tous les matchs comptent au coefficient 1. Le format choisi sert à saisir les sets
                        et à calculer automatiquement le score global du match.
                    </p>
                </div>

                <label className="field match-format-selector-field">
                    <span>Format</span>
                    <select
                        value={selectedFormat.key}
                        onChange={handleChange}
                    >
                        {formatOptions.map((format) => (
                            <option key={`pool-format-option-${format.key}`} value={format.key}>
                                {format.label}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <p className="note">
                <strong>Format {selectedFormat.key} :</strong> {selectedFormat.description}
            </p>
        </section>
    );
}

export default MatchFormatSelector;
