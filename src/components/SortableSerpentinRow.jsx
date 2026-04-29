import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FaTrash } from 'react-icons/fa';

function SortableSerpentinRow({
                                  entry,
                                  baseTeams,
                                  unavailableTeamIds,
                                  getTeamLabelById,
                                  onChange,
                                  onDelete,
                              }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: entry.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`serpentin-row ${isDragging ? 'dragging' : ''}`}
        >
            <button
                ref={setActivatorNodeRef}
                type="button"
                className="drag-handle"
                title="Glisser-déposer"
                {...attributes}
                {...listeners}
            >
                ↕
            </button>

            <select value={entry.value} onChange={(event) => onChange(event.target.value)}>
                <option value="">-- Sélectionner une équipe --</option>
                {baseTeams
                    .filter((team) => team.id === entry.value || !unavailableTeamIds.has(team.id))
                    .map((team) => (
                        <option key={team.id} value={team.id}>
                            {getTeamLabelById(team.id)}
                        </option>
                    ))}
            </select>

            <button type="button" className="danger small-btn" onClick={onDelete}>
                <FaTrash />
            </button>
        </div>
    );
}

export default SortableSerpentinRow;
