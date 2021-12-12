import { Component } from 'react';
import './App.css';

const electron = require('electron');

type MyProps = Record<string, unknown>;
type MyState = {
  connected: string;
};

class App extends Component<MyProps, MyState> {
  _drsEnabled = false;

  constructor(props: MyProps) {
    super(props);

    this.state = {
      connected: 'Disconnected',
    };

    electron.ipcRenderer.on('connection', (event, message) => {
      this.setState({
        connected: message,
      });
    });
  }

  render() {
    const localState = this.state;
    return (
      <div>
        <h1>iDRS</h1>
        <h2>{localState.connected}</h2>
      </div>
    );
  }
}

export default App;
