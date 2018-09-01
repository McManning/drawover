
import React from 'react';

/**
 * Video playback control UI:
 *  - Play/pause
 *  - Jump to start/end, Jump 1 or 5 frames either direction
 *  - Playback speed (1x, 0.5x, etc)
 *
 * <Playback
 *      playing={false} speed={1}
 *      onPause={callback}
 *      onSkip={callback(offset)}
 *      onPlay={callback}
 *      onSpeed={callback(speed)}
 * />
 *
 */
class Playback extends React.Component {
    constructor(props) {
        super(props);

        this.onClickPlay = this.onClickPlay.bind(this);
        this.onClickPause = this.onClickPause.bind(this);
        this.onSelectSpeed = this.onSelectSpeed.bind(this);
    }

    onClickPlay() {
        if (this.props.onPlay) {
            this.props.onPlay();
        }
    }

    onClickPause() {
        if (this.props.onPause) {
            this.props.onPause();
        }
    }

    /**
     * @param {SyntheticEvent} e
     */
    onSelectSpeed(e) {
        if (this.props.onSpeed) {
            this.props.onSpeed(parseFloat(e.target.value, 10));
        }
    }

    /**
     * Fire `onSkip` for the given offset
     *
     * @param {Number} offset
     */
    skip(offset) {
        if (this.props.onSkip) {
            this.props.onSkip(offset);
        }
    }

    render() {
        return (
            <div className="playback">
                {!this.props.playing &&
                    <button onClick={this.onClickPlay}>Play</button>
                }

                {this.props.playing &&
                    <button onClick={this.onClickPause}>Pause</button>
                }

                <button onClick={() => this.skip(1)}>+1</button>
                <button onClick={() => this.skip(-1)}>-1</button>
                <button onClick={() => this.skip(5)}>+5</button>
                <button onClick={() => this.skip(-5)}>-5</button>

                <button onClick={() => this.skip(-Number.MAX_SAFE_INTEGER)}>Start</button>
                <button onClick={() => this.skip(Number.MAX_SAFE_INTEGER)}>End</button>

                <select value={this.props.speed} onChange={this.onSelectSpeed}>
                    <option value="0.25">0.25x</option>
                    <option value="0.5">0.5x</option>
                    <option value="1">1x</option>
                    <option value="2">2x</option>
                </select>
            </div>
        );
    }
}

Playback.defaultProps = {
    playing: false,
    speed: 1,

    onPause: null,
    onPlay: null,
    onSkip: null,
    onSpeed: null
};

export default Playback;
