
import React from 'react';
import Timecode from './Timecode';

import './RangeSlider.scss';

/**
 * Component to interactively pick a subset range of frames
 *
 * <RangeSlider fps="29.98" min="0" max="100" onChange={callback} />
 *
 * `onChange` gets two integer arguments: `startFrame` and `endFrame`
 */
class RangeSlider extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            start: props.min,
            end: props.max
        };

        this.ref = React.createRef();

        this.onUpdateSlider = this.onUpdateSlider.bind(this);
        this.onChangeStartFrame = this.onChangeStartFrame.bind(this);
        this.onChangeEndFrame = this.onChangeEndFrame.bind(this);
        this.onChange = this.onChange.bind(this);
    }

    componentDidMount() {
        // Setup noUiSlider
        window.noUiSlider.create(this.ref.current, {
            // Add support for offsetting the window
            connect: true,
            behaviour: 'drag',
            tooltips: [this.getTooltipFormatter(), this.getTooltipFormatter()],

            // Custom formatting for time codes
            // format: {
            //     to: (value) => this.frameToTimecode(value),
            //     from: (value) => this.timecodeToFrame(value)
            // }

            // Disable slide animations (since we don't "slide" through source frames)
            animate: false,

            // Match full frame count
            range: {
                min: this.props.min * this.props.scale,
                max: this.props.max * this.props.scale
            },

            start: [
                this.state.start * this.props.scale,
                this.state.end * this.props.scale
            ],

            // 20 frame margin between start and end
            margin: 10,

            step: this.props.scale
        });

        this.slider = this.ref.current.noUiSlider;

        // Keep some DOM references for later update calculations
        this.connector = this.slider.target.getElementsByClassName('noUi-connect')[0];
        this.lowerHandle = this.slider.target.getElementsByClassName('noUi-handle-lower')[0];
        this.upperHandle = this.slider.target.getElementsByClassName('noUi-handle-upper')[0];

        this.slider.on('update', this.onUpdateSlider);

        // Override event handling for the tooltips to prevent propagation
        // (so click-dragging a tooltip won't function - only the handles will)
        [].forEach.call(this.slider.target.getElementsByClassName('noUi-tooltip'), (el) => {
            el.addEventListener('mousemove', RangeSlider.noop, true);
            el.addEventListener('mousedown', RangeSlider.noop, true);
        });
    }

    /**
     * No-op event handler to stop event propagation when needed
     * 
     * @param {Event} e 
     */
    static noop(e) {
        e.stopPropagation();
        return false;
    }

    /**
     * Formatter object for noUiSlider tooltips
     */
    getTooltipFormatter() {
        return new Timecode(this.props.fps);
    }

    /**
     * On prop update, also update our noUiSlider component
     */
    componentDidUpdate(prevProps) {
        if (prevProps.min !== this.props.min || prevProps.max !== this.props.max) {
            // Update noUiSlider to the new range limits
            this.slider.updateOptions({
                range: {
                    min: this.props.min * this.props.scale,
                    max: this.props.max * this.props.scale
                },
                start: [
                    this.props.min * this.props.scale,
                    this.props.max * this.props.scale
                ],

                // The larger our range, the higher our step count (1 vs 10)
                // < 5000, by 1s, 5000 frames, by 5's, 10000 frames, by 10s,
                // step: (this.props.max - this.props.min > 100) ? 10 : 1

                // TODO:
                // Step isn't what we want because manually setting a frame
                // that isn't within the step (divisible by 10) sets it to the
                // nearest divisible by ten value. Instead, we need something
                // that has a smaller scrollable range (/10) but can manually
                // enter numbers as fractions of that scrollable range, that are
                // then multiplied by the scale (10)


            }, false); // don't fire events for this

            // Update state to fill in the new range
            this.setState({
                start: this.props.min,
                end: this.props.max
            });
        }
    }

    /**
     * Determine where and how to render handle labels based on the slider
     * 
     * For "short" sliders, we'll push labels out of the connector, picking
     * either the lower or upper bound as the target to push based on the 
     * connector's current position. 
     */
    updateHandleLabels() {
        // > 188px - can fit both labels in the connector
        // > 118px - can fit a single label in the connector
        // <= 118px - no labels in the connector 
        const width = this.connector.getBoundingClientRect().width;

        // Connector interior is big enough for both labels
        if (width > 188) {
            this.lowerHandle.classList.remove('is-outside');
            this.upperHandle.classList.remove('is-outside');
            return;
        }

        // Only big enough for one label - pick one
        if (width > 118) {
            this.lowerHandle.classList.add('is-outside');
            this.upperHandle.classList.remove('is-outside');
            return;
        }

        // Too small for either label, remove both.
        this.lowerHandle.classList.add('is-outside');
        this.upperHandle.classList.add('is-outside');
    }

    onUpdateSlider(values) {
        const start = Math.round(values[0] / this.props.scale);
        const end = Math.round(values[1] / this.props.scale);

        this.setState({ start, end });

        this.updateHandleLabels();

        // If we have a listener bound, fire a message to it
        if (this.props.onChange) {
            this.props.onChange(start, end);
        }
    }

    onChange(e) {
        this.setState({
            [e.target.name]: e.target.value
        });
    }

    onChangeStartFrame(e) {
        this.slider.set([e.target.value * this.props.scale, null]);
    }

    onChangeEndFrame(e) {
        this.slider.set([null, e.target.value * this.props.scale]);
    }
    

    render() {
        return (
            <div className="range-slider">
                <input type="number" name="min" value={Math.round(this.props.min)} readOnly />
                <input type="number" name="start" value={Math.round(this.state.start)}
                    onChange={this.onChange} onBlur={this.onChangeStartFrame} />

                <div ref={this.ref}></div>

                <input type="number" name="end" value={Math.round(this.state.end)}
                    onChange={this.onChange} onBlur={this.onChangeEndFrame} />
                <input type="number" name="max" value={Math.round(this.props.max)} readOnly />
            </div>
        );
    }
}

RangeSlider.defaultProps = {
    min: 0,
    max: 100,
    scale: 1
};

export default RangeSlider;
