
/**
 * Converter for time codes to frames and visa versa
 */
class Timecode {
    constructor(fps) {
        this.fps = fps;
    }

    /**
     * Format a frame number to timecode
     *
     * @param {integer} frame
     *
     * @return {string}
     */
    to(frame) {
        let seconds = frame / this.fps;
        let minutes = seconds / 60;
        let hours = minutes / 60;
        let frames = Math.floor(frame % this.fps);
        seconds = Math.floor(seconds % 60);
        minutes = Math.floor(minutes % 60);
        hours = Math.floor(hours % 24);

        if (frames < 10) {
            frames = '0' + frames;
        }

        if (seconds < 10) {
            seconds = '0' + seconds;
        }

        if (minutes < 10) {
            minutes = '0' + minutes;
        }

        if (hours < 10) {
            hours = '0' + hours;
        }

        return `${hours}:${minutes}:${seconds}:${frames}`;
    }

    /**
     * Convert a timecode to a frame number
     *
     * @param {string} timecode
     *
     * @return {integer}
     */
    from(timecode) {
        let hours, minutes, seconds, frames;

        [hours, minutes, seconds, frames] = timecode.split(':');

        return parseInt(hours, 10) * 60
            + parseInt(minutes, 10) * 60
            + parseInt(seconds, 10) * this.fps
            + parseInt(frames, 10);
    }
}

export default Timecode;
