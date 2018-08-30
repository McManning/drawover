
import React from 'react';
import ReactDOM from 'react-dom';

import './index.css';

import registerServiceWorker from './registerServiceWorker';

import App from './App';
import Draw from './Draw';
import Transform from './Transform';

// ReactDOM.render(
//     <Transform>
//         <Draw />
//     </Transform>,
//     document.getElementById('root')
// );

ReactDOM.render(<App/>, document.getElementById('root'));

registerServiceWorker();
