
import React from 'react';

import './Draw.scss';

import Logger from './Log';
const log = new Logger('Draw');

/**
 * Frame drawover
 *
 * <Draw width="720" height="480" readonly={boolean}
 *       scale="1" rotate="0" translate={x: 0, y: 0}
 *       source={ArrayBuffer}
 *       onDraw={callable} onClear={callable} />
 *
 * Includes basic draw tools:
 *  - brush size
 *  - brush color
 *  - eraser
 *
 * Includes a history stack for undo/redo and storing
 * strokes in a more lightweight data format than a canvas image.
 */
class Draw extends React.Component {
    static PEN_TOOL = 1;
    static ERASE_TOOL = 2;
    static CLEAR_TOOL = 3;

    constructor(props) {
        super(props);

        this.penColors = [
            '#FF0000',
            '#00FF00',
            '#0000FF',
            '#000000',
            '#FFFFFF'
        ];

        this.state = {
            // Active tool information
            tool: null,
            color: null,
            lineWidth: 5,

            previousTool: 'pen',

            // Undo stack / serializable stroke info
            history: [],

            // Where we are in the undo stack
            historyIndex: 0,

            empty: true
        };

        // These are kept out of state since they're localized
        // only to the canvas element and updated very frequently
        this.points = [];
        this.dragging = false;
        this.mouseX = 0;
        this.mouseY = 0;

        this.matrix = new window.DOMMatrixReadOnly();

        this.canvas = React.createRef();
        this.temp = React.createRef();

        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onTouchStart = this.onTouchStart.bind(this);
        this.onTouchEnd = this.onTouchEnd.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchCancel = this.onTouchCancel.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onChangeLineWidth = this.onChangeLineWidth.bind(this);
        this.onClear = this.onClear.bind(this);
        this.onContextMenu = this.onContextMenu.bind(this);
        this.undo = this.undo.bind(this);
        this.redo = this.redo.bind(this);
    }

    componentDidMount() {
        // Set initial canvas transformation from props
        this.transform(
            this.props.translate,
            this.props.scale,
            this.props.rotate
        );

        // Add non-React event listener for context menu
        // (right click) and a default pen
        if (!this.props.readonly) {
            this.setPen(this.penColors[0]);
            this.temp.current.addEventListener('contextmenu', this.onContextMenu);
        }

        // If there was a preloaded serialized form of this
        // Draw to load from, render it on mount
        if (this.props.source) {
            this.deserialize(this.props.source);
        }
    }

    /**
     * Watch for component state updates to update associated canvas elements
     */
    componentDidUpdate(prevProps, prevState) {

        // On tool change or line width change, update our custom cursor to match
        if (prevState.tool !== this.state.tool ||
            prevState.lineWidth !== this.state.lineWidth
        ) {
            this.redrawCursorSVG();
        }

        // If any of the transformation props change, re-transform
        if (prevProps.translate.x !== this.props.translate.x ||
            prevProps.translate.y !== this.props.translate.y ||
            prevProps.scale !== this.props.scale ||
            prevProps.rotate !== this.props.rotate
        ) {
            this.transform(
                this.props.translate,
                this.props.scale,
                this.props.rotate
            );
        }

        // If history updated, update the cached empty status
        if (prevState.historyIndex !== this.state.historyIndex) {
            this.setState({
                empty: this.isEmpty()
            });
        }
    }

