
import debug from 'debug';

/**
 * Wrapper for debug.js to handle different log message levels
 */
class Logger {
    constructor(namespace) {
        this.print = debug('drawover:' + namespace);
    }

    debug() {
        this.print('%c debug ', 'background-color: #aaaaaa; color: #ffffff', ...arguments);
    }

    info() {
        this.print('%c info ', 'background-color: #66c2cd; color: #ffffff', ...arguments);
    }

    warning() {
        this.print('%c warning ', 'background-color: #dbaa79; color: #ffffff', ...arguments);
    }

    error() {
        this.print('%c error ', 'background-color: #e88388; color: #ffffff', ...arguments);
    }
}

export default Logger;
