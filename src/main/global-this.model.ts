/**
 * Module to set up globalThis and polyfills in main
 *
 * TODO: consider making this a normal exporting module so it's not using globalThis and using
 * NormalModuleReplacementPlugin to make sure the right one gets imported per process. Idea from
 * Bergi at https://stackoverflow.com/a/69982121 See
 * https://webpack.js.org/plugins/normal-module-replacement-plugin/
 */

import path from 'path';
import polyfillLocalStorage from '@node/polyfills/local-storage.polyfill';
import { ProcessType } from '@shared/global-this.model';
import { app } from 'electron';
import {
  ARG_LOG_LEVEL,
  ARG_PACKAGED,
  getCommandLineArgument,
  getCommandLineSwitch,
} from '@node/utils/command-line.util';
import { LogLevel } from 'electron-log';

// #region globalThis setup

globalThis.processType = ProcessType.Main;
// eslint-disable-next-line no-nested-ternary
globalThis.isPackaged = getCommandLineSwitch(ARG_PACKAGED) ? true : app ? app.isPackaged : false;
globalThis.resourcesPath = globalThis.isPackaged
  ? process.resourcesPath
  : path.join(__dirname, '../../');
globalThis.logLevel =
  // Assert the extracted type.
  // eslint-disable-next-line no-type-assertion/no-type-assertion
  (getCommandLineArgument(ARG_LOG_LEVEL) as LogLevel) ?? (globalThis.isPackaged ? 'info' : 'debug');

// #endregion

// #region polyfills

polyfillLocalStorage();

// #endregion
