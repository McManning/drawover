
// @ts-ignore
import debug from 'debug';

/**
 * Wrapper for debug.js to handle different log message levels
 */
class Logger {
    private readonly print: any;

    constructor(namespace: string) {
        this.print = debug('drawover:' + namespace);
    }

    debug(...args: any[]) {
        this.print('%c debug ', 'background-color: #aaaaaa; color: #ffffff', ...args);
    }

    info(...args: any[]) {
        this.print('%c info ', 'background-color: #66c2cd; color: #ffffff', ...args);
    }

    warning(...args: any[]) {
        this.print('%c warning ', 'background-color: #dbaa79; color: #ffffff', ...args);
    }

    error(...args: any[]) {
        this.print('%c error ', 'background-color: #e88388; color: #ffffff', ...args);
    }
}

export default Logger;
