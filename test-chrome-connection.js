#!/usr/bin/env node

/**
 * 测试 Chrome 远程调试连接
 */

const http = require('http');

function checkChrome() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:9222/json/version', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('✅ 连接成功!');
        console.log('响应:', data);
        resolve(true);
      });
    });
    
    req.on('error', (err) => {
      console.log('❌ 连接失败:', err.message);
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      console.log('❌ 连接超时');
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  console.log('测试 Chrome 远程调试连接...\n');
  
  console.log('尝试 127.0.0.1:9222...');
  const ok1 = await checkChrome();
  
  if (!ok1) {
    console.log('\n可能的原因:');
    console.log('1. Chrome 启动参数不正确');
    console.log('2. Chrome 安全设置阻止了连接');
    console.log('3. 需要使用特殊的启动参数');
    console.log('\n建议启动命令:');
    console.log('/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\\');
    console.log('  --remote-debugging-port=9222 \\\');
    console.log('  --remote-debugging-address=0.0.0.0 \\\');
    console.log('  --user-data-dir=/tmp/chrome-dev');
  }
}

main();
