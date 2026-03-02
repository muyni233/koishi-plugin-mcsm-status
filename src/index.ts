import { Context, Schema, Session, segment } from 'koishi'
import { NodeInfo, InstanceInfo, generateHtml, renderToImage, ThemeName } from './render'

declare module 'koishi' {
  interface Context {
    puppeteer: {
      page: () => Promise<{
        setContent: (html: string, options?: { waitUntil?: string }) => Promise<void>;
        setViewport: (viewport: { width: number; height: number; deviceScaleFactor: number }) => Promise<void>;
        screenshot: (options: { type: 'png'; fullPage: boolean }) => Promise<Buffer>;
        close: () => Promise<void>;
      }>;
    }
  }
}

export const name = 'mcsm-status'
export const inject = ['puppeteer']

// =====================================================================
// Config
// =====================================================================
export interface Config {
  mcsmUrl: string
  apiKey: string
  useProxyAPI?: boolean
  proxyAPIUrl?: string
  daemonUuid?: string
  title?: string
  theme?: 'purple' | 'blue' | 'green' | 'rose' | 'dark' | 'random'
  autoDark?: boolean
  highLoadThreshold?: number
  timeout?: number
}

export const Config: Schema<Config> = Schema.object({
  mcsmUrl: Schema.string().description('MCSM面板地址').default('http://localhost:23333'),
  apiKey: Schema.string().description('MCSM面板API密钥'),
  useProxyAPI: Schema.boolean().description('使用代理API获取数据(自用)').default(false),
  proxyAPIUrl: Schema.string().description('代理API地址').default(''),
  daemonUuid: Schema.string().description('节点Daemon ID，留空获取所有节点'),
  title: Schema.string().description('页面标题').default('MCSManager 节点状态'),
  theme: Schema.union(['purple', 'blue', 'green', 'rose', 'dark', 'random']).description('主题配色（random 为随机）').default('blue'),
  autoDark: Schema.boolean().description('夜间自动切换暗色主题（19:00-06:00）').default(false),
  highLoadThreshold: Schema.number().description('高负载阈值（百分比）').default(85),
  timeout: Schema.number().description('API请求超时时间（毫秒）').default(10000),
})

// =====================================================================
// Helpers
// =====================================================================
function fetchWithTimeout(url: string, options: RequestInit, timeout: number) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('API请求超时')), timeout)
    ) as Promise<Response>
  ])
}

// =====================================================================
// Data fetchers
// =====================================================================
function parseNodeFromRemote(node: any, portSource: 'config' | 'root'): NodeInfo {
  const sys = node.system || {}
  const inst = node.instance || {}
  const cfg = node.config || {}

  const isOnline = portSource === 'config'
    ? node.available
    : (sys.uptime !== undefined)

  return {
    uuid: node.uuid || node.id || '',
    name: node.nickname || node.remarks || node.name || `节点 ${node.ip || '?'}:${(portSource === 'config' ? cfg.port : node.port) || '?'}`,
    address: node.ip || 'unknown',
    port: (portSource === 'config' ? cfg.port : node.port) || node.port || 24444,
    status: isOnline ? 'online' : 'offline',
    cpuUsage: parseFloat(((sys.cpuUsage || 0) * 100).toFixed(1)),
    memoryUsage: parseFloat((((sys.totalmem || 0) - (sys.freemem || 0)) / (1024 ** 3)).toFixed(1)) || 0,
    maxMemory: parseFloat(((sys.totalmem || 0) / (1024 ** 3)).toFixed(1)) || 0,
    runningInstanceCount: inst.running || 0,
    instanceCount: inst.total || 0,
    hostname: sys.hostname || 'Unknown',
    system: sys.type || sys.platform || 'Unknown',
    version: sys.version || sys.release || '',
    uptime: sys.uptime || 0,
    cpuMemChart: node.cpuMemChart || [],
  }
}

function parseInstancesFromRemote(remoteList: any[]): InstanceInfo[] {
  const instances: InstanceInfo[] = []
  for (const node of remoteList) {
    if (node.instances && Array.isArray(node.instances)) {
      for (const inst of node.instances) {
        instances.push({
          uuid: inst.uuid || inst.instanceUuid,
          name: inst.name || inst.config?.name || inst.instanceName || '未知实例',
          status: inst.status || inst.state || inst.running || 'unknown',
          nodeUuid: node.uuid || node.id || '',
        })
      }
    }
  }
  return instances
}

function fillSyntheticInstances(instances: InstanceInfo[], chart: any): InstanceInfo[] {
  if (instances.length === 0 && chart?.request) {
    const info = chart.request[0] || chart.request
    if (info?.runningInstance !== undefined) {
      for (let i = 0; i < (info.runningInstance || 0); i++) {
        instances.push({ uuid: `s-${i}`, name: `Inst ${i}`, status: 'running', nodeUuid: 's' })
      }
    }
  }
  return instances
}

