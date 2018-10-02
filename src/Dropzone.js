
import React from 'react';
import './Dropzone.scss';

/**
 * Region that files can be dropped into for loading.
 *
 * <Dropzone onFile={callable} />
 */
class Dropzone extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            active: false
        }

        this.onDragEnter = this.onDragEnter.bind(this);
        this.onDragLeave = this.onDragLeave.bind(this);
        this.onDrop = this.onDrop.bind(this);
    }

    onDragEnter(e) {
        this.setState({
            active: true
        });

        e.preventDefault();
    }

    onDragLeave(e) {
        this.setState({
            active: false
        });

        e.preventDefault();
    }

    onDrop(e) {
        e.preventDefault();

        let file;

        if (e.dataTransfer.items) {
            if (e.dataTransfer.items[0].kind === 'file') {
                file = e.dataTransfer.items[0].getAsFile();
            }
        } else if (e.dataTransfer.files.length) {
            file = e.dataTransfer.files[0];
        }

        this.setState({
            active: false
        });

        if (file && this.props.onFile) {
            this.props.onFile(file);
        }
    }

    render() {
        const { active } = this.state;

        return (
            <div className={'dropzone ' + (active ? 'is-active' : '')}
                onDragOver={this.onDragEnter}
                onDragEnter={this.onDragEnter}
                onDragLeave={this.onDragLeave}
                onDrop={this.onDrop}>

                {this.props.children}

                <div className="dropzone-overlay">
                    Drop files here, and other tales of help
                </div>
            </div>
        );
    }
}

Dropzone.defaultProps = {
    onFile: null
};

export default Dropzone;
