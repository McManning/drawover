
import React from 'react';

/**
 * Component that controls matrix transforms of children
 *
 * All children are expected to have `translate`, `scale`, `rotate`
 * properties that are updated as this component accepts user input
 * to update transformations.
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
class Transform extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            // Translation - in pixels
            translate: {
                x: 0,
                y: 0
            },

            // Scale - in pixels (2 = 2x2 pixels per source pixel)
            scale: 1,

            // Rotation - in radians
            rotate: 0,

            // Whether or not we're actively transforming the children
            active: false
        };

        this.onMouseDownCapture = this.onMouseDownCapture.bind(this);
        this.onMouseMoveCapture = this.onMouseMoveCapture.bind(this);
        this.onWheelCapture = this.onWheelCapture.bind(this);
        this.onKeyDownCapture = this.onKeyDownCapture.bind(this);
        this.onKeyUpCapture = this.onKeyUpCapture.bind(this);

        this.matrix = new window.DOMMatrixReadOnly();
    }

    /**
     * Event capture to watch for a transform toggle and prevent
     * children from getting the same hotkey
     */
    onKeyDownCapture(e) {
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
    onKeyUpCapture(e) {
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
    onMouseDownCapture(e) {
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
    onMouseMoveCapture(e) {
        if (!this.state.active) {
            return;
        }

        // If dragging with Mouse 1, translate
        if (e.buttons === 1) {
            const invScale = 1 / this.state.scale;
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

    onWheelCapture(e) {
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

    translate(x, y) {
        this.matrix = this.matrix.translate(x, y);

        this.setState({
            translate: {
                x: this.matrix.e,
                y: this.matrix.f
            }
        });
    }

    /**
     * Zoom to a given (x, y) in local space
     */
    zoom(factor, x, y) {
        this.matrix = this.matrix.translate(x, y);
        this.matrix = this.matrix.scale(factor, factor);
        this.matrix = this.matrix.translate(-x, -y);

        // Since zooming on a point affects translation,
        // we extract our new translation and update that
        // alongside our new scale
        this.setState({
            translate: {
                x: this.matrix.e,
                y: this.matrix.f
            },
            scale: this.state.scale * factor
        });
    }

    /**
     * Rotate about a point (x, y) in local space
     */
    rotate(rad, x, y) {
        throw new Error('Not supported');
    }

    /**
     * Resets this transform to the identity matrix
     */
    reset() {
        this.matrix = new window.DOMMatrixReadOnly();

        this.setState({
            translate: {
                x: 0,
                y: 0
            },
            scale: 1,
            rotate: 0
        });
    }

    /**
     * Convert a DOM-space point to transformation local space
     *
     * @param {integer} x
     * @param {integer} y
     */
    localSpace(x, y) {
        const point = new window.DOMPoint(x, y);
        return point.matrixTransform(this.matrix.inverse());
    }

    render() {
        const { translate, scale, rotate } = this.state;

        const children = React.Children.map(this.props.children, (child) => {
            return React.cloneElement(child, {
                translate,
                scale,
                rotate
            });
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

export default Transform;
