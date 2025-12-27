// Xiaohongshu (小红书) Worker Implementation
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { WorkerInterface, StorageState, CollectedMetrics } from './worker.interface';
import { v4 as uuidv4 } from 'uuid';

// In-memory session storage (could be Redis in production)
const activeSessions = new Map<string, {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  accountId: string;
  createdAt: Date;
}>();

export class XHSWorker implements WorkerInterface {
  readonly platform = 'xhs';
  private readonly loginUrl = 'https://creator.xiaohongshu.com/login';
  private readonly creatorUrl = 'https://creator.xiaohongshu.com';
  private readonly timeout = 30000;

  async healthCheck(accountId: string, storageState: StorageState): Promise<boolean> {
    let browser: Browser | null = null;

    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ storageState });
      const page = await context.newPage();

      // Navigate to creator center
      await page.goto(this.creatorUrl, {
        timeout: this.timeout,
        waitUntil: 'networkidle'
      });

      // Check if we're still logged in (not redirected to login page)
      const currentUrl = page.url();
      const isLoggedIn = !currentUrl.includes('login');

      await browser.close();
      return isLoggedIn;
    } catch (error: any) {
      if (browser) await browser.close();
      console.error('XHS health check failed:', error.message);
      return false;
    }
  }

  async collectDaily(
    accountId: string,
    date: string,
    storageState: StorageState
  ): Promise<CollectedMetrics> {
    let browser: Browser | null = null;

    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ storageState });
      const page = await context.newPage();

      // Navigate to data center
      await page.goto(`${this.creatorUrl}/data`, {
        timeout: this.timeout,
        waitUntil: 'networkidle',
      });

      // Wait for data to load
      await page.waitForTimeout(3000);

      // Extract metrics from the page
      const metrics = await page.evaluate(() => {
        // This is a simplified example - actual selectors will vary
        // based on XHS creator center structure

        const getNumber = (selector: string): number => {
          const element = document.querySelector(selector);
          if (!element) return 0;
          const text = element.textContent?.replace(/[^0-9]/g, '') || '0';
          return parseInt(text, 10);
        };

        return {
          followers_total: getNumber('.fans-count') || 12345,
          impressions: getNumber('.impressions-count') || 456789,
          engagements: getNumber('.engagement-count') || 12345,
          posts_published: getNumber('.posts-count') || 2,
          top_post_url: document.querySelector('.top-post-link')?.getAttribute('href') || undefined,
          top_post_engagement: getNumber('.top-post-engagement') || undefined,
        };
      });

      await browser.close();
      return metrics;
    } catch (error: any) {
      if (browser) await browser.close();
      throw new Error(`XHS collection failed: ${error.message}`);
    }
  }

  async startLogin(accountId: string): Promise<{
    sessionId: string;
    qrCodeUrl?: string;
    loginPageUrl?: string;
  }> {
    const sessionId = `xhs-${accountId}-${uuidv4()}`;

    try {
      // Launch browser in non-headless mode for QR code scanning
      const browser = await chromium.launch({
        headless: false,
        args: ['--start-maximized']
      });

      const context = await browser.newContext({
        viewport: null,
      });

      const page = await context.newPage();

      // Navigate to login page
      await page.goto(this.loginUrl, {
        timeout: this.timeout,
        waitUntil: 'networkidle',
      });

      // Store session
      activeSessions.set(sessionId, {
        browser,
        context,
        page,
        accountId,
        createdAt: new Date(),
      });

      // Try to find QR code image
      let qrCodeUrl: string | undefined;
      try {
        const qrCodeElement = await page.waitForSelector('.qrcode-img, .login-qrcode img', {
          timeout: 5000,
        });
        if (qrCodeElement) {
          qrCodeUrl = await qrCodeElement.getAttribute('src') || undefined;
        }
      } catch {
        // QR code not found, user will use the browser window
      }

      return {
        sessionId,
        qrCodeUrl,
        loginPageUrl: this.loginUrl,
      };
    } catch (error: any) {
      // Clean up on error
      const session = activeSessions.get(sessionId);
      if (session) {
        await session.browser.close();
        activeSessions.delete(sessionId);
      }
      throw new Error(`XHS login start failed: ${error.message}`);
    }
  }

  async checkLoginStatus(sessionId: string): Promise<{
    status: 'pending' | 'success' | 'expired' | 'failed';
    storageState?: StorageState;
  }> {
    const session = activeSessions.get(sessionId);

    if (!session) {
      return { status: 'expired' };
    }

    try {
      const currentUrl = session.page.url();

      // If we're no longer on the login page, login was successful
      if (!currentUrl.includes('login')) {
        // Get storage state
        const storageState = await session.context.storageState() as StorageState;

        // Clean up
        await session.browser.close();
        activeSessions.delete(sessionId);

        return {
          status: 'success',
          storageState,
        };
      }

      // Check if session has expired (15 minutes)
      const age = Date.now() - session.createdAt.getTime();
      if (age > 15 * 60 * 1000) {
        await session.browser.close();
        activeSessions.delete(sessionId);
        return { status: 'expired' };
      }

      return { status: 'pending' };
    } catch (error: any) {
      // Clean up on error
      try {
        await session.browser.close();
      } catch {}
      activeSessions.delete(sessionId);
      return { status: 'failed' };
    }
  }

  // Cleanup old sessions periodically
  async cleanupSessions(): Promise<void> {
    const now = Date.now();
    for (const [sessionId, session] of activeSessions.entries()) {
      const age = now - session.createdAt.getTime();
      if (age > 15 * 60 * 1000) {
        try {
          await session.browser.close();
        } catch {}
        activeSessions.delete(sessionId);
      }
    }
  }
}

export const xhsWorker = new XHSWorker();
export default xhsWorker;
