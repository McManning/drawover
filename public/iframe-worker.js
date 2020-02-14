
totalWorkers = 5;

workers = [];
cachedBlobs = {};

function onCache(frame) {
    // TODO: event to host frame, somehow?
    console.log('Cached frame', frame);
}

function onLoadedData(workerIndex) {
    const worker = workers[workerIndex];

    worker.canvas.width = worker.video.videoWidth;
    worker.canvas.height = worker.video.videoHeight;
    console.log('Worker', workerIndex, 'good to go');
}

function onSeeked(workerIndex) {
    const worker = workers[workerIndex];
    const ctx = worker.canvas.getContext('2d');

    if (!worker.working) {
        return;
    }

    let frame = worker.nextFrame;

    if (!(frame in this.cachedBlobs)) {
        ctx.drawImage(worker.video, 0, 0);

        let that = this;
        worker.canvas.toBlob(function (blob) {
            cachedBlobs[frame] = blob;
            console.log(
                'Worker', workerIndex, 'add blob for frame',
                frame, 'bytes', blob.size
            );

            onCache(frame);
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

        if (worker.nextFrame in cachedBlobs) {
            console.log('Worker', workerIndex, 'skip cached frame', worker.nextFrame);
            worker.nextFrame++;
        } else {
            break;
        }
    }

    worker.video.currentTime = (worker.nextFrame) / 29.98;
    console.log('Worker', workerIndex, 'set next', worker.nextFrame);
}

function setupWorkers() {
    for (let i = 0; i < totalWorkers; i++) {
        video = document.createElement('video');
        video.muted = true;
        canvas = document.createElement('canvas');

        video.addEventListener('loadeddata', () => onLoadedData(i));
        video.addEventListener('seeked', () => onSeeked(i));

        workers.push({
            video: video,
            canvas: canvas,

            working: false,
            startFrame: 0,
            nextFrame: 0,
            totalFrames: 0
        });

        console.log('FRAME Worker', i, 'good to go');
    }
}

function load(file) {
    workers.forEach((worker) => {
        worker.video.src = file;
    });
}

/**
 * Start caching frames outward from the given frame
 */
function cache(frame, distance) {
    const iframe = parseInt(frame, 10);

    // Find available workers
    let available = [];
    workers.forEach((worker, index) => {
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
    const end = iframe + distance;

    let start = iframe;
    for (let i = 0; i < available.length - 1; i++) {
        work(i, start, distancePerWorker);
        start += distancePerWorker;
    }

    // last worker gets remaining frames
   work(available[available.length - 1], start, end - start);
}

function work(workerIndex, startFrame, totalFrames) {
    const worker = workers[workerIndex];

    console.log('Worker', workerIndex, 'set startFrame', startFrame, 'totalFrames', totalFrames);

    let realStart = startFrame;
    let endFrame = startFrame + totalFrames;
    while (realStart < endFrame && realStart in cachedBlobs) {
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
    // setTimeout(() => worker.video.currentTime = (startFrame) / 29.98, workerIndex * 100);

    // Skip the source video to the selected frame and start working
    worker.video.currentTime = (startFrame) / 29.98;
}

setupWorkers();
