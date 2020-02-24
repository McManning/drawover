
import React, { Component, createRef, MouseEvent, TouchEvent, KeyboardEvent, ChangeEvent } from 'react';

import Transform from '../utility/Transform';
import PenEditor from './PenEditor';
import { Point, Pen } from '../types';
import { svgToDataUri } from '../utility/misc';

import './Draw.scss';

import Logger from '../utility/Logger';
const log = new Logger('Draw');

type Event = {
    tool: number;
    color: string;
    lineWidth: number;
    points: Point[];
};

type Props = {
    readonly: boolean;

    /**
     * Previously serialized draw data to load back onto the canvas 
     */
    source?: ArrayBuffer;

    opacity: number;
    width: number;
    height: number;
    transform: Transform;
    
    onDraw(): void;
    onClear(): void;
};

type State = {
    // Active tool information
    tool: number;
    color: string;
    lineWidth: number;

    previousTool: number;

    toolsVisible: boolean;
    toolsOrigin: {
        top: number;
        left: number;
    };

    // Undo stack / serializable stroke info
    history: Event[];

    // Where we are in the undo stack
    historyIndex: number;

    empty: boolean;

    /**
     * SVG data URI for a dynamically generated cursor to match
     * the tool that the user is currently using with the canvas
     */
    cursor: string;
};

/**
 * Frame drawover
 *
 * ```
 * <Draw width="720" height="480" readonly={boolean}
 *       scale="1" rotate="0" translate={x: 0, y: 0}
 *       source={ArrayBuffer}
 *       onDraw={callable} onClear={callable} />
 * ```
 * 
 * Includes basic draw tools:
 *  - brush size
 *  - brush color
 *  - eraser
 *
 * Includes a history stack for undo/redo and storing
 * strokes in a more lightweight data format than a canvas image.
 */
export default class Draw extends Component<Props, State> {
    static PEN_TOOL = 1;
    static ERASE_TOOL = 2;
    static CLEAR_TOOL = 3;

    static defaultProps = {
        readonly: false,
        opacity: 1,
    
        transform: new Transform()
    };

    public readonly state: State = {
        tool: 0,
        color: '#000000',
        lineWidth: 5,

        previousTool: 0,
        
        toolsVisible: false,
        toolsOrigin: {
            top: 0,
            left: 0
        },

        history: [],
        historyIndex: 0,

        empty: true,

        cursor: ''
    };

    // Data points kept out of state since they're localized
    // only to the canvas element and updated very frequently
    private points: Point[] = [];
    private dragging: boolean = false;
    private mouseX: number = 0;
    private mouseY: number = 0;

    private matrix = new window.DOMMatrixReadOnly();

    private canvas = createRef<HTMLCanvasElement>();
    private temp = createRef<HTMLCanvasElement>();

    private touchIdentifier: number | null = null;
    
    constructor(props: Props) {
        super(props);

        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onTouchStart = this.onTouchStart.bind(this);
        this.onTouchEnd = this.onTouchEnd.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchCancel = this.onTouchCancel.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onChangePen = this.onChangePen.bind(this);
        this.onClear = this.onClear.bind(this);
        this.onContextMenu = this.onContextMenu.bind(this);
        this.undo = this.undo.bind(this);
        this.redo = this.redo.bind(this);
    }

