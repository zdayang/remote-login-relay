// Keep the remote-input channel responsive while the browser is producing
// high-resolution screenshots.  A screen is a latest-state stream: sending
// every intermediate frame only adds latency, so keep at most one frame in
// flight and coalesce newer frames behind it.
export function createFrameForwarder({socket, encode, openState = 1, maxBufferedAmount = 512 * 1024, retryMs = 16, waitForAck = false, ackTimeoutMs = 1500}) {
  let pending = null;
  let inFlight = false;
  let inFlightId = null;
  let sequence = 0;
  let timer = null;
  let ackTimer = null;
  let closed = false;

  const schedule = (delay = 0) => {
    if (closed || timer !== null || inFlight || pending === null) return;
    timer = setTimeout(flush, delay);
  };

  const release = (frameId) => {
    if (!inFlight || (frameId !== undefined && frameId !== inFlightId)) return;
    if (ackTimer !== null) clearTimeout(ackTimer);
    ackTimer = null;
    inFlight = false;
    inFlightId = null;
    schedule(Number(socket.bufferedAmount || 0) > maxBufferedAmount ? retryMs : 0);
  };

  const flush = () => {
    timer = null;
    if (closed || inFlight || pending === null || socket.readyState !== openState) return;
    if (Number(socket.bufferedAmount || 0) > maxBufferedAmount) {
      schedule(retryMs);
      return;
    }

    const frame = pending;
    pending = null;
    inFlight = true;
    const frameId = ++sequence;
    inFlightId = frameId;
    try {
      socket.send(encode(frame, {frameId}), (error) => {
        if (closed || error || socket.readyState !== openState) {
          release(frameId);
          return;
        }
        if (!waitForAck) {
          release(frameId);
          return;
        }
        if (inFlightId === frameId) ackTimer = setTimeout(() => release(frameId), ackTimeoutMs);
      });
    } catch {
      release(frameId);
      if (!closed && socket.readyState === openState && pending !== null) schedule(retryMs);
    }
  };

  return {
    push(frame) {
      if (closed) return;
      pending = frame;
      schedule();
    },
    ack(frameId) {
      if (!waitForAck) return false;
      const matched = Number(frameId) === inFlightId;
      if (matched) release(inFlightId);
      return matched;
    },
    close() {
      closed = true;
      pending = null;
      if (timer !== null) clearTimeout(timer);
      if (ackTimer !== null) clearTimeout(ackTimer);
      timer = null;
      ackTimer = null;
    },
  };
}
