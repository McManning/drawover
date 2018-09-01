
import React from 'react';

import Video from './Video';
import RangeSlider from './RangeSlider';
import TimeSlider from './TimeSlider';
import Draw from './Draw';
import Transform from './Transform';
import Dropzone from './Dropzone';

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
            end: 1,

            // List of key markers to send to TimeSlider.
            // Populated with frame #'s that we draw over
            keys: []
        };

        // Cache of serialized Draw content per-frame.
        // Eventually, this will be some localStorage object.
        this.drawCache = {};

        this.video = React.createRef();
        this.time = React.createRef();
        this.range = React.createRef();
        this.draw = React.createRef();

        this.onFrame = this.onFrame.bind(this);
        this.onVideoReady = this.onVideoReady.bind(this);
        this.onPickRange = this.onPickRange.bind(this);
        this.onPickFrame = this.onPickFrame.bind(this);
        this.onDropFile = this.onDropFile.bind(this);

        this.onClickTogglePlayback = this.onClickTogglePlayback.bind(this);
    }

    componentDidMount() {
        this.changeVideoSource('/bigbuckbunny.webm');
    }

    componentDidUpdate(prevProps, prevState) {
        // On Video frame change - change Draw content to match
        if (prevState.frame !== this.state.frame) {
            this.changeDrawover(prevState.frame, this.state.frame);
        }
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
        // this.setState({
        //     frame: frame
        // });

        this.video.current.pause();
        this.video.current.frame = frame;
    }

    /**
     * Swap Draw content to match the given frame
     *
     * This will serialize and store the current state of the Draw
     * Draw component to the previous frame, and either start a new
     * empty canvas for the specified frame or load the previously
     * serialized content back into Draw.
     *
     * @param {Number} prevFrame to cache current Draw content
     * @param {Number} frame to display new Draw content
     */
    changeDrawover(prevFrame, frame) {
        // If this is a newly added frame, update our list of keyed frames
        if (!this.draw.current.isEmpty()) {
            if (!(prevFrame in this.drawCache)) {
                const keys = this.state.keys;
                keys.push(prevFrame);
                this.setState({ keys });
            }

            // Store current Draw content to the cache
            this.drawCache[prevFrame] = this.draw.current.serialize();
        }

        this.draw.current.reset();

        // Try to load current Draw content from the cache
        if (frame in this.drawCache) {
            this.draw.current.deserialize(this.drawCache[frame]);
        }

        // TODO: Ghosting
    }

    onClickTogglePlayback() {
        if (this.video.current.isPlaying()) {
            this.video.current.pause();
        } else {
            this.video.current.play();
        }
    }

    /**
     * Local file from disk was dropped into our Dropzone
     *
     * If it's a video file, load it to replace the existing video.
     * If it's some other persisted file, load that instead.
     */
    onDropFile(file) {
        console.log(file);

        if (this.video.current.canLoad(file)) {
            this.changeVideoSource(file);
        } else {
            alert('Cannot load type: ' + file.type);
        }

        // TODO: Check for other types of files and ways to handle them
    }

    /**
     * Load a new file as our video source.
     *
     * This will clear everything (timeline, keys, etc) and start
     * fresh with the new video
     */
    changeVideoSource(file) {
        this.setState({
            frame: 0,
            ready: false,
            min: 0,
            max: 1,
            start: 0,
            end: 1,
            keys: []
        });

        // Will trigger a new onVideoReady call on success
        // and update the state range
        this.video.current.load(file);
    }

    /**
     * Skip ahead/behind the specified number of frames
     *
     * @param {integer} count number of frames to skip forward/back
     */
    skip(count) {
        this.video.current.skip(count);
    }

    render() {
        return (
            <div className="app">
                <Dropzone onFile={this.onDropFile}>
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
                </Dropzone>

                <TimeSlider ref={this.time}
                    fps={this.state.fps}
                    keys={this.state.keys}
                    onChange={this.onPickFrame} />

                <RangeSlider ref={this.range}
                    fps={this.state.fps}
                    min={this.state.min}
                    max={this.state.max}
                    onChange={this.onPickRange} />

                <div className="app-playback">
                    <button onClick={this.onClickTogglePlayback}>> / ||</button>

                    <button onClick={() => this.skip(1)}>+1</button>
                    <button onClick={() => this.skip(-1)}>-1</button>
                    <button onClick={() => this.skip(5)}>+5</button>
                    <button onClick={() => this.skip(-5)}>-5</button>

                </div>
            </div>
        );
    }
}

export default App;
