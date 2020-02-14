import React from 'react';
import logo from './logo.svg';
import './App.scss';

import Playback from './controls/Playback';
import RangeSlider from './controls/RangeSlider';
import Slider from './common/Slider';

import Timecode from './utility/Timecode';

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

        <RangeSlider fps={29.98} min={0} max={100} scale={1} onChange={() => 0} />
    </div>
);

export default App;
