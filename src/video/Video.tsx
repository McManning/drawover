
import React, { Component, createRef } from 'react';

import Transform from '../utility/Transform';

import './Video.scss';

import Logger from '../utility/Logger';
const log = new Logger('Video');

/**
 * Mapping between frame #'s and an image data URI representing that frame
 */
type FrameCache = {
    [frame: number]: string;
};

type Props = {
    fps: number;
    width: number;
    height: number;
    transform: Transform;

    backbufferScale: number;
    showSources: boolean;

    onReady?(): void;
    onFrame?(frame: number): void;
};

type State = {

};

/**
 * Video playback canvas
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
export default class Video extends Component<Props, State> {
    static defaultProps: Props = {    
        fps: 29.98,
        width: 720,
        height: 480,

        transform: new Transform(),

        backbufferScale: 0.8,

        showSources: false
    };

    private video = createRef<HTMLVideoElement>();
    private canvas = createRef<HTMLCanvasElement>();
    private backbuffer = createRef<HTMLCanvasElement>();
    private image = createRef<HTMLImageElement>();

    private frames = {
        total: 0,
        start: 0,
        end: 0
    };

    // Cached frame image URIs - by frame #
    private frameCache: FrameCache = {};

    private cacheFrameReady: boolean = false;
    private videoFrameReady: boolean = false;

    private videoWidth: number = 0;
    private videoHeight: number = 0;
    
    private previousFrameTime: number = 0;
    private previousFrame: number = 0;

    /**
     * requestAnimationFrame handle
     */
    private requestId: number = 0;

    constructor(props: Props) {
        super(props);

        this.onVideoLoad = this.onVideoLoad.bind(this);
        this.onVideoSeeked = this.onVideoSeeked.bind(this);
        this.onAnimFrame = this.onAnimFrame.bind(this);
        this.onImageLoad = this.onImageLoad.bind(this);
    }

    componentDidMount() {
        this.video.current?.addEventListener('loadeddata', this.onVideoLoad, false);
        this.video.current?.addEventListener('seeked', this.onVideoSeeked, false);    

        this.image.current?.addEventListener('load', this.onImageLoad, false);

        // Set initial canvas transformation from props
        this.transform(this.props.transform);
    }

    /**
     * Watch for component prop updates to update canvas transformation
     */
    componentDidUpdate(prevProps: Props, prevState: State) {
        if (!this.props.transform.equals(prevProps.transform)) {
            this.transform(this.props.transform);
        }
    }

    private onVideoLoad() {
        const video = this.video.current;
        const backbuffer = this.backbuffer.current;
        if (video === null || backbuffer === null) {
            log.error('onVideoLoad called without instantiated refs');
            return;
        }

        const totalFrames = video.duration * this.props.fps;
        log.debug(`Video loaded with ${totalFrames} frames across ${video.duration} seconds`);
        
        this.frames.total = totalFrames;
        this.frames.end = totalFrames;

        this.videoWidth = video.videoWidth;
        this.videoHeight = video.videoHeight;
        backbuffer.width = this.videoWidth * this.props.backbufferScale;
        backbuffer.height = this.videoHeight * this.props.backbufferScale;

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
    private onVideoSeeked() {
        this.videoFrameReady = true;
        this.drawCurrentFrame();
    }

    /**
     * Callback for when the cache frame <img> src finishes loading
     *
     * This will render the cached image to canvas immediately,
     * assuming the video source has not yet caught up.
     */
    private onImageLoad() {
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
    public canLoad(file: File): boolean {
        // Maybe? Probably? Thanks canPlayType 
        return this.video.current?.canPlayType(file.type) !== undefined;
    }

    /**
     * Load a new source to be played
     *
     * This will also clear the cache of the previously loaded source
     */
    public load(src: string) {
        if (!this.video.current) {
            log.error('Tried to call load() without a video ref');
            return;
        }

        this.frameCache = {};
        this.video.current.src = src;
    }

    /**
     * Continue video playback
     */
    public play() {
        if (!this.video.current) {
            log.error('Tried to call play() without a video ref');
            return;
        }

        this.video.current.play();
        this.requestId = window.requestAnimationFrame(this.onAnimFrame);
    }

    /**
     * Pause video playback
     */
    public pause() {
        if (!this.video.current) {
            log.error('Tried to call pause() without a video ref');
            return;
        }

        this.video.current.pause();
        window.cancelAnimationFrame(this.requestId);
    }

    /**
     * Return whether the video source is currently playing
     */
    public isPlaying(): boolean {
        if (!this.video.current) {
            log.error('Tried to call isPlaying() without a video ref');
            return false;
        }

        return !this.video.current.paused && !this.video.current.ended;
    }

    /**
     * requestAnimationFrame handler to copy the video frame to our canvas
     *
     * This performs FPS limiting to only render at the speed of
     * the source video's framerate.
     */
    private onAnimFrame() {
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
     */
    private transform(transform: Transform) {
        const ctx = this.canvas.current?.getContext('2d');
        if (!ctx) {
            log.error('Tried to transform() without a canvas context');
            return;
        }

        // Reset transformation
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Apply transformations to the canvas
        ctx.translate(transform.translate.x, transform.translate.y);
        ctx.scale(transform.scale, transform.scale);
        ctx.rotate(transform.rotate);

        // Redraw
        this.clearCanvas();
        this.drawCurrentFrame();
    }

    /**
     * Clear video content from the canvas
     */
    private clearCanvas() {
        const canvas = this.canvas.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) {
            log.error('Tried to clearCanvas() without a canvas context');
            return;
        }
        
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    /**
     * Copy the current video frame to our canvas.
     *
     * If there is a cached frame ready to render and the video hasn't caught up,
     * the cached frame will render first. For testing, we'll render the cache
     * if it exists and ignore the video.
     */
    private drawCurrentFrame() {
        const ctx = this.canvas.current?.getContext('2d');
        const image = this.image.current;
        const video = this.video.current;
        // const backbufferContext = this.backbuffer.current.getContext('2d');

        if (!ctx || !image || !video) {
            log.error('Tried to drawCurrentFrame() without required refs');
            return;
        }

        // Draw the cached frame if we have it and no higher quality source
        // frame to draw (video still seeking)
        if (this.cacheFrameReady && !this.videoFrameReady) {
            ctx.drawImage(
                image,
                0,
                0,
                this.videoWidth,
                this.videoHeight
            );
        } else {
            ctx.drawImage(
                video,
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
           /* if (this.videoFrameReady) {
                if (!this.frameCache[this.frame]) {
                    // HACK: Temporary
                    // Just want to see perf stats across browsers
                    // const backctx = this.backbuffer.current.getContext('2d');

                    // backctx.drawImage(
                    //     this.video.current,
                    //     0,
                    //     0,
                    //     this.videoWidth * this.props.backbufferScale,
                    //     this.videoHeight * this.props.backbufferScale
                    // );

                    // this.frameCache[this.frame] = this.backbuffer.current.toDataURL('image/jpg');

                    // this.props.onFrameCache(this.frame);
                }
            }*/
        }
    }

    /**
     * Skip ahead/behind the specified number of frames
     */
    public skip(frames: number) {
        this.frame = this.frame + frames;
    }

    /**
     * Load a series of image data URIs as frame caches
     *
     * If the series is longer than `len(end - start)`, anything
     * outside that range will be discarded.
     *
     * Any existing cache will be overwritten by the new frames
     */
    private cacheFrames(start: number, end: number, frames: string[]) {
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
     */
    public isFrameCached(frame: number): boolean {
        return this.frameCache[frame] !== undefined;
    }

    /**
     * Retrieve the start frame for playback clamping.
     *
     * Will be in range [0, endFrame)
     */
    public get startFrame(): number {
        return this.frames.start;
    }

    /**
     * Set the start frame for playback clamping.
     *
     * Input value will be clamped to [0, endFrame)
     */
    public set startFrame(value: number) {
        this.frames.start = Math.max(
            0,
            Math.min(value, this.endFrame - 1)
        );
    }

    /**
     * Retrieve the end frame for playback clamping.
     *
     * Will be in range (startFrame, totalFrames]
     */
    public get endFrame(): number {
        return this.frames.end;
    }

    /**
     * Set the end frame for playback clamping.
     *
     * Input value will be clamped to (startFrame, totalFrames]
     */
    public set endFrame(value: number) {
        this.frames.end = Math.max(
            this.startFrame + 1,
            Math.min(value, this.totalFrames)
        );
    }

    /**
     * Get the total number of frames in the video source
     */
    public get totalFrames(): number {
        return this.frames.total;
    }

    /**
     * Retrieve the current frame number being rendered
     */
    public get frame(): number {
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
    public set frame(value: number) {
        const video = this.video.current;
        if (!video) {
            log.error('Tried to set frame() without a video ref');
            return;
        }

        const frame = this.clampFrame(value);
        video.currentTime = frame / this.props.fps;
        this.videoFrameReady = false;

        // If the frame is in our cache, load it into the worker <img>
        // and flag the engine to render that image once ready
        // if (this.isFrameCached(frame)) {
        //     this.image.current.src = this.frameCache[frame];
        //     this.cacheFrameReady = true;
        // }

        this.cacheFrameReady = this.isFrameCached(frame);
        if (this.cacheFrameReady && this.image.current) {
            this.image.current.src = this.frameCache[frame];
        }
    }

    public get speed(): number {
        const video = this.video.current;
        if (!video) {
            log.error('Tried to get speed() without a video ref');
            return 0;
        }

        return video.playbackRate;
    }

    public set speed(val: number) {
        const video = this.video.current;
        if (!video) {
            log.error('Tried to set speed() without a video ref');
            return;
        }

        video.playbackRate = val;
    }

    /**
     * Clamp the input frame to range [startFrame, endFrame]
     */
    private clampFrame(frame: number): number {
        return Math.max(this.startFrame, Math.min(frame, this.endFrame));
    }

    render() {
        let sourcesDisplay = 'none';
        if (this.props.showSources) {
            sourcesDisplay = 'block';
        }

        return (
            <div className="video">
                <canvas ref={this.canvas}
                    width={this.props.width} height={this.props.height}
                ></canvas>

                <canvas ref={this.backbuffer} style={{ display: 'none' }}></canvas>

                <div className="video-sources" style={{ display: sourcesDisplay }}>
                    <div className="video-source">
                        <div className="video-source-label">Original Video</div>
                        <video className="video-source-render"
                            ref={this.video} muted loop
                        ></video>
                    </div>

                    <div className="video-source">
                        <div className="video-source-label">Frame Cache</div>
                        <img alt="frame" className="video-source-render" ref={this.image} />
                    </div>
                </div>
            </div>
        );
    }
}
