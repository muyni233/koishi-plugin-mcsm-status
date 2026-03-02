import { Context } from 'koishi';
export interface NodeInfo {
    uuid: string;
    name: string;
    address: string;
    port: number;
    status: string;
    cpuUsage: number;
    memoryUsage: number;
    maxMemory: number;
    instanceCount: number;
    runningInstanceCount?: number;
    hostname?: string;
    system?: string;
    version?: string;
    uptime?: number;
    cpuMemChart?: Array<{
        cpu: number;
        mem: number;
    }>;
}
export interface InstanceInfo {
    uuid: string;
    name: string;
    status: string;
    nodeUuid: string;
}
export type ThemeName = 'purple' | 'blue' | 'green' | 'rose' | 'dark';
export declare function generateHtml(nodes: NodeInfo[], instances: InstanceInfo[], title: string, highLoadThreshold: number, fontCSS?: string, theme?: ThemeName): string;
export declare function renderToImage(ctx: Context, html: string): Promise<Buffer>;
