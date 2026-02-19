import { Context, Schema, Session, segment } from 'koishi'

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

export interface Config {
  mcsmUrl: string
  apiKey: string
  useProxyAPI?: boolean
  proxyAPIUrl?: string
  daemonUuid?: string 
  title?: string
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
  highLoadThreshold: Schema.number().description('高负载阈值（百分比）').default(85),
  timeout: Schema.number().description('API请求超时时间（毫秒）').default(10000),
})

interface NodeInfo {
  uuid: string
  name: string
  address: string
  port: number
  status: string
  cpuUsage: number
  memoryUsage: number
  maxMemory: number
  instanceCount: number
  runningInstanceCount?: number  
  hostname?: string 
  system?: string 
  version?: string
  uptime?: number 
  cpuMemChart?: Array<{cpu: number, mem: number}>
}

interface InstanceInfo {
  uuid: string
  name: string
  status: string
  nodeUuid: string
}

export async function apply(ctx: Context, config: Config) {
  const fetchWithTimeout = (url: string, options: RequestInit, timeout: number) => {
    return Promise.race([
      fetch(url, options),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('API请求超时')), timeout)
      ) as Promise<Response>
    ])
  }

  // HTML 生成函数 - UI 已美化
  const generateHtmlContent = (nodes: NodeInfo[], instances: InstanceInfo[]): string => {
    const totalNodes = nodes.length;
    const onlineNodes = nodes.filter(n => n.status === 'online').length;
    const totalInstances = nodes.reduce((sum, node) => sum + (node.instanceCount || 0), 0);
    const runningInstances = nodes.reduce((sum, node) => sum + (node.runningInstanceCount || 0), 0);
    
    const escapeHtml = (str: any): string => {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    };
    
    // 生成单个节点的HTML
    const generateNodeHtml = (node: NodeInfo): string => {
      const cpuPercent = node.cpuUsage;
      const cpuPercentRounded = parseFloat(node.cpuUsage.toFixed(1));
      const memoryPercent = node.maxMemory > 0 ? parseFloat(((node.memoryUsage / node.maxMemory) * 100).toFixed(1)) : 0;
      const isHighLoad = cpuPercentRounded >= (config.highLoadThreshold || 85) || memoryPercent >= (config.highLoadThreshold || 85);
      
      return `
        <div class="node ${node.status === 'offline' ? 'node-offline' : ''}">
          <div class="node-header">
            <div class="node-title-group">
                <div class="node-icon">
                    ${node.status === 'online' ? 
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17L17 7M7 7l10 10"/></svg>' : // 只是个占位图标，实际用CSS画
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
                    }
                </div>
                <div>
                    <div class="node-name">${escapeHtml(node.name)}</div>
                    <div class="node-subtitle">${escapeHtml(node.address)}:${node.port}</div>
                </div>
            </div>
            <div class="status-badge ${node.status === 'online' ? (isHighLoad ? 'status-warning' : 'status-success') : 'status-danger'}">
              <span class="status-dot"></span>
              ${node.status === 'online' ? (isHighLoad ? '高负载' : '运行中') : '离线'}
            </div>
          </div>
          
          <div class="node-body">
            <div class="metrics-grid">
                <!-- Info Chips -->
                <div class="info-chip">
                  <span class="chip-label">OS</span>
                  <span class="chip-value">${escapeHtml(node.system || 'Unknown')}</span>
                </div>
                <div class="info-chip">
                  <span class="chip-label">Ver</span>
                  <span class="chip-value" title="${escapeHtml(node.version)}">${escapeHtml(node.version || 'Unknown').split(' ')[0]}</span>
                </div>
                <div class="info-chip">
                  <span class="chip-label">实例</span>
                  <span class="chip-value">${node.runningInstanceCount || 0} <span style="color:#999">/ ${node.instanceCount || 0}</span></span>
                </div>

                <!-- CPU Bar -->
                <div class="metric-item full-width">
                  <div class="metric-header">
                    <span class="metric-label">CPU 负载</span>
                    <span class="metric-value">${cpuPercentRounded}%</span>
                  </div>
                  <div class="progress-track">
                    <div class="progress-fill ${cpuPercentRounded > 80 ? 'fill-danger' : 'fill-primary'}" style="width: ${cpuPercentRounded}%"></div>
                  </div>
                </div>

                <!-- Memory Bar -->
                <div class="metric-item full-width">
                  <div class="metric-header">
                    <span class="metric-label">内存使用</span>
                    <span class="metric-value">${node.memoryUsage ? parseFloat(node.memoryUsage.toFixed(1)) : '0'} / ${node.maxMemory ? parseFloat(node.maxMemory.toFixed(1)) : '0'} GB</span>
                  </div>
                  <div class="progress-track">
                    <div class="progress-fill ${memoryPercent > 85 ? 'fill-danger' : 'fill-success'}" style="width: ${memoryPercent}%"></div>
                  </div>
                </div>
            </div>

            <div class="chart-wrapper">
               <canvas class="trend-chart" data-cpu-mem="${encodeURIComponent(JSON.stringify(node.cpuMemChart || []))}" width="240" height="90"></canvas>
            </div>
          </div>
        </div>
      `;
    };
    
    // 生成所有节点的HTML
    const nodesHtml = nodes.length > 0 
      ? nodes.map(node => generateNodeHtml(node)).join('')
      : '<div class="empty-state">暂无节点信息</div>';
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>MCSM Status</title>
  <style>
    :root {
      --primary: #4361ee;
      --primary-light: #4895ef;
      --success: #4cc9f0;
      --success-dark: #4361ee; 
      --danger: #f72585;
      --warning: #f8961e;
      --bg: #f8f9fa;
      --card-bg: #ffffff;
      --text-main: #2b2d42;
      --text-sub: #8d99ae;
      --border: #edf2f4;
    }

    body {
      font-family: 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', sans-serif;
      background-color: #f0f2f5;
      background-image: 
        radial-gradient(at 0% 0%, hsla(253,16%,7%,1) 0, transparent 50%), 
        radial-gradient(at 50% 0%, hsla(225,39%,30%,1) 0, transparent 50%), 
        radial-gradient(at 100% 0%, hsla(339,49%,30%,1) 0, transparent 50%);
      background-size: 100% 600px;
      background-repeat: no-repeat;
      margin: 0;
      padding: 40px;
      color: var(--text-main);
      min-height: 100vh;
      box-sizing: border-box;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(20px);
      border-radius: 24px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.15);
      overflow: hidden;
    }

    /* Header */
    .header {
      padding: 30px 40px;
      background: linear-gradient(135deg, rgba(255,255,255,0.8), rgba(255,255,255,0.4));
      border-bottom: 1px solid rgba(0,0,0,0.05);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header-title h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 800;
      background: linear-gradient(90deg, #4361ee, #f72585);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.5px;
    }
    .header-title p {
      margin: 5px 0 0;
      font-size: 13px;
      color: var(--text-sub);
    }

    .header-time {
      font-size: 13px;
      color: var(--text-sub);
      font-family: monospace;
      background: rgba(0,0,0,0.05);
      padding: 6px 12px;
      border-radius: 20px;
    }

    /* Summary Cards */
    .summary-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      padding: 30px 40px 10px;
    }

    .summary-card {
      background: linear-gradient(145deg, #ffffff, #f5f7fa);
      padding: 20px;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.03);
      border: 1px solid white;
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .summary-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      background: rgba(67, 97, 238, 0.1);
      color: var(--primary);
    }
    .summary-card:last-child .summary-icon {
      background: rgba(247, 37, 133, 0.1);
      color: var(--danger);
    }

    .summary-info .label { font-size: 12px; color: var(--text-sub); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    .summary-info .value { font-size: 24px; font-weight: 800; color: var(--text-main); line-height: 1.2; }
    .summary-info .sub { font-size: 12px; color: var(--text-sub); }

    /* Nodes List */
    .nodes-container {
      padding: 20px 40px 40px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 20px;
    }

    .node {
      background: #fff;
      border-radius: 18px;
      border: 1px solid rgba(0,0,0,0.04);
      box-shadow: 0 4px 6px rgba(0,0,0,0.02);
      transition: all 0.2s;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    .node-offline {
      opacity: 0.7;
      background: #fcfcfc;
    }

    .node-header {
      padding: 18px 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      background: rgba(248, 249, 250, 0.5);
    }

    .node-title-group {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .node-icon {
      width: 40px;
      height: 40px;
      background: #fff;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-main);
    }
    .node-icon svg { width: 20px; height: 20px; stroke: #4361ee; }
    .node-offline .node-icon svg { stroke: #999; }

    .node-name { font-weight: 700; font-size: 16px; color: var(--text-main); }
    .node-subtitle { font-size: 11px; color: var(--text-sub); margin-top: 2px; font-family: monospace; }

    .status-badge {
      padding: 6px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .status-dot { width: 6px; height: 6px; border-radius: 50%; display: block; }
    
    .status-success { background: rgba(76, 201, 240, 0.1); color: #0077b6; }
    .status-success .status-dot { background: #0077b6; box-shadow: 0 0 8px #0077b6; }

    .status-warning { background: rgba(248, 150, 30, 0.1); color: #e85d04; }
    .status-warning .status-dot { background: #e85d04; box-shadow: 0 0 8px #e85d04; }

    .status-danger { background: rgba(247, 37, 133, 0.1); color: #d00000; }
    .status-danger .status-dot { background: #d00000; }

    .node-body {
      padding: 20px;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
    }

    .info-chip {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 8px;
      text-align: center;
      border: 1px solid rgba(0,0,0,0.02);
    }
    .chip-label { display: block; font-size: 10px; color: var(--text-sub); text-transform: uppercase; margin-bottom: 2px; }
    .chip-value { font-size: 12px; font-weight: 600; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;}

    .metric-item {
      margin-top: 5px;
    }
    .full-width { grid-column: 1 / -1; }
    
    .metric-header { display: flex; justify-content: space-between; margin-bottom: 6px; }
    .metric-label { font-size: 11px; color: var(--text-sub); font-weight: 500; }
    .metric-value { font-size: 11px; font-weight: 700; color: var(--text-main); font-family: monospace; }

    .progress-track {
      height: 6px;
      background: #edf2f4;
      border-radius: 3px;
      overflow: hidden;
    }
    .progress-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
    .fill-primary { background: var(--primary); }
    .fill-success { background: #4cc9f0; }
    .fill-danger { background: var(--danger); }

    .chart-wrapper {
      margin-top: auto;
      height: 70px;
      width: 100%;
      position: relative;
      border-top: 1px solid #f0f0f0;
      padding-top: 15px;
    }
    .trend-chart { width: 100%; height: 100%; display: block; }
    
    .empty-state {
        grid-column: 1 / -1;
        text-align: center;
        padding: 60px;
        color: var(--text-sub);
        font-style: italic;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-title">
        <h1>${escapeHtml(config.title || 'MCSManager Monitor')}</h1>
        <p>System Status Dashboard</p>
      </div>
      <div class="header-time">
        ${new Date().toLocaleString('zh-CN', { hour12: false })}
      </div>
    </div>

    <div class="summary-section">
      <div class="summary-card">
        <div class="summary-icon">📡</div>
        <div class="summary-info">
          <div class="label">节点状态</div>
          <div class="value">${onlineNodes} <span class="sub">/ ${totalNodes}</span></div>
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-icon">📦</div>
        <div class="summary-info">
          <div class="label">实例总数</div>
          <div class="value">${runningInstances} <span class="sub">运行中</span></div>
        </div>
      </div>
    </div>

    <div class="nodes-container">
      ${nodesHtml}
    </div>
  </div>
  
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const charts = document.querySelectorAll('.trend-chart');
      charts.forEach(canvas => {
        try {
          const dataStr = decodeURIComponent(canvas.getAttribute('data-cpu-mem'));
          const data = JSON.parse(dataStr);
          drawChart(canvas, data);
        } catch(e) { console.error(e); }
      });
    });
    
    function drawChart(canvas, data) {
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 2; // 强制高清
      
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      
      const width = rect.width;
      const height = rect.height;
      
      ctx.clearRect(0, 0, width, height);
      
      if (!data || data.length === 0) {
        ctx.fillStyle = '#edf2f4';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#8d99ae';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No Data', width/2, height/2);
        return;
      }
      
      const padding = 2;
      const chartWidth = width - padding * 2;
      const chartHeight = height - padding * 2;
      const maxValue = 100;
      
      // 绘制函数
      const drawLine = (key, color, bgStops) => {
        if (!data.some(d => d[key] !== undefined)) return;
        
        ctx.beginPath();
        data.forEach((item, i) => {
          const x = padding + (i / (data.length - 1)) * chartWidth;
          const y = padding + chartHeight - ((item[key] || 0) / maxValue) * chartHeight;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        
        // 描边
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.stroke();
        
        // 填充渐变
        ctx.lineTo(padding + chartWidth, padding + chartHeight);
        ctx.lineTo(padding, padding + chartHeight);
        ctx.closePath();
        
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        bgStops.forEach(s => grad.addColorStop(s[0], s[1]));
        ctx.fillStyle = grad;
        ctx.fill();
      };

      // 先画 Memory (绿色/青色)
      drawLine('mem', '#4cc9f0', [[0, 'rgba(76, 201, 240, 0.2)'], [1, 'rgba(76, 201, 240, 0.0)']]);
      
      // 再画 CPU (主色/蓝色)
      drawLine('cpu', '#4361ee', [[0, 'rgba(67, 97, 238, 0.25)'], [1, 'rgba(67, 97, 238, 0.0)']]);
      
      // 图例文字
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#4361ee';
      ctx.fillText('CPU', width - 5, 10);
      ctx.fillStyle = '#4cc9f0';
      ctx.fillText('MEM', width - 30, 10);
    }
  </script>
</body>
</html>
    `;
  }
  
  const renderToImage = async (html: string): Promise<Buffer> => {
    const page = await ctx.puppeteer.page();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.setViewport({ 
        width: 900, // 略微增加宽度以适应新布局
        height: 600, 
        deviceScaleFactor: 2 
      });
      
      const screenshot = await page.screenshot({ 
        type: 'png',
        fullPage: true 
      });
      
      return screenshot;
    } finally {
      await page.close().catch(() => {}); 
    }
  }

  // 只使用官方API的指令
  ctx.command('mcsm-status', '获取MCSM节点状态')
    .action(async ({ session }: { session: Session }) => {
      try {
        const officialConfig = { ...config, useProxyAPI: false };
        
        if (!officialConfig.apiKey) return '错误：未配置MCSM API密钥'
        if (!officialConfig.mcsmUrl) return '错误：未配置MCSM面板地址'

        const fetchOfficialNodesStatus = async (): Promise<NodeInfo[]> => {
          try {
            let url = `${officialConfig.mcsmUrl}/api/overview?apikey=${officialConfig.apiKey}`;
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };

            const response = await fetchWithTimeout(url, { method: 'GET', headers }, officialConfig.timeout);
            if (!response.ok) throw new Error(`获取节点列表失败: ${response.status}`);

            const result = await response.json();
            const data = result.data || result;
            const nodes: NodeInfo[] = [];
            
            if (data && data.remote && Array.isArray(data.remote)) {
              for (const node of data.remote) {
                const systemInfo = node.system || {};
                const instanceInfo = node.instance || {};
                const configInfo = node.config || {};
                const isOnline = node.available;
                
                nodes.push({
                  uuid: node.uuid || node.id || '',
                  name: node.nickname || node.remarks || node.name || `节点 ${node.ip || '?'}:${configInfo.port || '?'}`,
                  address: node.ip || 'unknown',
                  port: configInfo.port || node.port || 24444,
                  status: isOnline ? 'online' : 'offline',
                  cpuUsage: parseFloat(((systemInfo.cpuUsage || 0) * 100).toFixed(1)), 
                  memoryUsage: parseFloat((((systemInfo.totalmem || 0) - (systemInfo.freemem || 0)) / (1024 * 1024 * 1024)).toFixed(1)) || 0, 
                  maxMemory: parseFloat(((systemInfo.totalmem || 0) / (1024 * 1024 * 1024)).toFixed(1)) || 0, 
                  runningInstanceCount: instanceInfo.running || 0, 
                  instanceCount: instanceInfo.total || 0, 
                  hostname: systemInfo.hostname || 'Unknown',
                  system: systemInfo.type || systemInfo.platform || 'Unknown',
                  version: systemInfo.version || systemInfo.release || '',
                  uptime: systemInfo.uptime || 0,
                  cpuMemChart: node.cpuMemChart || []
                });
              }
            }
            return nodes;
          } catch (error) {
            ctx.logger.error('获取节点列表时出错:', error);
            throw error;
          }
        }

        const fetchOfficialInstancesStatus = async (): Promise<InstanceInfo[]> => {
          try {
            let url = `${officialConfig.mcsmUrl}/api/overview?apikey=${officialConfig.apiKey}`;
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };

            const response = await fetchWithTimeout(url, { method: 'GET', headers }, officialConfig.timeout);
            if (!response.ok) throw new Error(`获取实例列表失败: ${response.status}`);

            const result = await response.json();
            const data = result.data || result;
            const instances: InstanceInfo[] = [];
            
            if (data && data.remote && Array.isArray(data.remote)) {
              for (const node of data.remote) {
                if (node.instances && Array.isArray(node.instances)) {
                  for (const instance of node.instances) {
                    instances.push({
                      uuid: instance.uuid || instance.instanceUuid,
                      name: instance.name || instance.config?.name || instance.instanceName || '未知实例',
                      status: instance.status || instance.state || instance.running || 'unknown',
                      nodeUuid: node.uuid || node.id || '' 
                    });
                  }
                }
              }
            }
            
            // 补充统计数据作为虚拟实例（如果API返回了）
            if (instances.length === 0 && data && data.chart && data.chart.request) {
               const requestInfo = data.chart.request[0] || data.chart.request; 
               if (requestInfo && requestInfo.runningInstance !== undefined) {
                 for (let i = 0; i < (requestInfo.runningInstance || 0); i++) {
                   instances.push({ uuid: `s-${i}`, name: `Inst ${i}`, status: 'running', nodeUuid: 's' });
                 }
               }
            }

            return instances;
          } catch (error) {
            ctx.logger.error('获取实例列表时出错:', error);
            throw error;
          }
        }

        const [nodes, instances] = await Promise.all([
          fetchOfficialNodesStatus().catch(err => []),
          fetchOfficialInstancesStatus().catch(err => [])
        ]);

        const htmlContent = generateHtmlContent(nodes, instances)
        const imageBuffer = await renderToImage(htmlContent)

        return segment.image('data:image/png;base64,' + imageBuffer.toString('base64'));
      } catch (error) {
        ctx.logger.error('生成图片时出错:', error)
        return '获取服务器状态失败: ' + error.message
      }
    })

  // 当启用代理API时注册代理指令
  if (config.useProxyAPI) {
    // 变更：mcsm-status-proxy -> mcsm-status-api
    ctx.command('mcsm-status-api', '获取MCSM节点状态（使用代理API）')
      .action(async ({ session }: { session: Session }) => {
        try {
          const fetchProxyNodesStatus = async (): Promise<NodeInfo[]> => {
            try {
              let url: string = config.proxyAPIUrl || '';
              const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'User-Agent': 'Koishi-MCSM-Status-Bot/1.0'
              };

              const response = await fetchWithTimeout(url, { method: 'GET', headers }, config.timeout);
              if (!response.ok) throw new Error(`获取节点列表失败: ${response.status}`);

              const result = await response.json();
              const data = { remote: Array.isArray(result.data) ? result.data : [], chart: result.chart || {} };
              const nodes: NodeInfo[] = [];
              
              if (data && data.remote && Array.isArray(data.remote)) {
                for (const node of data.remote) {
                  const systemInfo = node.system || {};
                  const instanceInfo = node.instance || {};
                  const isOnline = (node.system && node.system.uptime !== undefined);
                  
                  nodes.push({
                    uuid: node.uuid || node.id || '',
                    name: node.nickname || node.remarks || node.name || `节点 ${node.ip || '?'}:${node.port || '?'}`,
                    address: node.ip || 'unknown',
                    port: node.port || 24444,
                    status: isOnline ? 'online' : 'offline',
                    cpuUsage: parseFloat(((systemInfo.cpuUsage || 0) * 100).toFixed(1)), 
                    memoryUsage: parseFloat((((systemInfo.totalmem || 0) - (systemInfo.freemem || 0)) / (1024 * 1024 * 1024)).toFixed(1)) || 0, 
                    maxMemory: parseFloat(((systemInfo.totalmem || 0) / (1024 * 1024 * 1024)).toFixed(1)) || 0, 
                    runningInstanceCount: instanceInfo.running || 0, 
                    instanceCount: instanceInfo.total || 0, 
                    hostname: systemInfo.hostname || 'Unknown',
                    system: systemInfo.type || systemInfo.platform || 'Unknown',
                    version: systemInfo.version || systemInfo.release || '',
                    uptime: systemInfo.uptime || 0,
                    cpuMemChart: node.cpuMemChart || []
                  });
                }
              }
              return nodes;
            } catch (error) {
              ctx.logger.error('获取节点列表时出错:', error);
              throw error;
            }
          }

          const fetchProxyInstancesStatus = async (): Promise<InstanceInfo[]> => {
            try {
              let url: string = config.proxyAPIUrl || 'https://api.eqad.fun/mcsm/api/services';
              const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'User-Agent': 'Koishi-MCSM-Status-Bot/1.0'
              };

              const response = await fetchWithTimeout(url, { method: 'GET', headers }, config.timeout);
              if (!response.ok) throw new Error(`获取实例列表失败: ${response.status}`);

              const result = await response.json();
              const data = { remote: Array.isArray(result.data) ? result.data : [], chart: result.chart || {} };
              const instances: InstanceInfo[] = [];
              
              if (data && data.remote && Array.isArray(data.remote)) {
                for (const node of data.remote) {
                  if (node.instances && Array.isArray(node.instances)) {
                    for (const instance of node.instances) {
                      instances.push({
                        uuid: instance.uuid || instance.instanceUuid,
                        name: instance.name || instance.config?.name || instance.instanceName || '未知实例',
                        status: instance.status || instance.state || instance.running || 'unknown',
                        nodeUuid: node.uuid || node.id || '' 
                      });
                    }
                  }
                }
              }

              if (instances.length === 0 && data && data.chart && data.chart.request) {
                const requestInfo = data.chart.request[0] || data.chart.request; 
                if (requestInfo && requestInfo.runningInstance !== undefined) {
                  for (let i = 0; i < (requestInfo.runningInstance || 0); i++) {
                    instances.push({ uuid: `s-${i}`, name: `Inst ${i}`, status: 'running', nodeUuid: 's' });
                  }
                }
              }
              return instances;
            } catch (error) {
              ctx.logger.error('获取实例列表时出错:', error);
              throw error;
            }
          }

          const [nodes, instances] = await Promise.all([
            fetchProxyNodesStatus().catch(err => []),
            fetchProxyInstancesStatus().catch(err => [])
          ])

          const htmlContent = generateHtmlContent(nodes, instances)
          const imageBuffer = await renderToImage(htmlContent)

          return segment.image('data:image/png;base64,' + imageBuffer.toString('base64'));
        } catch (error) {
          ctx.logger.error('生成图片时出错:', error)
          return '获取服务器状态失败: ' + error.message
        }
      })
  }
}