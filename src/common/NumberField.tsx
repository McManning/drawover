
import React from 'react';

type NumberFieldProps = {
    name: string;
    title: string;
    value: number;
    className?: string;
    readOnly?: boolean;
    decimals?: boolean;
    onChange?(value: number): void;
    onBlur?(value: number): void;
};

const NumberField: React.FC<NumberFieldProps> = ({
    name,
    title,
    value,
    className = '',
    readOnly = false,
    decimals = false,
    onChange,
    onBlur
}) => (
    <input type="number"
        className={className}
        name={name}
        title={title}
        value={decimals ? value : Math.round(value)}
        readOnly={readOnly}
        onChange={(e) => onChange && onChange(parseInt(e.target.value))}
        onBlur={(e) => onBlur && onBlur(parseInt(e.target.value))}
    />
);

export default NumberField;

// TODO: NaN detection and block