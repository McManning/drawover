
function zeroPad(n: number): string {
    return String(n).padStart(2, '0');
}

/**
 * Converter for time codes to frames and visa versa
 */
export default class Timecode {
    fps: number;

    constructor(fps: number) {
        this.fps = fps;
    }

    /**
     * Format a frame number to timecode
     */
    to(frame: number): string {
        let seconds = frame / this.fps;
        let minutes = seconds / 60;
        let hours = minutes / 60;
        let frames = Math.floor(frame % this.fps);
        seconds = Math.floor(seconds % 60);
        minutes = Math.floor(minutes % 60);
        hours = Math.floor(hours % 24);

        return `${zeroPad(hours)}:${zeroPad(minutes)}:${zeroPad(seconds)}:${zeroPad(frames)}`;
    }

    /**
     * Convert a timecode to a frame number
     *
     * @param {string} timecode
     *
     * @return {integer}
     */
    from(timecode: string): number {
        let [hours, minutes, seconds, frames] = timecode.split(':');

        return parseInt(hours, 10) * 60
            + parseInt(minutes, 10) * 60
            + parseInt(seconds, 10) * this.fps
            + parseInt(frames, 10);
    }
}
