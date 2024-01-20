/**
 * This module executes inside of electron's main process. You can start electron renderer process
 * from here and communicate with the other processes through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to `./src/main.js`
 * using webpack. This gives us some performance wins.
 */
// Removed until we have a release. See https://github.com/paranext/paranext-core/issues/83
/* import { autoUpdater } from 'electron-updater'; */
// import path from 'path';
import '@main/global-this.model';
import dotnetDataProvider from '@main/services/dotnet-data-provider.service';
import logger from '@shared/services/logger.service';
import * as networkService from '@shared/services/network.service';
import * as commandService from '@shared/services/command.service';
// import { resolveHtmlPath } from '@node/utils/util';
import extensionHostService from '@main/services/extension-host.service';
import networkObjectService from '@shared/services/network-object.service';
// import extensionAssetProtocolService from '@main/services/extension-asset-protocol.service';
// import { wait } from '@shared/utils/util';
import { CommandNames } from 'papi-shared-types';
import { serialize } from '@shared/utils/papi-util';
import networkObjectStatusService from '@shared/services/network-object-status.service';
import { get } from '@shared/services/project-data-provider.service';
import { VerseRef } from '@sillsdev/scripture';
import { startNetworkObjectStatusService } from './services/network-object-status.service-host';

const PROCESS_CLOSE_TIME_OUT = 2000;

// `main.ts`'s command handler declarations are in `command.service.ts` so they can be picked up
// by papi-dts
// This map should allow any functions because commands can be any function type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const commandHandlers: { [commandName: string]: (...args: any[]) => any } = {
  'test.echo': async (message: string) => {
    return message;
  },
  'test.echoRenderer': async (message: string) => {
    /* const start = performance.now(); */
    /* const result =  */ await commandService.sendCommand('test.addThree', 1, 4, 9);
    /* logger.debug(
      `test.addThree(...) = ${result} took ${performance.now() - start} ms`,
    ); */
    return message;
  },
  'test.echoExtensionHost': async (message: string) => {
    await commandService.sendCommand('test.addMany', 3, 5, 7, 1, 4);
    return message;
  },
  'test.throwError': async (message: string) => {
    throw new Error(`Test Error thrown in throwError command: ${message}`);
  },
  'platform.restartExtensionHost': async () => {
    restartExtensionHost();
  },
};

async function main() {
  // The network service relies on nothing else, and other things rely on it, so start it first
  await networkService.initialize();

  // The network object status service relies on seeing everything else start up later
  await startNetworkObjectStatusService();

  // The .NET data provider relies on the network service and nothing else
  dotnetDataProvider.start();

  // TODO (maybe): Wait for signal from the .NET data provider process that it is ready

  // The extension host service relies on the network service.
  // Extensions inside the extension host might rely on the .NET data provider and each other
  // Some extensions inside the extension host rely on the renderer to accept 'getWebView' commands.
  // The renderer relies on the extension host, so something has to break the dependency loop.
  // For now, the dependency loop is broken by retrying 'getWebView' in a loop for a while.
  await extensionHostService.start();

  // extensionAssetProtocolService.initialize();

  // TODO (maybe): Wait for signal from the extension host process that it is ready (except 'getWebView')
  // We could then wait for the renderer to be ready and signal the extension host

  // Extension host test
  setTimeout(async () => {
    logger.debug(
      `Add Many (from EH): ${await commandService.sendCommand('test.addMany', 2, 5, 9, 7)}`,
    );
  }, 20000);

  Object.entries(commandHandlers).forEach(([commandName, handler]) => {
    // Re-assert type after passing through `forEach`.
    // eslint-disable-next-line no-type-assertion/no-type-assertion
    commandService.registerCommand(commandName as CommandNames, handler);
  });

  // Set our custom protocol handler to load assets from extensions
  // extensionAssetProtocolService.initialize();
  // eslint-disable-next-line no-bitwise
  setInterval(() => {}, 1 << 30);

  const testMain = {
    doStuff: (stuff: string) => {
      const result = `testMain did stuff: ${stuff}!`;
      logger.debug(result);
      return result;
    },
    dispose: () => {
      logger.debug('testMain.dispose() ran in testMain');
      return Promise.resolve(true);
    },
  };

  try {
    const testMainDisposer = await networkObjectService.set('testMain', testMain);
    testMain.doStuff('main things');
    testMainDisposer.onDidDispose(() => {
      logger.debug('testMain disposed in main message #1');
    });
    testMainDisposer.onDidDispose(() => {
      logger.debug('testMain disposed in main message #2');
    });
    setTimeout(testMainDisposer.dispose, 30000);
  } catch (err) {
    logger.error(`Test testMain.doStuff() resulted in error: ${err}`);
  }
  setTimeout(async () => {
    try {
      let testExtensionHost = await networkObjectService.get<{
        getVerse: () => Promise<string>;
      }>('testExtensionHost');
      if (testExtensionHost) {
        logger.debug(`get verse: ${await testExtensionHost.getVerse()}`);
        testExtensionHost.onDidDispose(() => {
          logger.debug('testExtensionHost disposed in main');
          testExtensionHost = undefined;
        });
      } else logger.error('Could not get testExtensionHost from main');
    } catch (err) {
      logger.error(`Test testExtensionHost.getVerse() resulted in error: ${err}`);
    }
  }, 10000);

  setTimeout(async () => {
    try {
      logger.info(
        `Available network objects after 30 seconds: ${serialize(
          await networkObjectStatusService.getAllNetworkObjectDetails(),
        )}`,
      );
    } catch (err) {
      logger.error(
        `Test networkObjectStatusService.getAllNetworkObjectDetails() resulted in error: ${err}`,
      );
    }
  }, 30000);

  // #endregion

  // #region Test a .NET data provider
  setTimeout(async () => {
    try {
      const paratextPdp = await get<'ParatextStandard'>(
        'ParatextStandard',
        '32664dc3288a28df2e2bb75ded887fc8f17a15fb',
      );
      const verse = await paratextPdp.getChapterUSX(new VerseRef('JHN', '1', '1'));
      logger.info(`Got PDP data: ${verse}`);

      if (verse !== undefined)
        await paratextPdp.setChapterUSX(new VerseRef('JHN', '1', '1'), verse);

      paratextPdp.setExtensionData(
        { extensionName: 'foo', dataQualifier: 'fooData' },
        'This is the data from extension foo',
      );
    } catch (err) {
      logger.error(`Test paratext get/setChapterUSX resulted in error: ${err}`);
    }
  }, 40000);
  // #endregion
}

async function restartExtensionHost() {
  await extensionHostService.waitForClose(PROCESS_CLOSE_TIME_OUT);
  await extensionHostService.start();
}

(async () => {
  logger.info('Beginning main script');
  await main();
  logger.info('Completed main script');
})().catch(logger.error);
