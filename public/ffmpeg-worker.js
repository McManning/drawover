/*
    Web Worker that uses ffmpeg.js to extract frames from a region of a source video.

    TODO:
    - Report timing information with each event in stdout
    - Arguments for ffmpeg for the `job` event
    - Clear stdout/stderr sometimes

    Accepts the following events:

    -> Input Event
    <- Output Event

    <- Worker is ready to accept job requests
    {
        type: 'ready'
    }

    -> Load source file:
    {
        type: 'load',
        filename: 'movie.mp4',
        data: ArrayBuffer
    }
    <- File loaded and ready to start reading data
    {
        type: 'loaded'
    }

    -> Retrieve encoding information for the source file:
    {
        type: 'info'
    }
    <-
    {
        type: 'info',
        metadata: {
            width: Number,
            height: Number,
            fps: Number,
            tbr: Number
        }
        stdout: [string],
        stderr: [string]
    }

    -> Start a frame grab job for [start, start + total) frames:
    {
        type: 'job',
        start: Number,
        total: Number
    }
    <- Frame data for [start, end) frames:
    {
        type: 'frames',
        frames: [Blob],
        stdout: [string],
        stderr: [string]
    }
*/

importScripts('./vendor/ffmpeg-all-codecs.js');

// ffmpeg callables for output
var stdout = [];
var stderr = [];

function printStdout(text) {
    stdout.push(text);
}

function printStderr(text) {
    stderr.push(text);
}

// Current source video file this worker is operating on
var files = {};

// Memory usage limit for ffmpeg - must be a power of 2 (in bits)
var TOTAL_MEMORY = 268435456;

/**
 * Change our source file to a new video source
 *
 * @param {string} filename to help hint ffmpeg at format
 * @param {ArrayBuffer} arrayBuffer source video contents
 */
function loadSourceFile(filename, arrayBuffer) {
    files = [{
        name: filename,
        data: new Uint8Array(arrayBuffer)
    }];

    // TODO: Cancel current ffmpeg job (if possible?)

    postMessage({
        type: 'loaded'
    });
}

/**
 * Start a frame processing job for the range [startFrame, startFrame + totalFrames)
 *
 * Once the job has been completed, this will fire a `frames` event
 * back to listeners with the parsed out frame blobs.
 *
 * @param {Number} startFrame
 * @param {Number} totalFrames
 */
function startJob(startFrame, totalFrames) {
    var args = [
        '-ss', startFrame / 29.98, // '00:00:00.000', Second to start at (decimals for frame %)
        '-i', files[0].name,
        // '-vframes', '10',
        // '-vf', 'scale=120:-1',
        // '-f', 'image2',
        '-frames:v', Math.round(totalFrames), // Math.floor(TOTAL_SECONDS * 29.98), // '100',
        '-f', 'image2',
        '-an', '%d.jpeg'
    ];

    console.log(args, files);

    // TODO! Args!!!

    var result = ffmpeg_run({
        print: printStdout,
        printErr: printStderr,
        TOTAL_MEMORY: TOTAL_MEMORY,
        arguments: args,
        files: files
    });

    // TODO: Post-processing of results to map blobs to frame #'s

    postMessage({
        type: 'frames',
        frames: result,
        stdout: stdout,
        stderr: stderr
    });
}

/**
 * Report information about the input file
 *
 * Once the job has been completed, this will fire an `info`
 * event back to listeners with encoding information
 */
function reportInfo() {
    var args = [
        '-i', files[0].name,
        '-hide_banner'
    ];

    var result = ffmpeg_run({
        print: printStdout,
        printErr: printStderr,
        TOTAL_MEMORY: TOTAL_MEMORY,
        arguments: args,
        files: files
    });

    // TODO: Extract useful information from stdout

    postMessage({
        type: 'info',
        metadata: extractInfo(),
        stdout: stdout,
        stderr: stderr
    });
}

/**
 * Parse source info from stdout/stderr
 *
 * @return {object}
 */
function extractInfo() {
    const RE1 = /\s(?<width>\d+)x(?<height>\d+)\s.*,\s(?<fps>[0-9\.]+)\sfps.*\s(?<tbr>[0-9\.]+)\stbr/gm;
    let metadata = {};

    // `stderr` is used because it'll end up in that stream since reportInfo
    // doesn't specify an output file. But we get decoder info for the input.
    for (let i = 0; i < stderr.length; i++) {
        match = RE1.exec(stderr[i]);
        if (match) {
            metadata.width = parseFloat(match.groups.width, 10);
            metadata.height = parseFloat(match.groups.height, 10);
            metadata.fps = parseFloat(match.groups.fps, 10);
            metadata.tbr = parseFloat(match.groups.tbr, 10);
        }
    }

    return metadata;
}

/**
 * Handler for messages from the main thread.
 *
 * Accepts message types: `file`, `job`, and `info`
 */
onmessage = function (event) {
    var message = event.data;

    if (message.type === 'load') {
        loadSourceFile(message.filename, message.data);
    } else if (message.type === 'job') {
        startJob(message.start, message.total);
    } else if (message.type === 'info') {
        reportInfo();
    } else {
        console.error('Invalid worker message', message);
    }
};

// Fire off a ready message to let the host know we can start accepting commands
postMessage({
    type: 'ready'
});
