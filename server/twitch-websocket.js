// Outbound EventSub connection: no public HTTPS callback or tunnel required.
const WebSocket = require('ws');
const ENDPOINT = 'wss://eventsub.wss.twitch.tv/ws';
const TYPE = 'channel.channel_points_custom_reward_redemption.add';

function createEventSubSocket({ token, clientId, broadcasterId, onRedemption, onStatus,
  api, Socket = WebSocket, retryMs = 1000 }) {
  let stopped = false, current, retryTimer, failures = 0;
  const connections = new Set();
  const seen = new Map();

  function connect(url = ENDPOINT, previous = null) {
    if (stopped) return;
    let endpoint;
    try { endpoint = new URL(url); } catch { return fail('Invalid Twitch reconnect URL'); }
    if (endpoint.protocol !== 'wss:' || endpoint.hostname !== 'eventsub.wss.twitch.tv' ||
        endpoint.port || endpoint.username || endpoint.password) return fail('Invalid Twitch reconnect URL');
    const socket = new Socket(url);
    connections.add(socket);
    let watchdog, welcomed = false;
    let timeout = 15000;
    const touch = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => socket.terminate(), timeout);
      watchdog.unref?.();
    };
    touch();
    socket.on('message', async raw => {
      let message;
      try { message = JSON.parse(String(raw)); } catch { return; }
      touch();
      const { metadata = {}, payload = {} } = message;
      if (metadata.message_type === 'session_welcome' && !welcomed) {
        welcomed = true;
        timeout = (payload.session?.keepalive_timeout_seconds || 10) * 1000 + 1000;
        touch();
        current = socket;
        if (previous) {
          failures = 0;
          previous.close(); // Twitch transfers subscriptions to the reconnect session.
          onStatus('connected');
          return;
        }
        try {
          await api.post('https://api.twitch.tv/helix/eventsub/subscriptions', {
            type: TYPE, version: '1', condition: { broadcaster_user_id: broadcasterId },
            transport: { method: 'websocket', session_id: payload.session.id },
          }, { headers: { 'Client-Id': clientId, Authorization: `Bearer ${token}` }, timeout: 10000 });
          if (!stopped && current === socket) { failures = 0; onStatus('connected'); }
        } catch (error) {
          const status = error.response?.status;
          if ([400, 401, 403].includes(status)) fail('Twitch subscription rejected; authorize the broadcaster again');
          else socket.terminate();
        }
      } else if (metadata.message_type === 'session_reconnect' && socket === current) {
        if (!socket.migrating) {
          socket.migrating = true;
          connect(payload.session?.reconnect_url, socket);
        }
      } else if (metadata.message_type === 'notification' && payload.subscription?.type === TYPE) {
        const id = metadata.message_id;
        const now = Date.now();
        for (const [key, at] of seen) if (now - at > 10 * 60 * 1000) seen.delete(key);
        if (!id || seen.has(id)) return;
        seen.set(id, now);
        if (seen.size > 10000) seen.delete(seen.keys().next().value);
        try { await onRedemption(payload.event); }
        catch { onStatus('error', 'Could not process Twitch redemption'); }
      } else if (metadata.message_type === 'revocation') {
        fail('Twitch subscription revoked; authorize the broadcaster again');
      }
    });
    socket.on('error', () => {}); // close triggers retry; never log credential-bearing errors.
    socket.on('close', () => {
      clearTimeout(watchdog);
      connections.delete(socket);
      if (stopped || (current && current !== socket && connections.has(current))) return;
      current = null;
      // If a reconnect handoff is still in progress, let its welcome take over.
      if (connections.size) return;
      onStatus('reconnecting');
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => connect(), Math.min(30000, retryMs * 2 ** failures++));
      retryTimer.unref?.();
    });
  }
  function stop() {
    stopped = true;
    clearTimeout(retryTimer);
    for (const socket of connections) socket.terminate();
  }
  function fail(message) { stop(); onStatus('authorization_required', message); }
  connect();
  return { stop };
}

module.exports = { createEventSubSocket };
