
import React from 'react';

/**
 * Video playback canvas. Not to be confused with native <video>
 * (TODO: ...should probably rename this)
 *
 * <Video onFrame={callable} onReady={callback}
 *      fps="29.98" scale="1" rotate="0" translate={x: 0, y: 0} />
 *
 * `onReady` is fired once the media source has been fully loaded
 * `onFrame` callable gets the current frame number as an argument
 */
class Video extends React.Component {
    constructor(props) {
        super(props);

        this.onVideoLoad = this.onVideoLoad.bind(this);
        this.onVideoSeeked = this.onVideoSeeked.bind(this);
        this.onAnimFrame = this.onAnimFrame.bind(this);

        this.video = React.createRef();
        this.canvas = React.createRef();
        this.backbuffer = React.createRef();

        // Canvas context
        this.context = null;
        this.backbufferContext = null;

        // State data not managed by React (need a faster response time here)
        this.frames = {
            total: 0,
            start: 0,
            end: 0
        };
    }

    componentDidMount() {
        // Don't do anything until the video is ready
        this.video.current.addEventListener('loadeddata', this.onVideoLoad, false);
        this.video.current.addEventListener('seeked', this.onVideoSeeked, false);

        // Set initial canvas transformation from props
        this.transform(
            this.props.translate,
            this.props.scale,
            this.props.rotate
        );
    }

    /**
     * Watch for component prop updates to update canvas transformation
     */
    componentDidUpdate(prevProps, prevState) {
        // If any of the transformation props change, re-transform
        if (prevProps.translate.x !== this.props.translate.x ||
            prevProps.translate.y !== this.props.translate.y ||
            prevProps.scale !== this.props.scale ||
            prevProps.rotate !== this.props.rotate
        ) {
            this.transform(
                this.props.translate,
                this.props.scale,
                this.props.rotate
            );
        }
    }

    onVideoLoad() {
        const totalFrames = this.video.current.duration * this.props.fps;

        console.log('Video loaded with', totalFrames, 'frames across', this.video.current.duration, 'seconds');

        this.frames.total = totalFrames;
        this.frames.end = totalFrames;

        // Frame draw tracking
        this.previousFrameTime = Date.now();
        this.previousFrame = -1;
        this.frame = 0;

        // Draw the first frame
        this.clearCanvas();
        this.drawCurrentFrame();

        // Notify listeners
        if (this.props.onReady) {
            this.props.onReady();
        }
    }

    /**
     * On seek - update our canvas with the new frame
     */
    onVideoSeeked() {
        this.drawCurrentFrame();
    }

    /**
     * Test if the given file resource can be loadable
     *
     * @param {File} file data to test
     *
     * @return {boolean}
     */
    canLoad(file) {
        return this.video.current.canPlayType(file.type);
    }

    /**
     * Load a new source to be played
     *
     * @param {string} src data to load
     */
    load(src) {
        this.video.current.src = src;
    }

    /**
     * Continue video playback
     */
    play() {
        this.video.current.play();
        this.requestId = window.requestAnimationFrame(this.onAnimFrame);
    }

    /**
     * Pause video playback
     */
    pause() {
        this.video.current.pause();
        window.cancelAnimationFrame(this.requestId);
    }

    /**
     * Return whether the video source is currently playing
     *
     * @return {boolean}
     */
    isPlaying() {
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

            // Clamp playback between start & end frame range, looping
            // whenever we run past the end frame.
            if (this.frame < this.startFrame || this.frame > this.endFrame) {
                this.frame = this.startFrame;
            }
        }
    }

    /**
     * Apply a transformation to the canvas render of the video
     *
     * @param {object} translate {x, y} coordinate pair
     * @param {float} scale
     * @param {float} rotate
     */
    transform(translate, scale, rotate) {
        const ctx = this.canvas.current.getContext('2d');

        // Reset transformation
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Apply transformations to the canvas
        ctx.translate(translate.x, translate.y);
        ctx.scale(scale, scale);
        ctx.rotate(rotate);

        // Redraw
        this.clearCanvas();
        this.drawCurrentFrame();
    }

    /**
     * Clear video content from the canvas
     */
    clearCanvas() {
        const ctx = this.canvas.current.getContext('2d');

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.current.width, this.canvas.current.height);
        ctx.restore();
    }

    /**
     * Copy the current video frame to our canvas.
     */
    drawCurrentFrame() {
        const ctx = this.canvas.current.getContext('2d');
        // const backbufferContext = this.backbuffer.current.getContext('2d');

        ctx.drawImage(
            this.video.current,
            0,
            0,
            this.video.current.videoWidth,
            this.video.current.videoHeight
        );

        // If there's an event handler for frame changes, call it.
        if (this.frame !== this.previousFrame) {
            this.previousFrame = this.frame;
            if (this.props.onFrame) {
                this.props.onFrame(this.frame);
            }
        }
    }

    /**
     * Skip ahead/behind the specified number of frames
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
     * Set the current frame to render and redraw
     *
     * Frame will be capped to range [startFrame, endFrame]
     */
    set frame(val) {
        const frame = this.clampFrame(val);
        this.video.current.currentTime = (frame + 1) / this.props.fps;
    }

    get speed() {
        return this.video.current.playbackRate;
    }

    set speed(val) {
        this.video.current.playbackRate = val;
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
                <canvas ref={this.canvas}
                    width={this.props.width} height={this.props.height}
                ></canvas>

                <canvas ref={this.backbuffer} style={{ display: 'none' }}></canvas>

                <video ref={this.video}
                    width={this.props.width} height={this.props.height}
                    muted loop
                ></video>
            </div>
        );
    }
}

Video.defaultProps = {
    fps: 29.98,
    width: 720,
    height: 480,

    translate: {
        x: 0,
        y: 0
    },
    scale: 1,
    rotate: 0
};

export default Video;
