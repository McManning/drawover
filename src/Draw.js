
import React from 'react';

/**
 * Frame drawover
 *
 * <Draw width="720" height="480"/>
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
    constructor(props) {
        super(props);

        this.penColors = [
            '#000000',
            '#FF0000',
            '#00FF00',
            '#0000FF'
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
        };

        // These are kept out of state since they're localized
        // only to the canvas element and updated very frequently
        this.points = [];
        this.dragging = false;
        this.mouseX = 0;
        this.mouseY = 0;

        // Worker SVG & matrix for doing matrix math
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.matrix = this.svg.createSVGMatrix();

        this.canvas = React.createRef();
        this.temp = React.createRef();

        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onChangeLineWidth = this.onChangeLineWidth.bind(this);
        this.onClear = this.onClear.bind(this);
        this.undo = this.undo.bind(this);
        this.redo = this.redo.bind(this);
    }

    componentDidMount() {
        this.setPen('#000000');

        // Set initial canvas transformation from props
        this.transform(
            this.props.translate,
            this.props.scale,
            this.props.rotate
        );
    }

    /**
     * Watch for component state updates to update associated canvas elements
     */
    componentDidUpdate(prevProps, prevState) {
        // On tool change or line width change, update our custom cursor to match
        if (prevState.tool !== this.state.tool || prevState.lineWidth !== this.state.lineWidth) {
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
    }

    clearTempCanvas() {
        const tl = this.transformedPoint(0, 0);
        const scale = 1 / this.props.scale;

        this.tempContext.clearRect(
            tl.x,
            tl.y,
            this.temp.current.width * scale,
            this.temp.current.height * scale
        );
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
        this.clearTempCanvas();
        this.points = [];
    }

    /**
     * Start drawing once the canvas is left clicked
     *
     * @param {SyntheticEvent} e
     */
    onMouseDown(e) {
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
     * Capture and respond to undo/redo events (ctrl+z/y)
     */
    onKeyDown(e) {
        if (e.keyCode === 90 && e.ctrlKey) {
            this.undo();
        } else if (e.keyCode === 89 && e.ctrlKey) {
            this.redo();
        }
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

    clear() {
        const ctx = this.canvasContext;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.current.width, this.canvas.current.height);
        ctx.restore();
    }

    /**
     * Redraw the main canvas up to `historyIndex`
     */
    redraw(historyIndex) {
        const ctx = this.canvasContext;

        this.clear();

        // Run through the history and redraw each tool onto the main canvas
        for (let i = 0; i < historyIndex; i++) {
            const event = this.state.history[i];

            if (event.tool === 'erase') {
                this.pen(
                    ctx,
                    '',
                    event.lineWidth,
                    event.points,
                    'destination-out'
                );
            } else if (event.tool === 'pen') {
                this.pen(
                    ctx,
                    event.color,
                    event.lineWidth,
                    event.points,
                    'source-over'
                );
            } else if (event.tool === 'clear') {
                this.clear();
            }
        }
    }

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
     * Draw with the currently selected tool
     */
    draw() {
        this.points.push({
            x: this.mouseX,
            y: this.mouseY
        });

        if (this.state.tool === 'erase') {
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
            this.clearTempCanvas();

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
     * @param {string} color Hex color code to draw in
     */
    setPen(color) {
        this.setState({
            tool: 'pen',
            color: color
        });
    }

    setEraser() {
        this.setState({
            tool: 'erase',
            color: ''
        });
    }

    onChangeLineWidth(e) {
        const ctx = this.canvas.current.getContext('2d');
        const tempCtx = this.temp.current.getContext('2d');

        ctx.lineWidth = e.target.value;
        tempCtx.lineWidth = e.target.value;

        this.setState({
            lineWidth: e.target.value
        });
    }

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
    }

    /**
     * Create a serialized form of `history` we can reuse later
     *
     * This attempts to eliminate some of the fat from `history`
     * to reduce serialized size.
     *
     * @return {string}
     */
    serialize() {
        let serialized = [];

        // TODO: Some sort of compression.
        // Tools can become integer IDs, color can be
        // an integer, combined with the ints of line width
        // and the array of positions, it's just arrays of
        // ints we can crunch down.
        this.state.history.forEach((event) => {
            if (event.tool === 'clear') {
                serialized = [];
            } else {
                serialized.push(event);
            }
        });

        return JSON.stringify(serialized);
    }

    /**
     * Deserialize the input history state and redraw to match
     */
    deserialize(serialized) {
        let deserialized = JSON.parse(serialized);

        this.setState({
            history: deserialized,
            historyIndex: deserialized.length
        }, () => this.redraw());
    }

    /**
     * Clear the composite canvas
     */
    onClear() {
        this.clear();
        this.pushHistory('clear', '', '', []);
    }

    /**
     * Load up a new SVG as our custom cursor based on the active tool
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

    setTransform(a, b, c, d, e, f) {
        this.matrix.a = a;
        this.matrix.b = b;
        this.matrix.c = c;
        this.matrix.d = d;
        this.matrix.e = e;
        this.matrix.f = f;

        this.canvasContext.setTransform(a, b, c, d, e, f);
        this.tempContext.setTransform(a, b, c, d, e, f);
    }

    get canvasContext() {
        return this.canvas.current.getContext('2d');
    }

    get tempContext() {
        return this.temp.current.getContext('2d');
    }

    transform(translate, scale, rotate) {
        const canvasCtx = this.canvasContext;
        const tempCtx = this.tempContext;

        // Reset transformation
        this.setTransform(1, 0, 0, 1, 0, 0);

        // Apply affine transformations to all three matrices
        this.matrix = this.matrix.translate(translate.x, translate.y);
        this.matrix = this.matrix.scale(scale);
        this.matrix = this.matrix.rotate(rotate * 180 / Math.PI);

        canvasCtx.translate(translate.x, translate.y);
        canvasCtx.scale(scale, scale);
        canvasCtx.rotate(rotate);

        tempCtx.translate(translate.x, translate.y);
        tempCtx.scale(scale, scale);
        tempCtx.rotate(rotate);

        this.redraw(this.state.historyIndex);
        this.redrawCursorSVG();
    }

    /**
     * Convert a DOM-space point to canvas local space
     *
     * @param {integer} x
     * @param {integer} y
     */
    transformedPoint(x, y) {
        let point = this.svg.createSVGPoint();
        point.x = x;
        point.y = y;

        return point.matrixTransform(
            this.matrix.inverse()
        );
    }

    render() {
        const { tool, color, lineWidth, history, historyIndex } = this.state;

        // Temp canvas is rendered directly on top of the main canvas so that
        // it gets input events and drawn lines are copied down to the underlying
        // persistent canvas.
        return (
            <div className="draw">
                <canvas ref={this.temp} className="draw-temp" tabIndex="0"
                    width={this.props.width} height={this.props.height}
                    onMouseMove={this.onMouseMove}
                    onMouseDown={this.onMouseDown}
                    onMouseUp={this.onMouseUp}
                    onMouseLeave={this.onMouseUp}
                    onKeyDown={this.onKeyDown}
                    style={{
                        cursor: this.state.cursor
                    }}
                ></canvas>

                <canvas ref={this.canvas} className="draw-canvas"
                    width={this.props.width} height={this.props.height}></canvas>

                <div className="draw-tools">
                    <input type="range" min="1" max="100"
                        className="draw-line-width"
                        value={lineWidth}
                        onChange={this.onChangeLineWidth} />

                    <ul>
                    {this.penColors.map((c) =>
                        <li key={c}>
                            <button className={'draw-pen ' +
                                (color === c && tool === 'pen' ? 'is-active' : '')
                            } onClick={() => this.setPen(c)} style={{backgroundColor: c}}></button>
                        </li>
                    )}
                    </ul>

                    <button className={'draw-eraser ' + (tool === 'erase' ? 'is-active' : '')}
                        onClick={() => this.setEraser()}>Eraser</button>

                    <button className="draw-clear" onClick={this.onClear}>Clear</button>

                    <button className="draw-undo" onClick={this.undo}>Undo</button>
                    <button className="draw-redo" onClick={this.redo}>Redo</button>
                </div>

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

                <ul>
                    <li>Translate: {this.props.translate.x}, {this.props.translate.y}</li>
                    <li>Scale: {this.props.scale}</li>
                    <li>Rotate: {this.props.rotate}</li>
                </ul>
            </div>
        );
    }
}

Draw.defaultProps = {
    width: 720,
    height: 480,

    translate: {
        x: 0,
        y: 0
    },
    scale: 1,
    rotate: 0
};

export default Draw;
