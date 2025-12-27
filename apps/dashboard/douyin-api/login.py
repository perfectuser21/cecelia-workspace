#!/usr/bin/env python3
"""
抖音创作者平台扫码登录脚本 v3
用法:
  python3 login.py --get-qrcode    # 获取二维码
  python3 login.py --check-status  # 检查登录状态
  python3 login.py --wait-login    # 获取二维码并等待扫码完成
"""

import argparse
import json
import os
import base64
import time
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
from playwright_stealth import Stealth

DATA_DIR = Path.home() / ".douyin"
COOKIES_FILE = DATA_DIR / "cookies.json"
STATE_FILE = DATA_DIR / "login_state.json"
QRCODE_FILE = DATA_DIR / "qrcode.png"

async def get_qrcode_and_wait(wait_for_login=False, timeout=300):
    """获取抖音创作者平台登录二维码，可选等待扫码完成"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ]
        )

        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            locale="zh-CN",
            timezone_id="Asia/Shanghai",
        )

        page = await context.new_page()

        # 应用 stealth
        stealth = Stealth(
            navigator_languages_override=('zh-CN', 'zh'),
            navigator_platform_override='MacIntel',
        )
        await stealth.apply_stealth_async(page)

        try:
            # 访问创作者平台
            await page.goto(
                "https://creator.douyin.com/",
                wait_until="networkidle",
                timeout=45000
            )
            # 等待二维码元素出现
            await asyncio.sleep(5)

            # 获取二维码 - 使用精确选择器
            qr_captured = False

            # 方法1: 使用抖音创作者平台的精确选择器
            qr_selectors = [
                '#animate_qrcode_container > div.qrcode-vz0gH7 > img',
                'img.qrcode_img-NPVTJs',
                'img[class*="qrcode_img"]',
                'img[aria-label="二维码"]',
            ]
            for selector in qr_selectors:
                try:
                    element = await page.query_selector(selector)
                    if element:
                        is_visible = await element.is_visible()
                        if is_visible:
                            await element.screenshot(path=str(QRCODE_FILE))
                            qr_captured = True
                            break
                except:
                    continue

            # 方法2: 查找带 base64 src 且 aria-label="二维码" 的图片
            if not qr_captured:
                try:
                    imgs = await page.query_selector_all('img[src^="data:image"]')
                    for img in imgs:
                        try:
                            aria = await img.get_attribute('aria-label')
                            if aria and '二维码' in aria:
                                await img.screenshot(path=str(QRCODE_FILE))
                                qr_captured = True
                                break
                            box = await img.bounding_box()
                            if box and box['width'] > 150 and box['height'] > 150:
                                await img.screenshot(path=str(QRCODE_FILE))
                                qr_captured = True
                                break
                        except:
                            continue
                except:
                    pass

            # 方法3: 截取页面中心区域（备用）
            if not qr_captured:
                viewport = page.viewport_size
                center_x = (viewport['width'] - 300) // 2
                center_y = (viewport['height'] - 300) // 2
                await page.screenshot(
                    path=str(QRCODE_FILE),
                    clip={"x": center_x, "y": center_y, "width": 300, "height": 300}
                )

            # 读取二维码 base64
            with open(QRCODE_FILE, "rb") as f:
                qr_base64 = base64.b64encode(f.read()).decode()

            # 保存状态
            state = {
                "status": "pending",
                "created_at": time.time(),
                "qrcode_file": str(QRCODE_FILE)
            }
            STATE_FILE.write_text(json.dumps(state, ensure_ascii=False))

            # 输出二维码结果
            result = {
                "success": True,
                "qrcode_base64": qr_base64,
                "message": "请使用抖音 APP 扫描二维码登录"
            }
            print(json.dumps(result, ensure_ascii=False))

            if wait_for_login:
                # 等待登录成功
                print('{"status": "waiting", "message": "等待扫码..."}', file=__import__('sys').stderr)

                start_time = time.time()
                check_count = 0
                initial_url = page.url

                while time.time() - start_time < timeout:
                    await asyncio.sleep(2)
                    check_count += 1

                    current_url = page.url
                    cookies = await context.cookies()

                    # 检查 URL 是否发生变化（登录成功后会跳转）
                    url_changed = current_url != initial_url

                    print(f'{{"status": "checking", "check": {check_count}, "url_changed": {url_changed}, "url": "{current_url[:60]}", "cookies": {len(cookies)}}}', file=__import__('sys').stderr)

                    # 如果 URL 变化了，检查是否是登录成功后的跳转
                    if url_changed:
                        # 如果跳转到了非登录页面，说明登录成功
                        if 'login' not in current_url and 'passport' not in current_url:
                            # 等待页面完全加载
                            await asyncio.sleep(3)
                            final_cookies = await context.cookies()

                            # 登录成功！保存 cookies
                            COOKIES_FILE.write_text(json.dumps(final_cookies, ensure_ascii=False, indent=2))

                            state = {
                                "status": "logged_in",
                                "logged_in_at": time.time(),
                                "cookies_count": len(final_cookies)
                            }
                            STATE_FILE.write_text(json.dumps(state, ensure_ascii=False))

                            success_result = {
                                "success": True,
                                "status": "logged_in",
                                "message": "登录成功！Cookies 已保存",
                                "cookies_saved": True,
                                "cookies_count": len(final_cookies)
                            }
                            print(json.dumps(success_result, ensure_ascii=False), file=__import__('sys').stderr)
                            break

                    # 继续等待

        except Exception as e:
            result = {"success": False, "error": str(e)}
            print(json.dumps(result, ensure_ascii=False))
        finally:
            await browser.close()

def check_status():
    """检查登录状态（基于本地文件）"""
    result = {
        "success": True,
        "status": "unknown",
        "message": "未知状态"
    }

    # 检查 cookies 文件
    if COOKIES_FILE.exists():
        try:
            cookies = json.loads(COOKIES_FILE.read_text())
            if cookies and len(cookies) > 0:
                result["status"] = "logged_in"
                result["message"] = "登录成功，Cookies 已保存"
                result["cookies_saved"] = True
                result["cookies_count"] = len(cookies)
        except:
            pass

    # 检查状态文件
    if STATE_FILE.exists():
        try:
            state = json.loads(STATE_FILE.read_text())
            if state.get("status") == "logged_in":
                result["status"] = "logged_in"
                result["message"] = "登录成功，Cookies 已保存"
                result["cookies_saved"] = True
            elif state.get("status") == "pending":
                if result["status"] != "logged_in":
                    result["status"] = "pending"
                    result["message"] = "等待扫码..."
        except:
            pass

    if result["status"] == "unknown":
        result["status"] = "not_started"
        result["message"] = "请先获取二维码"

    print(json.dumps(result, ensure_ascii=False))

def get_cookies():
    """获取保存的 cookies"""
    if COOKIES_FILE.exists():
        cookies = json.loads(COOKIES_FILE.read_text())
        result = {
            "success": True,
            "cookies": cookies,
            "count": len(cookies)
        }
    else:
        result = {
            "success": False,
            "error": "No cookies found. Please login first."
        }
    print(json.dumps(result, ensure_ascii=False))

async def validate_cookies():
    """验证 cookies 是否仍然有效"""
    if not COOKIES_FILE.exists():
        result = {
            "success": True,
            "valid": False,
            "status": "expired",
            "message": "Cookie 不存在，需要重新登录"
        }
        print(json.dumps(result, ensure_ascii=False))
        return

    try:
        cookies = json.loads(COOKIES_FILE.read_text())
        if not cookies:
            result = {
                "success": True,
                "valid": False,
                "status": "expired",
                "message": "Cookie 为空，需要重新登录"
            }
            print(json.dumps(result, ensure_ascii=False))
            return
    except:
        result = {
            "success": True,
            "valid": False,
            "status": "expired",
            "message": "Cookie 文件损坏，需要重新登录"
        }
        print(json.dumps(result, ensure_ascii=False))
        return

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ]
        )

        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            locale="zh-CN",
            timezone_id="Asia/Shanghai",
        )

        # 添加已保存的 cookies
        await context.add_cookies(cookies)

        page = await context.new_page()

        # 应用 stealth
        stealth = Stealth(
            navigator_languages_override=('zh-CN', 'zh'),
            navigator_platform_override='MacIntel',
        )
        await stealth.apply_stealth_async(page)

        try:
            # 访问创作者平台首页
            await page.goto(
                "https://creator.douyin.com/creator-micro/home",
                wait_until="networkidle",
                timeout=30000
            )
            await asyncio.sleep(3)

            current_url = page.url

            # 检查是否被重定向到登录页
            is_login_page = "login" in current_url or "passport" in current_url

            # 如果在登录页，Cookie 肯定无效
            if is_login_page:
                # Cookie 已失效
                result = {
                    "success": True,
                    "valid": False,
                    "status": "expired",
                    "message": "Cookie 已过期，需要重新登录"
                }
                # 更新状态文件
                state = {"status": "expired", "checked_at": time.time()}
                STATE_FILE.write_text(json.dumps(state, ensure_ascii=False))
            else:
                # Cookie 有效，不获取用户名（容易误判）
                result = {
                    "success": True,
                    "valid": True,
                    "status": "logged_in",
                    "message": "Cookie 有效"
                }
                # 更新状态文件
                state = {
                    "status": "logged_in",
                    "checked_at": time.time()
                }
                STATE_FILE.write_text(json.dumps(state, ensure_ascii=False))

            print(json.dumps(result, ensure_ascii=False))

        except Exception as e:
            result = {
                "success": False,
                "valid": False,
                "status": "error",
                "error": str(e)
            }
            print(json.dumps(result, ensure_ascii=False))
        finally:
            await browser.close()

def main():
    parser = argparse.ArgumentParser(description="抖音创作者平台扫码登录工具")
    parser.add_argument("--get-qrcode", action="store_true", help="获取登录二维码")
    parser.add_argument("--check-status", action="store_true", help="检查登录状态（本地）")
    parser.add_argument("--validate", action="store_true", help="验证 Cookie 是否有效（在线验证）")
    parser.add_argument("--get-cookies", action="store_true", help="获取保存的 cookies")
    parser.add_argument("--wait-login", action="store_true", help="获取二维码并等待扫码完成")
    parser.add_argument("--timeout", type=int, default=300, help="等待超时时间（秒）")

    args = parser.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    if args.get_qrcode:
        asyncio.run(get_qrcode_and_wait(wait_for_login=False))
    elif args.wait_login:
        asyncio.run(get_qrcode_and_wait(wait_for_login=True, timeout=args.timeout))
    elif args.check_status:
        check_status()
    elif args.validate:
        asyncio.run(validate_cookies())
    elif args.get_cookies:
        get_cookies()
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