// =====================================================================
// Plugin entry
// =====================================================================
export async function apply(ctx: Context, config: Config) {

  // ─── Startup: fetch Google Fonts CSS with fallback ─────────────────
  const FONT_QUERY = 'family=Google+Sans:wght@400;500;700&family=Noto+Sans+SC:wght@400;500;700&family=Roboto+Mono:wght@400;500&display=swap'
  const FONT_SOURCES = [
    `https://fonts.googleapis.com/css2?${FONT_QUERY}`,
    `https://fonts.loli.net/css2?${FONT_QUERY}`,
  ]

  let fontCSS = ''
  for (const url of FONT_SOURCES) {
    try {
      const res = await fetchWithTimeout(url, { method: 'GET' }, 3000)
      if (res.ok) {
        fontCSS = await res.text()
        ctx.logger.info(`字体加载成功: ${new URL(url).hostname}`)
        break
      }
    } catch {
      ctx.logger.warn(`字体加载失败: ${url}`)
    }
  }
  if (!fontCSS) {
    ctx.logger.warn('所有字体源均不可用，将使用系统字体')
  }

  const RANDOM_THEMES: ThemeName[] = ['purple', 'blue', 'green', 'rose']
  const resolveTheme = (): ThemeName => {
    // 夜间自动暗色 (19:00 - 06:00)
    if (config.autoDark) {
      const hour = new Date().getHours()
      if (hour >= 19 || hour < 6) return 'dark'
    }
    if (config.theme === 'random') {
      return RANDOM_THEMES[Math.floor(Math.random() * RANDOM_THEMES.length)]
    }
    return (config.theme as ThemeName) || 'blue'
  }

  // ─── Official API command ─────────────────────────────────────────
  ctx.command('mcsm-status', '获取MCSM节点状态')
    .action(async ({ session }: { session: Session }) => {
      try {
        if (!config.apiKey) return '错误：未配置MCSM API密钥'
        if (!config.mcsmUrl) return '错误：未配置MCSM面板地址'

        const url = `${config.mcsmUrl}/api/overview?apikey=${config.apiKey}`
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }

        const fetchNodes = async (): Promise<NodeInfo[]> => {
          const res = await fetchWithTimeout(url, { method: 'GET', headers }, config.timeout)
          if (!res.ok) throw new Error(`获取节点列表失败: ${res.status}`)
          const result = await res.json()
          const data = result.data || result
          if (!data?.remote || !Array.isArray(data.remote)) return []
          return data.remote.map((n: any) => parseNodeFromRemote(n, 'config'))
        }

        const fetchInstances = async (): Promise<InstanceInfo[]> => {
          const res = await fetchWithTimeout(url, { method: 'GET', headers }, config.timeout)
          if (!res.ok) throw new Error(`获取实例列表失败: ${res.status}`)
          const result = await res.json()
          const data = result.data || result
          if (!data?.remote || !Array.isArray(data.remote)) return []
          const list = parseInstancesFromRemote(data.remote)
          return fillSyntheticInstances(list, data.chart)
        }

        const [nodes, instances] = await Promise.all([
          fetchNodes().catch(err => { ctx.logger.error('获取节点列表时出错:', err); return [] as NodeInfo[] }),
          fetchInstances().catch(err => { ctx.logger.error('获取实例列表时出错:', err); return [] as InstanceInfo[] }),
        ])

        const html = generateHtml(nodes, instances, config.title, config.highLoadThreshold || 85, fontCSS, resolveTheme())
        const buf = await renderToImage(ctx, html)
        return segment.image('data:image/png;base64,' + buf.toString('base64'))
      } catch (error) {
        ctx.logger.error('生成图片时出错:', error)
        return '获取服务器状态失败: ' + error.message
      }
    })

  // ─── Proxy API command (optional) ─────────────────────────────────
  if (config.useProxyAPI) {
    ctx.command('mcsm-status-api', '获取MCSM节点状态（使用代理API）')
      .action(async ({ session }: { session: Session }) => {
        try {
          const proxyUrl = config.proxyAPIUrl || ''
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'User-Agent': 'Koishi-MCSM-Status-Bot/1.0',
          }

          const fetchNodes = async (): Promise<NodeInfo[]> => {
            const res = await fetchWithTimeout(proxyUrl, { method: 'GET', headers }, config.timeout)
            if (!res.ok) throw new Error(`获取节点列表失败: ${res.status}`)
            const result = await res.json()
            const remoteList = Array.isArray(result.data) ? result.data : []
            return remoteList.map((n: any) => parseNodeFromRemote(n, 'root'))
          }

          const fetchInstances = async (): Promise<InstanceInfo[]> => {
            const res = await fetchWithTimeout(proxyUrl, { method: 'GET', headers }, config.timeout)
            if (!res.ok) throw new Error(`获取实例列表失败: ${res.status}`)
            const result = await res.json()
            const remoteList = Array.isArray(result.data) ? result.data : []
            const list = parseInstancesFromRemote(remoteList)
            return fillSyntheticInstances(list, result.chart)
          }

          const [nodes, instances] = await Promise.all([
            fetchNodes().catch(err => { ctx.logger.error('获取节点列表时出错:', err); return [] as NodeInfo[] }),
            fetchInstances().catch(err => { ctx.logger.error('获取实例列表时出错:', err); return [] as InstanceInfo[] }),
          ])

          const html = generateHtml(nodes, instances, config.title, config.highLoadThreshold || 85, fontCSS, resolveTheme())
          const buf = await renderToImage(ctx, html)
          return segment.image('data:image/png;base64,' + buf.toString('base64'))
        } catch (error) {
          ctx.logger.error('生成图片时出错:', error)
          return '获取服务器状态失败: ' + error.message
        }
      })
  }
}