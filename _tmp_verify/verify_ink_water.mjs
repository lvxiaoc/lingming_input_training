import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_BIN = '/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell';
const OUT_DIR = path.resolve('_tmp_verify');
const URL = 'http://127.0.0.1:3000/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.seq = 1;
    this.pending = new Map();
    this.errors = [];
    this.consoleErrors = [];
  }
  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        this.errors.push(msg.params.exceptionDetails?.text || 'Runtime exception');
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        this.consoleErrors.push(
          (msg.params.args || []).map((a) => a.value || a.description || '').join(' ')
        );
      }
    });
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
  }
  send(method, params = {}) {
    const id = this.seq++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.text || 'Eval error');
    return res.result?.value;
  }
  async pressKey(key) {
    const code =
      key === 'Tab'
        ? 'Tab'
        : key.length === 1 && /[a-z]/i.test(key)
          ? `Key${key.toUpperCase()}`
          : key;
    const vk = key === 'Tab' ? 9 : key.toUpperCase().charCodeAt(0);
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk });
  }
  async clickButtonByText(substr) {
    const ok = await this.eval(`(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const target = btns.find((b) => (b.textContent || '').includes(${JSON.stringify(substr)}));
      if (!target) return false;
      target.click();
      return true;
    })()`);
    if (!ok) throw new Error(`Button not found: ${substr}`);
  }
  async screenshot(name) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, name), Buffer.from(data, 'base64'));
  }
  close() {
    this.ws.close();
  }
}

async function main() {
  const userDataDir = path.join(OUT_DIR, 'profile');
  fs.mkdirSync(userDataDir, { recursive: true });
  const proc = spawn(
    CHROME_BIN,
    [
      '--headless',
      '--no-sandbox',
      '--disable-gpu',
      '--remote-debugging-port=9231',
      `--user-data-dir=${userDataDir}`,
      '--window-size=1440,900',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  try {
    let wsUrl = null;
    for (let i = 0; i < 40; i++) {
      try {
        const list = await fetch('http://127.0.0.1:9231/json/list').then((r) => r.json());
        const page = list.find((t) => t.type === 'page');
        if (page?.webSocketDebuggerUrl) {
          wsUrl = page.webSocketDebuggerUrl;
          break;
        }
      } catch {}
      await sleep(200);
    }
    if (!wsUrl) throw new Error('Timed out');

    const cdp = new CDPClient(wsUrl);
    await cdp.connect();
    await cdp.send('Page.navigate', { url: URL });
    for (let i = 0; i < 30; i++) {
      const ready = await cdp.eval(`Array.from(document.querySelectorAll('button')).some(b => (b.textContent || '').includes('宣紙水墨'))`);
      if (ready) break;
      await sleep(300);
    }

    await cdp.clickButtonByText('宣紙水墨');
    await sleep(300);

    // 1. Palace view
    await cdp.clickButtonByText('五重道場闖關');
    await sleep(350);
    await cdp.clickButtonByText('記憶宮殿雲圖');
    await sleep(450);
    await cdp.screenshot('water_01_palace.png');

    // 2. Depth mode
    await cdp.clickButtonByText('返回');
    await sleep(250);
    await cdp.clickButtonByText('返回');
    await sleep(250);
    await cdp.clickButtonByText('自由鍛煉');
    await sleep(500);

    await cdp.pressKey('Tab');
    await sleep(100);
    const k1 = await cdp.eval(`(() => {
      const els = Array.from(document.querySelectorAll('[data-alice-key]'));
      const hinted = els.find((el) => el.style.borderColor === 'rgb(56, 56, 52)');
      return hinted ? hinted.getAttribute('data-alice-key') : null;
    })()`);

    // Wrong key -> ink-in-water deep smudge
    await cdp.pressKey(k1 === 'b' ? 'v' : 'b');
    await sleep(150);
    await cdp.screenshot('water_02_depth_wrong.png');

    // Correct keys -> complete glyph -> ink-in-water bloom
    await sleep(360);
    for (let step = 0; step < 3; step++) {
      await cdp.pressKey('Tab');
      await sleep(55);
      const nk = await cdp.eval(`(() => {
        const els = Array.from(document.querySelectorAll('[data-alice-key]'));
        const hinted = els.find((el) => el.style.borderColor === 'rgb(56, 56, 52)');
        return hinted ? hinted.getAttribute('data-alice-key') : null;
      })()`);
      if (!nk) break;
      await cdp.pressKey(nk);
      await sleep(75);
    }
    await sleep(110);
    await cdp.screenshot('water_03_depth_complete.png');

    // 3. Split mode
    await cdp.clickButtonByText('Alice 景深');
    await sleep(350);
    await cdp.pressKey('Tab');
    await sleep(90);
    const splitExpected = await cdp.eval(`(() => {
      const btns = Array.from(document.querySelectorAll('button[aria-label]'));
      const target = btns.find((b) => b.style.borderColor === 'rgb(56, 56, 52)');
      const lbl = target?.getAttribute('aria-label') || '';
      return lbl ? lbl[0].toLowerCase() : null;
    })()`);
    if (splitExpected) {
      await cdp.pressKey(splitExpected);
      await sleep(150);
    }
    await cdp.screenshot('water_04_split.png');

    console.log('Errors:', cdp.errors, cdp.consoleErrors);
    cdp.close();
  } finally {
    proc.kill('SIGKILL');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
