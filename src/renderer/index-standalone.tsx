import '@renderer/global-this.model';
import { createRoot } from 'react-dom/client';
import * as networkService from '@shared/services/network.service';
import * as commandService from '@shared/services/command.service';
import { startWebViewService } from '@renderer/services/web-view.service-host';
import logger from '@shared/services/logger.service';
import webViewProviderService from '@shared/services/web-view-provider.service';
import { startDialogService } from '@renderer/services/dialog.service-host';
import App from './app.component-standalone';
import { cleanupOldWebViewState } from './services/web-view-state.service';
import { blockWebSocketsToPapiNetwork } from './services/renderer-web-socket.service';

logger.info('Starting renderer');

// This is a little different than Promise.all in that the error message will have all the reasons
// that all promises were rejected (if they didn't resolve).
async function runPromisesAndThrowIfRejected(...promises: Promise<unknown>[]) {
  const resolutions = await Promise.allSettled(promises);
  const rejections = resolutions.filter((resolution) => resolution.status === 'rejected');
  if (rejections.length === 0) return;

  const reasons = rejections.map((rejection, index) => {
    if (rejection.status !== 'rejected') return "Why doesn't TS know we already checked this?";
    return `[${index}]: ${rejection.reason}`;
  });
  throw new Error(`${reasons}`);
}

// App-wide service setup
// We are not awaiting these service startups for a few reasons:
// - They internally await other services when they need others in order to start
// - Nothing in this React tree requires the services to have started in order to get to first paint
// - If any of these fail, it is a very serious problem that we have not attempted to address up to
//   this point. TODO: https://github.com/paranext/paranext-core/issues/559
(async () => {
  try {
    await networkService.initialize();

    // This needs to run before web views start running and after the network service is running
    blockWebSocketsToPapiNetwork();

    await runPromisesAndThrowIfRejected(
      commandService.initialize(),
      webViewProviderService
        .initialize()
        .catch((err) => console.log(`Error in webViewProviderService.initialize: ${err}`)),
      startWebViewService().catch((err) => console.log(`Error in startWebViewService: ${err}`)),
      startDialogService().catch((err) => console.log(`Error in startDialogService: ${err}`)),
    );
  } catch (e) {
    logger.error(`Service(s) failed to initialize! Error: ${e}`);
  }
})();

const container = document.getElementById('root');
if (!container) {
  throw new Error('Document root element not found!');
}

// localStorage.clear();
localStorage.removeItem('client-network-connector:clientGuid');
const root = createRoot(container);
root.render(<App />);

// This doesn't run if the renderer has an uncaught exception (which is a good thing)
window.addEventListener('beforeunload', () => {
  cleanupOldWebViewState();
});
