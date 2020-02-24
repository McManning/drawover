import React from 'react';
import ReactDOM from 'react-dom';
import RangeSlider from './RangeSlider';

it('renders without crashing', () => {
    const noop = () => 0;

    const div = document.createElement('div');
    ReactDOM.render(
        <RangeSlider 
            fps={0} 
            min={0} 
            max={1} 
            scale={1} 
            onChange={noop} 
        />, 
        div
    );
    
    ReactDOM.unmountComponentAtNode(div);
});
