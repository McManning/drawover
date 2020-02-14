
import React from 'react';

type IconProps = {
    name: string;
};

/**
 * Wrapper around Font Awesome Solid
 */
const Icon: React.FC<IconProps> = ({
    name = 'thumbs-down'
}) => (
    <i className={`fas fa-${name}`} aria-hidden={true}></i>
);

export default Icon;
