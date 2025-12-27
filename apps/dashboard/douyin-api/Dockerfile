FROM mcr.microsoft.com/playwright/python:v1.57.0-noble

WORKDIR /app

# 复制脚本
COPY api_server.py login.py ./

# 安装 playwright-stealth
RUN pip install playwright-stealth

# 创建数据目录
RUN mkdir -p /root/.douyin

EXPOSE 9876

CMD ["python3", "api_server.py"]
