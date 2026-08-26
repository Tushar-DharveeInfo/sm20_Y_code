import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type JSX, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useTheme } from 'styled-components';
import { registerAgCharts, ChartContainer } from '@n20a/libchart';
import '@n20a/libchart/ChartContainer.css';
import { Close24x24 } from '@n20a/libicon';
import './DashbordChart.css';
import {
    IChartApiItem,
    IChartOptions,
    IDashboardChart,
    IChartProfileItem,
    TChartProfileRow,
    TChartRecord,
    TSeriesRecord,
} from './IDashboardChart';
import { ActionImage } from '../../../shared/basic/actionimage/ActionImage';
import { FnGetCssVariable } from '../../../appcontainer/allcommon/FnGetCssVariable';
import { FnParseJsonSafely } from '../../../appcontainer/allcommon/FnParseJsonSafely';
import { useResourceContext } from '../../../shared/context/hooks/ResourceHooks';

registerAgCharts();

type TChartTypography = {
    titleFontSize?: number;
    subtitleFontSize?: number;
    legendFontSize?: number;
    labelFontSize?: number;
    labelColor?: string;
    axisLabelFontSize?: number;
    axisTitleFontSize?: number;
};

const TYPOGRAPHY_KEYS: (keyof TChartTypography)[] = [
    'titleFontSize',
    'subtitleFontSize',
    'legendFontSize',
    'labelFontSize',
    'labelColor',
    'axisLabelFontSize',
    'axisTitleFontSize',
];

type TChartDataSetItem = {
    CPName?: string;
    ChartData?: { Data?: unknown[] };
};

type TChartApiFile =
    | IChartApiItem[]
    | { ChartDataSet?: TChartDataSetItem[] }
    | { apiname?: string; response?: unknown[]; data?: unknown[] };

const unwrapChartProfiles = (data: unknown): IChartProfileItem[] => {
    if (Array.isArray(data)) {
        return data as IChartProfileItem[];
    }

    if (!data || typeof data !== 'object') {
        return [];
    }

    const root = data as Record<string, unknown>;

    if (Array.isArray(root._ChartProfile)) {
        return root._ChartProfile as IChartProfileItem[];
    }

    const entityData = root.EntityData;
    if (Array.isArray(entityData) && entityData[0] && typeof entityData[0] === 'object') {
        const dataset = (entityData[0] as Record<string, unknown>).Dataset;
        if (dataset && typeof dataset === 'object') {
            const profiles = (dataset as Record<string, unknown>)._ChartProfile;
            if (Array.isArray(profiles)) {
                return profiles as IChartProfileItem[];
            }
        }
    }

    return [];
};

const cpNameToApiKey = (cpName: string): string =>
    `get_${cpName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')}`;

const toChartApiItems = (data: TChartApiFile): IChartApiItem[] => {
    if (Array.isArray(data)) {
        return data.map((item) => item as IChartApiItem);
    }

    if (data && typeof data === 'object' && Array.isArray(data.ChartDataSet as any)) {
        return data.ChartDataSet
            .filter((item): item is TChartDataSetItem & { CPName: string } => !!item?.CPName)
            .map((item) => ({
                apiname: item.CPName,
                url: '',
                payload: {},
                response: Array.isArray(item.ChartData?.Data) ? item.ChartData.Data : [],
                data: Array.isArray(item.ChartData?.Data) ? item.ChartData.Data : [],
            }))
            .flatMap((item) => [
                item,
                {
                    ...item,
                    apiname: cpNameToApiKey(item.apiname),
                },
            ]);
    }

    return [];
};

