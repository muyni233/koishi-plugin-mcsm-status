import { Context, Schema } from 'koishi';
declare module 'koishi' {
    interface Context {
        puppeteer: {
            page: () => Promise<{
                setContent: (html: string, options?: {
                    waitUntil?: string;
                }) => Promise<void>;
                setViewport: (viewport: {
                    width: number;
                    height: number;
                    deviceScaleFactor: number;
                }) => Promise<void>;
                screenshot: (options: {
                    type: 'png';
                    fullPage: boolean;
                }) => Promise<Buffer>;
                close: () => Promise<void>;
            }>;
        };
    }
}
export declare const name = "mcsm-status";
export declare const inject: string[];
export interface Config {
    mcsmUrl: string;
    apiKey: string;
    useProxyAPI?: boolean;
    proxyAPIUrl?: string;
    daemonUuid?: string;
    title?: string;
    highLoadThreshold?: number;
    timeout?: number;
}
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context, config: Config): Promise<void>;
