
import { useCallback, useEffect, useState } from 'react';
import { getRuntimeConfig, signOut } from "@n20a/libauth";
import { YesNoFormContainer } from '../../../shared/basic/yesnoformcontainer/YesNoFormContainer.tsx';
import { IAppqaSignout } from '../allinterface/IAppqaSignout.ts';
import sampleOpenSessions from '../../../../smsampledata/appqa/SignoutSampleData.json';

const closeSampleSession = async (_sessionId: string): Promise<void> => {
  await Promise.resolve();
};

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

function AppqaSignout(appqasignoutprops: IAppqaSignout) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [openSessions, setOpenSessions] = useState<Record<string, any>[]>();
  const { AUTH_TYPE } = getRuntimeConfig();

  useEffect(() => {
    // API DISABLED: SESSION.GetOpenSession.
    // axiosInterceptor({ url: SESSION.GetOpenSession, ... }, statusBarContext);
    setOpenSessions(sampleOpenSessions);
    setIsOpen(sampleOpenSessions.length > 0);
  }, []);

  const closeSession = (
    sessionId: string
  ): Promise<void> => {
    // API DISABLED: SESSION.CloseSession.
    // return axiosInterceptor({ url: SESSION.CloseSession, ... }, statusBarContext);
    return closeSampleSession(sessionId);
  };

  const handleYesButtonClick = useCallback(async () => {
    if (!openSessions?.length) {
      return;
    }
    try {
      const promises: Promise<void>[] = [];
      for (const session of openSessions) {
        if (session.UserSessionID) {
          promises.push(
            closeSession(session.UserSessionID)
          );
        }
      }

      // Use allSettled to ensure all sessions are attempted even if any one fails
      const results = await Promise.allSettled(promises);

      // Check for any failures and log them
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        console.warn(`Failed to close ${failures.length} of ${results.length} sessions:`, failures);
      }

      const smTabLabels = await getSmTabLabels();
      console.log('Detected SM- tab labels:', smTabLabels);

      // Sign out all browser tabs whose label begins with "SM-"
      try {
        console.log('Broadcasting signout command to all SM- tabs');
        const channel = new BroadcastChannel('sm-tab-control');

        // Send the message multiple times with longer intervals to ensure delivery
        for (let i = 0; i < 10; i++) {
          setTimeout(() => {
            channel.postMessage({ action: 'signout-all-tabs' });
            console.log(`Broadcast sent (attempt ${i + 1})`);
          }, i * 50);
        }

        // Close channel after all messages have been sent
        setTimeout(() => {
          channel.close();
          console.log('Broadcast channel closed');
        }, 600);
      } catch (error) {
        console.warn('Failed to broadcast signout message:', error);
      }

      // Clear session storage and sign out current tab
      window.sessionStorage.removeItem('session_variables');
      signOut(AUTH_TYPE);

      // Close or navigate current tab after giving broadcasts time to reach other tabs
      setTimeout(() => {
        if (document.title.startsWith('SM-')) {
          console.log('Current tab is SM- tab, attempting to close');
          window.close();

          // Fallback if this is the last tab and can't be closed
          setTimeout(() => {
            if (!window.closed) {
              console.log('Could not close current tab, navigating to blank page');
              window.location.replace('about:blank');
            }
          }, 500);
        } else {
          console.log('Current tab is not SM- tab, navigating to home');
          window.location.replace('/');
        }
      }, 700);
    } catch (error) {
      console.error(error);
      appqasignoutprops.handleCloseFailed?.(
        error instanceof Error
          ? error
          : new Error("Failed to close sessions")
      );
    }
  }, [
    openSessions,
    AUTH_TYPE,
    appqasignoutprops
  ]);

  const handleNoButtonClick = useCallback(() => {
    setIsOpen(false);
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.replace("/");
    }
    appqasignoutprops.handleCloseFailed?.(new Error("User cancelled session close"));
  }, [appqasignoutprops]);

  return (
    <>
      {
        isOpen &&
        <YesNoFormContainer
          uniqueName={`${appqasignoutprops.uniqueName}-close-popup`}
          message={
            "Are you sure you want to close all open sessions? \n\n If you select 'Yes', all open Sessions will be closed and all browser tabs will be closed."
          }
          isOpen={isOpen}
          handleYesButtonClick={handleYesButtonClick}
          handleNoButtonClick={handleNoButtonClick}
          dialogTitle="Close Sessions"
        />
      }
    </>
  );
}

export { getSmTabLabels };
export default AppqaSignout;
