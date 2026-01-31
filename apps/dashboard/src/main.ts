import './components/App.js';
import { connect } from './api/websocket.js';
import { handleWSMessage } from './state/signals.js';
import { subscribe } from './api/websocket.js';

connect();
subscribe('*', handleWSMessage);
