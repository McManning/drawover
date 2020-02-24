import React from 'react';
import './App.scss';

import Playback from './video/Playback';
import RangeSlider from './video/RangeSlider';
import Slider from './common/Slider';

import Timecode from './utility/Timecode';
import Draw from './draw/Draw';

const noop = () => 0;

const App = () => (
    <div>
        <Playback
            onPause={() => 0}
            onPlay={() => 0}
            onSkipFrame={(offset) => 0}
            onSkipKey={(offset) => 0}
            onSpeed={(speed) => 0}
        />
{/*
        <Slider min={0} max={100} step={1}
            tooltips={[new Timecode(29.98), new Timecode(29.98)]}
            start={0} end={50}
            onChange={(s, e) => console.log(s, e)} /> */}

        <Draw 
            width={720}
            height={480}
            onDraw={() => console.log('draw')} 
            onClear={() => console.log('clear')} 
        />, 

        {/* <RangeSlider fps={29.98} min={0} max={100} scale={1} onChange={() => 0} /> */}
    </div>
);

export default App;
