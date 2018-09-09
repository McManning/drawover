
import debug from 'debug';

/**
 * Wrapper for debug.js to handle different log message levels
 */
class Logger {
    constructor(namespace) {
        this.debug = debug('drawover:' + namespace);
    }

    info() {
        this.debug('%c info ', 'background-color: #66c2cd; color: #ffffff', ...arguments);
    }

    warn() {
        this.debug('%c warning ', 'background-color: #dbaa79; color: #ffffff', ...arguments);
    }

    error() {
        this.debug('%c error ', 'background-color: #e88388; color: #ffffff', ...arguments);
    }
}

export default Logger;
