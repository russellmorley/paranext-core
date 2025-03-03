/**
 * Unified module for accessing API features in the extension host.
 *
 * WARNING: DO NOT IMPORT papi IN ANY FILE THAT papi IMPORTS AND EXPOSES.
 */

import * as commandService from '@shared/services/command.service';
import papiLogger from '@shared/services/logger.service';
import { papiNetworkService, PapiNetworkService } from '@shared/services/network.service';
import { WebViewServiceType } from '@shared/services/web-view.service-model';
import webViewService from '@shared/services/web-view.service';
import {
  papiWebViewProviderService,
  PapiWebViewProviderService,
} from '@shared/services/web-view-provider.service';
import internetService, { InternetService } from '@shared/services/internet.service';
import dataProviderService, {
  DataProviderService,
  DataProviderEngine as PapiDataProviderEngine,
} from '@shared/services/data-provider.service';
import {
  papiBackendProjectDataProviderService,
  PapiBackendProjectDataProviderService,
} from '@shared/services/project-data-provider.service';
import extensionStorageService, {
  ExtensionStorageService,
} from '@extension-host/services/extension-storage.service';
import { ProjectLookupServiceType } from '@shared/services/project-lookup.service-model';
import projectLookupService from '@shared/services/project-lookup.service';
import dialogService from '@shared/services/dialog.service';
import { DialogService } from '@shared/services/dialog.service-model';

// IMPORTANT NOTES:
// 1) When adding new services here, consider whether they also belong in papi-frontend.service.ts.
// 2) We need to provide type assertions for all members so they carry the JSDoc comments on the
// papi.d.ts file so extension developers see the comments. Please add to all properties you add.
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion, no-type-assertion/no-type-assertion */
// 3) The "JSDOC DESTINATION" comments are there to provide anchors for JSDocs to be copied in.
// Please add to all properties you add.
// 4) Anytime you add anything to PAPI also add it to the destructured export below
const papi = {
  // Classes
  /** JSDOC DESTINATION DataProviderEngine */
  DataProviderEngine: PapiDataProviderEngine,

  // Functions
  /** This is just an alias for internet.fetch */
  fetch: internetService.fetch,

  // Services/modules
  /** JSDOC DESTINATION commandService */
  commands: commandService,
  /** JSDOC DESTINATION papiWebViewService */
  webViews: webViewService as WebViewServiceType,
  /** JSDOC DESTINATION papiWebViewProviderService */
  webViewProviders: papiWebViewProviderService as PapiWebViewProviderService,
  /** JSDOC DESTINATION dialogService */
  dialogs: dialogService as DialogService,
  /** JSDOC DESTINATION papiNetworkService */
  network: papiNetworkService as PapiNetworkService,
  /** JSDOC DESTINATION logger */
  logger: papiLogger,
  /** JSDOC DESTINATION internetService */
  internet: internetService as InternetService,
  /** JSDOC DESTINATION dataProviderService */
  dataProviders: dataProviderService as DataProviderService,
  /** JSDOC DESTINATION papiBackendProjectDataProviderService */
  projectDataProviders:
    papiBackendProjectDataProviderService as PapiBackendProjectDataProviderService,
  /** JSDOC DESTINATION projectLookupService */
  projectLookup: projectLookupService as ProjectLookupServiceType,
  /** JSDOC DESTINATION extensionStorageService */
  storage: extensionStorageService as ExtensionStorageService,
};
/* eslint-enable */

// The PAPI object should not change at this point
Object.freeze(papi);

export default papi;

// This is the destructured export, if you add to the PAPI you need to add to this

/** JSDOC DESTINATION DataProviderEngine */
export const { DataProviderEngine } = papi;
Object.freeze(papi.DataProviderEngine);
/** This is just an alias for internet.fetch */
export const { fetch } = papi;
Object.freeze(papi.fetch);
/** JSDOC DESTINATION commandService */
export const { commands } = papi;
Object.freeze(papi.commands);
/** JSDOC DESTINATION papiWebViewService */
export const { webViews } = papi;
Object.freeze(papi.webViews);
/** JSDOC DESTINATION papiWebViewProviderService */
export const { webViewProviders } = papi;
Object.freeze(papi.webViewProviders);
/** JSDOC DESTINATION dialogService */
export const { dialogs } = papi;
Object.freeze(papi.dialogs);
/** JSDOC DESTINATION papiNetworkService */
export const { network } = papi;
Object.freeze(papi.network);
/** JSDOC DESTINATION logger */
export const { logger } = papi;
Object.freeze(papi.logger);
/** JSDOC DESTINATION internetService */
export const { internet } = papi;
Object.freeze(papi.internet);
/** JSDOC DESTINATION dataProviderService */
export const { dataProviders } = papi;
Object.freeze(papi.dataProviders);
/** JSDOC DESTINATION papiBackendProjectDataProviderService */
export const { projectDataProviders } = papi;
Object.freeze(papi.projectDataProviders);
/** JSDOC DESTINATION projectLookupService */
export const { projectLookup } = papi;
Object.freeze(papi.projectLookup);
/** JSDOC DESTINATION extensionStorageService */
export const { storage } = papi;
Object.freeze(papi.storage);
