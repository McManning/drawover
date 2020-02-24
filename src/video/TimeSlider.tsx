
import React, { Component, MouseEvent, createRef } from 'react';

// @ts-ignore - TS support pending: https://github.com/leongersen/noUiSlider/pull/986
import noUiSlider from 'nouislider';

import Timecode from '../utility/Timecode';
import NumberField from '../common/NumberField';

import './TimeSlider.scss';

type Props = {
    fps: number;

    onChange(frame: number): void;
};

type State = {
    start: number;
    end: number;
    current: number;
    currentInput: number;
    keys: {
        [frame: number]: string;
    };
};

/**
 * Set keyframes within a time frame, and mark frames
 *
 * <TimeSlider onChange={callable} />
 *
 * `onChange` callable takes one argument: `frame`
 */
export default class TimeSlider extends Component<Props, State> {
    static defaultProps = {
        
    };
    
    public readonly state: State = {
        start: 0,
        end: 1,
        current: 0,
        currentInput: 0,

        keys: {}
    };

    private ref = createRef<HTMLDivElement>();

    private slider: noUiSlider;

    private handle: any; // TODO

    constructor(props: Props) {
        super(props);

        this.onSliderChange = this.onSliderChange.bind(this);
        this.onInputChange = this.onInputChange.bind(this);
        this.onInputBlur = this.onInputBlur.bind(this);
        this.onClick = this.onClick.bind(this);
    }

    setRange(start: string, end: string) {
        this.setState({
            start: parseInt(start, 10),
            end: parseInt(end, 10)
        });
    }

    setFrame(frame: number) {
        this.setState({
            current: frame,
            currentInput: frame
        });
    }

    componentDidMount() {
        // Setup noUiSlider
        this.slider = noUiSlider.create(this.ref.current, {
            start: this.state.current,
            step: 1,

            tooltips: new Timecode(this.props.fps),

            // Snap to position when a handle is clicked
            behaviour: 'snap',

            // Disable slide animations (since we don't "slide" through source frames)
            animate: false,

            // Match full frame count
            range: {
                min: this.state.start,
                max: this.state.end
            },

            pips: this.getPips(this.state.start, this.state.end)

            // padding: [ 0, 1 ]
        });

        // Extract the handle element from noUiSlider - we're going to be dynamically adjusting the CSS later
        this.handle = this.slider.target.getElementsByClassName('noUi-handle')[0];

        // Slide is included here so that the event gets fired while "scrubbing"
        // See the event matrix on: https://refreshless.com/nouislider/events-callbacks/
        this.slider.on('change', this.onSliderChange);
        this.slider.on('slide', this.onSliderChange);

        // Update current in case our input current is outside the acceptable range
        this.setState({
            current: parseInt(this.slider.get(), 10),
            currentInput: parseInt(this.slider.get(), 10)
        });
    }

    /**
     * On prop update, also update our noUiSlider component
     */
    componentDidUpdate(prevProps: Props, prevState: State) {
        if (prevState.current !== this.state.current) {
            this.slider.set(this.state.current);
            this.updateHandleVisibility();
        }

        // Pass range changes off to noUiSlider
        if (prevState.start !== this.state.start || prevState.end !== this.state.end) {
            this.slider.updateOptions({
                range: {
                    min: this.state.start,
                    max: this.state.end
                }
            });

            // Update pip scaling
            // Not supported via updateOptions.
            // See https://github.com/leongersen/noUiSlider/issues/594
            this.slider.pips(this.getPips(this.state.start, this.state.end));

            // Make sure the handle is (in)visible based on whether
            // or not it's in the updated range, and that it fits frame sizes
            this.updateHandleVisibility();
            this.updateHandleWidth();
        }
    }

    /**
     * Toggle visibility of the handle DOM based on whether our current frame
     * is confined within the slider range (feature not available natively
     * within noUiSlider).
     */
    updateHandleVisibility() {
        if (!this.slider.target) {
            return;
        }

        const handle = this.slider.target.getElementsByClassName('noUi-origin');

        if (this.state.current >= this.state.start && this.state.current <= this.state.end) {
            handle[0].classList.remove('is-off-timeline');
            this.slider.set(this.state.current);
        } else {
            handle[0].classList.add('is-off-timeline');
        }
    }

    /**
     * Update the CSS width of the handle to match width of frames.
     *
     * Note that `min-width` is used within our CSS to ensure the handle doesn't underflow
     * and become unclickable by the end user
     */
    updateHandleWidth() {
        const { start, end } = this.state;
        let width = 100 / (end - start) + '%';

        this.handle.style.width = width;
    }

