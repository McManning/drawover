import React from 'react';
import ReactDOM from 'react-dom';
import Draw from './Draw';

it('renders without crashing', () => {
    const noop = () => 0;

    const div = document.createElement('div');
    ReactDOM.render(
        <Draw 
            width={720}
            height={480}
            onDraw={noop} 
            onClear={noop} 
        />, 
        div
    );

    ReactDOM.unmountComponentAtNode(div);
});
