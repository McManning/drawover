
import React, { Component, MouseEvent, WheelEvent, KeyboardEvent, ReactElement } from 'react';
import Transform from '../utility/Transform';

type Props = {

};

type State = {
    transform: Transform;
    active: boolean;
};

/**
 * Component that controls matrix transforms of children
 *
 * All children are expected to have `transform: Transform` property
 * that gets updated when the user changes the transform.
 *
 * Transformation can be controlled and updated by input shortcuts:
 *  - Pan (translate): Shift + Mouse Move
 *  - Zoom (scale): Shift + Scroll Wheel
 *  - Rotate: TBD
 *
 * Example:
 *  <Transform>
 *      <Draw ... />
 *      <Video ... />
 *  </Transform>
 */
export default class TransformEditor extends Component<Props, State> {
    static defaultProps = {

    };

    public readonly state: State = {
        transform: new Transform(),
        active: false
    }

    private matrix = new window.DOMMatrixReadOnly();

    constructor(props: Props) {
        super(props);

        this.onMouseDownCapture = this.onMouseDownCapture.bind(this);
        this.onMouseMoveCapture = this.onMouseMoveCapture.bind(this);
        this.onWheelCapture = this.onWheelCapture.bind(this);
        this.onKeyDownCapture = this.onKeyDownCapture.bind(this);
        this.onKeyUpCapture = this.onKeyUpCapture.bind(this);
    }

    /**
     * Event capture to watch for a transform toggle and prevent
     * children from getting the same hotkey
     */
    private onKeyDownCapture(e: KeyboardEvent<HTMLDivElement>) {
        if (e.keyCode === 16) { // Shift
            this.setState({
                active: true
            });

            e.stopPropagation();
        }
    }

    /**
     * Event capture to watch for a transform toggle and prevent
     * children from getting the same hotkey
     */
    private onKeyUpCapture(e: KeyboardEvent<HTMLDivElement>) {
        if (e.keyCode === 16) { // Shift
            this.setState({
                active: false
            });

            e.stopPropagation();
        }
    }

    /**
     * Event capture to ensure that children do not get mouse events
     * while a transformation tool is active
     */
    private onMouseDownCapture(e: MouseEvent<HTMLDivElement>) {
        if (!this.state.active) {
            return;
        }

        // if (e.buttons === 2) {
        //     const point = this.localSpace(
        //         e.nativeEvent.offsetX,
        //         e.nativeEvent.offsetY
        //     );

        //     this.rotate(
        //         // e.nativeEvent.movementY,
        //         0.78,
        //         point.x,
        //         point.y
        //     );

        //     e.stopPropagation();
        //     return;
        // }

        e.stopPropagation();
    }

    /**
     * Event capture to ensure that children do not get mouse events
     * while a transformation tool is active
     */
    private onMouseMoveCapture(e: MouseEvent<HTMLDivElement>) {
        if (!this.state.active) {
            return;
        }

        // If dragging with Mouse 1, translate
        if (e.buttons === 1) {
            const invScale = 1 / this.state.transform.scale;
            const x = e.nativeEvent.movementX * invScale;
            const y = e.nativeEvent.movementY * invScale;

            // Apply rotations
            // let rx = x*Math.cos(-this.state.rotate) - y*Math.sin(-this.state.rotate);
            // let ry = x*Math.sin(-this.state.rotate) + y*Math.cos(-this.state.rotate);

            this.translate(x, y);
            e.stopPropagation();
            return;
        }
    }

    private onWheelCapture(e: WheelEvent<HTMLDivElement>) {
        if (!this.state.active) {
            return;
        }

        if (e.deltaY === 0 && e.deltaX === 0) {
            return;
        }

        // Get the sign of the scroll wheel - as we don't want actual pixel-level scroll.
        // We fallback to deltaX for mice that have inverted wheels
        const sign = Math.sign(e.deltaY !== 0 ? e.deltaY : e.deltaX);
        const factor = Math.pow(1.1, sign);

        // Center the zoom on wherever the mouse cursor is located in local space
        const point = this.localSpace(
            e.nativeEvent.offsetX,
            e.nativeEvent.offsetY
        );

        this.zoom(factor, point.x, point.y);

        e.stopPropagation();
    }

    public translate(x: number, y: number) {
        this.matrix = this.matrix.translate(x, y);

        const transform = this.state.transform;
        transform.translate.x = this.matrix.e;
        transform.translate.y = this.matrix.f;

        this.setState({ transform });
    }

    /**
     * Zoom to a given (x, y) in local space
     */
    public zoom(factor: number, x: number, y: number) {
        this.matrix = this.matrix.translate(x, y);
        this.matrix = this.matrix.scale(factor, factor);
        this.matrix = this.matrix.translate(-x, -y);

        // Since zooming on a point affects translation,
        // we extract our new translation and update that
        // alongside our new scale
        const transform = this.state.transform;
        transform.translate.x = this.matrix.e;
        transform.translate.y = this.matrix.f;
        transform.scale *= factor;

        this.setState({ transform });
    }

    /**
     * Rotate about a point (x, y) in local space
     */
    public rotate(rad: number, x: number, y: number) {
        throw new Error('Not supported');
    }

    /**
     * Resets this transform to the identity matrix
     */
    public reset() {
        this.matrix = new window.DOMMatrixReadOnly();

        const transform = new Transform();
        this.setState({ transform });
    }

    /**
     * Convert a DOM-space point to transformation local space
     */
    public localSpace(x: number, y: number): DOMPoint {
        const inv = this.matrix.inverse();

        return new DOMPoint(
            x * inv.a + y * inv.c + inv.e,
            x * inv.b + y * inv.d + inv.f,
            0, 1
        );
    }

    render() {
        const { transform } = this.state;

        const children = React.Children.map(this.props.children, (child) => {
            return React.cloneElement(child as ReactElement, { transform });
        });

        return (
            <div className="transform"
                onMouseDownCapture={this.onMouseDownCapture}
                onMouseMoveCapture={this.onMouseMoveCapture}
                onWheelCapture={this.onWheelCapture}
                onKeyDownCapture={this.onKeyDownCapture}
                onKeyUpCapture={this.onKeyUpCapture}
            >
                {children}
            </div>
        );
    }
}

