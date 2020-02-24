import React from 'react';
import ReactDOM from 'react-dom';
import Slider from './Slider';

it('renders without crashing', () => {
    const noop = () => 0;
    
    const div = document.createElement('div');
    ReactDOM.render(
        <Slider
            min={0}
            max={1}
            step={0}
            start={0}
            end={1}
            onChange={noop}
        />, 
        div
    );
    
    ReactDOM.unmountComponentAtNode(div);
});
