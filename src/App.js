
import React from 'react';

import Video from './Video';
import RangeSlider from './RangeSlider';
import TimeSlider from './TimeSlider';
import Draw from './Draw';
import Transform from './Transform';

class App extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            fps: 29.98,

            frame: 0,
            ready: false,
            min: 0,
            max: 1,
            start: 0,
            end: 1
        };

        this.video = React.createRef();
        this.time = React.createRef();
        this.range = React.createRef();
        this.draw = React.createRef();

        this.onFrame = this.onFrame.bind(this);
        this.onVideoReady = this.onVideoReady.bind(this);
        this.onPickRange = this.onPickRange.bind(this);
        this.onPickFrame = this.onPickFrame.bind(this);
    }

    /**
     * Event handler for when the Video component has loaded content
     *
     * This will update TimeSlider and RangeSlider with appropriate playback ranges
     */
    onVideoReady() {
        this.setState({
            ready: true,
            min: 0,
            max: this.video.current.totalFrames,
            start: 0,
            end: this.video.current.totalFrames
        });
    }

    /**
     * Event handler for when Video changes rendered frame
     *
     * @param {integer} frame
     */
    onFrame(frame) {
        if (!this.video.current) {
            return;
        }

        this.setState({
            frame: this.video.current.frame
        });

        this.time.current.setFrame(frame);
    }

    /**
     * Event handler for when the range slider changes active range.
     *
     * Update our time slider with the new range
     */
    onPickRange(start, end) {
        this.time.current.setRange(start, end);
    }

    /**
     * Event handler for when the time slider is manually set to a frame
     *
     * This will pause video playback and jump it to the desired frame
     */
    onPickFrame(frame) {
        this.setState({
            frame: frame
        });

        this.video.current.pause();
        this.video.current.frame = frame;
    }

    render() {
        return (
            <div className="app">
                <Transform>
                    <Video ref={this.video}
                        fps={this.state.fps}
                        onReady={this.onVideoReady}
                        onFrame={this.onFrame}
                        width="720" height="480"
                        source="/timecode-2998fps.mp4"
                    />

                    <Draw ref={this.draw}
                        width="720" height="480"
                    />
                </Transform>

                <TimeSlider ref={this.time}
                    fps={this.state.fps}
                    onChange={this.onPickFrame} />

                <RangeSlider ref={this.range}
                    fps={this.state.fps}
                    min={this.state.min}
                    max={this.state.max}
                    onChange={this.onPickRange} />

                <p>Ready: {this.state.ready}</p>
                <p>Frame: {this.state.frame}</p>
            </div>
        );
    }
}

export default App;
