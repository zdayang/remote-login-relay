// Keep the remote-input channel responsive while the browser is producing
// high-resolution screenshots.  A screen is a latest-state stream: sending
// every intermediate frame only adds latency, so keep at most one frame in
// flight and coalesce newer frames behind it.
export function createFrameForwarder({socket, encode, openState = 1, maxBufferedAmount = 512 * 1024, retryMs = 16}) {
  let pending = null;
  let inFlight = false;
  let timer = null;
  let closed = false;

  const schedule = (delay = 0) => {
    if (closed || timer !== null || inFlight || pending === null) return;
    timer = setTimeout(flush, delay);
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
    try {
      socket.send(encode(frame), (error) => {
        inFlight = false;
        if (closed || error || socket.readyState !== openState) return;
        schedule(Number(socket.bufferedAmount || 0) > maxBufferedAmount ? retryMs : 0);
      });
    } catch {
      inFlight = false;
      if (!closed && socket.readyState === openState && pending !== null) schedule(retryMs);
    }
  };

  return {
    push(frame) {
      if (closed) return;
      pending = frame;
      schedule();
    },
    close() {
      closed = true;
      pending = null;
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
