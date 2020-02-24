
import React from 'react';
import Icon from '../common/Icon';
import IconButton from '../common/IconButton';

import './Playback.scss';

type Props = {
    playing?: boolean;
    speed?: number;
    onPause(): void;
    onPlay(): void;
    onSkipFrame(offset: number): void;
    onSkipKey(offset: number): void;
    onSpeed(speed: number): void;
};

/**
 * Video playback control UI to toggle play state and jump frames
 */
const Playback: React.FC<Props> = ({
    playing = false,
    speed = 1,
    onPause,
    onPlay,
    onSkipFrame,
    onSkipKey,
    onSpeed
}) => (
    <div className="playback">
        <div className="playback-speed">
            <select value={speed} onChange={(e) => onSpeed(parseFloat(e.target.value))}>
                <option value="0.25">0.25x</option>
                <option value="0.5">0.5x</option>
                <option value="1">1x</option>
                <option value="2">2x</option>
            </select>
            <Icon name="angle-down" />
        </div>

        <IconButton title="Skip to beginning" name="fast-backward"
            onClick={() => onSkipFrame(-Number.MAX_SAFE_INTEGER)} />

        <IconButton title="Skip to previous frame" name="step-backward"
            onClick={() => onSkipFrame(-1)} />

        <IconButton title="Skip to previous key" name="step-backward"
            className="playback-prev-key" onClick={() => onSkipKey(-1)} />

        {!playing &&
            <IconButton title="Play" name="play" onClick={onPlay} />
        }

        {playing &&
            <IconButton title="Pause" name="pause" onClick={onPause} />
        }

        <IconButton title="Skip to next key" name="step-forward"
            className="playback-next-key"  onClick={() => onSkipKey(1)} />

        <IconButton title="Skip to next frame" name="step-forward"
            onClick={() => onSkipFrame(1)} />

        <IconButton title="Skip to end" name="fast-forward"
            onClick={() => onSkipFrame(Number.MAX_SAFE_INTEGER)} />
    </div>
);

export default Playback;
