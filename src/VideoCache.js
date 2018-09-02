
import React from 'react';

class VideoCache extends React.Component {
    constructor(props) {
        super(props);

        this.caching = false;
        this.cachingStartFrame = 0;
        this.cacheDistance = 0;

        // Matching frame #'s to data
        this.cachedBlobs = {};

        this.workers = [];

        this.state = {
            cacheCount: 0
        };
    }

    createWorkers() {
        let video;
        let canvas;

        for (let i = 0; i < this.props.workers; i++) {
            video = document.createElement('video');
            video.muted = true;
            canvas = document.createElement('canvas');

            video.addEventListener('loadeddata', () => this.onLoadedData(i));
            video.addEventListener('seeked', () => this.onSeeked(i));

            this.workers.push({
                video: video,
                canvas: canvas,

                working: false,
                startFrame: 0,
                nextFrame: 0,
                totalFrames: 0
            });
        }
    }

    onLoadedData(workerIndex) {
        const worker = this.workers[workerIndex];

        worker.canvas.width = worker.video.videoWidth;
        worker.canvas.height = worker.video.videoHeight;
        console.log('Worker', workerIndex, 'good to go');
    }

    onSeeked(workerIndex) {
        const worker = this.workers[workerIndex];
        const ctx = worker.canvas.getContext('2d');

        if (!worker.working) {
            return;
        }

        let frame = worker.nextFrame;

        if (!(frame in this.cachedBlobs)) {
            ctx.drawImage(worker.video, 0, 0);

            let that = this;
            worker.canvas.toBlob(function (blob) {
                that.cachedBlobs[frame] = blob;
                console.log(
                    'Worker', workerIndex, 'add blob for frame',
                    frame, 'bytes', blob.size
                );

                if (that.props.onCache) {
                    that.props.onCache(frame);
                }
            }, 'image/jpeg', 1.0);
        }

        // Skip over cached frames to find something to seek to next
        worker.nextFrame++;
        const endFrame = worker.startFrame + worker.totalFrames;

        while (true) {
            if (worker.nextFrame >= endFrame) {
                console.log('Worker', workerIndex, 'done');
                worker.working = false;
                return;
            }

            if (worker.nextFrame in this.cachedBlobs) {
                console.log('Worker', workerIndex, 'skip cached frame', worker.nextFrame);
                worker.nextFrame++;
            } else {
                break;
            }
        }

        worker.video.currentTime = (worker.nextFrame) / 29.98;
        console.log('Worker', workerIndex, 'set next', worker.nextFrame);
    }

    componentDidMount() {
        this.createWorkers();

        // this.video.addEventListener('loadeddata', () => {
        //     this.canvas.width = this.video.videoWidth;
        //     this.canvas.height = this.video.videoHeight;
        //     console.log('Good to go', this.canvas.width, this.canvas.height);
        // });

        // // Wait for seek to complete before we start caching playback
        // this.video.addEventListener('seeked', () => {
        //     let frame = this.nextFrame;
        //     console.log('New cache frame', frame);

        //     if (!(frame in this.cachedBlobs)) {
        //         // Draw frame and cache
        //         this.ctx.drawImage(this.video, 0, 0);

        //         let that = this;
        //         this.canvas.toBlob(function (blob) {
        //             that.cachedBlobs[frame] = blob;
        //             console.log('Added blob for frame', frame, 'bytes', blob.size);
        //             if (that.props.onCache) {
        //                 that.props.onCache(frame);
        //             }
        //         }, 'image/jpeg', 1.0);
        //     }

        //     // Skip over cached frames to find something to seek to next
        //     this.nextFrame++;
        //     while (this.nextFrame in this.cachedBlobs) {
        //         console.log('Already cached frame', this.nextFrame);
        //         this.nextFrame++;
        //     }

        //     // Seek too far forward? We're done.
        //     if (this.nextFrame >= this.cachingStartFrame + this.cacheDistance) {
        //         console.log('Done');
        //         this.caching = false;
        //         return;
        //     }

        //     this.video.currentTime = (this.nextFrame) / 29.98;
        //     console.log('Set next', this.nextFrame);
        // });
    }

    load(file) {
        this.workers.forEach((worker) => {
            worker.video.src = file;
        });
    }

    /**
     * Start caching frames outward from the given frame
     */
    cache(frame, distance) {
        // TODO: Queue up the rule until the previous finishes
        if (this.caching) {
            console.log('Waiting for previous cache to finish');
            return;
        }

        // Find available workers
        let available = [];
        this.workers.forEach((worker, index) => {
            if (!worker.working) {
                available.push(index);
            }
        });

        console.log('Available workers', available);

        if (!available.length) {
            console.log('No workers, dying');
            // TODO: Queue work
            return;
        }

        // Split the work into available workers
        const distancePerWorker = Math.floor(distance / available.length);
        const end = frame + distance;

        let start = frame;
        for (let i = 0; i < available.length - 1; i++) {
            this.work(i, start, distancePerWorker);
            start += distancePerWorker;
        }

        // last worker gets remaining frames
        this.work(available[available.length - 1], start, end - start);
    }

    work(workerIndex, startFrame, totalFrames) {
        const worker = this.workers[workerIndex];

        console.log('Worker', workerIndex, 'set startFrame', startFrame, 'totalFrames', totalFrames);

        let realStart = startFrame;
        let endFrame = startFrame + totalFrames;
        while (realStart < endFrame && realStart in this.cachedBlobs) {
            realStart++;
        }

        if (startFrame !== realStart) {
            console.log('Worker', workerIndex, 'fast forward to', realStart);
        }

        // If we already cached every frame this worker has to work on, we're done.
        if (realStart >= endFrame) {
            console.log('Worker', workerIndex, 'has nothing to do');
            return;
        }

        // TODO: It'd be smarter if we re-allocated the work elsewhere.
        // Or pre-scanned for frames we *need* to work on and distribute
        // just those instead.

        worker.working = true;
        worker.startFrame = startFrame;
        worker.totalFrames = totalFrames;
        worker.nextFrame = worker.startFrame;

        // stagger the actual start randomly to prevent
        // all workers from being fired at once (this is hacky
        // and incredibly gross :D)

        // TODO: workers shouldn't even start if they're on
        // a range that doesn't need to be cached. Start on
        // the first unresolved frame only.
        setTimeout(() => worker.video.currentTime = (startFrame) / 29.98, workerIndex * 100);

        // Skip the source video to the selected frame and start working
        // worker.video.currentTime = (startFrame) / 29.98;
    }

    /**
     * @param {Number} frame
     *
     * @return {boolean}
     */
    isCached(frame) {
        return frame in this.cachedBlobs;
    }

    render() {
        // Serialize and dump each frame as an image super inefficiently for debugging
        // const images = Object.keys(this.cachedBlobs).map((frame) => {
        //     const content = URL.createObjectURL(this.cachedBlobs[frame]);
        //     return (
        //         <span style={{position: 'relative'}}>
        //             <img src={content} style={{width: '300px', height: 'auto'}} />
        //             <span style={{position: 'absolute', left: 0, background: '#ffd9d9'}}>
        //                 {frame}
        //             </span>
        //         </span>
        //     );
        // });

        return (
            <div className="video-cache">
                Running {this.props.workers} Worker Videos
            </div>
        );
    }
}

VideoCache.defaultProps = {
    workers: 1
}

export default VideoCache;
