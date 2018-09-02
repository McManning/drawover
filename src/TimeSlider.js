
import React from 'react';

import Timecode from './Timecode';

/**
 * Set keyframes within a time frame, and mark frames
 *
 * <TimeSlider onChange={callable} />
 *
 * `onChange` callable takes one argument: `frame`
 */
class TimeSlider extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            start: 0,
            end: 1,
            current: 0,
            currentInput: 0,

            keys: {}
        };

        this.ref = React.createRef();

        this.onSliderChange = this.onSliderChange.bind(this);
        this.onInputChange = this.onInputChange.bind(this);
        this.onInputBlur = this.onInputBlur.bind(this);
    }

    setRange(start, end) {
        this.setState({
            start: parseInt(start, 10),
            end: parseInt(end, 10)
        });
    }

    setFrame(frame) {
        this.setState({
            current: frame,
            currentInput: frame
        });
    }

    componentDidMount() {
        // Setup noUiSlider
        window.noUiSlider.create(this.ref.current, {
            start: this.state.current,
            step: 1,

            tooltips: this.getTooltipFormatter(),

            // Disable slide animations (since we don't "slide" through source frames)
            animate: false,

            // Match full frame count
            range: {
                min: this.state.start,
                max: this.state.end
            },

            pips: this.getPips()

            // padding: [ 0, 1 ]
        });

        this.slider = this.ref.current.noUiSlider;

        // Slide is included here so that the event gets fired while "scrubbing"
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
    componentDidUpdate(prevProps, prevState) {
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
            // or not it's in the updated range
            this.updateHandleVisibility();
        }
    }

    /**
     * Toggle visibility of the handle DOM based on whether our current frame
     * is confined within the slider range (feature not available natively
     * within noUiSlider).
     */
    updateHandleVisibility() {
        const handle = this.slider.target.getElementsByClassName('noUi-origin');

        if (this.state.current >= this.state.start && this.state.current <= this.state.end) {
            handle[0].classList.remove('is-off-timeline');
            this.slider.set(this.state.current);
        } else {
            handle[0].classList.add('is-off-timeline');
        }
    }

    /**
     * Formatter object for noUiSlider tooltips
     */
    getTooltipFormatter() {
        return new Timecode(this.props.fps);
    }

    /**
     * Get the `pips` configuration for noUiSlider
     *
     * This will attempt to intelligently rescale pips to match Maya's behavior.
     */
    getPips(start, end) {
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
     * Fires to onChange prop listener with the current frame as an argument
     *
     * @see https://refreshless.com/nouislider/events-callbacks/
     *
     * @param {string[]} value
     */
    onSliderChange(value) {
        const ival = parseInt(value[0], 10);

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
     *
     * @param {Event} e
     */
    onInputChange(e) {
        this.setState({
            [e.target.name]: e.target.value
        });
    }

    /**
     * Event handler for when the user clicks out of the frame input
     *
     * Will update noUiSlider to the selected frame
     *
     * @param {Event} e
     */
    onInputBlur(e) {
        this.slider.set(e.target.value);

        if (this.props.onChange) {
            this.props.onChange(parseInt(this.slider.get(), 10));
        }
    }

    /**
     * Set a frame as being keyed (colored on the timeline)
     *
     * @param {Number} frame
     * @param {string} type Type string, will be used to identify keys on the DOM
     *                      (as a data-type entry)
     */
    setKey(frame, type) {
        const keys = this.state.keys;
        keys[frame] = type;

        // We're just setting state to itself here,
        // but this'll trigger the redraw we need.
        this.setState({
            keys: keys
        });
    }

    /**
     * Returns true if the given frame has been keyed
     *
     * @param {Number} frame
     *
     * @return {boolean}
     */
    hasKey(frame) {
        return frame in this.state.keys;
    }

    deleteKey(frame) {
        delete this.state.keys[frame];
    }

    /**
     * Add custom markers to the slider for keyed frames
     */
    renderKeys() {
        const { start, end } = this.state;

        return (
            <div className="time-slider-keys">
                {Object.keys(this.state.keys).map((frame) => {
                    const type = this.state.keys[frame];

                    if (frame >= start && frame <= end) {
                        return (
                            <div key={frame} className="time-slider-key" style={{
                                left: ((frame - start) / (end - start) * 100) + '%',
                                width: 100 / (end - start) + '%',
                            }} data-type={type}></div>
                        );
                    }

                    return null;
                })}
            </div>
        );
    }

    render() {
        return (
            <div className="time-slider">
                <div className="time-slider-noui">
                    <div ref={this.ref}></div>
                    {this.renderKeys(this.props.keys)}
                </div>

                <input type="number" name="currentInput" value={this.state.currentInput}
                    onChange={this.onInputChange} onBlur={this.onInputBlur} />
            </div>
        );
    }
}

TimeSlider.defaultProps = {
    keys: []
};

export default TimeSlider;
