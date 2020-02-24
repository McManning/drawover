
import React, { useState, DragEvent } from 'react';

import './Dropzone.scss';

type Props = {
    onFile(file: File): void;
};

/**
 * Region that files can be dropped into for loading
 */
const Dropzone: React.FC<Props> = ({
    onFile,
    children
}) => {
    const [active, setActive] = useState(false);

    const onDragEnter = (e: DragEvent<HTMLDivElement>) => {
        setActive(true);
        e.preventDefault();
    };
    
    const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
        setActive(false);
        e.preventDefault();
    };

    const onDrop = (e: DragEvent<HTMLDivElement>) => {
        setActive(false);
        e.preventDefault();

        let file: File | null = null;
        
        if (e.dataTransfer.items) {
            if (e.dataTransfer.items[0].kind === 'file') {
                file = e.dataTransfer.items[0].getAsFile();
            }
        } else if (e.dataTransfer.files.length) {
            file = e.dataTransfer.files[0];
        }

        if (file) {
            onFile(file);
        }
    };

    let className = 'dropzone';
    if (active) {
        className += ' is-active';
    }

    return (
        <div className={className}
            onDragOver={onDragEnter}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDrop={onDrop}>

            {children}

            <div className="dropzone-overlay">
                Drop files here, and other tales of help
            </div>
        </div>
    );
};

export default Dropzone;
