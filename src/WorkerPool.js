
import React from 'react';

import Logger from './Log';
const log = new Logger('WorkerPool');

/**
 * WorkerPool manages a collection of WebWorkers for background data processing.
 *
 * <WorkerPool workers={Number} onMetadata={callable} onFrames={callable} />
 *
 * `onMetadata` is called after a new source file is loaded via `load` with
 * metadata about the source file (fps, encoding, etc). Argument is an object
 * that contains keys width, height, fps, tbr
 *
 * `onFrames` is called once a worker has generated one or more frame images
 * TODO: Arguments?
 */
class WorkerPool extends React.Component {
    static WEBWORKER_SCRIPT = 'ffmpeg-worker.js';

    constructor(props) {
        super(props);

        this.workers = [];
        this.waitingToPostInfo = false;

        log.info('hello', module);
    }

    componentDidMount() {
        this.startWebWorkers();
    }

    /**
     * Spin up the desired number of Web Workers and prep them to recieve jobs
     */
    startWebWorkers() {
        for (let i = 0; i < this.props.workers; i++) {
            this.addWebWorker();
        }
    }

    /**
     * Add a new Web Worker to our pool
     */
    addWebWorker() {
        const worker = new Worker(WorkerPool.WEBWORKER_SCRIPT);
        worker.ready = false;
        worker.working = false;

        worker.onmessage = (e) => this.onWorkerMessage(worker, e);
        worker.onerror = (e) => this.onWorkerError(worker, e);

        this.workers.push(worker);
    }

    /**
     * Provide a new source file to every worker to operate on
     *
     * @param {File} file
     */
    load(file) {
        const workers = this.workers;
        const filename = file.name;

        const reader = new FileReader();
        reader.onload = function () {
            workers.forEach((worker) => {
                worker.postMessage({
                    type: 'load',
                    filename: filename,
                    data: this.result
                });
            });
        };

        reader.readAsArrayBuffer(file);

        // TODO: Better handle workers that are in the middle of work.
        // Maybe queue this up and wait until all workers are idle.

        this.waitingToPostInfo = true;
    }

    /**
     * Message posted from one of the Web Workers
     *
     * This will delegate to one of the other onWorker* methods based on message type
     *
     * @param {Worker} worker
     * @param {object} event
     */
    onWorkerMessage(worker, event) {
        const message = event.data;
        console.log('[WorkerPool] Message', worker, message);

        // TODO: Less of a switch?
        switch (message.type) {
            case 'ready':
                this.onWorkerReady(worker, message);
                break;
            case 'loaded':
                this.onWorkerLoaded(worker, message);
                break;
            case 'info':
                this.onWorkerInfo(worker, message);
                break;
            case 'frames':
                this.onWorkerFrames(worker, message);
                break;
            default:
                console.error('Unknown message from worker', worker, message);
        }
    }

    /**
     * Web Worker ran into an error
     *
     * @param {Worker} worker
     */
    onWorkerError(worker) {
        console.error(arguments);
        alert('Error that we do not handle yet!');
    }

    /**
     * Web Worker is ready to start receiving commands
     *
     * @param {Worker} worker
     */
    onWorkerReady(worker) {
        worker.ready = true;
    }

    /**
     * Worker fired a 'loaded' event, indicating that a source video is ready
     *
     * The first worker to load a source video will try to load additional
     * information about the source (fps, encoding, etc).
     *
     * @param {Worker} worker
     */
    onWorkerLoaded(worker) {
        if (this.waitingToPostInfo) {
            this.waitingToPostInfo = false;
            worker.postMessage({
                type: 'info'
            });
        }
    }

    /**
     * Worker fired an `info` event - notify `onMetadata` listener
     *
     * @param {Worker} worker
     * @param {object} message
     */
    onWorkerInfo(worker, message) {
        if (this.props.onMetadata) {
            this.props.onMetadata(message.metadata);
        }
    }

    /**
     * Worker fired a `frames` event - notify `onFrames` listener
     *
     * @param {Worker} worker
     * @param {object} message
     */
    onWorkerFrames(worker, message) {
        if (this.props.onFrames) {
            this.props.onFrames(message.frames);
        }
    }

    /**
     * Get worker that aren't processing data
     *
     * @return {array} of worker instances
     */
    getIdleWorkers() {
        const idle = [];

        this.workers.forEach((worker) => {
            if (!worker.working && worker.ready) {
                idle.push(worker);
            }
        });

        return idle;
    }

    /**
     * Returns true if one or more workers are still not ready
     * (Happens when the browser is slow to start up new Web Worker threads)
     *
     * @return {boolean}
     */
    isWarmingUp() {
        for (let i = 0; i < this.workers.length; i++) {
            if (!this.workers[i].ready) {
                return true;
            }
        }

        return false;
    }

    /**
     * Start retrieving frames outward from the given frame
     *
     * Will execute `onFrames` with batches of frame images generated by the worker threads
     *
     * @param {Number} frame    Frame number to center the caching behavior on
     *
     * @param {Number} distance Number of frames in both directions of the given frame to cache.
     *                          If there are not enough frames in either direction of the given
     *                          frame, this will shift the frames over to still attempt to cache
     *                          the same amount.
     *
     * @param {array} skip      Frame IDs to ignore when assigning out frames to workers.
     *                          Note that it is NOT GUARANTEED that these frames will be skipped
     *                          by all workers - some may be returned by onFrames if they are between
     *                          other unskipped frames.
     */
    extractFrames(frame, distance, skip) {
        const iframe = parseInt(frame, 10);
        const idle = this.getIdleWorkers();

        console.log('Available workers', idle);

        if (idle.length < 2) {
            console.warn('Needs two idle workers, and no queue process yet. Quitting');
            // TODO: Queue work
            return;
        }

        // Lazy version (which might end up being the fastest)
        // first worker will work forward: (frame, frame + distance]
        // second worker will work backward: (frame - distance, frame]
        // Hopefully, ignoring "spin up" time for ffmpeg to load a media file,
        // the actual frame processing is fast enough to avoid adding more workers.
        // This way - a 2 core CPU is sufficient (assuming the browser distributes
        // worker threads across cores)

        // Both workers will ignore skip for now, but it'd make sense as a minor optimization
        // if skip was checked to see if we can just skip a worker altogether (e.g. everything
        // before `frame` was cached, so don't run idle[0])
        idle[0].postMessage({
            type: 'job',
            start: Math.floor(iframe - distance),
            total: Math.floor(iframe)
        });

        idle[1].postMessage({
            type: 'job',
            start: Math.floor(iframe),
            total: Math.floor(iframe + distance)
        });
    }

    render() {
        return (
            <div className="worker-pool">
                Running {this.props.workers} Worker Threads
            </div>
        );
    }
}

WorkerPool.defaultProps = {
    workers: 2
};

export default WorkerPool;
