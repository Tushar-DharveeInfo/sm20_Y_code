
import { useEffect } from 'react';
import authSampleData from '../../../../sampledata/auth/AuthorizationSampleData.json';
const { sampleSessionId } = authSampleData;
import { getSmTabLabels } from '../signout/Signout';

interface IAppqaLaunch {
  uniqueName: string;
  handleLaunchFailed?: (error: Error) => void;
}

/**
 * AppQA Launch — opens a new browser tab for another session using sample session id.
 * Real apps read userSessionId from StatusBar; sample-data mode uses AuthorizationSampleData.
 * Tab label is SM-{existingSMTabs.length + 1}.
 */
const AppqaLaunch = (_props: IAppqaLaunch) => {
  useEffect(() => {
    const launchNewTab = async () => {
      const sessionVar =
        window.sessionStorage.getItem('session_id')
        || sampleSessionId;

      if (!sessionVar?.length) {
        console.warn('AppqaLaunch: no sample session id available to launch.');
        window.history.back();
        return;
      }

      const existingSMTabs = await getSmTabLabels();
      const newTabLabel = `SM-${existingSMTabs.length + 1}`;

      const currentUrl = new URL(window.location.origin);
      currentUrl.searchParams.set('isnew', 'true');
      currentUrl.searchParams.set('id', sessionVar);
      currentUrl.searchParams.set('tablabel', newTabLabel);

      // Open without noopener so tabs can still be coordinated if needed later.
      window.open(currentUrl.toString(), '_blank');

      // Return to previous feature/view after launching.
      window.history.back();
    };

    void launchNewTab();
  }, []);

  return null;
};

export default AppqaLaunch;
