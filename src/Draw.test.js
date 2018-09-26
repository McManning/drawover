import React from 'react';
import ReactDOM from 'react-dom';
import Draw from './Draw';

it('renders without crashing', () => {
    const div = document.createElement('div');
    ReactDOM.render(<Draw />, div);
    ReactDOM.unmountComponentAtNode(div);
});
