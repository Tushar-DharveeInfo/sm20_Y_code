import React from 'react';
import { EQIDReminder } from './EQIDReminder';

interface IEQIDReminderPaneProps {
  eqid?: string;
  ticket?: any;
  selectedNode?: any;
}

export const EQIDReminderPane: React.FC<IEQIDReminderPaneProps> = (props) => {
  return <EQIDReminder {...props} />;
};

export default EQIDReminderPane;
