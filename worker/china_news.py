import requests
from bs4 import BeautifulSoup
import pandas as pd

# 目标网址
url = "https://china.buzzing.cc/"

# 伪装浏览器头
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def scrape_buzzing():
    print(f"正在请求页面: {url} ...")
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        response.encoding = 'utf-8' # 确保中文不乱码
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 1. 找到所有 article 标签 (根据你提供的 HTML，class包含 card)
        articles = soup.find_all('article', class_='card')
        
        print(f"找到 {len(articles)} 条新闻，开始解析...")
        
        news_data = []
        
        for item in articles:
            try:
                # --- 解析标题 ---
                # 找到 class 为 p-name 的 a 标签
                title_tag = item.find('a', class_='p-name')
                if title_tag:
                    # 获取文本，例如 "7. 中国将在年底..."
                    full_title = title_tag.get_text(strip=True)
                    # 获取链接
                    link = title_tag.get('href')
                else:
                    full_title = "无标题"
                    link = ""

                # --- 解析内容 (英文摘要) ---
                # 找到 class 为 p-summary 的 div，再找它里面的第一个 div (避开 footer)
                summary_container = item.find('div', class_='p-summary')
                if summary_container and summary_container.find('div'):
                    content = summary_container.find('div').get_text(strip=True)
                else:
                    content = ""

                # --- 解析时间 ---
                # 找到 time 标签
                time_tag = item.find('time')
                if time_tag:
                    # 优先获取 datetime 属性 (标准时间: 2025-12-22T...)
                    raw_time = time_tag.get('datetime')
                    # 也可以获取显示的时间文本 (04:10)
                    display_time = time_tag.get_text(strip=True)
                else:
                    raw_time = ""
                    display_time = ""

                # --- 存入列表 ---
                news_data.append({
                    "标题": full_title,
                    "发布时间(ISO)": raw_time,
                    "显示时间": display_time,
                    "内容摘要": content,
                    "链接": link
                })
                
            except Exception as e:
                print(f"解析某条数据时出错: {e}")
                continue

        return news_data

    except Exception as e:
        print(f"请求失败: {e}")
        return []

# 执行脚本
if __name__ == "__main__":
    data = scrape_buzzing()
    
    if data:
        # 使用 Pandas 保存为 Excel
        df = pd.DataFrame(data)
        
        # 简单清洗一下：把时间里的 T 和 Z 去掉，或者保留原样
        # df['发布时间(ISO)'] = df['发布时间(ISO)'].str.replace('T', ' ').str.replace('Z', '')

        filename = "buzzing_news_data.xlsx"
        df.to_excel(filename, index=False)
        
        print("-" * 30)
        print(f"成功！已抓取 {len(data)} 条数据")
        print(f"文件已保存为: {filename}")
        print("前3条数据预览：")
        print(df[['发布时间(ISO)', '标题']].head(3))
    else:
        print("未获取到数据。")