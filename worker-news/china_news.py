import requests
from bs4 import BeautifulSoup
import pandas as pd

# 目标网址
url = "https://china.buzzing.cc/"

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def scrape_buzzing():
    print(f"正在请求页面: {url} ...")
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        response.encoding = 'utf-8'
        
        soup = BeautifulSoup(response.text, 'html.parser')
        articles = soup.find_all('article', class_='card')
        
        print(f"找到 {len(articles)} 条新闻，开始解析...")
        
        news_data = []
        
        for item in articles:
            try:
                # --- 标题 ---
                title_tag = item.find('a', class_='p-name')
                full_title = title_tag.get_text(strip=True) if title_tag else "无标题"
                
                # --- 内容 ---
                summary_container = item.find('div', class_='p-summary')
                if summary_container and summary_container.find('div'):
                    content = summary_container.find('div').get_text(strip=True)
                else:
                    content = ""

                # --- 时间 (只抓取 ISO 原始时间，后续统一处理) ---
                time_tag = item.find('time')
                raw_time = time_tag.get('datetime') if time_tag else None

                if raw_time:
                    news_data.append({
                        "raw_time": raw_time, # 临时存储，稍后转换
                        "标题": full_title,
                        "内容摘要": content
                    })
                
            except Exception as e:
                continue

        return news_data

    except Exception as e:
        print(f"请求失败: {e}")
        return []

if __name__ == "__main__":
    data = scrape_buzzing()
    
    if data:
        df = pd.DataFrame(data)
        
        # ================== 核心优化部分 ==================
        
        # 1. 将字符串转换为 datetime 对象 (自动识别 UTC 的 'Z')
        df['temp_dt'] = pd.to_datetime(df['raw_time'])
        
        # 2. 转换时区：从 UTC 转为 Asia/Shanghai (北京时间)
        df['temp_dt'] = df['temp_dt'].dt.tz_convert('Asia/Shanghai')
        
        # 3. 格式化为易读的字符串 (例如: 2025-12-23 15:08:00)
        df['北京时间'] = df['temp_dt'].dt.strftime('%Y-%m-%d %H:%M:%S')
        
        # 4. 只筛选需要的列，去掉 raw_time 和 temp_dt
        final_df = df[['北京时间', '标题', '内容摘要']]
        
        # ==================================================

        filename = "buzzing_news_optimized.xlsx"
        final_df.to_excel(filename, index=False)
        
        print("-" * 30)
        print(f"处理完成！文件已保存为: {filename}")
        print("数据预览：")
        # 设置显示宽度，防止预览时换行
        pd.set_option('display.max_columns', None)
        pd.set_option('display.width', 1000)
        print(final_df.head())
    else:
        print("未获取到数据。")