    /**
     * Get the `pips` configuration for noUiSlider
     *
     * This will attempt to intelligently rescale pips to match Maya's behavior.
     */
    getPips(start: number, end: number) {
        // Maya time slices like:
        // by 1's up to 50 frames
        // by 2's up to 100
        // 5's up to 200
        // 10s up to 500
        // 20s up to 1000
        // 50s up to 2000
        // 100s up to 5000
        // 200s up to 10000
        // 500s up to ... etc

        if (!start && !end) {
            return null;
        }

        const range = end - start;
        let factor = 1;
        let step = 0;

        // TODO: This algorithm is disgusting. Optimize.

        while (true) {
            if (range < 50 * factor) {
                step = factor;
                break;
            } else if (range < 100 * factor) {
                step = 2 * factor;
                break;
            } else if (range < 200 * factor) {
                step = 5 * factor;
                break;
            }

            factor *= 10;
        }

        let values = [];
        for (let i = start; i <= end; i += step) {
            values.push(i);
        }

        return {
            mode: 'values',
            values: values,
            density: -1,
        };
    }

    /**
     * Event handler for when noUiSlider fires a `change` event
     *
     * Fires to `onChange` prop listener with the current frame as an argument
     *
     * @see https://refreshless.com/nouislider/events-callbacks/
     */
    onSliderChange(value: string[]) {
        const ival = parseInt(value[0]);

        // Only update if it's actually been changed.
        if (this.state.current !== ival) {
            this.setState({
                current: ival,
                currentInput: ival
            });

            if (this.props.onChange) {
                this.props.onChange(ival);
            }
        }
    }

    /**
     * Event handler for when the user types in the manual frame entry field
     *
     * This simply updates our state so that the field can be re-rendered.
     */
    onInputChange(value: number) {
        this.setState({
            currentInput: value
        });
    }

    /**
     * Event handler for when the user clicks out of the frame input
     *
     * Will update noUiSlider to the selected frame
     */
    onInputBlur(value: number) {
        this.slider.set(value);

        if (this.props.onChange) {
            this.props.onChange(parseInt(this.slider.get()));
        }
    }

    /**
     * Set a frame as being keyed (colored on the timeline)
     *
     * @param {Number} frame
     * @param {string} type Type string, will be used to identify keys on the DOM
     *                      (as a data-type entry)
     */
    setKey(frame: number, type: string) {
        const keys = this.state.keys;
        keys[frame] = type;

        // We're just setting state to itself here,
        // but this'll trigger the redraw we need.
        this.setState({ keys });
    }

    /**
     * Returns true if the given frame has been keyed
     */
    hasKey(frame: number): boolean {
        return frame in this.state.keys;
    }

    /**
     * Remove key for a given frame
     */
    deleteKey(frame: number) {
        const keys = this.state.keys;
        delete keys[frame];

        this.setState({ keys });
    }

    /**
     * Remove all keys from the timeline and redraw
     */
    deleteAllKeys() {
        this.setState({
            keys: {}
        });
    }

    /**
     * Add custom markers to the slider for keyed frames
     */
    renderKeys() {
        const { start, end } = this.state;

        return (
            <div className="time-slider-keys">
                {Object.keys(this.state.keys).map((key) => {
                    const frame = parseInt(key);
                    const type = this.state.keys[frame];

                    if (frame >= start && frame <= end) {
                        return (
                            <div key={frame} className="time-slider-key" style={{
                                left: ((frame - start) / (end - start) * 100) + '%',
                                width: 100 / (end - start) + '%',
                            }} data-type={type} data-frame={frame}></div>
                        );
                    }

                    return null;
                })}
            </div>
        );
    }

    onClick(e: MouseEvent<HTMLDivElement>) {
        // If we clicked on a key frame, jump to it
        if (e.currentTarget.dataset.frame) {
            const frame = parseInt(e.currentTarget.dataset.frame);

            // Only update if it's actually been changed.
            if (this.state.current !== frame) {
                this.setState({
                    current: frame,
                    currentInput: frame
                });

                if (this.props.onChange) {
                    this.props.onChange(frame);
                }
            }
        }
    }

    render() {
        return (
            <div className="time-slider" onClick={this.onClick}>
                <div className="time-slider-noui">
                    <div ref={this.ref}></div>
                    {this.renderKeys()}
                </div>

                <NumberField
                    name="currentInput"
                    title="Current frame"
                    value={this.state.currentInput}
                    onChange={this.onInputChange}
                    onBlur={this.onInputBlur}
                />
            </div>
        );
    }
}
