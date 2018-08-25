
import React from 'react';
import ReactDOM from 'react-dom';

import './index.css';

import registerServiceWorker from './registerServiceWorker';

import App from './App';
import Draw from './Draw';

ReactDOM.render(<Draw />, document.getElementById('root'));
registerServiceWorker();
