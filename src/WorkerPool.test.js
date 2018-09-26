import React from 'react';
import ReactDOM from 'react-dom';
import WorkerPool from './WorkerPool';

it('renders without crashing', () => {
    const div = document.createElement('div');
    ReactDOM.render(<WorkerPool />, div);
    ReactDOM.unmountComponentAtNode(div);
});
