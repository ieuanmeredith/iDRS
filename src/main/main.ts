/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import path from 'path';
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';

const sound = require('sound-play');
const irsdk = require('node-irsdk-2021');

enum DrsStatus {
  'Not Available' = 0,
  'Approaching' = 1,
  'Enabled' = 2,
  'On' = 3,
}

let LastDRSStatus = 0;
let mainWindow: BrowserWindow | null = null;

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDevelopment =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDevelopment) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDevelopment) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 200,
    height: 200,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.on('new-window', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    const longPath = getAssetPath(`beep-02.mp3`);
    const shortPath = getAssetPath(`beep-07.mp3`);

    console.log(longPath);

    sound.play(longPath);

    irsdk.init({
      sessionInfoUpdateInterval: 2000,
      telemetryUpdateInterval: 64, // 15 ticks per second
    });

    const iracing = irsdk.getInstance();
    mainWindow?.webContents.send('connection', 'Disconnected');

    iracing.on('Connected', () => {
      mainWindow?.webContents.send('connection', 'Connected');
    });

    iracing.on('Disconnected', () => {
      mainWindow?.webContents.send('connection', 'Disconnected');
    });

    iracing.on('Telemetry', (data: { DrsStatus: number }) => {
      const localLast = LastDRSStatus;

      if (LastDRSStatus !== data.DrsStatus) {
        LastDRSStatus = data.DrsStatus;
      }

      switch (data.DrsStatus) {
        case DrsStatus.Enabled:
          if (localLast === DrsStatus.Approaching) {
            sound.play(longPath);
          }
          break;

        case DrsStatus.On:
          if (localLast === DrsStatus.Enabled) {
            sound.play(shortPath);
          }
          break;
        default:
          break;
      }
    });
  });
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
