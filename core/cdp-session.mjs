export async function listChromeTabs(cdpHttp, fetchImpl = fetch) {
  const response = await fetchImpl(`${cdpHttp.replace(/\/$/, '')}/json/list`);
  if (!response.ok) throw new Error(`Chrome target list failed: ${response.status}`);
  return (await response.json())
    .filter((item) => item.type === 'page' && item.webSocketDebuggerUrl)
    .map(({id, title, url, webSocketDebuggerUrl}) => ({id, title, url, webSocketDebuggerUrl}));
}

export function selectExactTab(tabs, match) {
  const needle = String(match || '').trim().toLowerCase();
  if (!needle) throw new Error('A URL or title fragment is required.');
  const hits = tabs.filter((tab) => `${tab.url || ''} ${tab.title || ''}`.toLowerCase().includes(needle));
  if (hits.length === 0) throw new Error(`No Chrome tab matches: ${match}`);
  if (hits.length > 1) {
    throw new Error(`More than one Chrome tab matches "${match}". Use a more specific URL or title fragment.`);
  }
  return hits[0];
}

export class CDPSession {
  constructor({target, WebSocketImpl, mobile = true}) {
    this.target = target;
    this.WebSocketImpl = WebSocketImpl;
    this.mobile = mobile;
    this.socket = null;
    this.sequence = 0;
    this.pending = new Map();
    this.onFrame = null;
    this.onClose = null;
  }

  async connect() {
    if (!this.target?.webSocketDebuggerUrl) throw new Error('The selected Chrome tab is no longer available.');
    this.socket = new this.WebSocketImpl(this.target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      this.socket.once('open', resolve);
      this.socket.once('error', reject);
    });
    this.socket.on('message', (data) => this.#handleMessage(data));
    this.socket.on('close', () => this.onClose?.());
    await this.call('Page.enable');
    await this.call('Runtime.enable');
    if (this.mobile) {
      await this.call('Emulation.setDeviceMetricsOverride', {
        width: 780,
        height: 1400,
        deviceScaleFactor: 1,
        mobile: true,
        screenWidth: 780,
        screenHeight: 1400,
      });
    }
    await this.call('Page.bringToFront');
    await this.call('Page.startScreencast', {
      format: 'jpeg', quality: 95, maxWidth: 1920, maxHeight: 2200, everyNthFrame: 1,
    });
    return this.target;
  }

  #handleMessage(data) {
    const message = JSON.parse(data.toString());
    if (message.id) {
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result);
      return;
    }
    if (message.method === 'Page.screencastFrame') {
      this.onFrame?.(message.params);
      this.call('Page.screencastFrameAck', {sessionId: message.params.sessionId}).catch(() => {});
    }
  }

  call(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== this.WebSocketImpl.OPEN) {
        reject(new Error('Chrome debugging connection is closed.'));
        return;
      }
      const id = ++this.sequence;
      this.pending.set(id, {resolve, reject});
      this.socket.send(JSON.stringify({id, method, params}));
    });
  }

  async input(message) {
    if (message.type === 'pointer') {
      const mapping = {down: 'mousePressed', up: 'mouseReleased', move: 'mouseMoved'};
      if (!mapping[message.phase]) throw new Error('Unsupported pointer phase.');
      await this.call('Input.dispatchMouseEvent', {
        type: mapping[message.phase], x: message.x, y: message.y,
        button: message.phase === 'move' ? 'none' : 'left',
        buttons: message.phase === 'down' || message.dragging ? 1 : 0,
        clickCount: 1,
      });
    } else if (message.type === 'wheel') {
      await this.call('Input.dispatchMouseEvent', {
        type: 'mouseWheel', x: message.x, y: message.y,
        deltaX: message.deltaX || 0, deltaY: message.deltaY || 0,
      });
    } else if (message.type === 'text') {
      await this.call('Input.insertText', {text: String(message.text || '')});
    } else if (message.type === 'key') {
      const allowed = {Enter: 13, Backspace: 8, Tab: 9, Escape: 27};
      const keyCode = allowed[message.key];
      if (!keyCode) throw new Error('Unsupported key.');
      const common = {key: message.key, code: message.key, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode};
      await this.call('Input.dispatchKeyEvent', {type: 'keyDown', ...common});
      await this.call('Input.dispatchKeyEvent', {type: 'keyUp', ...common});
    } else if (message.type === 'reload') {
      await this.call('Page.reload', {ignoreCache: false});
    } else if (message.type === 'back') {
      await this.call('Runtime.evaluate', {expression: 'history.back()'});
    } else {
      throw new Error('Unsupported remote input message.');
    }
  }

  async close() {
    try { await this.call('Page.stopScreencast'); } catch {}
    if (this.mobile) {
      try { await this.call('Emulation.clearDeviceMetricsOverride'); } catch {}
    }
    for (const waiter of this.pending.values()) waiter.reject(new Error('Chrome debugging connection closed.'));
    this.pending.clear();
    try { this.socket?.close(); } catch {}
  }
}
