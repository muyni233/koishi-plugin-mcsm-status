var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  Config: () => Config,
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(src_exports);
var import_koishi = require("koishi");
var name = "mcsm-status";
var inject = ["puppeteer"];
var Config = import_koishi.Schema.object({
  mcsmUrl: import_koishi.Schema.string().description("MCSM面板地址").default("http://localhost:23333"),
  apiKey: import_koishi.Schema.string().description("MCSM面板API密钥"),
  useProxyAPI: import_koishi.Schema.boolean().description("使用代理API获取数据(自用)").default(false),
  proxyAPIUrl: import_koishi.Schema.string().description("代理API地址").default(""),
  daemonUuid: import_koishi.Schema.string().description("节点Daemon ID，留空获取所有节点"),
  title: import_koishi.Schema.string().description("页面标题").default("MCSManager 节点状态"),
  highLoadThreshold: import_koishi.Schema.number().description("高负载阈值（百分比）").default(85),
  timeout: import_koishi.Schema.number().description("API请求超时时间（毫秒）").default(1e4)
});
async function apply(ctx, config) {
  const fetchWithTimeout = /* @__PURE__ */ __name((url, options, timeout) => {
    return Promise.race([
      fetch(url, options),
      new Promise(
        (_, reject) => setTimeout(() => reject(new Error("API请求超时")), timeout)
      )
    ]);
  }, "fetchWithTimeout");
  const fetchNodesStatus = /* @__PURE__ */ __name(async () => {
    try {
      let url;
      if (config.useProxyAPI) {
        url = config.proxyAPIUrl || "";
      } else {
        url = `${config.mcsmUrl}/api/overview?apikey=${config.apiKey}`;
      }
      const headers = {
        "Content-Type": "application/json"
      };
      if (config.useProxyAPI) {
        headers["User-Agent"] = "Koishi-MCSM-Status-Bot/1.0";
      }
      const response = await fetchWithTimeout(url, {
        method: "GET",
        headers
      }, config.timeout);
      if (!response.ok) {
        throw new Error(`获取节点列表失败: ${response.status} - ${response.statusText}`);
      }
      const result = await response.json();
      let data;
      if (config.useProxyAPI) {
        data = { remote: Array.isArray(result.data) ? result.data : [], chart: result.chart || {} };
      } else {
        data = result.data || result;
      }
      const nodes = [];
      if (data && data.remote && Array.isArray(data.remote)) {
        for (const node of data.remote) {
          const systemInfo = node.system || {};
          const instanceInfo = node.instance || {};
          const configInfo = node.config || {};
          const isOnline = config.useProxyAPI ? node.system && node.system.uptime !== void 0 : node.available;
          nodes.push({
            uuid: node.uuid || node.id || "",
            name: node.nickname || node.remarks || node.name || `节点 ${node.ip || "unknown"}:${configInfo.port || "unknown"}`,
            address: node.ip || "unknown",
            port: configInfo.port || node.port || 24444,
            status: isOnline ? "online" : "offline",
            cpuUsage: parseFloat(((systemInfo.cpuUsage || 0) * 100).toFixed(1)),
            memoryUsage: parseFloat((((systemInfo.totalmem || 0) - (systemInfo.freemem || 0)) / (1024 * 1024 * 1024)).toFixed(1)) || 0,
            maxMemory: parseFloat(((systemInfo.totalmem || 0) / (1024 * 1024 * 1024)).toFixed(1)) || 0,
            runningInstanceCount: instanceInfo.running || 0,
            instanceCount: instanceInfo.total || 0,
            hostname: systemInfo.hostname || "Unknown",
            system: systemInfo.type || systemInfo.platform || "Unknown",
            version: systemInfo.version || systemInfo.release || "",
            uptime: systemInfo.uptime || 0,
            cpuMemChart: node.cpuMemChart || []
          });
        }
      }
      return nodes;
    } catch (error) {
      ctx.logger.error("获取节点列表时出错:", error);
      throw error;
    }
  }, "fetchNodesStatus");
  const fetchInstancesStatus = /* @__PURE__ */ __name(async () => {
    try {
      let url;
      if (config.useProxyAPI) {
        url = config.proxyAPIUrl || "";
      } else {
        url = `${config.mcsmUrl}/api/overview?apikey=${config.apiKey}`;
      }
      const headers = {
        "Content-Type": "application/json"
      };
      if (config.useProxyAPI) {
        headers["User-Agent"] = "Koishi-Bot";
      }
      const response = await fetchWithTimeout(url, {
        method: "GET",
        headers
      }, config.timeout);
      if (!response.ok) {
        throw new Error(`获取实例列表失败: ${response.status} - ${response.statusText}`);
      }
      const result = await response.json();
      let data;
      if (config.useProxyAPI) {
        data = { remote: Array.isArray(result.data) ? result.data : [], chart: result.chart || {} };
      } else {
        data = result.data || result;
      }
      const instances = [];
      if (data && data.remote && Array.isArray(data.remote)) {
        for (const node of data.remote) {
          if (node.instances && Array.isArray(node.instances)) {
            for (const instance of node.instances) {
              instances.push({
                uuid: instance.uuid || instance.instanceUuid,
                name: instance.name || instance.config?.name || instance.instanceName || "未知实例",
                status: instance.status || instance.state || instance.running || "unknown",
                nodeUuid: node.uuid || node.id || ""
              });
            }
          }
        }
      }
      if (instances.length === 0 && data && data.chart && data.chart.request) {
        const requestInfo = data.chart.request[0] || data.chart.request;
        if (requestInfo && requestInfo.runningInstance !== void 0) {
          for (let i = 0; i < (requestInfo.runningInstance || 0); i++) {
            instances.push({
              uuid: `stat-instance-${i}`,
              name: `实例 ${i + 1}`,
              status: "running",
              nodeUuid: "stat-node"
            });
          }
        }
      }
      return instances;
    } catch (error) {
      ctx.logger.error("获取实例列表时出错:", error);
      throw error;
    }
  }, "fetchInstancesStatus");
  const generateHtmlContent = /* @__PURE__ */ __name((nodes, instances) => {
    const totalNodes = nodes.length;
    const onlineNodes = nodes.filter((n) => n.status === "online").length;
    const totalInstances = nodes.reduce((sum, node) => sum + (node.instanceCount || 0), 0);
    const runningInstances = nodes.reduce((sum, node) => sum + (node.runningInstanceCount || 0), 0);
    const escapeHtml = /* @__PURE__ */ __name((str) => {
      if (str === null || str === void 0) return "";
      return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/\//g, "&#x2F;");
    }, "escapeHtml");
    const generateNodeHtml = /* @__PURE__ */ __name((node) => {
      const cpuPercent = node.cpuUsage;
      const cpuPercentRounded = parseFloat(node.cpuUsage.toFixed(1));
      const memoryPercent = node.maxMemory > 0 ? parseFloat((node.memoryUsage / node.maxMemory * 100).toFixed(1)) : 0;
      return `
        <div class="node">
          <div class="node-header">
            <div class="node-name">${escapeHtml(node.name)}</div>
            <div class="node-status status-${node.status === "online" ? "online" : "offline"}">
              ${node.status === "online" ? "在线" : "离线"}
            </div>
          </div>
          <div class="node-info">
            <div class="info-item">
              <div class="info-label">主机名</div>
              <div class="info-value">${escapeHtml(node.hostname || "N/A")}</div>
            </div>
            <div class="info-item">
              <div class="info-label">系统</div>
              <div class="info-value">${escapeHtml(node.system || "N/A")}</div>
            </div>
            <div class="info-item">
              <div class="info-label">系统版本</div>
              <div class="info-value">${escapeHtml(node.version || "N/A")}</div>
            </div>
            <div class="info-item">
              <div class="info-label">实例数</div>
              <div class="info-value">${node.runningInstanceCount || 0}/${node.instanceCount || 0}</div>
            </div>
            <div class="info-item">
              <div class="info-label">CPU使用率</div>
              <div class="info-value">${cpuPercentRounded}%</div>
              <div class="progress-bar">
                <div class="progress" style="width: ${cpuPercentRounded}%; background: ${cpuPercentRounded >= (config.highLoadThreshold || 85) ? "#f57975" : "#4A6CF7"};"></div>
              </div>
            </div>
            <div class="info-item">
              <div class="info-label">内存使用</div>
              <div class="info-value">${node.memoryUsage ? parseFloat(node.memoryUsage.toFixed(1)) : "0"}GB / ${node.maxMemory ? parseFloat(node.maxMemory.toFixed(1)) : "0"}GB</div>
              <div class="progress-bar">
                <div class="progress" style="width: ${memoryPercent}%; background: ${memoryPercent >= (config.highLoadThreshold || 85) ? "#f57975" : "#4A6CF7"};"></div>
              </div>
            </div>
            <div class="info-item" style="grid-column: span 2; min-width: 200px; height: 70px; display: flex; align-items: center; justify-content: center;">
              <canvas class="trend-chart" data-cpu-mem="${encodeURIComponent(JSON.stringify(node.cpuMemChart || []))}" width="200" height="70" style="display: block;"></canvas>
            </div>
          </div>
        </div>
      `;
    }, "generateNodeHtml");
    const nodesHtml = nodes.length > 0 ? nodes.map((node) => generateNodeHtml(node)).join("") : '<p style="text-align: center; color: #7f8c8d;">暂无节点信息</p>';
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCSM Status</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, 'Microsoft YaHei', sans-serif;
      background: #f8f9fa;
      margin: 0;
      padding: 20px;
      color: #333333;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.5);
    }
    .header {
      background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
      color: white;
      padding: 28px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .header::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%);
      transform: rotate(30deg);
    }
    .header::after {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%);
      transform: rotate(30deg);
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 600;
      letter-spacing: -0.5px;
      position: relative;
      z-index: 2;
    }
    .summary {
      display: flex;
      justify-content: space-around;
      padding: 24px;
      background: linear-gradient(to bottom, #f8fbff, #ffffff);
      border-bottom: 1px solid #e6f0ff;
    }
    .summary-item {
      text-align: center;
    }
    .summary-value {
      font-size: 32px;
      font-weight: 700;
      color: #495057;
    }
    .summary-label {
      font-size: 14px;
      color: #666666;
      margin-top: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 500;
    }
    .nodes-container {
      padding: 24px;
    }
    .node {
      background: #ffffff;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
      border: 1px solid #e9ecef;
      transition: all 0.3s ease;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
    }
    .node:hover {
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15);
      transform: translateY(-2px);
      border-color: #dee2e6;
    }
    .node-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .node-name {
      font-weight: 600;
      font-size: 18px;
      color: #333333;
    }
    .node-status {
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status-online {
      background-color: #d4edda;
      color: #155724;
    }
    .status-offline {
      background-color: #f8d7da;
      color: #721c24;
    }
    .node-info {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 16px;
      margin-top: 12px;
    }
    .info-item {
      padding: 10px;
      background: linear-gradient(to bottom, #ffffff, #f8fbff);
      border-radius: 10px;
      text-align: center;
      transition: all 0.3s ease;
      border: 1px solid #e6f0ff;
      height: 65px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .chart-container {
      text-align: left;
    }
    .info-item.chart-container {
      padding: 5px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    }
    .info-item:hover {
      background: linear-gradient(to bottom, #f9fbff, #ffffff);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }
    .info-label {
      font-size: 12px;
      color: #888888;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .info-value {
      font-weight: 700;
      font-size: 15px;
      color: #333333;
    }
    .progress-bar {
      width: 100%;
      height: 8px;
      background: #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 8px;
    }
    .progress {
      height: 100%;
      background: #4a6cf7;
      border-radius: 4px;
    }
    .chart-container {
      margin-top: 20px;
      padding: 10px;
      background: rgba(255, 255, 255, 0.7);
      border-radius: 8px;
      border: 1px solid #e6f0ff;
    }
    .chart-title {
      font-size: 13px;
      font-weight: 600;
      color: #333333;
      margin: 5px 0;
      text-align: center;
    }
    .chart-content {
      text-align: center;
    }

    .footer {
      text-align: center;
      padding: 20px;
      color: #666666;
      font-size: 13px;
      background: linear-gradient(to top, #f8fbff, #ffffff);
      border-top: 1px solid #e6f0ff;
    }
    
    .trend-chart {
      display: block;
      margin: 5px auto;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(config.title || "MCSM 服务器状态")}</h1>
    </div>
    <div class="summary">
      <div class="summary-item">
        <div class="summary-label">在线/总节点</div>
        <div class="summary-value">${onlineNodes}/${totalNodes}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">运行/总实例</div>
        <div class="summary-value">${runningInstances}/${totalInstances}</div>
      </div>
    </div>
    <div class="nodes-container">
      ${nodesHtml}
    </div>
    <div class="footer">
      数据更新时间: ${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN")}
    </div>
  </div>
  
  <script>
    // 页面加载完成后绘制所有图表
    document.addEventListener('DOMContentLoaded', function() {
      const charts = document.querySelectorAll('.trend-chart');
      charts.forEach(canvas => {
        try {
          const dataStr = decodeURIComponent(canvas.getAttribute('data-cpu-mem'));
          const data = JSON.parse(dataStr);
          if (data && data.length > 0) {
            drawChart(canvas, data);
          }
        } catch(e) {
          console.error('绘制图表时出错:', e);
        }
      });
    });
    
    function drawChart(canvas, data) {
      const dpr = window.devicePixelRatio || 1;
      
      // 获取canvas的显示尺寸
      const displayWidth = canvas.clientWidth || canvas.width;
      const displayHeight = canvas.clientHeight || canvas.height;
      

      if (canvas.width !== displayWidth * dpr) {
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
        canvas.style.width = displayWidth + 'px';
        canvas.style.height = displayHeight + 'px';
      }
      
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr); // 应用缩放
      
      const width = displayWidth;
      const height = displayHeight;
      
      ctx.clearRect(0, 0, width, height);
      
      if (!data || data.length === 0) {
        ctx.fillStyle = '#cccccc';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('无数据', width/2, height/2);
        return;
      }
      

      const margin = { top: 18, right: 8, bottom: 6, left: 18 }; 
      const chartWidth = width - margin.left - margin.right;
      const chartHeight = height - margin.top - margin.bottom;
      
      ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
      ctx.lineWidth = 0.5 / dpr;
      
      for (let y = 0; y <= 100; y += 25) {
        const yPos = margin.top + chartHeight - (y / 100) * chartHeight;
        ctx.beginPath();
        ctx.moveTo(margin.left, yPos);
        ctx.lineTo(width - margin.right, yPos);
        ctx.stroke();
      }
      
      const maxValue = 100; 
      
      if (data.some(item => item.cpu !== undefined)) {
        ctx.beginPath();
        ctx.strokeStyle = '#4A6CF7';
        ctx.lineWidth = 1.5 / dpr;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        data.forEach((item, index) => {
          const x = margin.left + (index / (data.length - 1)) * chartWidth;
          const y = margin.top + chartHeight - (item.cpu / maxValue) * chartHeight;
          
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        
        ctx.stroke();
        
        ctx.lineTo(width - margin.right, margin.top + chartHeight);
        ctx.lineTo(margin.left, margin.top + chartHeight);
        ctx.closePath();
        
        const cpuGradient = ctx.createLinearGradient(0, margin.top, 0, margin.top + chartHeight);
        cpuGradient.addColorStop(0, 'rgba(74, 108, 247, 0.2)');
        cpuGradient.addColorStop(1, 'rgba(74, 108, 247, 0.05)');
        
        ctx.fillStyle = cpuGradient;
        ctx.fill();
      }
      
      if (data.some(item => item.mem !== undefined)) {
        ctx.beginPath();
        ctx.strokeStyle = '#6FCF97';
        ctx.lineWidth = 1.5 / dpr;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        data.forEach((item, index) => {
          const x = margin.left + (index / (data.length - 1)) * chartWidth;
          const y = margin.top + chartHeight - (item.mem / maxValue) * chartHeight;
          
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        
        ctx.stroke();
        
        ctx.lineTo(width - margin.right, margin.top + chartHeight);
        ctx.lineTo(margin.left, margin.top + chartHeight);
        ctx.closePath();
        
        const memGradient = ctx.createLinearGradient(0, margin.top, 0, margin.top + chartHeight);
        memGradient.addColorStop(0, 'rgba(111, 207, 151, 0.2)');
        memGradient.addColorStop(1, 'rgba(111, 207, 151, 0.05)');
        
        ctx.fillStyle = memGradient;
        ctx.fill();
      }
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.font = '7px Arial';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let y = 0; y <= 100; y += 25) {
        const yPos = margin.top + chartHeight - (y / 100) * chartHeight;
        ctx.fillText(y + '%', margin.left - 2, yPos);
      }
      
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      if (data.some(item => item.cpu !== undefined)) {
        const legendY = 6;
        ctx.fillStyle = '#4A6CF7';
        ctx.fillRect(margin.left, legendY - 1, 8, 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.font = '8px Arial';
        ctx.fillText('CPU', margin.left + 10, legendY);
      }
      
      if (data.some(item => item.mem !== undefined)) {
        const cpuLabelWidth = data.some(item => item.cpu !== undefined) ? 30 : 0;
        const legendY = 6;
        ctx.fillStyle = '#6FCF97';
        ctx.fillRect(margin.left + cpuLabelWidth, legendY - 1, 8, 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.font = '8px Arial';
        ctx.fillText('MEM', margin.left + cpuLabelWidth + 10, legendY);
      }
      
      ctx.textBaseline = 'alphabetic';
    }
  </script>
</body>
</html>
    `;
  }, "generateHtmlContent");
  const renderToImage = /* @__PURE__ */ __name(async (html) => {
    const page = await ctx.puppeteer.page();
    try {
      await page.setContent(html, { waitUntil: "networkidle0" });
      await page.setViewport({
        width: 800,
        height: 600,
        deviceScaleFactor: 2
      });
      const screenshot = await page.screenshot({
        type: "png",
        fullPage: true
      });
      return screenshot;
    } finally {
      await page.close().catch(() => {
      });
    }
  }, "renderToImage");
  ctx.command("mcsm-status", "获取MCSM节点状态").action(async ({ session }) => {
    try {
      const officialConfig = { ...config, useProxyAPI: false };
      if (!officialConfig.apiKey) {
        return "错误：未配置MCSM API密钥";
      }
      if (!officialConfig.mcsmUrl) {
        return "错误：未配置MCSM面板地址";
      }
      const fetchOfficialNodesStatus = /* @__PURE__ */ __name(async () => {
        try {
          let url = `${officialConfig.mcsmUrl}/api/overview?apikey=${officialConfig.apiKey}`;
          const headers = {
            "Content-Type": "application/json"
          };
          const response = await fetchWithTimeout(url, {
            method: "GET",
            headers
          }, officialConfig.timeout);
          if (!response.ok) {
            throw new Error(`获取节点列表失败: ${response.status} - ${response.statusText}`);
          }
          const result = await response.json();
          const data = result.data || result;
          const nodes2 = [];
          if (data && data.remote && Array.isArray(data.remote)) {
            for (const node of data.remote) {
              const systemInfo = node.system || {};
              const instanceInfo = node.instance || {};
              const configInfo = node.config || {};
              const isOnline = node.available;
              nodes2.push({
                uuid: node.uuid || node.id || "",
                name: node.nickname || node.remarks || node.name || `节点 ${node.ip || "unknown"}:${configInfo.port || "unknown"}`,
                address: node.ip || "unknown",
                port: configInfo.port || node.port || 24444,
                status: isOnline ? "online" : "offline",
                cpuUsage: parseFloat(((systemInfo.cpuUsage || 0) * 100).toFixed(1)),
                memoryUsage: parseFloat((((systemInfo.totalmem || 0) - (systemInfo.freemem || 0)) / (1024 * 1024 * 1024)).toFixed(1)) || 0,
                maxMemory: parseFloat(((systemInfo.totalmem || 0) / (1024 * 1024 * 1024)).toFixed(1)) || 0,
                runningInstanceCount: instanceInfo.running || 0,
                instanceCount: instanceInfo.total || 0,
                hostname: systemInfo.hostname || "Unknown",
                system: systemInfo.type || systemInfo.platform || "Unknown",
                version: systemInfo.version || systemInfo.release || "",
                uptime: systemInfo.uptime || 0,
                cpuMemChart: node.cpuMemChart || []
              });
            }
          }
          return nodes2;
        } catch (error) {
          ctx.logger.error("获取节点列表时出错:", error);
          throw error;
        }
      }, "fetchOfficialNodesStatus");
      const fetchOfficialInstancesStatus = /* @__PURE__ */ __name(async () => {
        try {
          let url = `${officialConfig.mcsmUrl}/api/overview?apikey=${officialConfig.apiKey}`;
          const headers = {
            "Content-Type": "application/json"
          };
          const response = await fetchWithTimeout(url, {
            method: "GET",
            headers
          }, officialConfig.timeout);
          if (!response.ok) {
            throw new Error(`获取实例列表失败: ${response.status} - ${response.statusText}`);
          }
          const result = await response.json();
          const data = result.data || result;
          const instances2 = [];
          if (data && data.remote && Array.isArray(data.remote)) {
            for (const node of data.remote) {
              if (node.instances && Array.isArray(node.instances)) {
                for (const instance of node.instances) {
                  instances2.push({
                    uuid: instance.uuid || instance.instanceUuid,
                    name: instance.name || instance.config?.name || instance.instanceName || "未知实例",
                    status: instance.status || instance.state || instance.running || "unknown",
                    nodeUuid: node.uuid || node.id || ""
                  });
                }
              }
            }
          }
          if (instances2.length === 0 && data && data.chart && data.chart.request) {
            const requestInfo = data.chart.request[0] || data.chart.request;
            if (requestInfo && requestInfo.runningInstance !== void 0) {
              for (let i = 0; i < (requestInfo.runningInstance || 0); i++) {
                instances2.push({
                  uuid: `stat-instance-${i}`,
                  name: `实例 ${i + 1}`,
                  status: "running",
                  nodeUuid: "stat-node"
                });
              }
            }
          }
          return instances2;
        } catch (error) {
          ctx.logger.error("获取实例列表时出错:", error);
          throw error;
        }
      }, "fetchOfficialInstancesStatus");
      const [nodes, instances] = await Promise.all([
        fetchOfficialNodesStatus().catch((err) => {
          ctx.logger.warn("获取官方节点状态失败，返回空数组:", err.message);
          return [];
        }),
        fetchOfficialInstancesStatus().catch((err) => {
          ctx.logger.warn("获取官方实例状态失败，返回空数组:", err.message);
          return [];
        })
      ]);
      const htmlContent = generateHtmlContent(nodes, instances);
      const imageBuffer = await renderToImage(htmlContent);
      return import_koishi.segment.image("data:image/png;base64," + imageBuffer.toString("base64"));
    } catch (error) {
      ctx.logger.error("生成图片时出错:", error);
      return "获取服务器状态失败: " + error.message;
    }
  });
  if (config.useProxyAPI) {
    ctx.command("mcsm-status-proxy", "获取MCSM节点状态（使用代理API）").action(async ({ session }) => {
      try {
        const proxyConfig = { ...config, useProxyAPI: true };
        const fetchProxyNodesStatus = /* @__PURE__ */ __name(async () => {
          try {
            let url = config.proxyAPIUrl || "";
            const headers = {
              "Content-Type": "application/json"
            };
            headers["User-Agent"] = "Koishi-MCSM-Status-Bot/1.0";
            const response = await fetchWithTimeout(url, {
              method: "GET",
              headers
            }, config.timeout);
            if (!response.ok) {
              throw new Error(`获取节点列表失败: ${response.status} - ${response.statusText}`);
            }
            const result = await response.json();
            const data = { remote: Array.isArray(result.data) ? result.data : [], chart: result.chart || {} };
            const nodes2 = [];
            if (data && data.remote && Array.isArray(data.remote)) {
              for (const node of data.remote) {
                const systemInfo = node.system || {};
                const instanceInfo = node.instance || {};
                const isOnline = node.system && node.system.uptime !== void 0;
                nodes2.push({
                  uuid: node.uuid || node.id || "",
                  name: node.nickname || node.remarks || node.name || `节点 ${node.ip || "unknown"}:${node.port || "unknown"}`,
                  address: node.ip || "unknown",
                  port: node.port || 24444,
                  status: isOnline ? "online" : "offline",
                  cpuUsage: parseFloat(((systemInfo.cpuUsage || 0) * 100).toFixed(1)),
                  memoryUsage: parseFloat((((systemInfo.totalmem || 0) - (systemInfo.freemem || 0)) / (1024 * 1024 * 1024)).toFixed(1)) || 0,
                  maxMemory: parseFloat(((systemInfo.totalmem || 0) / (1024 * 1024 * 1024)).toFixed(1)) || 0,
                  runningInstanceCount: instanceInfo.running || 0,
                  instanceCount: instanceInfo.total || 0,
                  hostname: systemInfo.hostname || "Unknown",
                  system: systemInfo.type || systemInfo.platform || "Unknown",
                  version: systemInfo.version || systemInfo.release || "",
                  uptime: systemInfo.uptime || 0,
                  cpuMemChart: node.cpuMemChart || []
                });
              }
            }
            return nodes2;
          } catch (error) {
            ctx.logger.error("获取节点列表时出错:", error);
            throw error;
          }
        }, "fetchProxyNodesStatus");
        const fetchProxyInstancesStatus = /* @__PURE__ */ __name(async () => {
          try {
            let url = config.proxyAPIUrl || "https://api.eqad.fun/mcsm/api/services";
            const headers = {
              "Content-Type": "application/json"
            };
            headers["User-Agent"] = "Koishi-MCSM-Status-Bot/1.0";
            const response = await fetchWithTimeout(url, {
              method: "GET",
              headers
            }, config.timeout);
            if (!response.ok) {
              throw new Error(`获取实例列表失败: ${response.status} - ${response.statusText}`);
            }
            const result = await response.json();
            const data = { remote: Array.isArray(result.data) ? result.data : [], chart: result.chart || {} };
            const instances2 = [];
            if (data && data.remote && Array.isArray(data.remote)) {
              for (const node of data.remote) {
                if (node.instances && Array.isArray(node.instances)) {
                  for (const instance of node.instances) {
                    instances2.push({
                      uuid: instance.uuid || instance.instanceUuid,
                      name: instance.name || instance.config?.name || instance.instanceName || "未知实例",
                      status: instance.status || instance.state || instance.running || "unknown",
                      nodeUuid: node.uuid || node.id || ""
                    });
                  }
                }
              }
            }
            if (instances2.length === 0 && data && data.chart && data.chart.request) {
              const requestInfo = data.chart.request[0] || data.chart.request;
              if (requestInfo && requestInfo.runningInstance !== void 0) {
                for (let i = 0; i < (requestInfo.runningInstance || 0); i++) {
                  instances2.push({
                    uuid: `stat-instance-${i}`,
                    name: `实例 ${i + 1}`,
                    status: "running",
                    nodeUuid: "stat-node"
                  });
                }
              }
            }
            return instances2;
          } catch (error) {
            ctx.logger.error("获取实例列表时出错:", error);
            throw error;
          }
        }, "fetchProxyInstancesStatus");
        const [nodes, instances] = await Promise.all([
          fetchProxyNodesStatus().catch((err) => {
            ctx.logger.warn("获取代理节点状态失败，返回空数组:", err.message);
            return [];
          }),
          fetchProxyInstancesStatus().catch((err) => {
            ctx.logger.warn("获取代理实例状态失败，返回空数组:", err.message);
            return [];
          })
        ]);
        const htmlContent = generateHtmlContent(nodes, instances);
        const imageBuffer = await renderToImage(htmlContent);
        return import_koishi.segment.image("data:image/png;base64," + imageBuffer.toString("base64"));
      } catch (error) {
        ctx.logger.error("生成图片时出错:", error);
        return "获取服务器状态失败: " + error.message;
      }
    });
  }
}
__name(apply, "apply");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Config,
  apply,
  inject,
  name
});
