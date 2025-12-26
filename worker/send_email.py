import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr

# ================= 🔴 核心配置 (请从环境变量或配置文件读取) =================
SMTP_SERVER = "smtp-relay.brevo.com"
SMTP_PORT = 587

# 从环境变量读取敏感信息
# USERNAME = os.environ.get('BREVO_SMTP_LOGIN')
# PASSWORD = os.environ.get('BREVO_SMTP_KEY')
USERNAME = "YOUR_SMTP_LOGIN"  # 替换为你的 SMTP Login
PASSWORD = "YOUR_SMTP_KEY"    # 替换为你的 SMTP Key

SENDER_EMAIL = "admin@newestgpt.com"
SENDER_NAME = "Fintell"
RECEIVER_EMAIL = "test@example.com"
# =========================================================

def send_mail():
    try:
        msg = MIMEMultipart()
        msg['From'] = formataddr((SENDER_NAME, SENDER_EMAIL))
        msg['To'] = RECEIVER_EMAIL
        msg['Subject'] = "Brevo 测试邮件"

        body = "你好！这是一封测试邮件。"
        msg.attach(MIMEText(body, 'plain'))

        print(f"正在连接 {SMTP_SERVER}...")
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()

        print(f"正在登录用户: {USERNAME} ...")
        server.login(USERNAME, PASSWORD)

        print(f"正在发送...")
        server.sendmail(SENDER_EMAIL, RECEIVER_EMAIL, msg.as_string())

        server.quit()
        print("✅ 成功了！")

    except Exception as e:
        print(f"❌ 发送失败: {e}")

if __name__ == "__main__":
    send_mail()