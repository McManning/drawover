
import React, { useRef, useState, useEffect, useCallback } from 'react';

// @ts-ignore - TS support pending: https://github.com/leongersen/noUiSlider/pull/986
import noUiSlider from 'nouislider';

import './Slider.scss';

interface NoUiSliderFormatter {
    /**
     * format to string
     */
    to(val: number): string;

    /**
     * get number from formatted string
     */
    from(val: string): number;
}

type SliderProps = {
    min: number;
    max: number;
    step: number;

    start: number;
    end: number;

    onChange(values: any[]): void;
    tooltips?: [NoUiSliderFormatter, NoUiSliderFormatter];
};

/**
 * Reusable wrapper around noUiSlider
 */
const Slider: React.FC<SliderProps> = ({
    min,
    max,
    step,
    start,
    end,
    tooltips,
    onChange
}) => {
    const [slider, setSlider] = useState<null | any>(null);
    const [range, setRange] = useState([start, end]);
    const containerRef = useRef<HTMLDivElement>(null);

    // const onSliderUpdate = useCallback((values: any[]) => {
    //     onChange(values[0], values[1]);
    // }, [onChange]);

    const onSliderUpdate = useCallback((values: any[]) => {

    }, [range]);

    // Create/destory noUiSlider on mount/unmount
    useEffect(() => {
        const onSliderUpdate = (values: any[]) => {
            console.log('onSliderUpdate');
            const start = parseInt(values[0]);
            const end = parseInt(values[0]);
            if (start !== range[0] || end !== range[1]) {
                setRange([ start, end ]);
            }
        };

        console.log('Mount effect');

        const instance = noUiSlider.create(containerRef.current, {
            // Add support for offsetting the window
            connect: true,
            behaviour: 'drag',

            // Disable slide animations (since we don't "slide" through source frames)
            animate: false,

            // 20 frame margin between start and end
            margin: 10,

            range: {
                min: 0,
                max: 1
            },
            start: [0, 1]
        });

        console.log('Instantiated slider');

        instance.on('update', onSliderUpdate);
        setSlider(instance);

        return () => {
            console.log('Destroy slider');
            instance.destroy();
        }
    }, []);

    // // Update noUiSlider on prop changes
    useEffect(() => {
        console.log('[Slider] Update');
        slider?.updateOptions({
            range: {
                min: min * step,
                max: max * step
            },
            tooltips,
            step
        });
    }, [slider, min, max, step, tooltips]);

    // Notify listeners when range is recalculated
    useEffect(() => {
        // const start = Math.round(values[0] / step);
        // const end = Math.round(values[1] / step);

        console.log('[Slider] Range update', range);

        // if (onChange) {
        //     onChange(range[0], range[1]);
        // }
    }, [range]);

    return (
        <div ref={containerRef} />
    );
};

export default Slider;
