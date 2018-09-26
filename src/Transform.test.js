import React from 'react';
import ReactDOM from 'react-dom';
import Transform from './Transform';

it('renders without crashing', () => {
    const div = document.createElement('div');
    ReactDOM.render(<Transform />, div);
    ReactDOM.unmountComponentAtNode(div);
});
