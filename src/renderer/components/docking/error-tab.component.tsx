import { TabInfo } from '@shared/data/web-view.model';
import { newGuid } from '@shared/utils/util';

export default function ErrorTab({ errorMessage }: { errorMessage: string }) {
  return (
    <>
      <div>
        Content could not be loaded. Please make sure you have the correct extension loaded.
      </div>
      <div>Message: {errorMessage}</div>
    </>
  );
}

/**
 * Creates a new error message tab with the specified error message
 */
export const createErrorTab = (errorMessage: string): TabInfo => {
  return {
    id: newGuid(),
    tabType: 'error',
    tabTitle: 'Error',
    content: <ErrorTab errorMessage={errorMessage} />,
    minWidth: 150,
    minHeight: 150,
  };
};
