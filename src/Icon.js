
import React from 'react';

/**
 * Basic wrapper over Font Awesome (Solid)
 * 
 * @param {object} props 
 */
const Icon = (props) => {
    const { name, ...other } = props;
    return <i className={'fas fa-' + name} {...other}></i>
};

Icon.defaultProps = {
    name: 'thumbs-down'
};

export default Icon;
