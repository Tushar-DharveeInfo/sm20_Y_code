
import { useEffect } from 'react';


interface IAppqaLaunch {
  uniqueName: string;
  handleLaunchFailed?: (error: Error) => void;
}
const SM_TAB_PREFIX = 'SM-';

const getSmTabLabels = async (): Promise<string[]> => {
  const currentTitle = document.title;
  const initialLabels = currentTitle.startsWith(SM_TAB_PREFIX) ? [currentTitle] : [];
  const labels = new Set<string>(initialLabels);

  try {
    const channel = new BroadcastChannel('sm-tab-control');
    const requestId = `sm-tabs-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const listener = (event: MessageEvent) => {
      if (event.data?.action !== 'response-sm-tab-label') return;
      if (event.data?.requestId !== requestId) return;

      const label = event.data?.label;
      if (typeof label === 'string' && label.startsWith(SM_TAB_PREFIX)) {
        labels.add(label);
      }
    };

    channel.addEventListener('message', listener);
    channel.postMessage({ action: 'request-sm-tab-label', requestId });

    await new Promise((resolve) => setTimeout(resolve, 150));

    channel.removeEventListener('message', listener);
    channel.close();
  } catch (error) {
    console.warn('Failed to query SM- tab labels:', error);
  }

  return Array.from(labels);
};


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
        || "sampleSessionId";

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
