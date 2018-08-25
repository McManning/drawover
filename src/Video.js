
import React from 'react';

/**
 * Video playback canvas. Not to be confused with native <video>
 * (TODO: ...should probably rename this)
 *
 * <Video onFrame={callable} onReady={callback} />
 *
 * `onReady` is fired once the media source has been fully loaded
 * `onFrame` callable gets the current frame number as an argument
 */
class Video extends React.Component {
    constructor(props) {
        super(props);

        this.onVideoLoad = this.onVideoLoad.bind(this);
        this.onAnimFrame = this.onAnimFrame.bind(this);

        this.play = this.play.bind(this);
        this.pause = this.pause.bind(this);
        this.skip = this.skip.bind(this);

        this.video = React.createRef();
        this.canvas = React.createRef();
        this.backbuffer = React.createRef();

        // Canvas context
        this.context = null;
        this.backbufferContext = null;

        // State data not managed by React (need a faster response time here)
        this.frames = {
            current: 0,
            total: 0,
            start: 0,
            end: 0
        };
    }

    componentDidMount() {
        // Don't do anything until the video is ready
        this.video.current.addEventListener('loadeddata', this.onVideoLoad, false);
    }

    onVideoLoad() {
        const totalFrames = this.video.current.duration * this.props.fps;

        console.log('Video loaded with', totalFrames, 'frames across', this.video.current.duration, 'seconds');

        this.frames.total = totalFrames;
        this.frames.end = totalFrames;

        // TODO: Scale video to canvas
        this.canvas.current.width = 1280/2;
        this.canvas.current.height = 720/2;
        this.backbuffer.current.width = 1280/2;
        this.backbuffer.current.height = 720/2;

        // Frame draw tracking
        this.previousFrameTime = Date.now();
        this.previousFrame = -1;

        if (this.props.onReady) {
            this.props.onReady();
        }
    }

    /**
     * Continue video playback
     */
    play() {
        this.video.current.play();
        this.requestId = window.requestAnimationFrame(this.onAnimFrame);
    }

    /**
     * Return whether the video source is currently playing
     *
     * @return {boolean}
     */
    get playing() {
        return !this.video.current.paused && !this.video.current.ended;
    }

    /**
     * requestAnimationFrame handler to copy the video frame to our canvas
     *
     * This performs FPS limiting to only render at the speed of
     * the source video's framerate.
     */
    onAnimFrame() {
        const now = Date.now();
        const delta = now - this.previousFrameTime;
        const interval = 1000 / this.props.fps;

        this.requestId = window.requestAnimationFrame(this.onAnimFrame);

        if (delta > interval) {
            this.previousFrameTime = now - (delta % interval);
            this.drawCurrentFrame();
        }
    }

    /**
     * Copy the current video frame to our canvas.
     */
    drawCurrentFrame() {
        // TODO: Backbuffer shenanigans to handle scale/rotate/etc
        // and mixing with other renderables (pen tools and such)
        // Assuming that's here and not in a parent component.
        const context = this.canvas.current.getContext('2d');
        // const backbufferContext = this.backbuffer.current.getContext('2d');

        context.drawImage(this.video.current, 0, 0, 1280/2, 720/2);

        // If there's an event handler for frame changes, call it.
        if (this.frame !== this.previousFrame) {
            this.previousFrame = this.frame;
            if (this.props.onFrame) {
                this.props.onFrame(this.frame);
            }
        }
    }

    /**
     * Pause video playback
     */
    pause() {
        this.video.current.pause();
        // window.cancelAnimationFrame(this.requestId);
    }

    /**
     * Pause and skip ahead/behind the specified number of frames
     *
     * @param {integer} count number of frames to skip forward/back
     */
    skip(count) {
        this.frame = this.frame + count;
    }

    /**
     * Retrieve the start frame for playback clamping.
     *
     * Will be in range [0, endFrame)
     *
     * @return {integer}
     */
    get startFrame() {
        return this.frames.start;
    }

    /**
     * Set the start frame for playback clamping.
     *
     * Input value will be clamped to [0, endFrame)
     *
     * @param {integer} value
     */
    set startFrame(value) {
        this.frames.start = Math.max(
            0,
            Math.min(value, this.endFrame - 1)
        );
    }

    /**
     * Retrieve the end frame for playback clamping.
     *
     * Will be in range (startFrame, totalFrames]
     *
     * @return {integer}
     */
    get endFrame() {
        return this.frames.end;
    }

    /**
     * Set the end frame for playback clamping.
     *
     * Input value will be clamped to (startFrame, totalFrames]
     *
     * @param {integer} value
     */
    set endFrame(value) {
        this.frames.end = Math.max(
            this.startFrame + 1,
            Math.min(value, this.totalFrames)
        );
    }

    /**
     * Get the total number of frames in the video source
     *
     * @return {integer}
     */
    get totalFrames() {
        return this.frames.total;
    }

    /**
     * Retrieve the current frame number being rendered
     */
    get frame() {
        if (this.video.current) {
            return Math.round(this.video.current.currentTime * this.props.fps - 1);
        }

        return 0;
    }

    /**
     * Set the current frame to render
     *
     * Frame will be capped to range [startFrame, endFrame]
     */
    set frame(val) {
        const frame = this.clampFrame(val);
        this.video.current.currentTime = (frame + 1) / this.props.fps;
    }

    /**
     * Clamp the input frame to range [startFrame, endFrame]
     *
     * @return {integer} clamped frame
     */
    clampFrame(frame) {
        return Math.max(this.startFrame, Math.min(frame, this.endFrame));
    }

    render() {
        return (
            <div className="video">
                <div className="video-playback-controls">
                    <button onClick={this.play}>play</button>
                    <button onClick={this.pause}>pause</button>

                    <button onClick={() => this.skip(1)}>+1</button>
                    <button onClick={() => this.skip(-1)}>-1</button>
                    <button onClick={() => this.skip(5)}>+5</button>
                    <button onClick={() => this.skip(-5)}>-5</button>
                </div>

                <canvas ref={this.canvas} width="640" height="360"></canvas>
                <canvas ref={this.backbuffer} style={{ display: 'none' }}></canvas>

                <video ref={this.video} width="640" height="360" muted loop>
                    <source src="/timecode-2998fps.mp4" />
                </video>
            </div>
        );
    }
}

export default Video;
