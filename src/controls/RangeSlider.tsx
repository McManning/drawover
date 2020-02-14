
import React, { createRef, useState, useEffect } from 'react';
import Timecode from '../utility/Timecode';

// @ts-ignore - TS support pending: https://github.com/leongersen/noUiSlider/pull/986
import noUiSlider from 'nouislider';

import NumberField from '../common/NumberField';
import Slider from '../common/Slider';

import './RangeSlider.scss';

type RangeSliderProps = {
    fps: number;
    min: number;
    max: number;
    scale: number;
    onChange(startFrame: number, endFrame: number): void;
};

/**
 * Component to interactively pick a subset range of frames
 *
 * ```
 * <RangeSlider fps="29.98" min="0" max="100" onChange={callback} />
 * ```
 */
const RangeSlider: React.FC<RangeSliderProps> = ({
    min,
    max,
    fps,
    scale,
    onChange
}) => {
    const [range, setRange] = useState({ start: min, end: max });

    // const onChangeSlider = (start: number, end: number) => {
    //     console.log('[RangeSlider] onChangeSlider', start, end);

    //     start = Math.round(start / scale);
    //     end = Math.round(end / scale);

    //     setRange({ start, end });
    //     // updateHandleLabels();

    //     if (onChange) {
    //         onChange(start, end);
    //     }
    // }

    const onChangeSlider = (values: any[]) => {
        console.log('[RangeSlider] onChangeSlider', values);
    };

    const onChangeStart = (start: number) => setRange({ start, end: range.end });
    const onChangeEnd = (end: number) => setRange({ start: range.start, end });

    return (
        <div className="range-slider">
            <NumberField title="Min" name="min" value={min} readOnly />

            <NumberField title="Start" name="start" value={range.start}
                onChange={onChangeStart} />

            <Slider min={min} max={max} step={scale}
                tooltips={[ new Timecode(fps), new Timecode(fps) ]}
                start={range.start} end={range.end}
                onChange={onChangeSlider} />

            <NumberField title="End" name="end" value={range.end}
                onChange={onChangeEnd} />

            <NumberField title="Max" name="max" value={max} readOnly />
        </div>
    );
};

export default RangeSlider;
