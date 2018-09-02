
import React from 'react';

import Video from './Video';
import RangeSlider from './RangeSlider';
import TimeSlider from './TimeSlider';
import Draw from './Draw';
import Transform from './Transform';
import Dropzone from './Dropzone';
import Playback from './Playback';

import VideoCache from './VideoCache';

class App extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            fps: 29.98,

            ready: false,
            playing: false,

            // Video playback speed
            speed: 1,

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
        this.videoCache = React.createRef();
        this.time = React.createRef();
        this.range = React.createRef();
        this.draw = React.createRef();

        // Events for <Video>
        this.onVideoReady = this.onVideoReady.bind(this);
        this.onFrame = this.onFrame.bind(this);

        // Events for <VideoCache>
        this.onFrameCache = this.onFrameCache.bind(this);

        // Events for <RangeSlider>
        this.onPickRange = this.onPickRange.bind(this);

        // Events for <TimeSlider>
        this.onPickFrame = this.onPickFrame.bind(this);

        // Events for <Dropzone>
        this.onDropFile = this.onDropFile.bind(this);

        // Events for <Playback>
        this.onPlaybackSpeed = this.onPlaybackSpeed.bind(this);
        this.onPlaybackPlay = this.onPlaybackPlay.bind(this);
        this.onPlaybackPause = this.onPlaybackPause.bind(this);
        this.onPlaybackSkip = this.onPlaybackSkip.bind(this);
    }

    componentDidMount() {
        this.changeVideoSource('timecode-2998fps.mp4');
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

        // Cache frames forward
        // TODO: Eventually move over to only when we're drawing frames
        this.videoCache.current.cache(
            frame,
            this.state.fps * this.props.cacheSeekAhead
        );
    }

    /**
     * Update playback speed of the video
     */
    onPlaybackSpeed(value) {
        this.setState({
            speed: value
        });

        this.video.current.speed = value;
    }

    /**
     * Event handler to start video playback
     */
    onPlaybackPlay() {
        this.video.current.play();

        // TODO: Probably only set once the
        // video source confirms it's playing.
        this.setState({ playing: true });
    }

    /**
     * Event handler to pause video playback
     */
    onPlaybackPause() {
        this.video.current.pause();

        // TODO: Probably only set once the
        // video source confirms it's playing.
        this.setState({ playing: false });
    }

    /**
     * Skip the video forward/back the specified number of frames
     *
     * Frame skip is clamped to the range defined by RangeSlider
     *
     * @param {Number} frames to skip forward/back
     */
    onPlaybackSkip(frames) {
        this.video.current.skip(frames);
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
     * Frame has been added to the VideoCache
     */
    onFrameCache(frame) {
        // Push as a key on the timeline to indicate that it's been cached
        if (!this.time.current.hasKey(frame)) {
            this.time.current.setKey(frame, '#00FF00');
        }
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
        // If this is a newly added frame, add it as a keyframe to the time slider
        if (!this.draw.current.isEmpty()) {
            this.time.current.setKey(prevFrame, '#FF0000');

            if (!(prevFrame in this.drawCache)) {
                const keys = this.state.keys;
                keys.push(prevFrame);
                this.setState({ keys });
            }

            // Store current Draw content to the cache
            this.drawCache[prevFrame] = this.draw.current.serialize();

            // TODO: Run the video caching around this key
        }

        this.draw.current.reset();

        // Try to load current Draw content from the cache
        if (frame in this.drawCache) {
            this.draw.current.deserialize(this.drawCache[frame]);
        }

        // TODO: Ghosting
    }

    /**
     * Load a new file as our video source.
     *
     * This will clear everything (timeline, keys, etc) and start
     * fresh with the new video
     */
    changeVideoSource(file) {
        let url = file;

        this.setState({
            frame: 0,
            ready: false,
            playing: false,
            speed: 1,
            min: 0,
            max: 1,
            start: 0,
            end: 1,
            keys: []
        });

        if (file instanceof File) {
            url = URL.createObjectURL(file);
        }

        // Will trigger a new onVideoReady call on success
        // and update the state range
        this.video.current.load(url);
        this.videoCache.current.load(url);
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

                <Playback
                    playing={this.state.playing}
                    speed={this.state.speed}
                    onPause={this.onPlaybackPause}
                    onSkip={this.onPlaybackSkip}
                    onPlay={this.onPlaybackPlay}
                    onSpeed={this.onPlaybackSpeed}
                />

                <VideoCache ref={this.videoCache}
                    workers={this.props.cacheWorkers}
                    onCache={this.onFrameCache} />
            </div>
        );
    }
}

App.defaultProps = {
    // How many concurrent workers should be used
    // in the child VideoCache component.
    cacheWorkers: 5,

    // How many frames ahead from a cached frame
    // to cache alongside it (in seconds)
    cacheSeekAhead: 2
};

export default App;