    componentDidMount() {
        // Set initial canvas transformation from props
        this.applyTransform(this.props.transform);

        // Add non-React event listener for context menu
        // (right click) and a default pen
        if (!this.props.readonly) {
            this.temp.current?.addEventListener('contextmenu', this.onContextMenu);
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
    componentDidUpdate(prevProps: Props, prevState: State) {
        // On tool change or line width change, update our custom cursor to match
        if (prevState.tool !== this.state.tool ||
            prevState.lineWidth !== this.state.lineWidth
        ) {
            this.redrawCursorSVG();
        }

        // If any of the transformation props change, re-transform
        if (!this.props.transform.equals(prevProps.transform)) {
            this.applyTransform(this.props.transform);
        }

        // If history updated, update the cached empty status
        if (prevState.historyIndex !== this.state.historyIndex) {
            this.setState({
                empty: this.isEmpty()
            });
        }
    }

    /**
     * End the current line being drawn with the pen or eraser tools
     *
     * This will copy whatever is rendered on the temp canvas
     * onto the main canvas, and clear the temp.
     */
    private endCurrentLine() {
        if (!this.points.length || !this.temp.current) {
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
     */
    private onMouseDown(e: MouseEvent<HTMLCanvasElement>) {
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
     * to treat both as a line ender
     */
    private onMouseUp(e: MouseEvent<HTMLCanvasElement>) {
        if (this.dragging) {
            this.dragging = false;
            this.endCurrentLine();
        }
    }

    /**
     * Track the mouse position on movement
     */
    private onMouseMove(e: MouseEvent<HTMLCanvasElement>) {
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
     */
    private onTouchStart(e: TouchEvent<HTMLCanvasElement>) {
        log.debug('Touch Start', e);
        const touches = e.changedTouches;

        // If we're not tracking touch yet, track first
        if (this.touchIdentifier === null) {
            const touch = touches[0];

            this.touchIdentifier = touch.identifier;

            this.dragging = true;
            this.trackTouch(touch);
            this.draw();
        }

        // Everything else - we ignore. Single touch only
    }

    /**
     * Finger lifts from touch input
     */
    private onTouchEnd(e: TouchEvent<HTMLCanvasElement>) {
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
     */
    private onTouchCancel(e: TouchEvent<HTMLCanvasElement>) {
        log.debug('Touch Cancel', e);
        this.onTouchEnd(e);
    }

    /**
     * Finger touch move event - draw more lines
     */
    private onTouchMove(e: TouchEvent<HTMLCanvasElement>) {
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
     */
    private onKeyDown(e: KeyboardEvent<HTMLCanvasElement>) {
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
     */
    private onContextMenu(e: any) {
        // TODO: Typed to 'any' because this is a mouse event that
        // isn't compatible with React's mouse event (due to addEventListener
        // being the way this was mounted) - should it go through React?
        // Why wasn't I going through React in the first place?

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
     */
    private trackMouse(e: MouseEvent<HTMLCanvasElement>) {
        const point = this.domToLocalSpace(
            e.nativeEvent.offsetX,
            e.nativeEvent.offsetY
        );

        this.mouseX = point.x;
        this.mouseY = point.y;
    }

    private trackTouch(touch: React.Touch) {
        const point = this.domToLocalSpace(
            touch.pageX,
            touch.pageY
            // TODO: TS complains that offsetLeft/offsetTop don't exist
            // touch.pageX - touch.target.offsetLeft,
            // touch.pageY - touch.target.offsetTop
        );

        this.mouseX = point.x;
        this.mouseY = point.y;
    }

    /**
     * Clear the temporary canvas used for storing the current line
     */
    private clearTemp() {
        const ctx = this.tempContext;

        if (ctx && this.temp.current) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, this.temp.current.width, this.temp.current.height);
            ctx.restore();
        }
    }

    /**
     * Clear both canvas but persist draw history
     */
    private clear() {
        const ctx = this.canvasContext;
        const r = this.canvasRect;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, r.width, r.height);
        ctx.restore();

        this.clearTemp();
    }

    /**
     * Redraw the main canvas up to `historyIndex`
     *
     * @param {Number} historyIndex in range [0, history.length]
     */
    private redraw(historyIndex: number) {
        this.clear();

        // Run through the history and redraw each tool onto the main canvas
        for (let i = 0; i < historyIndex; i++) {
            const event = this.state.history[i];

            if (event.tool === Draw.ERASE_TOOL) {
                this.pen(
                    this.canvasContext,
                    '',
                    event.lineWidth,
                    event.points,
                    'destination-out'
                );
            } else if (event.tool === Draw.PEN_TOOL) {
                this.pen(
                    this.canvasContext,
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
     * @param {Context2D}       ctx         Target canvas context
     * @param {string}          color       Hex color code
     * @param {number}          lineWidth   Stroke size of the pen
     * @param {Point[]}         points      Array of {x, y} pairs in canvas space
     * @param {string}          operation   A globalCompositeOperation for the
     *                                      stroke (e.g. `source-over`)
     */
    private pen(
        ctx: CanvasRenderingContext2D, 
        color: string, 
        lineWidth: number, 
        points: Point[], 
        operation: string
    ) {
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
    private draw() {
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
        } else if (this.tempContext) {
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
    private setPen(color: string) {
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
    private setEraser() {
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
    private onChangePen(pen: Pen) {
        this.canvasContext.lineWidth = pen.width;
        if (this.tempContext) {
            this.tempContext.lineWidth = pen.width;
        }

        this.setState({ 
            lineWidth: pen.width,
            color: pen.color
        });
    }

    private get canvasContext(): CanvasRenderingContext2D {
        const ctx = this.canvas.current?.getContext('2d');
        if (!ctx) {
            throw new Error('No canvas context');
        }

        return ctx;
    }

    /**
     * This will return null if the component was rendered
     * without a temp canvas (e.g. in `readonly` mode)
     */
    private get tempContext(): CanvasRenderingContext2D | null {
        const ctx = this.temp.current?.getContext('2d') || null;
        return ctx;
    }

    private get canvasRect() {
        const canvas = this.canvas.current;
        if (!canvas) {
            throw new Error('No canvas ref');
        }

        return {
            width: canvas.width,
            height: canvas.height
        }
    };

    /**
     * Add a new stroke or operation to the history stack
     *
     * @param {number} tool One of the *_TOOL constants
     * @param {string} color Hex color code (if PEN_TOOL)
     * @param {number} lineWidth Stroke size
     * @param {Point[]} points {x, y} coordinate pairs (canvas space)
     */
    private pushHistory(tool: number, color: string, lineWidth: number, points: Point[]) {
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
    private undo() {
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
    private redo() {
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
    private reset() {
        this.clear();
        this.setState({
            history: [],
            historyIndex: 0
        });
    }

    /**
     * Returns true if there is currently no rendered content
     */
    private isEmpty(): boolean {
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
     */
    private serialize(): ArrayBuffer {
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

        let buffer: number[] = [];

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
     */
    private deserialize(buffer: ArrayBuffer) {
        const int16 = new Int16Array(buffer);
        const deserialized: Event[] = [];

        let i = 0;

        while (i < int16.length) {
            // Read event header
            const event: Event = {
                tool: int16[i],
                color: '#' +
                    int16[i + 1].toString(16).padStart(2, '0') +
                    int16[i + 2].toString(16).padStart(2, '0') +
                    int16[i + 3].toString(16).padStart(2, '0'),
                lineWidth: int16[i + 4],
                points: []
            };

            i += 5;

            // Read point data
            const plen = int16[i];
            const points: Point[] = [];

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
    private onClear() {
        this.clear();
        this.pushHistory(Draw.CLEAR_TOOL, '', 0, []);

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
    private redrawCursorSVG() {
        const size = this.state.lineWidth * this.props.transform.scale;
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
            cursor: `${svgToDataUri(svg)} ${rad+padding} ${rad+padding}, crosshair`
        });
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
     */
    private applyTransform(transform: Transform) {
        const { translate, scale, rotate } = transform;
        const canvasCtx = this.canvasContext;
        const tempCtx = this.tempContext;

        log.info('Transform', translate, scale, rotate);

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
     */
    private domToLocalSpace(x: number, y: number) {
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
    private renderHistory() {
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

    render() {
        // Temp canvas is rendered directly on top of the main canvas so that
        // it gets input events and drawn lines are copied down to the underlying
        // persistent canvas. The temp canvas and all its event handlers will NOT
        // be rendered if this canvas is in readonly mode.
        return (
            <div className="draw" style={{ opacity: this.props.opacity }}>
                {!this.props.readonly &&
                    <canvas ref={this.temp} className="draw-temp" tabIndex={0}
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

                {this.state.toolsVisible && 
                    <PenEditor
                        position={this.state.toolsOrigin}
                        onChange={this.onChangePen}
                        pen={{ 
                            color: this.state.color, 
                            width: this.state.lineWidth
                        }}
                    />
                }
            </div>
        );
    }
}
