
import React from 'react';

/**
 * Transformation component that controls transforms of children
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
                x: 50,
                y: 50
            },

            // Scale - in pixels (2 = 2x2 pixels per source pixel)
            scale: 0.5,

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

        // Worker SVG for doing matrix math
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

        // Transformation matrix
        this.matrix = this.svg.createSVGMatrix();
    }

    rotate(rad) {
        this.setState({
            rotate: rad
        });
    }

    /**
     * Event capture to ensure that children do not get mouse events
     * while a transformation tool is active
     */
    onMouseDownCapture(e) {
        if (!this.state.active) {
            return;
        }

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

        // Only translate if dragging
        if (e.buttons !== 1) {
            return;
        }

        const invScale = 1 / this.state.scale;

        this.translate(
            e.nativeEvent.movementX * invScale,
            e.nativeEvent.movementY * invScale
        );

        e.stopPropagation();
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
        const translate = Object.assign({}, this.state.translate);
        translate.x += x;
        translate.y += y;

        // this.matrix = this.matrix.translate(x, y);

        this.setState({
            translate: translate,
            matrix: this.state.matrix.translate(x, y)
        });

        this.setState({ translate });
    }

    /**
     * Zoom to a given (x, y) in local space
     */
    zoom(factor, x, y) {
        // This doesn't work because we need to do these ops on a matrix,
        // rather than in properties. UNLESS each operation waits for setState
        // - but that sucks. There needs to be a setState AFTER all of these
        // are said and done. Other option is to store it all in the matrix,
        // and just decompose affine transformations out of that via maths.
        this.translate(x, y);
        this.scale(factor);
        this.translate(-x, -y);
    }

    /**
     * Convert a DOM-space point to transformation local space
     *
     * @param {integer} x
     * @param {integer} y
     */
    localSpace(x, y) {
        let point = this.svg.createSVGPoint();
        point.x = x;
        point.y = y;

        return point.matrixTransform(
            this.matrix.inverse()
        );
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
