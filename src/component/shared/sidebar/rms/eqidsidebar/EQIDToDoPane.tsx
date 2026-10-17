import React from 'react';
import { EQIDReminder } from './EQIDReminder';

interface IEQIDToDoPaneProps {
  eqid?: string;
  ticket?: any;
  selectedNode?: any;
}

export const EQIDToDoPane: React.FC<IEQIDToDoPaneProps> = (props) => {
  return <EQIDReminder {...props} />;
};

export default EQIDToDoPane;
