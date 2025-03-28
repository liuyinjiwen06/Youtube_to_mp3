/**
 * 请求混淆器 - 协议级反检测机制
 * 用于混淆HTTP请求特征，避免YouTube API限制和封禁
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { HttpProxyAgent } = require('http-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

// 配置文件路径
const CONFIG_FILE = path.join(__dirname, 'obfuscator_config.json');

// 默认配置
const DEFAULT_CONFIG = {
  // 请求延迟设置
  delay: {
    enabled: true,
    minDelay: 500,  // 最小延迟(ms)
    maxDelay: 2000, // 最大延迟(ms)
    adaptiveMode: true, // 自适应模式
    currentDelay: 1000, // 当前延迟基准值
    backoffFactor: 1.5, // 检测到封禁时的延迟增加因子
    maxBackoffDelay: 30000, // 最大回退延迟(30秒)
    successReduceFactor: 0.9 // 成功后延迟减少因子
  },
  
  // 代理设置
  proxy: {
    enabled: false,
    currentIndex: 0,
    rotationStrategy: 'round-robin', // round-robin, random, health-based
    healthCheck: true,
    proxies: [
      // 示例代理配置
      // { url: 'http://user:pass@proxy.example.com:8080', type: 'http', health: 100, lastUsed: 0 },
      // { url: 'socks5://proxy.example.com:1080', type: 'socks5', health: 100, lastUsed: 0 }
    ]
  },
  
  // 用户代理设置
  userAgent: {
    enabled: true,
    mobileProbability: 0.3, // 移动端UA出现概率
    desktop: [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 OPR/77.0.4054.254"
    ],
    mobile: [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/91.0.4472.80 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/34.0 Mobile/15E148 Safari/605.1.15",
      "Mozilla/5.0 (Android 11; Mobile; rv:68.0) Gecko/68.0 Firefox/89.0",
      "Mozilla/5.0 (Linux; Android 11; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36",
      "Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
    ]
  },
  
  // HTTP头部设置
  headers: {
    enabled: true,
    randomizeOrder: true,
    common: {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Cache-Control": "max-age=0"
    },
    optional: {
      "DNT": "1",
      "Sec-GPC": "1",
      "TE": "Trailers",
      "Pragma": "no-cache"
    },
    referrers: [
      "https://www.google.com/",
      "https://www.bing.com/",
      "https://search.yahoo.com/",
      "https://duckduckgo.com/",
      "https://www.youtube.com/",
      "https://www.facebook.com/",
      "https://twitter.com/",
      "https://www.reddit.com/"
    ]
  },
  
  // 协议特征设置
  protocol: {
    enabled: true,
    httpVersions: ["1.0", "1.1", "2.0"],
    httpVersionProbabilities: [0.1, 0.6, 0.3], // 各版本出现概率
    tlsFingerprint: {
      enabled: false, // 需要特殊库支持，默认关闭
      randomize: true
    }
  },
  
  // 统计信息
  stats: {
    requestCount: 0,
    successCount: 0,
    failureCount: 0,
    blockDetectionCount: 0,
    lastReset: Date.now()
  }
};

// 当前配置
let config = { ...DEFAULT_CONFIG };

// 加载配置
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const loadedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      config = { ...DEFAULT_CONFIG, ...loadedConfig };
      console.log('已加载请求混淆器配置');
    } else {
      saveConfig(); // 创建默认配置文件
      console.log('已创建默认请求混淆器配置');
    }
  } catch (error) {
    console.error('加载请求混淆器配置失败:', error.message);
    // 使用默认配置
  }
}

// 保存配置
function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('保存请求混淆器配置失败:', error.message);
  }
}

// 检测是否被封禁的标志
function isBlockedResponse(response, body) {
  // YouTube封禁特征检测
  if (response.statusCode === 429) {
    return true; // Too Many Requests
  }
  
  if (response.statusCode === 403) {
    return true; // Forbidden
  }
  
  // 检查响应体中的特定字符串
  if (body && typeof body === 'string') {
    const blockPatterns = [
      'unusual traffic',
      'automated requests',
      'blocked',
      'captcha',
      'suspicious activity'
    ];
    
    for (const pattern of blockPatterns) {
      if (body.toLowerCase().includes(pattern)) {
        return true;
      }
    }
  }
  
  return false;
}

// 随机延迟函数
function getRandomDelay() {
  if (!config.delay.enabled) return 0;
  
  const { minDelay, maxDelay, currentDelay } = config.delay;
  
  if (config.delay.adaptiveMode) {
    // 在当前基准延迟的50%-150%范围内随机
    const min = currentDelay * 0.5;
    const max = currentDelay * 1.5;
    return Math.floor(min + Math.random() * (max - min));
  } else {
    // 固定范围内随机
    return Math.floor(minDelay + Math.random() * (maxDelay - minDelay));
  }
}

// 调整延迟（根据成功/失败）
function adjustDelay(success, blocked = false) {
  if (!config.delay.enabled || !config.delay.adaptiveMode) return;
  
  if (blocked) {
    // 检测到封禁，大幅增加延迟
    config.delay.currentDelay = Math.min(
      config.delay.currentDelay * config.delay.backoffFactor,
      config.delay.maxBackoffDelay
    );
    console.log(`检测到封禁，增加延迟至 ${config.delay.currentDelay}ms`);
  } else if (success) {
    // 请求成功，稍微减少延迟
    config.delay.currentDelay = Math.max(
      config.delay.minDelay,
      config.delay.currentDelay * config.delay.successReduceFactor
    );
  } else {
    // 请求失败但非封禁，小幅增加延迟
    config.delay.currentDelay = Math.min(
      config.delay.currentDelay * 1.2,
      config.delay.maxBackoffDelay
    );
  }
  
  saveConfig();
}

// 获取随机User-Agent
function getRandomUserAgent() {
  if (!config.userAgent.enabled) {
    return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
  }
  
  // 根据概率决定是移动端还是桌面端
  const isMobile = Math.random() < config.userAgent.mobileProbability;
  const uaList = isMobile ? config.userAgent.mobile : config.userAgent.desktop;
  
  // 随机选择一个UA
  return uaList[Math.floor(Math.random() * uaList.length)];
}

// 获取随机HTTP版本
function getRandomHttpVersion() {
  if (!config.protocol.enabled) return "1.1";
  
  // 根据概率选择HTTP版本
  const rand = Math.random();
  let cumulativeProbability = 0;
  
  for (let i = 0; i < config.protocol.httpVersions.length; i++) {
    cumulativeProbability += config.protocol.httpVersionProbabilities[i];
    if (rand <= cumulativeProbability) {
      return config.protocol.httpVersions[i];
    }
  }
  
  return "1.1"; // 默认
}

// 获取随机引用来源
function getRandomReferrer() {
  if (!config.headers.enabled || config.headers.referrers.length === 0) {
    return "";
  }
  
  return config.headers.referrers[Math.floor(Math.random() * config.headers.referrers.length)];
}

// 生成随机化的HTTP头部
function generateRandomizedHeaders(customHeaders = {}) {
  if (!config.headers.enabled) return customHeaders;
  
  // 基础头部
  let headers = { ...config.headers.common };
  
  // 添加User-Agent
  headers['User-Agent'] = getRandomUserAgent();
  
  // 随机添加可选头部
  for (const [key, value] of Object.entries(config.headers.optional)) {
    if (Math.random() > 0.5) { // 50%概率添加每个可选头部
      headers[key] = value;
    }
  }
  
  // 随机添加Referer
  if (Math.random() > 0.7) { // 30%概率添加引用来源
    headers['Referer'] = getRandomReferrer();
  }
  
  // 合并自定义头部
  headers = { ...headers, ...customHeaders };
  
  // 随机化头部顺序
  if (config.headers.randomizeOrder) {
    const entries = Object.entries(headers);
    const shuffled = entries.sort(() => Math.random() - 0.5);
    headers = Object.fromEntries(shuffled);
  }
  
  return headers;
}

// 获取代理代理
function getProxy() {
  if (!config.proxy.enabled || config.proxy.proxies.length === 0) {
    return null;
  }
  
  let proxyIndex;
  
  switch (config.proxy.rotationStrategy) {
    case 'random':
      proxyIndex = Math.floor(Math.random() * config.proxy.proxies.length);
      break;
    case 'health-based':
      // 按健康度排序，选择最健康的代理
      const sortedProxies = [...config.proxy.proxies].sort((a, b) => b.health - a.health);
      proxyIndex = config.proxy.proxies.findIndex(p => p === sortedProxies[0]);
      break;
    case 'round-robin':
    default:
      // 轮询策略
      proxyIndex = config.proxy.currentIndex;
      config.proxy.currentIndex = (config.proxy.currentIndex + 1) % config.proxy.proxies.length;
      break;
  }
  
  const proxy = config.proxy.proxies[proxyIndex];
  proxy.lastUsed = Date.now();
  
  return proxy;
}

// 创建代理代理
function createProxyAgent(proxy) {
  if (!proxy) return null;
  
  try {
    if (proxy.url.startsWith('http://')) {
      return new HttpProxyAgent(proxy.url);
    } else if (proxy.url.startsWith('https://')) {
      return new HttpsProxyAgent(proxy.url);
    } else if (proxy.url.startsWith('socks')) {
      return new SocksProxyAgent(proxy.url);
    }
  } catch (error) {
    console.error(`创建代理代理失败: ${error.message}`);
    // 降低此代理的健康度
    if (proxy.health) {
      proxy.health = Math.max(0, proxy.health - 20);
    }
  }
  
  return null;
}

// 更新代理健康度
function updateProxyHealth(proxy, success, blocked = false) {
  if (!proxy || !config.proxy.healthCheck) return;
  
  if (blocked) {
    // 检测到封禁，大幅降低健康度
    proxy.health = Math.max(0, proxy.health - 50);
  } else if (!success) {
    // 请求失败，降低健康度
    proxy.health = Math.max(0, proxy.health - 20);
  } else {
    // 请求成功，提高健康度
    proxy.health = Math.min(100, proxy.health + 5);
  }
  
  saveConfig();
}

// 混淆HTTP请求
async function obfuscatedRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    // 更新统计
    config.stats.requestCount++;
    
    // 获取随机延迟
    const delay = getRandomDelay();
    
    // 获取代理
    const proxy = getProxy();
    const proxyAgent = createProxyAgent(proxy);
    
    // 准备请求选项
    const requestOptions = {
      ...options,
      headers: generateRandomizedHeaders(options.headers || {}),
      agent: proxyAgent || options.agent
    };
    
    // 设置HTTP版本
    const httpVersion = getRandomHttpVersion();
    if (httpVersion === "2.0") {
      requestOptions.protocol = "https:";
    }
    
    console.log(`发送混淆请求: ${options.method || 'GET'} ${options.hostname}${options.path}`);
    if (delay > 0) {
      console.log(`应用随机延迟: ${delay}ms`);
    }
    
    // 应用延迟
    setTimeout(() => {
      // 选择HTTP客户端
      const client = requestOptions.protocol === 'https:' ? https : http;
      
      const req = client.request(requestOptions, (res) => {
        let responseBody = '';
        
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        
        res.on('end', () => {
          // 检查是否被封禁
          const blocked = isBlockedResponse(res, responseBody);
          
          if (blocked) {
            config.stats.blockDetectionCount++;
            config.stats.failureCount++;
            console.warn('检测到可能的封禁响应!');
            
            // 调整延迟和代理健康度
            adjustDelay(false, true);
            updateProxyHealth(proxy, false, true);
            
            reject(new Error('请求被封禁或限制'));
          } else if (res.statusCode >= 200 && res.statusCode < 300) {
            config.stats.successCount++;
            
            // 调整延迟和代理健康度
            adjustDelay(true);
            updateProxyHealth(proxy, true);
            
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: responseBody
            });
          } else {
            config.stats.failureCount++;
            
            // 调整延迟和代理健康度
            adjustDelay(false);
            updateProxyHealth(proxy, false);
            
            reject(new Error(`HTTP错误: ${res.statusCode}`));
          }
          
          saveConfig();
        });
      });
      
      req.on('error', (error) => {
        config.stats.failureCount++;
        
        // 调整延迟和代理健康度
        adjustDelay(false);
        updateProxyHealth(proxy, false);
        
        console.error('请求错误:', error.message);
        reject(error);
        
        saveConfig();
      });
      
      // 发送请求体数据
      if (data) {
        req.write(typeof data === 'string' ? data : JSON.stringify(data));
      }
      
      req.end();
    }, delay);
  });
}

// 获取统计信息
function getStats() {
  const successRate = config.stats.requestCount > 0 
    ? (config.stats.successCount / config.stats.requestCount * 100).toFixed(2) 
    : '0.00';
  
  return {
    ...config.stats,
    successRate: `${successRate}%`,
    currentDelay: config.delay.currentDelay,
    proxies: config.proxy.enabled ? config.proxy.proxies.map(p => ({
      url: p.url.replace(/\/\/.*?:.*?@/, '//***:***@'), // 隐藏凭据
      type: p.type,
      health: p.health,
      lastUsed: new Date(p.lastUsed).toISOString()
    })) : [],
    timestamp: new Date().toISOString()
  };
}

// 重置统计信息
function resetStats() {
  config.stats = {
    requestCount: 0,
    successCount: 0,
    failureCount: 0,
    blockDetectionCount: 0,
    lastReset: Date.now()
  };
  
  saveConfig();
  console.log('请求混淆器统计已重置');
}

// 添加代理
function addProxy(proxyUrl, type = 'http') {
  if (!config.proxy.proxies) {
    config.proxy.proxies = [];
  }
  
  // 检查是否已存在
  const exists = config.proxy.proxies.some(p => p.url === proxyUrl);
  if (exists) {
    return false;
  }
  
  config.proxy.proxies.push({
    url: proxyUrl,
    type: type,
    health: 100,
    lastUsed: 0
  });
  
  saveConfig();
  return true;
}

// 移除代理
function removeProxy(proxyUrl) {
  if (!config.proxy.proxies) return false;
  
  const initialLength = config.proxy.proxies.length;
  config.proxy.proxies = config.proxy.proxies.filter(p => p.url !== proxyUrl);
  
  if (config.proxy.proxies.length < initialLength) {
    saveConfig();
    return true;
  }
  
  return false;
}

// 启用/禁用代理
function setProxyEnabled(enabled) {
  config.proxy.enabled = !!enabled;
  saveConfig();
  return config.proxy.enabled;
}

// 初始化
function init() {
  loadConfig();
  console.log('请求混淆器已初始化');
}

// 初始化
init();

module.exports = {
  obfuscatedRequest,
  getRandomUserAgent,
  generateRandomizedHeaders,
  getStats,
  resetStats,
  addProxy,
  removeProxy,
  setProxyEnabled,
  getConfig: () => ({ ...config }),
  updateConfig: (newConfig) => {
    config = { ...config, ...newConfig };
    saveConfig();
    return { ...config };
  }
}; 