
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
            tool: 'pen',
            color: '#FF0000',
            lineWidth: 5,

            // Undo stack / serializable stroke info
            history: [],

            // Where we are in the undo stack
            historyIndex: 0
        };

        // These are kept out of state since they're localized
        // only to the canvas element and updated very frequently
        this.points = [];
        this.drawing = false;
        this.mouseX = 0;
        this.mouseY = 0;

        // Worker SVG for doing matrix math
        this.svg = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'svg'
        );

        this.transform = this.svg.createSVGMatrix();
        this.transformStack = [];

        this.canvas = React.createRef();
        this.temp = React.createRef();

        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onChangeLineWidth = this.onChangeLineWidth.bind(this);
        this.clear = this.clear.bind(this);
        this.undo = this.undo.bind(this);
        this.redo = this.redo.bind(this);
    }

    componentDidMount() {
        this.setPen(this.state.color);

        this.translate(30, 30);
    }

    /**
     * Copy the contents of the temp canvas to the main and clear temp
     */
    copyToFrontCanvas() {
        const ctx = this.canvas.current.getContext('2d');

        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(this.temp.current, 0, 0);

        this.clearTempCanvas();
    }

    clearTempCanvas() {
        const ctx = this.temp.current.getContext('2d');
        ctx.clearRect(0, 0, this.temp.current.width, this.temp.current.height);
    }

    /**
     * Start drawing once the canvas is left clicked
     *
     * @param {SyntheticEvent} e
     */
    onMouseDown(e) {
        if (e.buttons === 1) {
            this.drawing = true;

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
        if (this.drawing) {
            this.drawing = false;

            // Add line to our history stack
            this.pushHistory(
                this.state.tool,
                this.state.color,
                this.state.lineWidth,
                this.points
            );

            // Copy the current line to the main canvas and clear
            this.copyToFrontCanvas();
            this.points = [];
        }
    }

    /**
     * Track the mouse position on movement
     *
     * @param {SyntheticEvent} e
     */
    onMouseMove(e) {
        // If primary mouse is down while they're dragging in, start drawing.
        if (e.buttons === 1 && !this.drawing) {
            this.drawing = true;
        }

        if (this.drawing) {
            this.trackMouse(e);
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

    /**
     * Redraw the main canvas up to `historyIndex`
     */
    redraw(historyIndex) {
        const ctx = this.canvasContext;
        
        this.pushTransform();
        this.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.current.width, this.canvas.current.height);
        
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
                ctx.clearRect(0, 0, this.canvas.current.width, this.canvas.current.height);
            }
        }
    
        this.popTransform();
    }

    // /**
    //  * Draw the given "rule" to the canvas
    //  *
    //  * @param {object} role {tool, color, lineWidth, points}
    //  */
    // draw(ctx, rule) {
    //     if (rule.tool === 'pen') {
    //         this.pen(ctx, rule.color, rule.lineWidth, rule.points);
    //     } else {
    //         this.erase(ctx, rule.lineWidth, rule.points);
    //     }
    // }

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
        // ctx.globalCompositeOperation = 'source-over';

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

    erase(ctx, lineWidth, points) {
        const len = points.length;

        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.globalCompositeOperation = 'destination-out';

        if (points.length < 2) {
            ctx.arc(
                points[len - 1].x,
                points[len - 1].y,
                lineWidth / 2,
                0,
                Math.PI * 2
            );

            ctx.fill();
            ctx.closePath();
            return;
        }

        // Draw a curve for the last two points
        const control = points[len - 2];
        const end = points[len - 1];

        ctx.quadraticCurveTo(control.x, control.y, end.x, end.y);
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
                this.canvas.current.getContext('2d'),
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
                this.temp.current.getContext('2d'),
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
        }, this.rebuildCursorSVG());
    }

    setEraser() {
        this.setState({
            tool: 'erase',
            color: ''
        }, this.rebuildCursorSVG());
    }

    onChangeLineWidth(e) {
        const ctx = this.canvas.current.getContext('2d');
        const tempCtx = this.temp.current.getContext('2d');

        ctx.lineWidth = e.target.value;
        tempCtx.lineWidth = e.target.value;

        this.setState({
            lineWidth: e.target.value
        }, this.rebuildCursorSVG);
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
    clear() {
        const ctx = this.canvas.current.getContext('2d');
        ctx.clearRect(0, 0, this.canvas.current.width, this.canvas.current.height);

        this.pushHistory('clear', '', '', []);
    }

    /**
     * Load up a new SVG as our custom cursor based on the active tool
     */
    rebuildCursorSVG() {
        const size = parseInt(this.state.lineWidth, 10);
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

    pushTransform() {
        this.transformStack.push(
            this.transform.translate(0, 0)
        );

        this.canvasContext.save();
        this.tempContext.save();
    }

    popTransform() {
        this.transform = this.transformStack.pop();
        this.canvasContext.restore();
        this.tempContext.restore();
    }

    setTransform(a, b, c, d, e, f) {
        this.transform.a = a;
        this.transform.b = b;
        this.transform.c = c;
        this.transform.d = d;
        this.transform.e = e;
        this.transform.f = f;

        this.canvasContext.setTransform(a, b, c, d, e, f);
        this.tempContext.setTransform(a, b, c, d, e, f);
    }

    get canvasContext() {
        return this.canvas.current.getContext('2d');
    }

    get tempContext() {
        return this.temp.current.getContext('2d');
    }

    /**
     * Translate the canvas the specified distance (x, y)
     *
     * @param {integer} x
     * @param {integer} y
     */
    translate(x, y) {
        this.setState({
            translate: {
                x,
                y
            }
        });

        this.transform = this.transform.translate(x, y);
        this.canvasContext.translate(x, y);
        this.tempContext.translate(x, y);
    }

    scale(factor) {
        this.setState({
            scale: factor
        });

        this.transform = this.transform.scale(factor);
        this.canvasContext.scale(factor);
        this.tempContext.scale(factor);
    }

    /**
     * Scale wrapper for focus zooming on a given (x, y)
     * in DOM-space
     */
    zoom(factor, x, y) {
        let point = this.transformedPoint(x, y);

        this.translate(point.x, point.y);
        this.scale(Math.pow(1.1, factor));
        this.translate(-point.x, -point.y);

        this.redraw();
    }

    rotate(radians) {
        this.setState({
            rotate: radians
        });

        this.transform = this.transform.rotate(radians * 180 / Math.PI);
        this.canvasContext.rotate(radians);
        this.tempContext.rotate(radians);
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
            this.transform.inverse()
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

                <div class="draw-tools">
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

                    <button className="draw-clear" onClick={this.clear}>Clear</button>

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
            </div>
        );
    }
}

Draw.defaultProps = {
    width: 720,
    height: 480
}

export default Draw;
