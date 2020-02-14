

import React from 'react';
import Icon from './Icon';

type IconButtonProps = {
    name: string;
    title: string;
    className?: string;
    onClick(): void;
};

const IconButton: React.FC<IconButtonProps> = ({
    name,
    title,
    className = '',
    onClick,
}) => (
    <button onClick={onClick} className={className} title={title}>
        <Icon name={name} />
    </button>
);

export default IconButton;
