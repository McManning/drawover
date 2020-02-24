import React from 'react';
import ReactDOM from 'react-dom';
import TransformEditor from './TransformEditor';

it('renders without crashing', () => {
    const div = document.createElement('div');
    ReactDOM.render(<TransformEditor />, div);
    ReactDOM.unmountComponentAtNode(div);
});
