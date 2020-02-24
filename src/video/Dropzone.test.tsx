import React from 'react';
import ReactDOM from 'react-dom';
import Dropzone from './Dropzone';

it('renders without crashing', () => {
    const noop = () => 0;
    
    const div = document.createElement('div');
    ReactDOM.render(
        <Dropzone onFile={noop} />, 
        div
    );
    
    ReactDOM.unmountComponentAtNode(div);
});