    /**
     * Clear the temporary canvas used for storing the current line
     */
    clearTemp() {
        const ctx = this.tempContext;

        if (ctx) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, this.temp.current.width, this.temp.current.height);
            ctx.restore();
        }
    }

    /**
     * End the current line being drawn with the pen or eraser tools
     *
     * This will copy whatever is rendered on the temp canvas
     * onto the main canvas, and clear the temp.
     */
    endCurrentLine() {
        if (!this.points.length) {
            return;
        }

        const ctx = this.canvasContext;

        // Add line to our history stack
        this.pushHistory(
            this.state.tool,
            this.state.color,
            this.state.lineWidth,
            this.points
        );

        // Copy temp canvas contents onto the composite canvas
        ctx.globalCompositeOperation = 'source-over';

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(this.temp.current, 0, 0);
        ctx.restore();

        // Reset everything
        this.clearTemp();
        this.points = [];

        // Fire the onDraw event listener, if present
        if (this.props.onDraw) {
            this.props.onDraw();
        }
    }

    /**
     * Start drawing once the canvas is left clicked
     *
     * @param {SyntheticEvent} e
     */
    onMouseDown(e) {
        // If we click outside the visible tools window,
        // just close it and don't start drawing.
        if (this.state.toolsVisible) {
            this.setState({
                toolsVisible: false
            });
            return;
        }

        if (e.buttons === 1) {
            this.dragging = true;
        }

        if (this.dragging) {
            this.trackMouse(e);
            this.draw();
        }
    }

    /**
     * Stop drawing a line on the canvas
     *
     * This event is triggered for both the button up event and
     * the mouse leaving the canvas (onMouseOut) since we want
     * to treat both as a line ender.
     *
     * @param {SyntheticEvent} e
     */
    onMouseUp(e) {
        if (this.dragging) {
            this.dragging = false;
            this.endCurrentLine();
        }
    }

    /**
     * Track the mouse position on movement
     *
     * @param {SyntheticEvent} e
     */
    onMouseMove(e) {
        if (this.state.toolsVisible) {
            return;
        }

        // If they had the primary mouse button down while dragging INTO
        // the canvas, but didn't press it down while already on the canvas,
        // flag as a drag event
        if (e.buttons === 1) {
            this.dragging = true;
        }

        this.trackMouse(e);

        if (this.dragging) {
            this.draw();
        }
    }

    /**
     * Finger(s) down for touch input
     *
     * @param {SyntheticEvent} e
     */
    onTouchStart(e) {
        log.debug('Touch Start', e);
        const touches = e.changedTouches;

        // If we're not tracking touch yet, track first
        if (!this.touchIdentifier) {
            this.touchIdentifier = touches[0].identifier;

            this.dragging = true;
            this.trackTouch(touches[0]);
            this.draw();
        }

        // Everything else - we ignore. Single touch only
    }

    /**
     * Finger lifts from touch input
     *
     * @param {SyntheticEvent} e
     */
    onTouchEnd(e) {
        log.debug('Touch End', e);
        const touches = e.changedTouches;

        // If our tracked touch was lifted, end the line
        for (let i = 0; i < touches.length; i++) {
            if (touches[i].identifier === this.touchIdentifier) {
                this.touchIdentifier = null;
                this.dragging = false;
                this.endCurrentLine();
            }
        }
    }

    /**
     * Finger(s) leave the touch region
     *
     * @param {SyntheticEvent} e
     */
    onTouchCancel(e) {
        log.debug('Touch Cancel', e);
        this.onTouchEnd(e);
    }

    /**
     * Keyboard touch move event - draw more lines
     *
     * @param {SyntheticEvent} e
     */
    onTouchMove(e) {
        const touches = e.changedTouches;

        for (let i = 0; i < touches.length; i++) {
            if (touches[i].identifier === this.touchIdentifier) {
                this.trackTouch(touches[i]);
                this.draw();
            }
        }
    }

    /**
     * Capture and respond to undo/redo events (ctrl+z/y)
     *
     * @param {SyntheticEvent} e
     */
    onKeyDown(e) {
        if (e.keyCode === 90 && e.ctrlKey) { // ctrl+z or cmd+z
            this.undo();
        } else if (e.keyCode === 89 && e.ctrlKey) { // ctrl+y or cmd+shift+z
            this.redo();
        } else if (e.keyCode === 27) { // ESC - hide tools if visible
            this.setState({
                toolsVisible: false
            });
        }
    }

    /**
     * Override the default context menu with a tool menu
     *
     * @param {SyntheticEvent} e
     */
    onContextMenu(e) {
        e.preventDefault();

        // TODO: Smarter placement, in case it's offscreen or something.
        this.setState({
            toolsVisible: true,
            toolsOrigin: {
                top: e.pageY,
                left: e.pageX
            }
        });

        return false;
    }

    /**
     * Store the current position of the mouse as a point on the canvas
     *
     * @param {SyntheticEvent} e
     */
    trackMouse(e) {
        const point = this.transformedPoint(
            e.nativeEvent.offsetX,
            e.nativeEvent.offsetY
        );

        this.mouseX = point.x;
        this.mouseY = point.y;
    }

    trackTouch(touch) {
        const point = this.transformedPoint(
            touch.pageX - touch.target.offsetLeft,
            touch.pageY - touch.target.offsetTop
        );

        this.mouseX = point.x;
        this.mouseY = point.y;
    }

    /**
     * Clear both canvas but persist draw history
     */
    clear() {
        const ctx = this.canvasContext;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.current.width, this.canvas.current.height);
        ctx.restore();

        this.clearTemp();
    }

    /**
     * Redraw the main canvas up to `historyIndex`
     *
     * @param {Number} historyIndex in range [0, history.length]
     */
    redraw(historyIndex) {
        const ctx = this.canvasContext;

        this.clear();

        // Run through the history and redraw each tool onto the main canvas
        for (let i = 0; i < historyIndex; i++) {
            const event = this.state.history[i];

            if (event.tool === Draw.ERASE_TOOL) {
                this.pen(
                    ctx,
                    '',
                    event.lineWidth,
                    event.points,
                    'destination-out'
                );
            } else if (event.tool === Draw.PEN_TOOL) {
                this.pen(
                    ctx,
                    event.color,
                    event.lineWidth,
                    event.points,
                    'source-over'
                );
            } else if (event.tool === Draw.CLEAR_TOOL) {
                this.clear();
            }
        }
    }

    /**
     * Perform a pen tool draw operation on the desired canvas
     *
     * A quadratic curve is drawn through `points` to create
     * a smooth curve across the canvas
     *
     * This also supports an erase tool by changing the canvas
     * operation that the stroke utilizes to `destination-out`
     *
     * @param {CanvasContext2D} ctx         Target canvas context
     * @param {string}          color       Hex color code
     * @param {Number}          lineWidth   Stroke size of the pen
     * @param {array}           points      Array of {x, y} pairs in canvas space
     * @param {string}          operation   A globalCompositeOperation for the
     *                                      stroke (e.g. `source-over`)
     */
    pen(ctx, color, lineWidth, points, operation) {
        let cpx, cpy, x, y;
        let i = 1;

        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = color;
        ctx.fillStyle = color;

        ctx.globalCompositeOperation = operation;

        // If not enough points for a curve, just make a dot
        if (points.length < 3) {
            ctx.beginPath();
            ctx.arc(
                points[0].x,
                points[0].y,
                lineWidth / 2,
                0,
                Math.PI * 2
            );

            ctx.fill();
            ctx.closePath();
            return;
        }

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (i; i < points.length - 2; i++) {
            // Control point coordinate
            cpx = points[i].x;
            cpy = points[i].y;

            // End point coordinate - midpoint between two points
            x = (cpx + points[i + 1].x) / 2;
            y = (cpy + points[i + 1].y) / 2;

            ctx.quadraticCurveTo(cpx, cpy, x, y);
        }

        // Draw a curve for the last two
        cpx = points[i].x;
        cpy = points[i].y;
        x = points[i + 1].x;
        y = points[i + 1].y;

        ctx.quadraticCurveTo(cpx, cpy, x, y);
        ctx.stroke();
    }

    /**
     * Interactive draw update with the currently selected tool
     */
    draw() {
        this.points.push({
            x: this.mouseX,
            y: this.mouseY
        });

        if (this.state.tool === Draw.ERASE_TOOL) {
            // Erase tool operates directly on the composite canvas
            // so that it can immediately overwrite existing lines.
            // The edges are slightly more jagged and overdraw themselves
            // while moving the pen, but that's typically alright.
            this.pen(
                this.canvasContext,
                '',
                this.state.lineWidth,
                this.points,
                'destination-out'
            );
        } else {
            // Clear the temp and start a new curve from all the
            // stored points for a smoother curve
            this.clearTemp();

            this.pen(
                this.tempContext,
                this.state.color,
                this.state.lineWidth,
                this.points,
                'source-over'
            );
        }
    }

    /**
     * Activate a pen tool in the chosen color
     *
     * @param {string} color Hex color code to draw in
     */
    setPen(color) {
        this.setState({
            tool: Draw.PEN_TOOL,
            color: color,

            // Clear tools menu, if still active
            toolsVisible: false
        });
    }

    /**
     * Activate the eraser tool
     */
    setEraser() {
        this.setState({
            tool: Draw.ERASE_TOOL,
            color: '',

            // Clear tools menu, if still active
            toolsVisible: false
        });
    }

    /**
     * Tools menu event handler to change state.lineWidth
     *
     * @param {SyntheticEvent} e
     */
    onChangeLineWidth(e) {
        const ctx = this.canvas.current.getContext('2d');
        const tempCtx = this.temp.current.getContext('2d');

        ctx.lineWidth = e.target.value;
        tempCtx.lineWidth = e.target.value;

        this.setState({
            lineWidth: e.target.value
        });
    }

    /**
     * Add a new stroke or operation to the history stack
     *
     * @param {Number} tool One of the *_TOOL constants
     * @param {string} color Hex color code (if PEN_TOOL)
     * @param {Number} lineWidth Stroke size
     * @param {array} points {x, y} coordinate pairs (canvas space)
     */
    pushHistory(tool, color, lineWidth, points) {
        const history = this.state.history;
        let historyIndex = this.state.historyIndex;

        // If they rolled back the history, drop everything
        // after the index and replace with the new event
        if (historyIndex < history.length) {
            history.splice(historyIndex);
        }

        history.push({
            tool,
            color,
            lineWidth,
            points
        });

        historyIndex++;

        this.setState({ history, historyIndex });
    }

    /**
     * Walk backwards in the history stack and redraw
     */
    undo() {
        let historyIndex = this.state.historyIndex - 1;

        if (historyIndex < 0) {
            historyIndex = 0;
        }

        this.setState({ historyIndex });
        this.redraw(historyIndex);

        // if we `undo` to a clear event or an empty canvas, fire onClear
        if (historyIndex < 1 || this.state.history[historyIndex].tool === Draw.ERASE_TOOL) {
            if (this.props.onClear) {
                this.props.onClear();
            }
        } else if (this.props.onDraw) {
            // Otherwise - we undo some pen event, consider it a draw.
            this.props.onDraw();
        }
    }

    /**
     * Walk forwards in the history stack and redraw
     */
    redo() {
        let historyIndex = this.state.historyIndex + 1;

        if (historyIndex > this.state.history.length) {
            historyIndex = this.state.history.length;
        }

        this.setState({ historyIndex });
        this.redraw(historyIndex);

        // If we redo a 'clear' event, fire onClear
        if (this.state.history[historyIndex].tool === Draw.ERASE_TOOL) {
            if (this.props.onClear) {
                this.props.onClear();
            }
        } else if (this.props.onDraw) {
            // redoed to some pen event, fire a draw
            this.props.onDraw();
        }
    }

    /**
     * Clear the canvas and the history stack.
     *
     * This will still maintain whatever the active tool was.
     */
    reset() {
        this.clear();
        this.setState({
            history: [],
            historyIndex: 0
        });
    }

    /**
     * Returns true if there is currently no rendered content
     *
     * @return {boolean}
     */
    isEmpty() {
        if (this.state.historyIndex < 1) {
            return true;
        }

        const lastTool = this.state.history[this.state.historyIndex - 1].tool;

        // Consider us "empty" if the last tool was a clear.
        if (lastTool === Draw.CLEAR_TOOL) {
            return true;
        }

        // If it's a pen, we know we're not empty
        if (lastTool === Draw.PEN_TOOL) {
            return false;
        }

        // Otherwise - it's an erase. No way to know for
        // certain without testing the canvas pixels.
        // Can create (and cache) a `toDataURL` of a blank canvas and
        // compare that to our data URL of this canvas.

        // .. But this is slow. And we call this method often (every
        // history stack update) so for now, we'll assume it's not empty
        return true;
    }

    /**
     * Create a serialized form of `history` we can reuse later
     *
     * This attempts to eliminate some of the fat from `history`
     * to reduce serialized size.
     *
     * @return {ArrayBuffer}
     */
    serialize() {
        /*
            Byte count is:

            tool: 1 byte
            color: 3 bytes
            lineWidth: 1 byte
            point length: 2 bytes
            points: 4 bytes per point

            For laziness, everything will be padded to int16,
            so tool/linewidth = 2 bytes, color = 6 bytes, and color/point length will
            be in every event, regardless of type. Will overoptimize later.
        */

        let buffer = [];

        // TODO: Better handle "erase" events s.t. if an erasure actually
        // clears the entire canvas, don't store anything prior to erase
        for (let i = 0; i < this.state.historyIndex; i++) {
            const event = this.state.history[i];

            if (event.tool === Draw.CLEAR_TOOL) {
                buffer = [];
            } else {
                buffer.push(event.tool);
                buffer.push(parseInt(event.color.substr(1, 2), 16)); // R
                buffer.push(parseInt(event.color.substr(3, 2), 16)); // G
                buffer.push(parseInt(event.color.substr(5, 2), 16)); // B
                buffer.push(event.lineWidth);
                buffer.push(event.points.length * 2); // int16 length of points

                for (let p = 0; p < event.points.length; p++) {
                    buffer.push(event.points[p].x);
                    buffer.push(event.points[p].y);
                }
            }
        }

        // TODO: Some sort of compression?
        return new Int16Array(buffer).buffer;
    }

    /**
     * Deserialize the input history state and redraw to match
     *
     * @param {ArrayBuffer} buffer
     */
    deserialize(buffer) {
        const int16 = new Int16Array(buffer);
        const deserialized = [];

        let i = 0;

        while (i < int16.length) {
            // Read event header
            const event = {
                tool: int16[i],
                color: '#' +
                    int16[i + 1].toString(16).padStart(2, '0') +
                    int16[i + 2].toString(16).padStart(2, '0') +
                    int16[i + 3].toString(16).padStart(2, '0'),
                lineWidth: int16[i + 4]
            };

            i += 5;

            // Read point data
            const plen = int16[i];
            const points = [];

            i++;
            for (let p = 0; p < plen; p += 2) {
                points.push({
                    x: int16[i + p],
                    y: int16[i + p + 1]
                });
            }

            event.points = points;
            i += plen;

            deserialized.push(event);
        }

        // Rewrite history and redraw
        this.setState({
            history: deserialized,
            historyIndex: deserialized.length
        }, () => this.redraw(deserialized.length));
    }

    /**
     * Tools menu event to clear the canvas
     */
    onClear() {
        this.clear();
        this.pushHistory(Draw.CLEAR_TOOL, '', '', []);

        // Hide the tools menu, if visible
        this.setState({
            toolsVisible: false
        });

        // Fire off the `onClear` listener, if present
        if (this.props.onClear) {
            this.props.onClear();
        }
    }

    /**
     * Load up a new SVG as our custom cursor based on the active tool
     *
     * This will create a new SVG instance and apply it to state.cursor
     */
    redrawCursorSVG() {
        const size = parseInt(this.state.lineWidth * this.props.scale, 10);
        const rad = size / 2;
        const padding = 2;

        // Photoshop-esque circle that matches the line width.
        // It doesn't invert itself on dark backgrounds, so instead we give it
        // a white blur around the edges to make it still visible.
        const svg = `
            <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
                xmlns:xlink="http://www.w3.org/1999/xlink"
                x="0" y="0" width="${size+padding*2}px" height="${size+padding*2}px"
                xml:space="preserve"
            >
                <defs>
                    <filter id="blur" x="0" y="0" filterUnits="userSpaceOnUse">
                        <feGaussianBlur stdDeviation="1" />
                    </filter>
                </defs>
                <circle cx="${rad+padding}" cy="${rad+padding}" r="${rad-1}"
                    stroke="white"
                    fill="transparent"
                    stroke-width="0.8"
                    filter="url(#blur)"
                />
                <circle cx="${rad+padding}" cy="${rad+padding}" r="${rad-1}"
                    stroke="black"
                    fill="transparent"
                    stroke-width="1"
                />
            </svg>
        `;

        // Debug rect
        // <rect width="${size+padding*2}px" height="${size+padding*2}" stroke="green" stroke-width="3" fill="transparent" />

        this.setState({
            cursor: `url("data:image/svg+xml,${encodeURI(svg)}") ${rad+padding} ${rad+padding}, crosshair`
        });
    }

    get canvasContext() {
        return this.canvas.current.getContext('2d');
    }

    /**
     * Get the context of the temp canvas.
     *
     * This will return null if the component was rendered
     * without a temp canvas (e.g. in `readonly` mode)
     *
     * @return {CanvasContext2D|null}
     */
    get tempContext() {
        if (!this.temp.current) {
            return null;
        }

        return this.temp.current.getContext('2d');
    }

    /**
     * Apply a transformation to the canvas
     *
     * This transformation will replace whatever the previous
     * canvas transformation was. Used with components like
     * Transform to apply canvas transformations uniformly
     * with other DOM components.
     *
     * Currently, transformations are done in TSR order.
     *
     * @param {object} translate {x, y} coordinate pair
     * @param {Number} scale Canvas scale, where 1 is no scale
     * @param {Number} rotate Radian rotation
     */
    transform(translate, scale, rotate) {
        const canvasCtx = this.canvasContext;
        const tempCtx = this.tempContext;

        // Apply transformations to all three matrices
        this.matrix = new window.DOMMatrixReadOnly();
        this.matrix = this.matrix.translate(translate.x, translate.y);
        this.matrix = this.matrix.scale(scale, scale);
        this.matrix = this.matrix.rotate(rotate * 180 / Math.PI);

        canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
        canvasCtx.translate(translate.x, translate.y);
        canvasCtx.scale(scale, scale);
        canvasCtx.rotate(rotate);

        if (tempCtx) {
            tempCtx.setTransform(1, 0, 0, 1, 0, 0);
            tempCtx.translate(translate.x, translate.y);
            tempCtx.scale(scale, scale);
            tempCtx.rotate(rotate);
        }

        this.redraw(this.state.historyIndex);
        this.redrawCursorSVG();
    }

    /**
     * Convert a DOM-space point to canvas local space
     *
     * @param {Number} x
     * @param {Number} y
     */
    transformedPoint(x, y) {
        const inv = this.matrix.inverse();

        return new window.DOMPoint(
            x * inv.a + y * inv.c + inv.e,
            x * inv.b + y * inv.d + inv.f,
            0, 1
        );
    }

    /**
     * Render a panel that contains our history stack
     *
     * For debugging use only, ATM
     */
    renderHistory() {
        const { history, historyIndex } = this.state;

        return (
            <ul className="draw-history">
                {history.map((event, idx) =>
                    <li key={idx} className={idx >= historyIndex ? 'is-undone' : ''}>
                        {idx}:

                        {idx === historyIndex &&
                            <span>*</span>
                        }

                        {event.tool} - {event.color} -
                        {event.lineWidth} - {event.points.length}
                    </li>
                )}
            </ul>
        );
    }

    /**
     * Render the floating tools menu
     */
    renderTools() {
        const { tool, color, lineWidth } = this.state;

        return (
            <div className="draw-tools" style={this.state.toolsOrigin}>
                <input type="range" min="1" max="100"
                    className="draw-line-width"
                    value={lineWidth}
                    onChange={this.onChangeLineWidth} />

                <ul>
                {this.penColors.map((c) =>
                    <li key={c}>
                        <button className={'draw-pen ' +
                            (color === c && tool === Draw.PEN_TOOL ? 'is-active' : '')
                        } onClick={() => this.setPen(c)} style={{backgroundColor: c}}></button>
                    </li>
                )}
                </ul>

                <button className={'draw-eraser ' + (tool === Draw.PEN_TOOL ? 'is-active' : '')}
                    onClick={() => this.setEraser()}>Eraser</button>

                <button className="draw-clear" onClick={this.onClear}>Clear</button>

                <button className="draw-undo" onClick={this.undo}>Undo</button>
                <button className="draw-redo" onClick={this.redo}>Redo</button>
            </div>
        );
    }

    render() {
        // Temp canvas is rendered directly on top of the main canvas so that
        // it gets input events and drawn lines are copied down to the underlying
        // persistent canvas. The temp canvas and all its event handlers will NOT
        // be rendered if this canvas is in readonly mode.
        return (
            <div className="draw" style={{ opacity: this.props.opacity }}>
                {!this.props.readonly &&
                    <canvas ref={this.temp} className="draw-temp" tabIndex="0"
                        width={this.props.width} height={this.props.height}
                        onMouseMove={this.onMouseMove}
                        onMouseDown={this.onMouseDown}
                        onMouseUp={this.onMouseUp}
                        onMouseLeave={this.onMouseUp}
                        onTouchStart={this.onTouchStart}
                        onTouchEnd={this.onTouchEnd}
                        onTouchMove={this.onTouchMove}
                        onTouchCancel={this.onTouchCancel}
                        onKeyDown={this.onKeyDown}
                        style={{
                            cursor: this.state.cursor
                        }}
                    ></canvas>
                }

                <canvas ref={this.canvas} className="draw-canvas"
                    width={this.props.width} height={this.props.height}></canvas>

                {this.state.toolsVisible && this.renderTools()}
            </div>
        );
    }
}

Draw.defaultProps = {
    readonly: false,
    source: null,
    opacity: 1,

    width: 720,
    height: 480,

    translate: {
        x: 0,
        y: 0
    },
    scale: 1,
    rotate: 0,

    onDraw: null,
    onClear: null
};

export default Draw;
