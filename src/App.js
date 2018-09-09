
import React from 'react';

import Video from './Video';
import RangeSlider from './RangeSlider';
import TimeSlider from './TimeSlider';
import Draw from './Draw';
import Transform from './Transform';
import Dropzone from './Dropzone';
import Playback from './Playback';

import VideoCache from './VideoCache';
import WorkerPool from './WorkerPool';

import Logger from './Log';
const log = new Logger('App');

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
            keys: [],

            // Video data
            videoFilename: null,
            videoSourceUrl: null
        };

        // Cache of serialized Draw content per-frame.
        // Eventually, this will be some localStorage object.
        this.drawCache = {};

        this.video = React.createRef();
        this.workers = React.createRef();
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

        // Events for <Draw>
        this.onDrawDraw = this.onDrawDraw.bind(this);
        this.onDrawClear = this.onDrawClear.bind(this);

        // Events for <WorkerPool>
        this.onWorkerMetadata = this.onWorkerMetadata.bind(this);
        this.onWorkerFrames = this.onWorkerFrames.bind(this);
    }

    componentDidMount() {
        // Setup a worker iframe for video caching
        // this.frame = document.createElement('iframe');
        // this.frame.onload = function () {
        //     console.log('Frame loaded');
        // };
        // this.frame.srcdoc = `
        //     <html>
        //     <body>
        //         <script type="text/javascript" src="iframe-worker.js"></script>
        //         <script>console.log('Hello from iframe!');</script>
        //     </body>
        //     </html>
        // `;

        // // MUST get added to the DOM before it loads
        // document.body.appendChild(this.frame);

        // this.createWorkers();

        this.changeVideoSource('timecode-2998fps.mp4');
    }

    componentDidUpdate(prevProps, prevState) {
        // On Video frame change - change Draw content to match
        // if (prevState.frame !== this.state.frame) {
        //     this.changeDrawover(prevState.frame, this.state.frame);
        // }
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

    onWorkerFrames(frames) {
        log.info(frames);
    }

    onWorkerMetadata(metadata) {
        log.info(metadata);
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

        if (this.frame !== frame) {
            this.changeDrawover(this.frame, frame);
            this.time.current.setFrame(frame);

            this.frame = frame;    
        }
    }

    /**
     * Event handler for when the range slider changes active range.
     *
     * Update our time slider with the new range and clamp video playback
     */
    onPickRange(start, end) {
        this.time.current.setRange(start, end);
        this.video.current.startFrame = start;
        this.video.current.endFrame = end;
    }

    /**
     * Event handler for when the time slider is manually set to a frame
     *
     * This will pause video playback and jump it to the desired frame
     */
    onPickFrame(frame) {
        this.video.current.pause();
        this.video.current.frame = frame;

        // Cache frames forward
        // TODO: Eventually move over to only when we're drawing frames
        // this.videoCache.current.cache(
        //     frame,
        //     this.state.fps * this.props.cacheSeekAhead
        // );

        // this.frame.contentWindow.cache(
        //     frame,
        //     this.state.fps * this.props.cacheSeekAhead
        // );

        if (frame !== this.frame) {
            this.changeDrawover(this.frame, frame);
            this.frame = frame;

            // TODO: Render cached frame, if present
        }
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
        log.info(file);

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
            this.time.current.setKey(frame, 'cached-frame');
        }
    }

    /**
     * Draw layer had a new brush update added
     */
    onDrawDraw() {
        const frame = this.video.current.frame;
        log.info('Draw Update', frame);

        // Placeholder the drawCache - we won't serialize until
        // we swap off of this frame.
        this.drawCache[frame] = null;

        // Add a key to TimeSlider immediately to let the 
        // user know that their line created a new key frame
        this.time.current.setKey(frame, 'draw-frame');
    }

    /**
     * Draw layer is cleared of content, either by
     * a clear button, or history undo
     */
    onDrawClear() {
        const frame = this.video.current.frame;
        log.info('Draw Clear', frame);

        // Remove the empty frame from our cache
        delete this.drawCache[frame];

        // Reset to prior key color
        // if (this.videoCache.current.isCached(frame)) {
        //     this.time.current.setKey(frame, 'cached-frame');
        // } else {
            this.time.current.deleteKey(frame);
        // }
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
        // If there's content, key it and cache the Draw content
        if (!this.draw.current.isEmpty()) {
            this.time.current.setKey(prevFrame, 'draw-frame');
            this.drawCache[prevFrame] = this.draw.current.serialize();

            // TODO: Run the video caching around this key
        } else {
            // Canvas is empty - make sure we didn't still have anything
            // cached or keyed to indicate that there is draw content.
            delete this.drawCache[prevFrame];
            this.time.current.deleteKey(prevFrame);
        }

        this.draw.current.reset();

        // Try to load current Draw content from the cache
        if (frame in this.drawCache) {
            this.draw.current.deserialize(this.drawCache[frame]);
        }

        // Update ghost <Draw> components both forward and back from the current frame
        this.updateGhosting();
    }

    /**
     * Load a new file as our video source.
     *
     * This will clear everything (timeline, keys, etc) and start
     * fresh with the new video
     */
    changeVideoSource(file) {
        let url = file;
        let filename = file;

        if (file instanceof File) {
            url = URL.createObjectURL(file);
            filename = file.name;
        }

        this.setState({
            frame: 0,
            ready: false,
            playing: false,
            speed: 1,
            min: 0,
            max: 1,
            start: 0,
            end: 1,
            keys: [],

            videoFilename: filename,
            videoSourceUrl: url
        });

        this.time.current.deleteAllKeys();

        // Will trigger a new onVideoReady call on success
        // and update the state range
        this.video.current.load(url);
        // this.videoCache.current.load(url);

        // Clear all loaded draw frames
        this.draw.current.reset();
        this.drawCache = {};

        // if (this.frame.contentWindow.load) {
        //     this.frame.contentWindow.load(url);
        // }

        if (file instanceof File) {
            this.workers.current.load(file);
        } else {
            log.warn('Skipping WorkerPool load for non-local source file');
        }
    }

    /**
     * Get the previous frame that has a Draw cached prior to `frame`
     *
     * @param {Number} frame
     *
     * @return {Number|false}
     */
    getPreviousDrawFrame(frame) {
        let frames = Object.keys(this.drawCache);
        let i;
        
        for (i = frames.length - 1; i >= 0; i--) {
            if (frames[i] < frame) {
                break;
            }
        }

        // If we went before the list start, no frames match
        if (i < 0) {
            return false;
        }

        // Return the frame we broke on
        return parseInt(frames[i], 10);
    }

    /**
     * Get the next frame that has a Draw cached after `frame`
     *
     * @param {Number} frame
     *
     * @return {Number|false}
     */
    getNextDrawFrame(frame) {
        let frames = Object.keys(this.drawCache);
        let i;
        
        for (i = 0; i < frames.length; i++) {
            if (frames[i] > frame) {
                break;
            }
        }

        // If i is list end, no eligible frames after `frame`
        if (i === frames.length) {
            return false;
        }

        // Return the frame we broke on
        return parseInt(frames[i], 10);
    }

    updateGhosting() {
        const frame = this.video.current.frame;
        let i;

        let adjacent = this.getPreviousDrawFrame(frame);
        for (i = 0; i < this.props.ghostLayers; i++) {
            if (adjacent !== false) {
                this.refs['ghostBack' + i].deserialize(this.drawCache[adjacent]);
                adjacent = this.getPreviousDrawFrame(adjacent);    
            } else {
                this.refs['ghostBack' + i].clear();
            }
        }

        // adjacent = this.getNextDrawFrame(frame);
        // for (i = 0; i < this.props.ghostLayers && adjacent !== false; i++) {
        //     this.refs['ghostForward' + i].deserialize(this.drawCache[adjacent]);
        //     adjacent = this.getNextDrawFrame(adjacent);
        // }
    }

    /**
     * Return a set of <Draw> components
     *
     * This will return an active Draw component with event
     * hooks to all of our interactivity with the current frame,
     * as well as other readonly draw frames for ghosting / 
     * onion skinning our previous and next frames. 
     */
    renderDrawovers() {
        const opacityScale = 0.25;         
        const components = [];
        let opacity;

        // We add the lowest (furthest) layers first 
        for (let i = this.props.ghostLayers - 1; i >= 0; i--) {
            opacity = 1 - (i + 1) * this.props.ghostOpacityScale;
            
            components.push(
                <Draw key={'ghostBack' + i} 
                    ref={'ghostBack' + i}
                    width="720" height="480"
                    readonly={true} 
                    opacity={opacity} 
                />
            );

            // components.push(
            //     <Draw ref={'ghostForward' + i}
            //         width="720" height="480"
            //         readonly={true} 
            //         opacity={opacity} 
            //     />
            // );
        }
        
        components.push(
            <Draw key={'main'} ref={this.draw}
                width="720" height="480"
                onDraw={this.onDrawDraw}
                onClear={this.onDrawClear}
            />
        );

        return components;
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

                        {this.renderDrawovers()}
                    </Transform>
                </Dropzone>

                <TimeSlider ref={this.time}
                    fps={this.state.fps}
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

                {/* <VideoCache ref={this.videoCache}
                    workers={this.props.cacheWorkers}
                    onCache={this.onFrameCache} /> */}

                <WorkerPool ref={this.workers}
                    onMetadata={this.onWorkerMetadata}
                    onFrames={this.onWorkerFrames} />
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
    cacheSeekAhead: 2,

    // How many drawn frame forward/behind the current
    // frame should be rendered at once
    ghostLayers: 3,

    // How much to decrement opacity per ghost layer
    ghostOpacityScale: 0.3
};

export default App;
