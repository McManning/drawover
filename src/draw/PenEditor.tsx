
import React, { ChangeEvent } from 'react';
import { Pen } from '../types';

type Props = {
    position: {
        top: number;
        left: number;
    };

    /**
     * Initial pen properties
     */
    pen: Pen;

    /**
     * Event handler for pen property changes
     */
    onChange(pen: Pen): void;
};

const PEN_COLORS = [
    '#FF0000',
    '#00FF00',
    '#0000FF',
    '#000000',
    '#FFFFFF'
];

const PenEditor: React.FC<Props> = ({
    position,
    pen,
    onChange
}) => {
    const onChangeWidth = (e: ChangeEvent<HTMLInputElement>) => {
        onChange({
            width: parseInt(e.target.value),
            color: pen.color
        });
    };

    const onSetColor = (color: string) => {
        onChange({
            width: pen.width,
            color: color 
        });
    };

    return (
    <div className="draw-tools" style={position}>
        <input type="range" min="1" max="100"
            className="draw-line-width"
            value={pen.width}
            onChange={onChangeWidth} 
        />

        <ul>
        {PEN_COLORS.map((c) => {
            let classNames = 'draw-pen';
            if (pen && pen.color === c) {
                classNames += ' is-active';
            }

            return (
            <li key={c}>
                <button className={classNames} 
                    onClick={() => onSetColor(c)} 
                    style={{backgroundColor: c}}
                > </button>
            </li>
            )
        })}
        </ul>
    </div>
    );
}

export default PenEditor;
