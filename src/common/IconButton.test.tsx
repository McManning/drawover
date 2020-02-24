import React from 'react';
import ReactDOM from 'react-dom';
import IconButton from './IconButton';

it('renders without crashing', () => {
    const noop = () => 0;
    
    const div = document.createElement('div');
    ReactDOM.render(
        <IconButton name="test" title="test" onClick={noop} />, 
        div
    );
    
    ReactDOM.unmountComponentAtNode(div);
});
