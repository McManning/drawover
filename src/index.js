
import React from 'react';
import ReactDOM from 'react-dom';

import './index.css';

import registerServiceWorker from './registerServiceWorker';

import App from './App';

// Activate the debug library on non-production using a key in localStorage
if (process.env.NODE_ENV !== 'production') {
    localStorage.setItem('debug', 'drawover:*');
}

ReactDOM.render(<App/>, document.getElementById('root'));

registerServiceWorker();
