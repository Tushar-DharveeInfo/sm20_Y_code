import React from 'react';
import { FqaEqidToDo } from './FqaEqidToDo';

interface IEQIDToDoPaneProps {
  eqid?: string;
  ticket?: any;
  selectedNode?: any;
}

export const EQIDToDoPane: React.FC<IEQIDToDoPaneProps> = (props) => {
  return <FqaEqidToDo {...props} />;
};

export default EQIDToDoPane;