const normalizeApiKey = (value: string): string =>
    value
        .toLowerCase()
        .replace(/^.*\//, '')
        .replace(/[^a-z0-9]/g, '');

const matchChartApi = (
    chartDatasetApi: string,
    chartApis: IChartApiItem[],
    chartProfileName?: string
): IChartApiItem | undefined => {
    const targets = [chartDatasetApi, chartProfileName]
        .filter((value): value is string => !!value)
        .map(normalizeApiKey);

    return chartApis.find((item) => {
        const name = normalizeApiKey(item.apiname ?? '');
        return targets.some(
            (target) =>
                name === target ||
                name.includes(target) ||
                target.includes(name)
        );
    });
};

const extractChartTypography = (
    source: Record<string, unknown>,
    seriesItem?: Record<string, unknown>
): TChartTypography => ({
    titleFontSize: (source.titleFontSize ?? seriesItem?.titleFontSize) as number | undefined,
    subtitleFontSize: (source.subtitleFontSize ?? seriesItem?.subtitleFontSize) as number | undefined,
    legendFontSize: (source.legendFontSize ?? seriesItem?.legendFontSize) as number | undefined,
    labelFontSize: (source.labelFontSize ?? seriesItem?.labelFontSize) as number | undefined,
    labelColor: (source.labelColor ?? seriesItem?.labelColor) as string | undefined,
    axisLabelFontSize: (source.axisLabelFontSize ?? seriesItem?.axisLabelFontSize) as number | undefined,
    axisTitleFontSize: (source.axisTitleFontSize ?? seriesItem?.axisTitleFontSize) as number | undefined,
});

const stripChartTypography = <T extends Record<string, unknown>>(item: T): T => {
    const result = { ...item };
    for (const key of TYPOGRAPHY_KEYS) {
        delete result[key];
    }
    return result;
};

const parseChartOptions = (chartOptions: unknown): IChartOptions => {
    if (!chartOptions) {
        return { series: [] };
    }

    if (typeof chartOptions === 'string') {
        const parsed = FnParseJsonSafely(chartOptions) as unknown;
        if (parsed && typeof parsed === 'object') {
            return parsed as IChartOptions;
        }
        return { series: [] };
    }

    if (typeof chartOptions === 'object') {
        return chartOptions as IChartOptions;
    }

    return { series: [] };
};

const buildChartConfig = (chartProfile: TChartProfileRow): TChartRecord => {
    const seriesOptions = parseChartOptions(chartProfile.ChartOptions);
    const chartData = chartProfile?.ChartData
        ? Array.isArray(chartProfile.ChartData)
            ? chartProfile.ChartData
            : [chartProfile.ChartData]
        : [];
    const firstSeriesConfig = (seriesOptions.series || [])[0] as TSeriesRecord | undefined;
    const typography = extractChartTypography(
        seriesOptions as Record<string, unknown>,
        firstSeriesConfig
    );
    const series = (seriesOptions.series || []).map((s: TSeriesRecord) => ({
        ...stripChartTypography(s),
        data: chartData.filter((row: unknown) => {
            const rowData = row && typeof row === 'object' ? (row as TChartRecord) : {};
            const xKey = s.xKey;
            const yKey = s.yKey;
            const angleKey = s.angleKey;
            if (angleKey) {
                return rowData[String(angleKey)] !== undefined;
            }
            return (
                (!xKey || rowData[String(xKey)] !== undefined) &&
                (!yKey || rowData[String(yKey)] !== undefined)
            );
        }),
    }));

    return {
        IsNZ: chartProfile.IsNZ ? 1 : 0,
        EntityName: 'Dashboard',
        GroupName: chartProfile.GroupName,
        Description: chartProfile.Description,
        ChartType: chartProfile.ChartType?.toLowerCase(),
        SortOrder: chartProfile.SortOrder,
        Enabled: chartProfile.Enabled ? 1 : 0,
        noLabel: false,
        series,
        title: seriesOptions?.title ?? chartProfile._ChartProfile,
        subtitle: seriesOptions?.subtitle ?? chartProfile.Description,
        legend: seriesOptions?.legend,
        _ChartProfile: chartProfile._ChartProfile,
        ...typography,
    };
};

function DashboardChart(ChartsProps: IDashboardChart) {
    const { chartApiJson, chartProfileJson } = useResourceContext();
    const [visibleCharts, setVisibleCharts] = useState<JSX.Element[]>([]);
    const [chartRecords, setChartRecords] = useState<TChartRecord[]>();
    const [numberOfColumnsChart] = useState<number>(ChartsProps.displayPerRow ?? 2);
    const [selectedCard, setSelectedCard] = useState<TChartRecord[] | null>(null);
    const [showSelectedCard, setShowSelectedCard] = useState<JSX.Element[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [fullscreenChart, setFullscreenChart] = useState<TChartRecord | null>(null);

    const styledTheme = useTheme();
    const themeName = (styledTheme as { name?: string }).name ?? 'light';
    const chartTheme = useMemo(
        () => ({
            params: {
                backgroundColor: styledTheme.colors.bgExplorer,
                foregroundColor: '#000000',
                chromeBackgroundColor: styledTheme.colors.ChartButtonBackground,
                chromeTextColor: '#000000',
            },
        }),
        [styledTheme]
    );

    const containerRef = useRef<HTMLDivElement | null>(null);
    const fullscreenContainerRef = useRef<HTMLDivElement | null>(null);

    const handleChartFullscreen = useCallback((chartRow: TChartRecord) => {
        setFullscreenChart(chartRow);
        window.setTimeout(() => {
            void fullscreenContainerRef.current?.requestFullscreen?.();
        }, 0);
    }, []);

    const exitChartFullscreen = useCallback(() => {
        if (document.fullscreenElement) {
            void document.exitFullscreen();
        }
        setFullscreenChart(null);
    }, []);

    const prepareCardChart = useCallback(
        (thisChartRow: TChartRecord, activeChartTheme: unknown, chartIndex: number) => (
            <Fragment key={`nz-chart-${chartIndex}-${themeName}`}>
                <ChartContainer
                    uniqueName={`${thisChartRow?.ChartType}-${chartIndex}-${themeName}`}
                    chartTheme={activeChartTheme}
                    chartType={
                        thisChartRow?.ChartType as
                        | 'bar'
                        | 'line'
                        | 'pie'
                        | 'area'
                        | 'multibar'
                        | 'radial-gauge'
                    }
                    onDoubleClick={() => {
                        setSelectedCard([thisChartRow]);
                    }}
                    Fullscreen={(data: TChartRecord) => {
                        handleChartFullscreen(
                            data && typeof data === 'object' ? data : thisChartRow
                        );
                    }}
                    outputFormat={'jsx'}
                    ChartData={thisChartRow}
                />
            </Fragment>
        ),
        [handleChartFullscreen, themeName]
    );

    const handleContainerKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (!containerRef.current) {
            return;
        }

        const focusableSelectors = [
            'button:not([disabled])',
            '[href]',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])',
        ].join(',');

        const focusableElements = Array.from(
            containerRef.current.querySelectorAll<HTMLElement>(focusableSelectors)
        ).filter((element) => element.offsetParent !== null);

        if (!focusableElements.length) {
            return;
        }

        const activeIndex = focusableElements.indexOf(document.activeElement as HTMLElement);
        const currentIndex = activeIndex >= 0 ? activeIndex : 0;
        const moveFocusTo = (index: number) => {
            const boundedIndex = Math.max(0, Math.min(index, focusableElements.length - 1));
            focusableElements[boundedIndex]?.focus();
        };

        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault();
            moveFocusTo(currentIndex + 1);
            return;
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault();
            moveFocusTo(currentIndex - 1);
            return;
        }
        if (event.key === 'Home') {
            event.preventDefault();
            moveFocusTo(0);
            return;
        }
        if (event.key === 'End') {
            event.preventDefault();
            moveFocusTo(focusableElements.length - 1);
        }
    }, []);

    useEffect(() => {
        if (!chartApiJson || !chartProfileJson) {
            setLoading(true);
            return;
        }

        const loadCharts = () => {
            setLoading(true);
            setChartRecords(undefined);

            try {
                const profiles = unwrapChartProfiles(chartProfileJson);
                const chartApis = toChartApiItems(chartApiJson as TChartApiFile);
                let chartDataSet = profiles.filter((item) => item.Enabled !== false);

                if (ChartsProps.isDashboard === false && ChartsProps.selectedNode?.NodeEntityname) {
                    const selectedNodeEntityName =
                        ChartsProps.selectedNode.NodeEntityname.toString().toLowerCase();
                    chartDataSet = chartDataSet.filter(
                        (item) =>
                            item.EntityNames &&
                            item.EntityNames.toString().toLowerCase().includes(selectedNodeEntityName)
                    );
                    chartDataSet = chartDataSet.filter((item) =>
                        ChartsProps.purpose
                            ? item.Purpose?.toLowerCase() === ChartsProps.purpose.toLowerCase()
                            : item.Purpose?.toLowerCase() === 'chart usage'
                    );
                } else {
                    chartDataSet = chartDataSet.filter(
                        (item) => item.Purpose?.toLowerCase() === 'dashboard'
                    );
                }

                chartDataSet = [...chartDataSet].sort(
                    (a, b) => (a.SortOrder ?? 0) - (b.SortOrder ?? 0)
                );

                const chartApiData: TChartProfileRow[] = [];

                for (const element of chartDataSet) {
                    if (!element.ChartDatasetAPI) {
                        continue;
                    }

                    const matchedApi = matchChartApi(
                        element.ChartDatasetAPI,
                        chartApis,
                        element._ChartProfile
                    );
                    const rowData = matchedApi?.response ?? matchedApi?.data;

                    if (Array.isArray(rowData)) {
                        const withData: TChartProfileRow = {
                            ...element,
                            ChartData: rowData,
                        };
                        withData.ChartData = buildChartConfig(withData);
                        chartApiData.push(withData);
                    } else {
                        chartApiData.push({ ...element, ChartData: null });
                    }
                }

                const records = chartApiData
                    .map((row) => row.ChartData as TChartRecord | null)
                    .filter((chartData): chartData is TChartRecord => !!chartData);

                setChartRecords(records);
            } catch (error) {
                console.error('Error loading privatecharts dashboard:', error);
                setChartRecords([]);
            } finally {
                setLoading(false);
            }
        };

        loadCharts();
    }, [
        ChartsProps.featureId,
        ChartsProps.isDashboard,
        ChartsProps.purpose,
        ChartsProps.selectedNode?.NodeEntityname,
        chartApiJson,
        chartProfileJson,
    ]);

    useEffect(() => {
        if (!chartRecords?.length) {
            setVisibleCharts([]);
            return;
        }

        setVisibleCharts(
            chartRecords.map((thisChartRow, chartIndex) =>
                prepareCardChart(thisChartRow, chartTheme, chartIndex)
            )
        );
    }, [chartRecords, chartTheme, prepareCardChart]);

    useEffect(() => {
        if (selectedCard && Array.isArray(selectedCard)) {
            setShowSelectedCard(
                selectedCard.map((thisChartRow, chartIndex) =>
                    prepareCardChart({ ...thisChartRow, noLabel: false }, chartTheme, chartIndex)
                )
            );
        }
    }, [selectedCard, chartTheme, prepareCardChart]);

    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') {
                return;
            }
            if (fullscreenChart || document.fullscreenElement) {
                exitChartFullscreen();
                return;
            }
            if (selectedCard) {
                setSelectedCard(null);
                setShowSelectedCard(null);
            }
        };

        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [fullscreenChart, selectedCard, exitChartFullscreen]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            if (!document.fullscreenElement) {
                setFullscreenChart(null);
            }
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    useEffect(() => {
        if (!loading && chartRecords?.length === 0) {
            ChartsProps.handleShowUserMessage?.('Charts data not found to display');
        }
    }, [chartRecords, loading, ChartsProps.handleShowUserMessage]);

    const handleMouse = useCallback(() => {
        setShowSelectedCard(null);
        setSelectedCard(null);
    }, []);

    return (
        <>
            {!ChartsProps.hideHeader && (
                <div className="nz-form-title-bar nz-grid-container-header">
                    <div className="nz-form-title-header nz-main-header-title">
                        <div className="nz-property-main-header">
                            <span className="nz-property-bar-title-span">{ChartsProps.title}</span>
                        </div>
                    </div>
                </div>
            )}
            <div
                className={
                    showSelectedCard && Array.isArray(showSelectedCard) && showSelectedCard.length > 0
                        ? 'nz-dashbord-main nz-selected'
                        : 'nz-dashbord-main'
                }
                tabIndex={1}
                onKeyDown={handleContainerKeyDown}
            >
                {visibleCharts?.length ? (
                    <div
                        ref={containerRef}
                        className={`nz-dashbord-chart-container ${showSelectedCard && showSelectedCard.length > 0
                            ? 'nz-dashbord-chart-selected'
                            : ''
                            }`}
                    >
                        <Fragment key="nz-chart">
                            {showSelectedCard && (
                                <div className="dashboard-chart-close">
                                    <ActionImage
                                        image={{
                                            uniqueName: 'cancel',
                                            source: (
                                                <Close24x24
                                                    size={FnGetCssVariable('--image-size-2')}
                                                    fill="none"
                                                    strokeWidth={1}
                                                />
                                            ),
                                            type: 'svg',
                                            w: 'var(--image-size-2)',
                                            h: 'var(--image-size-2)',
                                            tooltip: 'Close Chart',
                                        }}
                                        uniqueName="cancelIcon"
                                        actionCode="cancel"
                                        w="var(--node_height)"
                                        handleMouse={handleMouse}
                                    />
                                </div>
                            )}
                            <div
                                key="nz"
                                className={`nz-dashbord-chart  grid-cols-${visibleCharts.length < numberOfColumnsChart
                                    ? visibleCharts.length
                                    : numberOfColumnsChart
                                    }  ${showSelectedCard && showSelectedCard.length > 0
                                        ? 'nz-hide-chart'
                                        : ''
                                    }`}
                            >
                                {visibleCharts}
                            </div>
                        </Fragment>
                        {showSelectedCard && showSelectedCard.length > 0 && (
                            <div className="nz-dashbord-chart-sigle">{showSelectedCard}</div>
                        )}
                    </div>
                ) : (
                    <span className="nz-wh-100 nz-d-flex-hv-left">
                        {loading ? 'Loading...' : 'No Charts to display'}
                    </span>
                )}
            </div>
            {fullscreenChart && (
                <div ref={fullscreenContainerRef} className="nz-dashbord-chart-fullscreen">
                    <div className="nz-dashbord-chart-fullscreen-close">
                        <ActionImage
                            image={{
                                uniqueName: 'cancel',
                                source: (
                                    <Close24x24
                                        size={FnGetCssVariable('--image-size-2')}
                                        fill="none"
                                        strokeWidth={1}
                                    />
                                ),
                                type: 'svg',
                                w: 'var(--image-size-2)',
                                h: 'var(--image-size-2)',
                                tooltip: 'Exit Fullscreen (Esc)',
                            }}
                            uniqueName="fullscreenCancelIcon"
                            actionCode="cancel"
                            w="var(--node_height)"
                            handleMouse={exitChartFullscreen}
                        />
                    </div>
                    <div className="nz-dashbord-chart-fullscreen-content">
                        {prepareCardChart(fullscreenChart, chartTheme, -1)}
                    </div>
                </div>
            )}
        </>
    );
}

export { DashboardChart };
export default DashboardChart;
