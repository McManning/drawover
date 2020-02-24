
import React from 'react';

/**
 * Editing tools
 */
class Tools extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className="tools">
                <div className="tools-sidebar">

                </div>
                <div className="tools-children">
                    {this.props.children}
                </div>
            </div>
        );
    }
}

export default Tools;

/*

Shift down - swap to transform tool
Shift up - swap back to previous tool

Scroll wheel - if shift, fire onTransform
Click drag - if shift, fire onTransform

mouse move, need movementX, movementY
scroll wheel, need offsetXY and deltaXY

need a reset transform action as well


Could refactor Transform to have a:
    transform(domDeltaX, domDeltaY)
    zoom(domOffsetX, domOffsetY, factor)

*/