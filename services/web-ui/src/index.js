import axios from 'axios';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import App from './container/app';
import { updateConfig } from './conf';

import configureStore, { history } from './store';

import * as serviceWorker from './serviceWorker';


(async () => {
    updateConfig((await axios.get('/config')).data);
    ReactDOM.render(
        <Provider store={configureStore()}>
            <Router history={history}>
                <App />
            </Router>
        </Provider>,
        document.getElementById('root'),
    );
})();


// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
