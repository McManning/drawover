
import React from 'react';

/*
    File
        New
        ---
        Export
            individual draw frames
            save file
        Import
            save file

    View
        [Timeline]
        [x] Maya Controls
        [ ] New Thing

        [Onion Skinning]
        [3] Layers Behind

        [Debug]
        Encoding Info


    Help
        How to use
        ---
        About

    elsewhere:
        webworker configurations?
        hotkey management?
        local storage save/load/review?


*/

const MenuDivider = () => {
    return (
        <div className="menu-divider">
            ---
        </div>
    );
}

class MenuItem extends React.Component {
    render() {
        const { children } = this.props;

        return (
            <button>{children}</button>
        );
    }
}

class MenuList extends React.Component {
    render() {
        const { children, title } = this.props;

        return (
            <div className="menu-list">
                <button>{title}</button>
                {children}
            </div>
        );
    }
}

MenuList.defaultProps = {
    open: false,
    title: 'Menu'
};

class MenuBar extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className="menu-bar">
                <MenuList title="File">
                    <MenuItem>New</MenuItem>
                    <MenuItem>Import</MenuItem>
                    <MenuItem>Export</MenuItem>
                </MenuList>

                <MenuList title="View">
                    <MenuItem>New</MenuItem>
                    <MenuItem>Import</MenuItem>
                    <MenuItem>Export</MenuItem>
                </MenuList>

                <MenuList title="Help">
                    <MenuItem>How to Use</MenuItem>
                    <MenuDivider />
                    <MenuItem>About</MenuItem>
                </MenuList>
            </div>
        );
    }
}

MenuBar.defaultProps = {

};

export default MenuBar;
