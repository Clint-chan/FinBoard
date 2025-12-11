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

      // GET /api/stock/comments/:code - 获取股吧评论（代理百度接口）
      if (path.startsWith('/api/stock/comments/') && request.method === 'GET') {
        const code = path.split('/').pop();
        if (!code) {
          return jsonResponse({ error: '股票代码不能为空' }, 400);
        }

        try {
          // 调用百度股市通接口
          const baiduUrl = `https://finance.pae.baidu.com/api/stockwidget?code=${code}&market=ab&type=stock&widgetType=talks&finClientType=pc`;
          const baiduResponse = await fetch(baiduUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': 'https://finance.baidu.com/'
            }
          });

          if (!baiduResponse.ok) {
            return jsonResponse({ error: '获取数据失败' }, 500);
          }

          const data = await baiduResponse.json();
          
          if (data.ResultCode !== '0' || !data.Result?.content?.list) {
            return jsonResponse({ comments: [] });
          }

          // 格式化数据
          const comments = data.Result.content.list.map(item => {
            // 提取文本内容
            let content = '';
            if (item.content?.items) {
              content = item.content.items
                .filter(i => i.type === 'text')
                .map(i => i.data)
                .join('');
            }

            return {
              id: item.comment_id || item.reply_id || '',
              content: content.trim(),
              author: {
                name: item.author?.name || '匿名用户',
                avatar: item.author?.image?.src || ''
              },
              source: item.provider || '股吧',
              createTime: item.create_show_time || item.publish_time || '',
              likeCount: parseInt(item.like_count || '0'),
              replyCount: parseInt(item.reply_count || '0'),
              url: item.loc || item.third_url || item.real_loc || ''
            };
          }).filter(c => c.content.length > 0);

          return jsonResponse({ comments });
        } catch (err) {
          console.error('Failed to fetch comments:', err);
          return jsonResponse({ error: '获取评论失败', comments: [] }, 500);
        }
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
