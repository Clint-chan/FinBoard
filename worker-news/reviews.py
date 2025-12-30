import requests
import re
import html
from datetime import datetime

def clean_text(text):
    """清洗HTML标签和转义字符"""
    if not text or not isinstance(text, str):
        return ""
    text = re.sub(r'<[^>]+>', '', text)  # 正则去除HTML标签
    return html.unescape(text).strip()   # 转义实体并去首尾空格

def parse_tcrd(content_list):
    """解析题材热点 (tcrd)"""
    lines = []
    if not isinstance(content_list, list):
        return lines

    for item in content_list:
        name = item.get("concept_name", "未知概念")
        zdf = item.get("concept_zdf", "0.00")
        
        # 提取原因 (取列表第一条)
        reasons = item.get("hot_spot", {}).get("hot_reason", [])
        reason_text = clean_text(reasons[0]) if reasons else ""
        
        # 提取领涨股
        stocks = item.get("top2_stocks", [])
        stock_str_list = [f"{s['stock_name']}({s['stock_zdf']}%)" for s in stocks]
        stock_display = ", ".join(stock_str_list)

        # 格式化输出
        lines.append(f"- **{name}** (涨幅 {zdf}%)")
        if reason_text:
            lines.append(f"  > 催化: {reason_text}")
        if stock_display:
            lines.append(f"  > 领涨: {stock_display}")
            
    return lines

def parse_sqry(content_dict):
    """解析社区热议 (sqry)"""
    lines = []
    # 这里的 content 是字典，不是列表
    if not isinstance(content_dict, dict):
        return lines

    hot_stocks = content_dict.get("hot_stock", [])
    if not hot_stocks:
        return lines

    # 为了美观，做成一行还是列表？这里选择紧凑列表
    for stock in hot_stocks:
        name = stock.get("name", "")
        zdf = stock.get("zdf", "")
        cnt = stock.get("cnt", "0")
        
        # 涨跌幅加颜色符号（Markdown无法直接变色，用箭头表示）
        arrow = "🔺" if float(zdf) > 0 else "dg"
        arrow = "🔻" if float(zdf) < 0 else arrow
        
        lines.append(f"- **{name}** {arrow} {zdf}% (热度: {cnt})")
        
    return lines

def main():
    # 1. 获取 ID (默认当天+02)
    news_id = datetime.now().strftime("%Y%m%d") + "02"
    # news_id = "2025123002" # 强制测试用
    
    url = f"https://snp.tenpay.com/cgi/cgi-bin/snp/newsDailyInfo/getPushDailyDetail?id={news_id}"
    
    try:
        res = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=5)
        res.raise_for_status()
        json_data = res.json()
        # 兼容处理：优先取 'data'
        data = json_data.get("data", json_data)
        
    except Exception as e:
        print(f"请求失败: {e}")
        return

    # 2. 输出头部
    print(f"# A股复盘日报 ({news_id})")
    print(f"> 生成时间: {datetime.now().strftime('%H:%M:%S')}\n---")

    # 3. 遍历数据
    # 定义不需要副标题的板块 key
    no_subtitle_keys = ["jryw", "hsyp"]

    for key, section in data.items():
        if not isinstance(section, dict):
            continue
            
        tab_title = section.get("tab_title", "")
        if not tab_title:
            continue

        # --- 标题输出 ---
        print(f"## 📊 {tab_title}")
        
        # 主标题 (部分板块有)
        if section.get("title"):
            print(f"### {section['title']}")
            
        # 副标题 (根据需求过滤)
        sub_title = section.get("sub_title", "")
        if sub_title and key not in no_subtitle_keys:
            print(f"_{sub_title}_")
            
        print() # 空行

        # --- 内容处理 (分发逻辑) ---
        raw_content = section.get("content")

        # CASE 1: 题材热点 (tcrd)
        if key == "tcrd":
            lines = parse_tcrd(raw_content)
            print("\n".join(lines))

        # CASE 2: 社区热议 (sqry)
        elif key == "sqry":
            lines = parse_sqry(raw_content)
            print("\n".join(lines))

        # CASE 3: 通用列表 (agsp, zjdx, jryw, hsyp 等)
        elif isinstance(raw_content, list):
            has_items = False
            for item in raw_content:
                # 过滤图片
                if item.get("type") == "image":
                    continue
                
                desc = clean_text(item.get("desc"))
                if desc:
                    print(f"- {desc}")
                    has_items = True
        
        print("\n---") # 板块分隔

if __name__ == "__main__":
    main()