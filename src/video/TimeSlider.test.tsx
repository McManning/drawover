import React from 'react';
import ReactDOM from 'react-dom';
import TimeSlider from './TimeSlider';

it('renders without crashing', () => {
    const div = document.createElement('div');
    ReactDOM.render(
        <TimeSlider 
        
        />, 
        div
    );
    
    ReactDOM.unmountComponentAtNode(div);
});
