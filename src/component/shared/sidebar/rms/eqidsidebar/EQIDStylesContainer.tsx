import React from 'react';
import EQIDStyles from '../rmscollection/EQIDStyles';
import { Label } from '../../../basic/label/Label';

export interface IEQIDStylesContainerProps {
    uniqueName: string;
    label?: string;
}

export const EQIDStylesContainer: React.FC<IEQIDStylesContainerProps> = ({
    uniqueName,
    label = 'Shape Styles'
}) => {
    return (
        <div key={uniqueName} className='nz-eqid-styles-container' style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className='nz-sub-header'>
                <Label uniqueName={`${uniqueName}-header`} label={label} />
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
                <EQIDStyles initialStyles={[]} onSave={function (styles: string[]): void {
                    throw new Error('Function not implemented.');
                }} />
            </div>
        </div>
    );
};
