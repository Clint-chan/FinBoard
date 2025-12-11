// Cloudflare Worker - Market Board 配置同步 API (带登录功能)

export default {
  async fetch(request, env) {
    // CORS 处理
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // POST /api/register - 注册
      if (path === '/api/register' && request.method === 'POST') {
        const { username, password } = await request.json();
        
        if (!username || !password) {
          return jsonResponse({ error: '用户名和密码不能为空' }, 400);
        }
        if (username.length < 3 || username.length > 20) {
          return jsonResponse({ error: '用户名长度 3-20 字符' }, 400);
        }
        if (password.length < 6) {
          return jsonResponse({ error: '密码至少 6 位' }, 400);
        }

        // 检查用户名是否已存在
        const existing = await env.CONFIG_KV.get(`user:${username}`);
        if (existing) {
          return jsonResponse({ error: '用户名已存在' }, 400);
        }

        // 哈希密码
        const passwordHash = await hashPassword(password);
        
        // 保存用户
        await env.CONFIG_KV.put(`user:${username}`, JSON.stringify({
          passwordHash,
          createdAt: Date.now()
        }));

        return jsonResponse({ success: true, message: '注册成功' });
      }

      // POST /api/login - 登录
      if (path === '/api/login' && request.method === 'POST') {
        const { username, password } = await request.json();
        
        if (!username || !password) {
          return jsonResponse({ error: '用户名和密码不能为空' }, 400);
        }

        const userData = await env.CONFIG_KV.get(`user:${username}`, 'json');
        if (!userData) {
          return jsonResponse({ error: '用户名或密码错误' }, 401);
        }

        // 验证密码
        const valid = await verifyPassword(password, userData.passwordHash);
        if (!valid) {
          return jsonResponse({ error: '用户名或密码错误' }, 401);
        }

        // 生成 token
        const token = await generateToken(username);
        
        return jsonResponse({ success: true, token, username });
      }

      // GET /api/config - 获取配置 (需要 token)
      if (path === '/api/config' && request.method === 'GET') {
        const username = await verifyToken(request, env);
        if (!username) {
          return jsonResponse({ error: '未登录' }, 401);
        }

        const config = await env.CONFIG_KV.get(`config:${username}`, 'json');
        return jsonResponse({ config: config || null });
      }

      // POST /api/config - 保存配置 (需要 token)
      if (path === '/api/config' && request.method === 'POST') {
        const username = await verifyToken(request, env);
        if (!username) {
          return jsonResponse({ error: '未登录' }, 401);
        }

        const { config } = await request.json();
        if (!config) {
          return jsonResponse({ error: '配置不能为空' }, 400);
        }

        await env.CONFIG_KV.put(`config:${username}`, JSON.stringify(config));
        return jsonResponse({ success: true });
      }

      return jsonResponse({ error: 'Not found' }, 404);
    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }
  }
};

// 密码哈希
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'market_board_salt_2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

// 验证密码
async function verifyPassword(password, hash) {
  const newHash = await hashPassword(password);
  return newHash === hash;
}

// 生成 token (简单实现，用 username + 时间戳 + 签名)
async function generateToken(username) {
  const payload = { username, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 }; // 30天过期
  const data = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.digest('SHA-256', encoder.encode(data + 'token_secret_2024'));
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature))).slice(0, 16);
  return btoa(data) + '.' + sig;
}

// 验证 token
async function verifyToken(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  
  const token = auth.slice(7);
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return null;
  
  try {
    const data = atob(payloadB64);
    const payload = JSON.parse(data);
    
    // 检查过期
    if (payload.exp < Date.now()) return null;
    
    // 验证签名
    const encoder = new TextEncoder();
    const expectedSig = await crypto.subtle.digest('SHA-256', encoder.encode(data + 'token_secret_2024'));
    const expectedSigStr = btoa(String.fromCharCode(...new Uint8Array(expectedSig))).slice(0, 16);
    
    if (sig !== expectedSigStr) return null;
    
    return payload.username;
  } catch {
    return null;
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders()
    }
  });
}
