import React from 'react';
import ReactDOM from 'react-dom';
import NumberField from './NumberField';

it('renders without crashing', () => {
    const noop = () => 0;
    
    const div = document.createElement('div');
    ReactDOM.render(
        <NumberField
            name="test"
            title="test"
            value={0}
            onChange={noop}
        />, 
        div
    );
    
    ReactDOM.unmountComponentAtNode(div);
});
