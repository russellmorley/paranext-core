import { Unsubscriber, deserialize, serialize, PlatformEventEmitter } from 'platform-bible-utils';
import { SettingNames, SettingTypes } from 'papi-shared-types';

/** Event to set or update a setting */
export type UpdateSettingEvent<SettingName extends SettingNames> = {
  type: 'update-setting';
  setting: SettingTypes[SettingName];
};

/** Event to remove a setting */
export type ResetSettingEvent = {
  type: 'reset-setting';
};

/** All supported setting events */
export type SettingEvent<SettingName extends SettingNames> =
  | UpdateSettingEvent<SettingName>
  | ResetSettingEvent;

/** All message subscriptions - emitters that emit an event each time a setting is updated */
const onDidUpdateSettingEmitters = new Map<
  SettingNames,
  PlatformEventEmitter<SettingEvent<SettingNames>>
>();

/**
 * Retrieves the value of the specified setting
 *
 * @param key The string id of the setting for which the value is being retrieved
 * @param defaultSetting The default value used for the setting if no value is available for the key
 * @returns The value of the specified setting, parsed to an object. Returns default setting if
 *   setting does not exist
 */
const getSetting = <SettingName extends SettingNames>(
  key: SettingName,
  defaultSetting: SettingTypes[SettingName],
): SettingTypes[SettingName] => {
  const settingString = localStorage.getItem(key);
  // Null is used by the external API
  // eslint-disable-next-line no-null/no-null
  if (settingString !== null) {
    return deserialize(settingString);
  }
  return defaultSetting;
};

/**
 * Sets the value of the specified setting
 *
 * @param key The string id of the setting for which the value is being retrieved
 * @param newSetting The value that is to be stored. Setting the new value to `undefined` is the
 *   equivalent of deleting the setting
 */
const setSetting = <SettingName extends SettingNames>(
  key: SettingName,
  newSetting: SettingTypes[SettingName],
) => {
  localStorage.setItem(key, serialize(newSetting));
  // Assert type of the particular SettingName of the emitter.
  // eslint-disable-next-line no-type-assertion/no-type-assertion
  const emitter = onDidUpdateSettingEmitters.get(key);
  const setMessage: UpdateSettingEvent<SettingName> = {
    setting: newSetting,
    type: 'update-setting',
  };
  emitter?.emit(setMessage);
};

/**
 * Removes the setting from memory
 *
 * @param key The string id of the setting for which the value is being removed
 */
const resetSetting = <SettingName extends SettingNames>(key: SettingName) => {
  localStorage.removeItem(key);
  // Assert type of the particular SettingName of the emitter.
  // eslint-disable-next-line no-type-assertion/no-type-assertion
  const emitter = onDidUpdateSettingEmitters.get(key);
  const resetMessage: ResetSettingEvent = { type: 'reset-setting' };
  emitter?.emit(resetMessage);
};

/**
 * Subscribes to updates of the specified setting. Whenever the value of the setting changes, the
 * callback function is executed.
 *
 * @param key The string id of the setting for which the value is being subscribed to
 * @param callback The function that will be called whenever the specified setting is updated
 * @returns Unsubscriber that should be called whenever the subscription should be deleted
 */
const subscribeToSetting = <SettingName extends SettingNames>(
  key: SettingName,
  callback: (newSetting: SettingEvent<SettingName>) => void,
): Unsubscriber => {
  // Assert type of the particular SettingName of the emitter.
  // eslint-disable-next-line no-type-assertion/no-type-assertion
  let emitter = onDidUpdateSettingEmitters.get(key) as
    | PlatformEventEmitter<SettingEvent<SettingName>>
    | undefined;
  if (!emitter) {
    emitter = new PlatformEventEmitter<SettingEvent<SettingName>>();
    onDidUpdateSettingEmitters.set(
      key,
      // Assert type of the general SettingNames of the emitter.
      // eslint-disable-next-line no-type-assertion/no-type-assertion
      emitter as PlatformEventEmitter<SettingEvent<SettingNames>>,
    );
  }
  return emitter.subscribe(callback);
};

// Declare an interface for the object we're exporting so that JSDoc comments propagate
export interface SettingsService {
  get: typeof getSetting;
  set: typeof setSetting;
  reset: typeof resetSetting;
  subscribe: typeof subscribeToSetting;
}

/**
 * JSDOC SOURCE settingsService
 *
 * Service that allows to get and set settings in local storage
 */
const settingsService: SettingsService = {
  get: getSetting,
  set: setSetting,
  reset: resetSetting,
  subscribe: subscribeToSetting,
};
export default settingsService;
