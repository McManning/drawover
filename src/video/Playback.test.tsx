import React from 'react';
import ReactDOM from 'react-dom';
import Playback from './Playback';

it('renders without crashing', () => {
    const noop = () => 0;

    const div = document.createElement('div');
    ReactDOM.render(
        <Playback 
            onPlay={noop}
            onPause={noop}
            onSpeed={noop}
            onSkipFrame={noop}
            onSkipKey={noop}
        />, 
        div
    );

    ReactDOM.unmountComponentAtNode(div);
});
