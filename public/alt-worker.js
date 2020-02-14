

/*

Via: https://stackoverflow.com/questions/10957412/fastest-way-to-extract-frames-using-ffmpeg

Splitting up the ffmpeg call to seek and extract.

    time for i in {0..39} ; do ffmpeg -accurate_seek -ss `echo $i*60.0 | bc` -i input.mp4   -frames:v 1 period_down_$i.bmp ; done


    Would that be faster than asking ffmpeg to iterate through the whole video? Probably not - if it needs to open (parse)
    the stream every time we start up the process...
*/


importScripts('./vendor/ffmpeg-all-codecs.js');

var now = Date.now;

function print(text) {
    return;

    postMessage({
        'type' : 'stdout',
        'data' : text
    });
}

onmessage = function(event) {
    var message = event.data;

    var Module = {
        print: print,
        printErr: print,
        files: message.files || [],
        TOTAL_MEMORY: 268435456
        // Can play around with this option - must be a power of 2
        // TOTAL_MEMORY: 268435456
    };

    postMessage({
        'type' : 'start',
        // 'data' : Module.arguments.join(" ")
    });

    postMessage({
      'type' : 'stdout',
      'data' : 'Received command (dont care) ' +
                // Module.arguments.join(" ") +
                ((Module.TOTAL_MEMORY) ? ".  Processing with " + Module.TOTAL_MEMORY + " bits." : "")
    });

    var time = now();

    var results = [];

    // 100 frame extraction split

    var seconds = 10; // how big a range to extract each time

    for (var i = 0; i < 2*60; i += seconds) {
        Module.arguments = [
            '-ss', i, // '00:00:00.000',
            '-i', 'input.mp4',
            // '-vframes', '10',
            '-vf', 'scale=120:-1',
            // '-f', 'image2',
            '-frames:v', Math.floor(seconds * 29.95), // '100',
            'out-' + i + '-%d.jpeg'
        ];

        console.log(Module.arguments);

        // postMessage({
        //     'type' : 'stdout',
        //     'data' : 'Process frame ' + i
        // });

        var result = ffmpeg_run(Module);
        // results.push(result);

        postMessage({
            'type' : 'done',
            'data' : result,
            'time' : totalTime
        });
    }

    var totalTime = now() - time;
    postMessage({
        'type' : 'stdout',
        'data' : 'Finished processing (took ' + totalTime + 'ms)'
    });

    // postMessage({
    //     'type' : 'done',
    //     'data' : results,
    //     'time' : totalTime
    // });
};

postMessage({
    'type' : 'ready'
});
