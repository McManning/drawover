
import React from 'react';

import Logger from './Log';
const log = new Logger('Video');

/**
 * Video playback canvas. Not to be confused with native <video>
 * (TODO: ...should probably rename this)
 *
 * <Video onFrame={callable} onReady={callback}
 *      fps="29.98" scale="1" rotate="0" translate={x: 0, y: 0} />
 *
 * `onReady` is fired once the media source has been fully loaded
 * `onFrame` callable gets the current frame number as an argument
 *
 * Supports frame caching (by way of being fed frames from an external source
 * such as an ffmpeg web worker or remote server)
 *
 * When this component has a cached version of a video frame, it will render
 * the cached frame before the original `video` element catches up - and then
 * replaces itself with the source frame once caught up. This allows
 * substantially faster scrubbing for video sources that may be complete
 * garbage at scrubbing in the browser otherwise (i.e.: everything).
 */
class Video extends React.Component {
    constructor(props) {
        super(props);

        this.onVideoLoad = this.onVideoLoad.bind(this);
        this.onVideoSeeked = this.onVideoSeeked.bind(this);
        this.onAnimFrame = this.onAnimFrame.bind(this);
        this.onImageLoad = this.onImageLoad.bind(this);

        this.video = React.createRef();
        this.canvas = React.createRef();
        this.backbuffer = React.createRef();
        this.image = React.createRef();

        // Canvas context
        this.context = null;
        this.backbufferContext = null;

        // State data not managed by React (need a faster response time here)
        this.frames = {
            total: 0,
            start: 0,
            end: 0
        };

        // Cached frame image URIs - by frame #
        this.frameCache = {};
        this.cacheFrameReady = false;
        this.videoFrameReady = false;
    }

    componentDidMount() {
        this.video.current.addEventListener('loadeddata', this.onVideoLoad, false);
        this.video.current.addEventListener('seeked', this.onVideoSeeked, false);

        this.image.current.addEventListener('load', this.onImageLoad, false);

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

        this.videoWidth = this.video.current.videoWidth;
        this.videoHeight = this.video.current.videoHeight;
        this.backbuffer.current.width = this.videoWidth * this.props.backbufferScale;
        this.backbuffer.current.height = this.videoHeight * this.props.backbufferScale;

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
     * On seek - update our canvas with the new frame, overriding
     * the cached frame that's possibly already rendered
     */
    onVideoSeeked() {
        this.videoFrameReady = true;
        this.drawCurrentFrame();
    }

    /**
     * Callback for when the cache frame <img> src finishes loading
     *
     * This will render the cached image to canvas immediately,
     * assuming the video source has not yet caught up.
     */
    onImageLoad() {
        this.cacheFrameReady = true;
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
     * This will also clear the cache of the previously loaded source
     *
     * @param {string} src data to load
     */
    load(src) {
        this.frameCache = {};
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
     *
     * If there is a cached frame ready to render and the video hasn't caught up,
     * the cached frame will render first. For testing, we'll render the cache
     * if it exists and ignore the video.
     */
    drawCurrentFrame() {
        const ctx = this.canvas.current.getContext('2d');
        // const backbufferContext = this.backbuffer.current.getContext('2d');

        // Draw the cached frame if we have it and no higher quality source
        // frame to draw (video still seeking)
        if (this.cacheFrameReady && !this.videoFrameReady) {
            ctx.drawImage(
                this.image.current,
                0,
                0,
                this.videoWidth,
                this.videoHeight
            );
        } else {
            ctx.drawImage(
                this.video.current,
                0,
                0,
                this.videoWidth,
                this.videoHeight
            );
        }

        // If there's an event handler for frame changes, call it.
        if (this.frame !== this.previousFrame) {
            this.previousFrame = this.frame;
            if (this.props.onFrame) {
                this.props.onFrame(this.frame);
            }

            // Frame change - and the video is caught up. Try to quickly add a local cache
            if (this.videoFrameReady) {
                if (!this.frameCache[this.frame]) {
                    // HACK: Temporary
                    // Just want to see perf stats across browsers
                    const backctx = this.backbuffer.current.getContext('2d');

                    backctx.drawImage(
                        this.video.current,
                        0,
                        0,
                        this.videoWidth * this.props.backbufferScale,
                        this.videoHeight * this.props.backbufferScale
                    );

                    this.frameCache[this.frame] = this.backbuffer.current.toDataURL('image/jpg');

                    this.props.onFrameCache(this.frame);
                }
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
     * Load a series of URIs as frame caches
     *
     * If the series is longer than `len(end - start)`, anything
     * outside that range will be discarded.
     *
     * Any existing cache will be overwritten by the new frames
     *
     * @param {Number} start frame number of the URIs
     * @param {Number} end frame number of the URIs
     * @param {array} frames series of URIs to cache, 0 indexed
     */
    cacheFrames(start, end, frames) {
        // TODO: Faster than this loop
        const len = Math.min(frames.length, end - start);

        for (let i = 0; i < len; i++) {
            this.frameCache[start + i] = frames[i];
        }

        // Dump results for debugging
        log.debug('frameCache', Object.keys(this.frameCache));
    }

    /**
     * Returns true if the given frame has been cached from any source
     *
     * @return {boolean}
     */
    isFrameCached(frame) {
        return this.frameCache[frame] !== undefined;
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
            return Math.round(this.video.current.currentTime * this.props.fps);
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
        this.video.current.currentTime = frame / this.props.fps;
        this.videoFrameReady = false;

        // If the frame is in our cache, load it into the worker <img>
        // and flag the engine to render that image once ready
        // if (this.isFrameCached(frame)) {
        //     this.image.current.src = this.frameCache[frame];
        //     this.cacheFrameReady = true;
        // }

        this.cacheFrameReady = this.isFrameCached(frame);
        if (this.cacheFrameReady) {
            this.image.current.src = this.frameCache[frame];
        }
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

                <div className="video-sources">
                    <div className="video-source">
                        <div className="video-source-label">Original Video</div>
                        <video className="video-source-render"
                            ref={this.video} muted loop
                        ></video>
                    </div>

                    <div className="video-source">
                        <div className="video-source-label">Frame Cache</div>
                        <img className="video-source-render" ref={this.image} />
                    </div>
                </div>
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
    rotate: 0,

    backbufferScale: 0.8
};

export default Video;
