
import Logger from './Logger';
const log = new Logger('WorkerPool');

type OnVideoMetadataDelegate = (metadata: any) => void;
type OnRenderFramesDelegate = (start: number, end: number, frames: any[]) => void;

// TODO: Bunch more work needed here. readyWorkers never has workers
// removed from it and re-added after a job is completed. 

// TODO: this.totalReady is just a duplicate of .readyWorkers.size 

/**
 * WorkerPool manages a collection of WebWorkers for background data processing.
 *
 * `onMetadata` is called after a new source file is loaded via `load` with
 * metadata about the source file (fps, encoding, etc). Argument is an object
 * that contains keys width, height, fps, tbr
 *
 * `onFrames` is called once a worker has generated one or more frame images
 * TODO: Arguments?
 */
class WorkerPool {
    static WEBWORKER_SCRIPT = 'ffmpeg-worker.js';

    public onMetadata?: OnVideoMetadataDelegate;
    public onFrames?: OnRenderFramesDelegate;

    private totalWorkers: number;

    private workers = new Set<Worker>();
    private readyWorkers = new Set<Worker>();

    private waitingToPostInfo = false;
    private metadata: any = {};

    private totalReady: number = 0;

    constructor(workers: number = 2) {
        log.info('hello', module);

        this.totalWorkers = workers;
        this.startWebWorkers();
    }

    /**
     * Spin up web worker threads up to `props.workers` size.
     *
     * Note that worker count only goes up, not down.
     */
    private startWebWorkers() {
        while (this.workers.size < this.totalWorkers) {
            this.addWebWorker();
        }
    }

    /**
     * Add a new Web Worker to our pool
     */
    private addWebWorker() {
        const worker = new Worker(WorkerPool.WEBWORKER_SCRIPT);
        
        worker.onmessage = (e) => this.onWorkerMessage(worker, e);
        worker.onerror = (e) => this.onWorkerError(worker, e);

        this.workers.add(worker);
    }

    /**
     * Provide a new source file to every worker to operate on
     */
    public load(file: File) {
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
     */
    private onWorkerMessage(worker: Worker, event: MessageEvent) {
        const message = event.data;
        log.info('Web Worker Message', worker, message);

        switch (message.type) {
            case 'ready':
                this.onWorkerReady(worker);
                break;
            case 'loaded':
                this.onWorkerLoaded(worker);
                break;
            case 'info':
                this.onWorkerInfo(worker, message);
                break;
            case 'frames':
                this.onWorkerFrames(worker, message);
                break;
            default:
                log.error('Unknown Web Worker Message', worker, message);
                break;
        }
    }

    /**
     * Web Worker ran into an error
     */
    private onWorkerError(worker: Worker, err: ErrorEvent) {
        log.error('Web Worker Error', worker, err);
    }

    /**
     * Web Worker is ready to start receiving commands
     */
    private onWorkerReady(worker: Worker) {
        this.readyWorkers.add(worker);

        // Count the number of ready workers at this point
        let count = 0;
        this.workers.forEach((worker) => {
            if (this.readyWorkers.has(worker)) {
                count++;
            }
        });

        this.totalReady = count;
    }

    /**
     * Worker fired a 'loaded' event, indicating that a source video is ready
     *
     * The first worker to load a source video will try to load additional
     * information about the source (fps, encoding, etc).
     */
    private onWorkerLoaded(worker: Worker) {
        if (this.waitingToPostInfo) {
            this.waitingToPostInfo = false;
            worker.postMessage({
                type: 'info'
            });
        }
        // TODO: Remove the worker from the ready pool
    }

    /**
     * Worker fired an `info` event - notify `onMetadata` listener
     *
     * @param {Worker} worker
     * @param {object} message
     */
    private onWorkerInfo(worker: Worker, message: any) {
        this.metadata = message.metadata;

        if (this.onMetadata) {
            this.onMetadata(message.metadata);
        }
    }

    /**
     * Worker fired a `frames` event - notify `onFrames` listener
     */
    private onWorkerFrames(worker: Worker, message: any) {
        if (this.onFrames) {
            this.onFrames(
                message.start,
                message.end,
                message.frames
            );
        }
    }

    /**
     * Get worker that aren't processing data
     *
     * @return {array} of worker instances
     */
    private getIdleWorkers(): Worker[] {
        const idle: Worker[] = [];

        this.workers.forEach((worker) => {
            if (this.readyWorkers.has(worker)) {
                idle.push(worker);
            }
        });

        return idle;
    }

    /**
     * Returns true if one or more workers are still not ready
     * (Happens when the browser is slow to start up new Web Worker threads)
     */
    public isWarmingUp(): boolean {
        return this.readyWorkers.size !== this.workers.size;
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
    public extractFrames(frame: number, distance: number, skip: number[]) {
        const idle = this.getIdleWorkers();

        log.info('Available workers', idle);

        if (idle.length < 2) {
            log.warning('Needs two idle workers, and no queue process yet. Quitting');
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

        // in general - check if frames are already processed. Because if so - skip work.

        const workPerThread = distance * 2 / idle.length;

        for (let i = 0; i < idle.length; i++) {
            const start = Math.floor(frame - distance + (workPerThread * i));
            const end = Math.floor(start + workPerThread + 1);
            console.log('Worker', i, 'Range', start, 'to', end);

            idle[i].postMessage({
                type: 'job',
                metadata: this.metadata,
                start: start,
                end: end
            });
        }

        // idle[0].postMessage({
        //     type: 'job',
        //     metadata: this.metadata,
        //     start: Math.floor(iframe - distance),
        //     end: Math.floor(iframe)
        // });

        // idle[1].postMessage({
        //     type: 'job',
        //     metadata: this.metadata,
        //     start: Math.floor(iframe),
        //     end: Math.floor(iframe + distance)
        // });
    }
}

export default WorkerPool;
