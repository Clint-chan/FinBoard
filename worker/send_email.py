import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr

# ================= 🔴 核心配置 (请仔细检查) =================
SMTP_SERVER = "smtp-relay.brevo.com"
SMTP_PORT = 587

# 1. 这里填 Brevo 后台 "SMTP Login" 显示的邮箱
# 通常是你注册 Brevo 的 Gmail，但也可能是系统生成的字符串
# 请务必去后台确认一下！
USERNAME = "9eb78f001@smtp-brevo.com" 

# 2. 这里填你在 Brevo 后台【新生成】的 SMTP Key
# 格式通常是 xsmtpsib- 开头的长字符串
# ⚠️ 之前那个已经废了，必须生成新的！
PASSWORD = "xsmtpsib-4d12c27044d26c5b041a1c7b54cd17ddab09eef1c3df016e529559a2b5a968d7-6NQG2L6VkrZWyXpm" 

# 3. 这里必须填你的【域名邮箱】
# 千万不要填什么 smtp-brevo.com，必须是 admin@你的域名
SENDER_EMAIL = "admin@newestgpt.com"
SENDER_NAME = "GPT Admin"

# 4. 收件人
RECEIVER_EMAIL = "945036663@qq.com" 
# =========================================================

def send_mail():
    try:
        msg = MIMEMultipart()
        msg['From'] = formataddr((SENDER_NAME, SENDER_EMAIL))
        msg['To'] = RECEIVER_EMAIL
        msg['Subject'] = "Brevo 最终测试"

        # 邮件正文
        body = "你好！这是一封配置修正后的测试邮件。"
        msg.attach(MIMEText(body, 'plain'))

        print(f"正在连接 {SMTP_SERVER}...")
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls() 

        print(f"正在登录用户: {USERNAME} ...")
        # 这一步报错 535 说明 USERNAME 或 PASSWORD 不对
        server.login(USERNAME, PASSWORD)

        print(f"正在发送...")
        server.sendmail(SENDER_EMAIL, RECEIVER_EMAIL, msg.as_string())

        server.quit()
        print("✅ 成功了！")

    except Exception as e:
        print(f"❌ 发送失败: {e}")

if __name__ == "__main__":
    send_mail()