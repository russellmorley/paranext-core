import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { ProcessType } from '@shared/global-this.model';
import { PlatformEventEmitter } from 'platform-bible-utils';
import App from '@renderer/app.component';

// #region globalThis setup

globalThis.processType = ProcessType.Renderer;
globalThis.isPackaged = false;
globalThis.resourcesPath = 'resources://';

// #endregion

jest.mock('@shared/services/network.service', () => ({
  createRequestFunction:
    (requestType: string) =>
    async (...args: unknown[]) =>
      `Mocked ${requestType} request with args ${args.join(', ')}`,
  createNetworkEventEmitter: () => {
    return new PlatformEventEmitter();
  },
  papiNetworkService: {
    createNetworkEventEmitter: () => {
      return new PlatformEventEmitter();
    },
    onDidClientConnect: new PlatformEventEmitter().event,
  },
}));
jest.mock('@renderer/components/docking/platform-dock-layout.component', () => ({
  __esModule: true,
  default: /** ParanextDockLayout Mock */ () => undefined,
}));

describe('App', () => {
  it('should render', async () => {
    expect(render(<App />)).toBeTruthy();
  });
});
