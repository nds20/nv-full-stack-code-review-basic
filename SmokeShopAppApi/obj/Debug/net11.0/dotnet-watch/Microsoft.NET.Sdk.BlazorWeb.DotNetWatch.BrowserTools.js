// dotnet-watch browser tools client.
//
// This module is part of the application build output. It must never be downloaded from the
// dotnet-watch provider: the provider is the party this client authenticates, so executable code
// served by it could not be trusted. The generated configuration module pins the provider's public
// key at build time and passes it to startBrowserTools.

const hotReloadActiveKey = '_dotnet_watch_hot_reload_active';
// Ensures we only connect once even when several activation paths import this module.
const scriptInjectedSentinel = '_dotnet_watch_ws_injected';
const replayResponseLoggingLevel = 1;
const AgentMessageSeverity_Warning = 1;
const AgentMessageSeverity_Error = 2;
// Bounds how long the replay waits for the Hot Reload agent. Only spent when there is something to
// replay and the apply API is still missing, which is the case that would otherwise lose updates.
const hotReloadAgentReadyTimeoutMs = 10000;
const browserToolsStyles = `
  :host {
    z-index: 1000000;
    position: fixed;
  }

  :host(#dotnet-compile-error) {
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    color: black;
    overflow: scroll;
  }

  .dotnet-compile-error-item {
    border: 2px solid red;
    padding: 8px;
    background-color: #faa;
  }

  .dotnet-compile-error-message {
    font-weight: bold;
  }

  :host(#dotnet-hotreload-toast) {
    width: 48px;
    height: 48px;
    top: 5px;
    left: 5px;
  }

  svg {
    filter: drop-shadow(0 2px 1px rgb(0 0 0 / 0.4));
  }

  #hotreloaded-ellipse1 {
    animation: hotreloaded-ellipse1_c_o 1800ms linear 1 normal forwards;
  }

  #hotreloaded-path1 {
    animation-name: hotreloaded-path1__m, hotreloaded-path1_c_o;
    animation-duration: 1800ms;
    animation-delay: 100ms;
    animation-fill-mode: forwards;
    animation-timing-function: linear;
    animation-direction: normal;
    animation-iteration-count: 1;
  }

  @keyframes hotreloaded-ellipse1_c_o {
    0% { opacity: 0; }
    16.666667% { opacity: 1; }
    72.222222% { opacity: 1; }
    90% { opacity: 0; }
    100% { opacity: 0; }
  }

  @keyframes hotreloaded-path1__m {
    0% { d: path('M126.151214,288.396852L196.625037,350.661591L320.793323,178.518242'); }
    16.666667% { d: path('M126.151214,288.396852L126.151214,288.396852L126.151214,288.396852'); }
    22.222222% {
      d: path('M126.151214,288.396852L196.625037,350.661591L196.625037,350.661591');
      animation-timing-function: cubic-bezier(0.42, 0, 0.58, 1);
    }
    33.333333% { d: path('M126.151214,288.396852L196.625037,350.661591L320.793323,178.518242'); }
    100% { d: path('M126.151214,288.396852L196.625037,350.661591L320.793323,178.518242'); }
  }

  @keyframes hotreloaded-path1_c_o {
    0% { opacity: 0; }
    16.666667% { opacity: 0; }
    22.222222% { opacity: 1; }
    72.222222% { opacity: 1; }
    90% { opacity: 0; }
    100% { opacity: 0; }
  }
`;
let browserToolsStylesheet;

/**
 * Connects to the dotnet-watch browser tools provider.
 *
 * @param {object} config Build-generated configuration.
 * @param {string} config.publicKey Base64 SubjectPublicKeyInfo of the provider's session key.
 * @param {string} config.connectPath Root-relative route of the provider's WebSocket endpoint.
 * @param {string} config.clearCachePath Root-relative route of the provider's cache reset endpoint.
 * @param {string} config.moduleUrl URL of the generated configuration module. Polled to detect that
 *                                  the application is reachable again after it restarted.
 */
export async function startBrowserTools(config) {
  if (window.hasOwnProperty(scriptInjectedSentinel)) {
    return;
  }
  window[scriptInjectedSentinel] = true;

  const { publicKey, connectPath, clearCachePath, moduleUrl } = config;

  const sharedSecret = await getSecret(publicKey);
  if (!sharedSecret) {
    delete window[scriptInjectedSentinel];
    console.debug('Unable to protect the dotnet-watch browser tools connection. Browser tools are disabled.');
    return;
  }

  const connectUrl = new URL(connectPath, document.baseURI);
  connectUrl.protocol = connectUrl.protocol === 'https:' ? 'wss:' : 'ws:';

  let closing = false;
  let waiting = false;

  // The provider sends the session initialization message, which carries the updates produced
  // before this browser connected, as the first message on the socket. It releases live messages
  // for this connection only after the browser acknowledges that message, so chaining the live
  // message queue on the initialization promise preserves the order even if a live message somehow
  // arrives early.
  let completeInitialization;
  let failInitialization;
  const initialized = new Promise((resolve, reject) => { completeInitialization = resolve; failInitialization = reject; });
  initialized.catch(() => { });

  let initializationMessageReceived = false;
  let receiveInitializationMessage;
  const initializationMessage = new Promise(resolve => receiveInitializationMessage = resolve);
  let messageQueue = initialized;

  let connection;
  try {
    connection = await getWebSocket(connectUrl, sharedSecret.encryptedSharedSecret, message => {
      if (!initializationMessageReceived) {
        initializationMessageReceived = true;
        receiveInitializationMessage(message);
      } else {
        messageQueue = messageQueue
          .then(() => handleMessage(message))
          .catch(error => console.debug('Failed to process a browser refresh message.', error));
      }
    });
  } catch (ex) {
    console.debug(ex);
  }

  if (!connection) {
    delete window[scriptInjectedSentinel];
    console.debug('Unable to establish a connection to the browser refresh server.');
    return;
  }

  connection.onerror = function (event) { console.debug('dotnet-watch reload socket error.', event) }
  connection.onclose = function () {
    delete window[scriptInjectedSentinel];
    failInitialization('The browser tools connection was closed.');
    console.debug('dotnet-watch reload socket closed.');
    if (!closing) {
      // The browser reaches the provider through the application, so the socket dies when the
      // application restarts and any pending Reload message is lost. Reload once it is back.
      reloadWhenApplicationReturns();
    }
  }

  if (await initializeSession()) {
    completeInitialization();
  } else {
    closing = true;
    connection.close();
  }

  async function initializeSession() {
    let payload;
    try {
      payload = JSON.parse((await withTimeout(initializationMessage, 30000)).data);
    } catch (error) {
      console.debug('Unable to initialize the browser tools session.', error);
      return false;
    }

    if (payload.type !== 'InitializeSession') {
      console.error(`Expected the browser tools session initialization message but received '${payload.type}'.`);
      return false;
    }

    if (!authenticateProvider(payload.sharedSecret)) {
      console.error('Unable to validate the browser refresh server. Closing the connection.');
      return false;
    }

    const log = [];
    let applyError;
    try {
      const updates = payload.updates ?? [];
      if (updates.length && !(await waitForDeltaApplyApi())) {
        // Keep initializing: the connection is still useful for reloads, diagnostics and CSS, and
        // failing here would close the socket and reload the page into the same state. Surface the
        // condition in the dotnet-watch console instead.
        log.push({
          "message": 'The Hot Reload agent did not become available in time, so the updates produced before this browser connected were not applied.',
          "severity": AgentMessageSeverity_Warning
        });
      }

      for (const update of updates) {
        try {
          const entries = applyDeltas(update.deltas, replayResponseLoggingLevel);
          if (entries && entries.length) {
            log.push(...entries);
          }
        } catch (error) {
          // Report the failure without failing the initialization, for the same reason as above:
          // dotnet-watch prints these entries as errors, while closing the socket would only make
          // the page reload into a browser that cannot apply updates either.
          console.warn('Unable to replay Hot Reload updates.', error);
          log.push({ "message": getMessageAndStack(error), "severity": AgentMessageSeverity_Error });
        }
      }
    } catch (error) {
      console.warn('Unable to initialize the browser tools session.', error);
      applyError = error;
      log.push({ "message": getMessageAndStack(error), "severity": AgentMessageSeverity_Error });
    }

    connection.send(JSON.stringify({ "success": !applyError, "log": log }));
    return !applyError;
  }

  async function handleMessage(message) {
    const payload = JSON.parse(message.data);
    const action = {
      'Reload': () => reload(),
      'Wait': () => wait(),
      'UpdateStaticFile': () => updateStaticFile(payload.path),
      'ApplyManagedCodeUpdates': () => applyManagedCodeUpdates(payload.sharedSecret, payload.deltas, payload.responseLoggingLevel),
      'ReportDiagnostics': () => reportDiagnostics(payload.diagnostics),
      'RefreshBrowser': () => refreshBrowser()
    };

    if (payload.type && action.hasOwnProperty(payload.type)) {
      await action[payload.type]();
    } else {
      console.error('Unknown payload:', message.data);
    }
  }

  // The provider proves it decrypted the secret this browser generated, which is only possible for
  // the process holding the private key matching the build-pinned public key.
  function authenticateProvider(providerSecret) {
    return providerSecret === sharedSecret.encodedSharedSecret;
  }

  async function reloadWhenApplicationReturns() {
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 100));
      try {
        const response = await fetch(moduleUrl, { cache: 'no-store' });
        if (response.ok) {
          location.reload();
          return;
        }
      } catch (error) {
        // The application is still restarting.
      }
    }
  }

  function updateStaticFile(path) {
    if (path && path.endsWith('.css')) {
      updateCssByPath(path);
    } else {
      console.debug(`File change detected to file ${path}. Reloading page...`);
      location.reload();
      return;
    }
  }

  async function updateCssByPath(path) {
    const styleElement = document.querySelector(`link[href^="${path}"]`) ||
      document.querySelector(`link[href^="${document.baseURI}${path}"]`);

    // Receive a Clear-site-data header.
    await fetch(new URL(clearCachePath, document.baseURI), { cache: 'no-store' });

    if (!styleElement || !styleElement.parentNode) {
      console.debug('Unable to find a stylesheet to update. Updating all local css files.');
      updateAllLocalCss();
    }

    updateCssElement(styleElement);
  }

  function updateAllLocalCss() {
    [...document.querySelectorAll('link')]
      .filter(l => l.baseURI === document.baseURI)
      .forEach(e => updateCssElement(e));
  }

  function updateCssElement(styleElement) {
    if (!styleElement || styleElement.loading) {
      // A file change notification may be triggered for the same file before the browser
      // finishes processing a previous update. In this case, it's easiest to ignore later updates
      return;
    }

    const newElement = styleElement.cloneNode();
    const href = styleElement.href;
    newElement.href = href.split('?', 1)[0] + `?nonce=${Date.now()}`;

    styleElement.loading = true;
    newElement.loading = true;
    newElement.addEventListener('load', function () {
      newElement.loading = false;
      styleElement.remove();
    });

    styleElement.parentNode.insertBefore(newElement, styleElement.nextSibling);
  }

  function applyDeltas_legacy(deltas) {
    let apply = window.Blazor?._internal?.applyHotReload

    // Only apply hot reload deltas if Blazor has been initialized.
    // It's possible for Blazor to start after the initial page load, so we don't consider skipping this step
    // to be a failure. These deltas will get applied later, when Blazor completes initialization.
    if (apply) {
      deltas.forEach(d => {
        if (apply.length == 5) {
          // WASM 8.0
          apply(d.moduleId, d.metadataDelta, d.ilDelta, d.pdbDelta, d.updatedTypes)
        } else {
          // WASM 9.0
          apply(d.moduleId, d.metadataDelta, d.ilDelta, d.pdbDelta)
        }
      });
    }
  }

  function applyDeltas(deltas, responseLoggingLevel) {
    let applyDeltas = hotReloadAgentSignal().applyHotReloadDeltas ?? window.Blazor?._internal?.applyHotReloadDeltas
    if (applyDeltas) {
      // Only apply hot reload deltas if Blazor has been initialized.
      // It's possible for Blazor to start after the initial page load, so we don't consider skipping this step
      // to be a failure. These deltas will get applied later, when Blazor completes initialization.

      let wasmDeltas = deltas.map(delta => {
        return {
          "moduleId": delta.moduleId,
          "metadataDelta": delta.metadataDelta,
          "ilDelta": delta.ilDelta,
          "pdbDelta": delta.pdbDelta,
          "updatedTypes": delta.updatedTypes,
        };
      });

      return applyDeltas(wasmDeltas, responseLoggingLevel);
    }

    // Try invoke older WASM API:
    applyDeltas_legacy(deltas)
    return [];
  }

  function applyManagedCodeUpdates(providerSecret, deltas, responseLoggingLevel) {
    if (!authenticateProvider(providerSecret)) {
      throw 'Unable to validate the server. Rejecting apply-update payload.';
    }

    console.debug('Applying managed code updates.');

    let applyError = undefined;
    let log = [];
    try {
      log = applyDeltas(deltas, responseLoggingLevel);
    } catch (error) {
      console.warn(error);
      applyError = error;
      log.push({ "message": getMessageAndStack(error), "severity": AgentMessageSeverity_Error });
    }

    connection.send(JSON.stringify({
      "success": !applyError,
      "log": log
    }));

    if (!applyError) {
      displayChangesAppliedToast();
    }
  }

  function reportDiagnostics(diagnostics) {
    console.debug('Reporting Hot Reload diagnostics.');

    document.querySelectorAll('#dotnet-compile-error').forEach(el => el.remove());

    if (diagnostics.length == 0) {
      return;
    }

    const { host: el, root } = createBrowserToolsHost('dotnet-compile-error');
    document.body.appendChild(el);
    diagnostics.forEach(error => {
      const item = root.appendChild(document.createElement('div'));
      item.className = 'dotnet-compile-error-item';
      const message = item.appendChild(document.createElement('div'));
      message.className = 'dotnet-compile-error-message';
      message.textContent = error.Message;
      item.appendChild(document.createElement('div')).textContent = error;
    });
  }

  function displayChangesAppliedToast() {
    document.querySelectorAll('#dotnet-compile-error').forEach(el => el.remove());
    if (document.querySelector('#dotnet-hotreload-toast')) {
      return;
    }
    if (!window[hotReloadActiveKey])
    {
        return;
    }
    const { host: el, root } = createBrowserToolsHost('dotnet-hotreload-toast');
    root.appendChild(createHotReloadToastIcon());
    document.body.appendChild(el);
    window[hotReloadActiveKey] = false;
    setTimeout(() => el.remove(), 2000);
  }

  function createHotReloadToastIcon() {
    const svgNamespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNamespace, 'svg');
    svg.setAttribute('viewBox', '0 0 500 500');

    const ellipse = svg.appendChild(document.createElementNS(svgNamespace, 'ellipse'));
    ellipse.id = 'hotreloaded-ellipse1';
    ellipse.setAttribute('rx', '212.808853');
    ellipse.setAttribute('ry', '205.404598');
    ellipse.setAttribute('transform', 'matrix(0.982102 0 0 1.017504 251 238)');
    ellipse.setAttribute('opacity', '0');
    ellipse.setAttribute('fill', 'rgb(120,120,120)');

    const path = svg.appendChild(document.createElementNS(svgNamespace, 'path'));
    path.id = 'hotreloaded-path1';
    path.setAttribute('d', 'M126.151214,288.396852L196.625037,350.661591L320.793323,178.518242');
    path.setAttribute('transform', 'matrix(1 0 0 1 27.527732 -26.589916)');
    path.setAttribute('opacity', '0');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'rgb(255,255,255)');
    path.setAttribute('stroke-width', '40');
    path.setAttribute('stroke-linecap', 'round');
    return svg;
  }

  function createBrowserToolsHost(id) {
    const host = document.createElement('div');
    host.id = id;
    const root = host.attachShadow({ mode: 'open' });
    if ('adoptedStyleSheets' in root && typeof CSSStyleSheet === 'function') {
      if (!browserToolsStylesheet) {
        browserToolsStylesheet = new CSSStyleSheet();
        browserToolsStylesheet.replaceSync(browserToolsStyles);
      }

      root.adoptedStyleSheets = [browserToolsStylesheet];
    }

    return { host, root };
  }

  function refreshBrowser() {
    if (window.Blazor) {
      window[hotReloadActiveKey] = true;
      // hotReloadApplied triggers an enhanced navigation to
      // refresh pages that have been statically rendered with
      // Blazor SSR.
      if (window.Blazor?._internal?.hotReloadApplied)
      {
        console.debug('Refreshing browser: WASM.');
        Blazor._internal.hotReloadApplied();
      }
      else
      {
        console.debug('Refreshing browser.');
        displayChangesAppliedToast();
      }
    } else {
      console.debug('Refreshing browser: Reloading.');
      location.reload();
    }
  }

  function reload() {
    console.debug('Reloading.');
    location.reload();
  }

  function wait() {
    console.debug('Waiting for application to rebuild.');

    if (waiting) {
      return;
    }

    waiting = true;
    const glyphs = ['☱', '☲', '☴'];
    const title = document.title;
    let i = 0;
    setInterval(function () { document.title = glyphs[i++ % glyphs.length] + ' ' + title; }, 240);
  }

  function getWebSocket(url, encryptedSecret, onMessage) {
    return new Promise((resolve, reject) => {
      const webSocket = new WebSocket(url, encodeURIComponent(encryptedSecret));
      let opened = false;

      // Listen for messages before the socket opens so that the session initialization message,
      // which the provider sends first, can never be missed.
      webSocket.addEventListener('message', onMessage);

      function onOpen() {
        opened = true;
        clearEventListeners();
        resolve(webSocket);
      }

      function onClose(event) {
        if (opened) {
          // Open completed successfully. Nothing to do here.
          return;
        }

        let error = 'WebSocket failed to connect.';
        if (event instanceof ErrorEvent) {
          error = event.error;
        }

        clearEventListeners();
        reject(error);
      }

      function clearEventListeners() {
        webSocket.removeEventListener('open', onOpen);
        // The error event isn't as reliable, but close is always called even during failures.
        // If close is called without a corresponding open, we can reject the promise.
        webSocket.removeEventListener('close', onClose);
      }

      webSocket.addEventListener('open', onOpen);
      webSocket.addEventListener('close', onClose);
      if (window.Blazor?.removeEventListener && window.Blazor?.addEventListener)
      {
        webSocket.addEventListener('close', () => window.Blazor?.removeEventListener('enhancedload', displayChangesAppliedToast));
        window.Blazor?.addEventListener('enhancedload', displayChangesAppliedToast);
      }
    });
  }
}

function getMessageAndStack(error) {
  const message = error.message || '<unknown error>'
  let messageAndStack = error.stack || message
  if (!messageAndStack.includes(message)) {
    messageAndStack = message + "\n" + messageAndStack;
  }

  return messageAndStack
}

// Rendezvous with the WebAssembly initializer. Either module may create the object first because
// library initializer module evaluation order is not guaranteed; the initializer resolves it.
function hotReloadAgentSignal() {
  const agent = globalThis.__DOTNET_WATCH_HOT_RELOAD_AGENT ||= {};
  if (!agent.ready) {
    agent.ready = new Promise(resolve => { agent.setReady = resolve; });
  }

  return agent;
}

function hasDeltaApplyApi() {
  return !!(hotReloadAgentSignal().applyHotReloadDeltas || window.Blazor?._internal?.applyHotReloadDeltas || window.Blazor?._internal?.applyHotReload);
}

// The provider sends the replay snapshot once, so applying it before the agent installed the apply
// API would drop those updates while still reporting success. Wait for the agent to finish starting.
// Runtimes that install the apply API through their own bootstrap never publish the signal, so the
// wait is bounded and best effort.
async function waitForDeltaApplyApi() {
  if (hasDeltaApplyApi()) {
    return true;
  }

  try {
    await withTimeout(hotReloadAgentSignal().ready, hotReloadAgentReadyTimeoutMs);
  } catch (error) {
    console.debug('Timed out waiting for the Hot Reload agent.', error);
  }

  return hasDeltaApplyApi();
}

function withTimeout(promise, milliseconds) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(`Timed out after ${milliseconds}ms.`), milliseconds);
    promise.then(
      value => { clearTimeout(timeout); resolve(value); },
      error => { clearTimeout(timeout); reject(error); });
  });
}

// Generates the secret this browser uses to authenticate the provider and encrypts it with the
// build-pinned public key. The secret itself never leaves the browser in clear text and is never
// persisted.
async function getSecret(serverKeyString) {
  if (!serverKeyString || !window.crypto || !window.crypto.subtle) {
    return null;
  }

  const secretBytes = window.crypto.getRandomValues(new Uint8Array(32)); // 32-bytes of entropy

  // Based on https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey#subjectpublickeyinfo_import
  const binaryServerKey = str2ab(atob(serverKeyString));
  const serverKey = await window.crypto.subtle.importKey('spki', binaryServerKey, { name: "RSA-OAEP", hash: "SHA-256" }, false, ['encrypt']);
  const encrypted = await window.crypto.subtle.encrypt({ name: 'RSA-OAEP' }, serverKey, secretBytes);
  return {
    encryptedSharedSecret: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    encodedSharedSecret: btoa(String.fromCharCode(...secretBytes)),
  };

  function str2ab(str) {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
      bufView[i] = str.charCodeAt(i);
    }
    return buf;
  }
}

// SIG // Begin signature block
// SIG // MIInNQYJKoZIhvcNAQcCoIInJjCCJyICAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // AyqKBPE8oMmCigalvzCFPL2zcWZNrLsjCYx7C1xPwy+g
// SIG // ggypMIIF5DCCA8ygAwIBAgITMwAAAcgkOsgeTZOIuwAA
// SIG // AAAByDANBgkqhkiG9w0BAQsFADBXMQswCQYDVQQGEwJV
// SIG // UzEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9u
// SIG // MSgwJgYDVQQDEx9NaWNyb3NvZnQgQ29kZSBTaWduaW5n
// SIG // IFBDQSAyMDI0MB4XDTI2MDQxNjE4NTc0MVoXDTI3MDQx
// SIG // NTE4NTc0MVowYzELMAkGA1UEBhMCVVMxEzARBgNVBAgT
// SIG // Cldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAc
// SIG // BgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjENMAsG
// SIG // A1UEAxMELk5FVDCCASIwDQYJKoZIhvcNAQEBBQADggEP
// SIG // ADCCAQoCggEBAMJfsAP8OxCUF6ivbFnD75BCsACvUPfi
// SIG // Af/LQ2AsqaCvJWtki//fPx4BhRWbvVuA5Tn1RvESIwAA
// SIG // oBJic0fJfjHYrZeQ4Ga7AxdGESwJMP5LZYfbVYKef3k/
// SIG // slhO8ygk5JNvxgos4lfXPCoBDFNm9a0fHfrRjgEVOmLb
// SIG // andQPFM0MSKk+kiJtSIpB3dIWQhaMQ3t0XwVHo3XEDYo
// SIG // SY3qU/npr6shcxBFgdZcTf0AQsITzCHPFDUS+iPqdmLh
// SIG // /PIokqOhmxIgd5Q69vqYjASwq1sg9peqfsJKVY4C0idy
// SIG // /Uf4AtWU6qmfxbQGrxphgBM4YU21HyQ1CgtEscHdSEKk
// SIG // TrcCAwEAAaOCAZswggGXMA4GA1UdDwEB/wQEAwIHgDAf
// SIG // BgNVHSUEGDAWBgorBgEEAYI3TAgBBggrBgEFBQcDAzAd
// SIG // BgNVHQ4EFgQUwduFP95X0NdybDKqpv9jV3T9cfIwRQYD
// SIG // VR0RBD4wPKQ6MDgxHjAcBgNVBAsTFU1pY3Jvc29mdCBD
// SIG // b3Jwb3JhdGlvbjEWMBQGA1UEBRMNNDY0MjIzKzUwNzU5
// SIG // NjAfBgNVHSMEGDAWgBR/WT9UIdqtT+8F5eaj1y0GlBII
// SIG // MTBgBgNVHR8EWTBXMFWgU6BRhk9odHRwOi8vd3d3Lm1p
// SIG // Y3Jvc29mdC5jb20vcGtpb3BzL2NybC9NaWNyb3NvZnQl
// SIG // MjBDb2RlJTIwU2lnbmluZyUyMFBDQSUyMDIwMjQuY3Js
// SIG // MG0GCCsGAQUFBwEBBGEwXzBdBggrBgEFBQcwAoZRaHR0
// SIG // cDovL3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9jZXJ0
// SIG // cy9NaWNyb3NvZnQlMjBDb2RlJTIwU2lnbmluZyUyMFBD
// SIG // QSUyMDIwMjQuY3J0MAwGA1UdEwEB/wQCMAAwDQYJKoZI
// SIG // hvcNAQELBQADggIBAKNTJ0R6r3T/SAhdOUibRuJvosAa
// SIG // IssCd+bb8aUe/hDVbBovDkE3EtgWAm5CPeFOeYiqmpCt
// SIG // 3aJntyMvA/qtLuWeJymwvCd4E/qo2If/trHxzZ12yGjo
// SIG // xp822b46DKIFFbg0mvZ74f0WVRu+Ftae93BT4Hid2x0h
// SIG // MYQWtIgTjoGH0FJCETvfTBBgegscj1AY+zghBpgeK2Df
// SIG // 5+zZdCGr6s/s6/xecllnuoJIdD35AW4G/5yqjU7oztCZ
// SIG // Wzr21L1Dlsq6RYuFg/2yym7hd9V+Au6XojrKbpR9Vi5v
// SIG // HqqWXjmE6QF/BXRSXzNHmqZhtCjKynbcMHNeQkqy+5/3
// SIG // iPSvAs8Fd6oVHRJxc+CFCWVirnpm9tQHNvfyvEsjTxjm
// SIG // e5pyWvnz6bGQM8bm30Zto/6F1zviqMTCJ2+OORn3wFZv
// SIG // F+63NT4UB9FH7SxjdgFZoprwvQxnzvCujaOfosARxt/7
// SIG // DrOF26bvdUNRsJQSjhdzGVZp5nLCT6aYONqVI75oljrJ
// SIG // kBNTJ2nmNYeUxUKV2iyntZqIUIqHd+SHDAn+GcoI+Jo1
// SIG // 1J3pOuCTl6OygDdPJZW5UfcglKCfdoHSzFAEH/dvpT+U
// SIG // 8sA3xIseAAsH3nUjOwadeMLu1jkRC40u7CcVfqaDuUO9
// SIG // 58az54AQfjwWRT3JxzVAJT1v0BX6gkkyemgCcawdMIIG
// SIG // vTCCBKWgAwIBAgITMwAAADk7tjcZvwYdZwAAAAAAOTAN
// SIG // BgkqhkiG9w0BAQwFADCBiDELMAkGA1UEBhMCVVMxEzAR
// SIG // BgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1v
// SIG // bmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlv
// SIG // bjEyMDAGA1UEAxMpTWljcm9zb2Z0IFJvb3QgQ2VydGlm
// SIG // aWNhdGUgQXV0aG9yaXR5IDIwMTEwHhcNMjQwODA4MjA1
// SIG // NDE4WhcNMzYwMzIyMjIxMzA0WjBXMQswCQYDVQQGEwJV
// SIG // UzEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9u
// SIG // MSgwJgYDVQQDEx9NaWNyb3NvZnQgQ29kZSBTaWduaW5n
// SIG // IFBDQSAyMDI0MIICIjANBgkqhkiG9w0BAQEFAAOCAg8A
// SIG // MIICCgKCAgEA2AGcHuM4x6qVFgc1rbrm/ghj18fxMqF6
// SIG // Yd88g17WCktpXd2GDfbhbAfTotwdumewG6QIM2K2vKjR
// SIG // 21L8Rboj/IQv9stJjyEqlt9C5a6wE+v2prNhwPEJb+qe
// SIG // NvkmwjWzxs06DdtUBO9BUvi1x/TdpPJyzPxB4J0zSX/I
// SIG // dE5sn1CprMzWvpU8Q4nssv64QRvvfDpAK6Gzz1rW6/XN
// SIG // 6s5gyeyd5FHAJunJbXUhyCBTRxEoMOrWmNUnMhsgXr6i
// SIG // JddtF46yB4jzO7UXJB8rR9WRrJrxKZUdD+05/beZnhb2
// SIG // TRGLbZBb2ndSBILk5QOS0rHFwKYYvq1ct84ZJYcghXhi
// SIG // tMlNPo823LlESiMcm5kcCuQX1WcdMRFahOMDN8jeQ/7l
// SIG // vhqVR2GABnu2067VtWdd8dqo9iXas+zbSOLTcs5VayH+
// SIG // tp2ATXt6zmEv63qVXR5UetWGyyxE5Ym7PYxcwK3uLDuU
// SIG // U8b0tcoaOyaiefaCi0Z0ci4SDkmckwlWaLF3ktGWSaBh
// SIG // FkrOHFILDKgYirQ+FoDtj5U9y3mkIeSKNwggObSeWQr7
// SIG // QrJ6miVyoabRP8ZhBEyEcmUY46ZVCinfrBRVRiSVTL76
// SIG // 8NZ4SASjizuHE3qYht/YxIhD+Ih8xmAnELr2i6QxRcKs
// SIG // 4LdKQT/EiSCl+XbYwzWK2Rnfmc1eQyiVTWUCAwEAAaOC
// SIG // AU4wggFKMA4GA1UdDwEB/wQEAwIBhjAQBgkrBgEEAYI3
// SIG // FQEEAwIBADAdBgNVHQ4EFgQUf1k/VCHarU/vBeXmo9ct
// SIG // BpQSCDEwGQYJKwYBBAGCNxQCBAweCgBTAHUAYgBDAEEw
// SIG // DwYDVR0TAQH/BAUwAwEB/zAfBgNVHSMEGDAWgBRyLToC
// SIG // MZBDuRQFTuHqp8cx0SOJNDBaBgNVHR8EUzBRME+gTaBL
// SIG // hklodHRwOi8vY3JsLm1pY3Jvc29mdC5jb20vcGtpL2Ny
// SIG // bC9wcm9kdWN0cy9NaWNSb29DZXJBdXQyMDExXzIwMTFf
// SIG // MDNfMjIuY3JsMF4GCCsGAQUFBwEBBFIwUDBOBggrBgEF
// SIG // BQcwAoZCaHR0cDovL3d3dy5taWNyb3NvZnQuY29tL3Br
// SIG // aS9jZXJ0cy9NaWNSb29DZXJBdXQyMDExXzIwMTFfMDNf
// SIG // MjIuY3J0MA0GCSqGSIb3DQEBDAUAA4ICAQAUlB84KE/u
// SIG // iefp8sgwqtKU3VZgrAMWAB13KY5Q7cWszx3sH9b+JDoP
// SIG // FewOfsPlbjAzBh4vKy1wSp+SPPg1RFGBrPIy7nJHNCHg
// SIG // uqMDi1K1NwmHWikTGjuefk+48Fidu7T5MdK5UdN7RVNM
// SIG // 9WGKXL+mIWsOjdrFD0/gL46XnJ637aBN96QgJLnFL5xh
// SIG // 9Ii+CfQmSxUFUxhUjlAW7+qGcuGwQURTMbx++/SGOCQ7
// SIG // 6WSlX23LoaQ3i92d3vJrpDppH3LfhqIzWqbFrEGLo5Sf
// SIG // I2Xp+S66f92JMWdgMtOmk6Sv+aDlZJ8KINUw0LG2PjA8
// SIG // oLk6YebUNAi38w2iRtsfdQawU/VBvOwuhy5KosK8fT0i
// SIG // jd8M9OaxxH1jvkbipftFNfwB0E+jQjo4SiN/f3O4Vm3S
// SIG // o4ebrlhZATr1xkza54TUwHTl002Acr2BMTvMq8r9+DwH
// SIG // aqNbzwxP9YXlXm69ka2pr0VIvZFrMCsD6sM+5/okZjPg
// SIG // emAxkcHhLqzNZIpgG/RWKwLN/GB5T52q5db1t3Rq5iU4
// SIG // HnwM9w5gp1zdJ73iD7EvilwSFsHngk6ACTBhO7/10t4f
// SIG // akOp4lkAAFUNZFAJpd87kuDIrAoIthemKCtlgKNRIFyv
// SIG // 5V7w8VYyFVNCXS/irwn8BSZA3lbifXTVxjYvgDsZNAbW
// SIG // HfYccC99ARJY/TGCGeQwghngAgEBMG4wVzELMAkGA1UE
// SIG // BhMCVVMxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3Jh
// SIG // dGlvbjEoMCYGA1UEAxMfTWljcm9zb2Z0IENvZGUgU2ln
// SIG // bmluZyBQQ0EgMjAyNAITMwAAAcgkOsgeTZOIuwAAAAAB
// SIG // yDANBglghkgBZQMEAgEFAKCBrjAZBgkqhkiG9w0BCQMx
// SIG // DAYKKwYBBAGCNwIBBDAcBgorBgEEAYI3AgELMQ4wDAYK
// SIG // KwYBBAGCNwIBFTAvBgkqhkiG9w0BCQQxIgQgU6/eb4wR
// SIG // nlHRiTah24qLb1NVP0fcdhk93TPwxg2dxH4wQgYKKwYB
// SIG // BAGCNwIBDDE0MDKgFIASAE0AaQBjAHIAbwBzAG8AZgB0
// SIG // oRqAGGh0dHA6Ly93d3cubWljcm9zb2Z0LmNvbTANBgkq
// SIG // hkiG9w0BAQEFAASCAQAaOW9W5rRpU0oCJ8wtzW2qkrmX
// SIG // 6W2t205OVwnhZ4UTnPLSVasjLFm9YdVTO8AqLG4BcAAy
// SIG // yMhYcewfNGcGAkALaaN2EFO9Ej+pnJRnbBGFdGxTFMTD
// SIG // dYvcGFeV49/G3CGHRLPmZt48/O48ozOTM04dd7hsa8U0
// SIG // 0BkyI1GY+XnvfJ6CRgzktfGpzEzjUAsLjTsl74Ld3Hr8
// SIG // Rg2epr/Aar81GaefOCTQCLUoHFWFyhEKose89X0g4wec
// SIG // 1py7qjJg774iK6GKrgARUBDwCgmuQGT1VQsNSvuOkrJz
// SIG // xukjLt/mP8QqLZW7x3jYgyVWD2ePUiZgkiJJoJNvq3H/
// SIG // dp75x6A5oYIXljCCF5IGCisGAQQBgjcDAwExgheCMIIX
// SIG // fgYJKoZIhvcNAQcCoIIXbzCCF2sCAQMxDzANBglghkgB
// SIG // ZQMEAgEFADCCAVEGCyqGSIb3DQEJEAEEoIIBQASCATww
// SIG // ggE4AgEBBgorBgEEAYRZCgMBMDEwDQYJYIZIAWUDBAIB
// SIG // BQAEIE4fVJ+Whc/q+IRSLopzNKacLRwCYc/wQ0wPM31W
// SIG // doDdAgZqqYBz06YYEjIwMjYxMDA0MjMyOTU1LjU5WjAE
// SIG // gAIB9KCB0aSBzjCByzELMAkGA1UEBhMCVVMxEzARBgNV
// SIG // BAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQx
// SIG // HjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEl
// SIG // MCMGA1UECxMcTWljcm9zb2Z0IEFtZXJpY2EgT3BlcmF0
// SIG // aW9uczEnMCUGA1UECxMeblNoaWVsZCBUU1MgRVNOOkEw
// SIG // MDAtMDVFMC1EOTQ3MSUwIwYDVQQDExxNaWNyb3NvZnQg
// SIG // VGltZS1TdGFtcCBTZXJ2aWNloIIR7TCCByAwggUIoAMC
// SIG // AQICEzMAAAIruwBQ/007mqEAAQAAAiswDQYJKoZIhvcN
// SIG // AQELBQAwfDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldh
// SIG // c2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNV
// SIG // BAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEmMCQGA1UE
// SIG // AxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTAw
// SIG // HhcNMjYwMjE5MTk0MDExWhcNMjcwNTE3MTk0MDExWjCB
// SIG // yzELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0
// SIG // b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1p
// SIG // Y3Jvc29mdCBDb3Jwb3JhdGlvbjElMCMGA1UECxMcTWlj
// SIG // cm9zb2Z0IEFtZXJpY2EgT3BlcmF0aW9uczEnMCUGA1UE
// SIG // CxMeblNoaWVsZCBUU1MgRVNOOkEwMDAtMDVFMC1EOTQ3
// SIG // MSUwIwYDVQQDExxNaWNyb3NvZnQgVGltZS1TdGFtcCBT
// SIG // ZXJ2aWNlMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIIC
// SIG // CgKCAgEAl95oujg97MlKkJuEKoJKyj23LCv0Md32HLS/
// SIG // PlTNbjmN26KIuRscGrk4EH+iRRyE06MUu4I6ipSvDhS8
// SIG // y+lE5dI8RCubeg7jnICV3b7rYpqE5TktAt5MiE1wQF6I
// SIG // /4KeoUUfc+lkYqdSrZIpW93SVwo0Kk/T9grro6/lc/K/
// SIG // mfow5dPY4v4nP+Bt+K95lcI7P/xp8fT7t9VfK1xYnDYg
// SIG // M8abm2sKW3fKan85Vk9r5xt5BfZejIkRG7yd1xy1MB0L
// SIG // IdLf060hcf7P8gqqSVmCeqApRu9Lb7BR9GkT/MAeHD/w
// SIG // hWtiC75NuotznCQZfqaiox00gcvZr8EzxA5Z83KNDbfE
// SIG // eqUj012YAbLHB4aCnwtFkJjs2NpHl2wJkU3GTMl8+b/w
// SIG // CW5qCNMtOwWs77eTZF3XRvUxK0FsLbBciCqxJQ4Fnx3g
// SIG // qE7tcLtnIg93Su9s93GtoM6BA8U9o/QVyFCmok803UD0
// SIG // bADGjt3VNM2hsDDJcLUicg4deGBIGaFLub0vDLoDKnaz
// SIG // Y6Yci+ucioY6QFm4WJCBzv9LmY7vebT/M2TalyEYeLXX
// SIG // 1hyTwE5/a/nMZMrodsdFS3X8dZZivV9zYx9DbYALOSQf
// SIG // 8DpZMrrncZhU31lckay9+4rKTmfGjwBYL8kenDU5BqZB
// SIG // aN+SUY3IjZmYlOKk/VLcvleYLnRZNY8CAwEAAaOCAUkw
// SIG // ggFFMB0GA1UdDgQWBBQ+Fo7kE1CW7W3d45r2ZLtBWdnl
// SIG // NjAfBgNVHSMEGDAWgBSfpxVdAF5iXYP05dJlpxtTNRnp
// SIG // cjBfBgNVHR8EWDBWMFSgUqBQhk5odHRwOi8vd3d3Lm1p
// SIG // Y3Jvc29mdC5jb20vcGtpb3BzL2NybC9NaWNyb3NvZnQl
// SIG // MjBUaW1lLVN0YW1wJTIwUENBJTIwMjAxMCgxKS5jcmww
// SIG // bAYIKwYBBQUHAQEEYDBeMFwGCCsGAQUFBzAChlBodHRw
// SIG // Oi8vd3d3Lm1pY3Jvc29mdC5jb20vcGtpb3BzL2NlcnRz
// SIG // L01pY3Jvc29mdCUyMFRpbWUtU3RhbXAlMjBQQ0ElMjAy
// SIG // MDEwKDEpLmNydDAMBgNVHRMBAf8EAjAAMBYGA1UdJQEB
// SIG // /wQMMAoGCCsGAQUFBwMIMA4GA1UdDwEB/wQEAwIHgDAN
// SIG // BgkqhkiG9w0BAQsFAAOCAgEAzvwirHIhDPJK9X6h+E5X
// SIG // 0+uhDaE48V8PNdKchKtD3a4C8H4E98ftYM+wkB7VHXr6
// SIG // jEOah8gy4ZuqU/ddQmJBjfuoPjFO3zGE6+nd0sYnicAS
// SIG // KFpH0eIO0orRszClOOuShGHo33XaFIKLwv8XEaWgCzua
// SIG // d/wNuPAcoSYjLbQUDQ7bE/x2ghcERQlEW8v3/HNZJMvB
// SIG // fMZAlxc/vzLWeXdZVhY8DiNoHmR1qvV4oQzoHnuZ0tpK
// SIG // KOVep/FxtttFE3r1X/qYJqSB+9Vyg1SGExhmSbOsj5Xy
// SIG // dml6sNTBODUeqJDbGNz9TN9R+gzGEXyRjQTXqefeZFxo
// SIG // d2MwN3AosoPo5iefIf307454CKblBXzg6Q4xcdInNWKC
// SIG // wDcYQhd0YUvamDOyuNDRISrIWLmgJCBtlwSmIoN6/9P2
// SIG // 9LI74wcLOeQGKJzJtwPKnF/+pPVX3NJr/XbaJx7lhnwN
// SIG // m/qhNqqQp4cxm3Qx6u4jkmRMNNZzbqQDH9XONZPSKE0N
// SIG // s94sOsOGWaCzsoOEyjG6dZK6U+La4qf8t9Ar+ZIcqggz
// SIG // aml0KQZDmDjfC4LaEN2plTl+4seY3a58f71MU1EooF76
// SIG // 1nS+1JPJKZktM7aNk6Mu2k+aAcwk734/YifwTfxNb4RQ
// SIG // ZISQr2ez1b7DEp005pMdhWpdpVZM7bgCOOHw/7siyXWj
// SIG // EEswggdxMIIFWaADAgECAhMzAAAAFcXna54Cm0mZAAAA
// SIG // AAAVMA0GCSqGSIb3DQEBCwUAMIGIMQswCQYDVQQGEwJV
// SIG // UzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMH
// SIG // UmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBv
// SIG // cmF0aW9uMTIwMAYDVQQDEylNaWNyb3NvZnQgUm9vdCBD
// SIG // ZXJ0aWZpY2F0ZSBBdXRob3JpdHkgMjAxMDAeFw0yMTA5
// SIG // MzAxODIyMjVaFw0zMDA5MzAxODMyMjVaMHwxCzAJBgNV
// SIG // BAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYD
// SIG // VQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQg
// SIG // Q29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jvc29mdCBU
// SIG // aW1lLVN0YW1wIFBDQSAyMDEwMIICIjANBgkqhkiG9w0B
// SIG // AQEFAAOCAg8AMIICCgKCAgEA5OGmTOe0ciELeaLL1yR5
// SIG // vQ7VgtP97pwHB9KpbE51yMo1V/YBf2xK4OK9uT4XYDP/
// SIG // XE/HZveVU3Fa4n5KWv64NmeFRiMMtY0Tz3cywBAY6GB9
// SIG // alKDRLemjkZrBxTzxXb1hlDcwUTIcVxRMTegCjhuje3X
// SIG // D9gmU3w5YQJ6xKr9cmmvHaus9ja+NSZk2pg7uhp7M62A
// SIG // W36MEBydUv626GIl3GoPz130/o5Tz9bshVZN7928jaTj
// SIG // kY+yOSxRnOlwaQ3KNi1wjjHINSi947SHJMPgyY9+tVSP
// SIG // 3PoFVZhtaDuaRr3tpK56KTesy+uDRedGbsoy1cCGMFxP
// SIG // LOJiss254o2I5JasAUq7vnGpF1tnYN74kpEeHT39IM9z
// SIG // fUGaRnXNxF803RKJ1v2lIH1+/NmeRd+2ci/bfV+Autuq
// SIG // fjbsNkz2K26oElHovwUDo9Fzpk03dJQcNIIP8BDyt0cY
// SIG // 7afomXw/TNuvXsLz1dhzPUNOwTM5TI4CvEJoLhDqhFFG
// SIG // 4tG9ahhaYQFzymeiXtcodgLiMxhy16cg8ML6EgrXY28M
// SIG // yTZki1ugpoMhXV8wdJGUlNi5UPkLiWHzNgY1GIRH29wb
// SIG // 0f2y1BzFa/ZcUlFdEtsluq9QBXpsxREdcu+N+VLEhReT
// SIG // wDwV2xo3xwgVGD94q0W29R6HXtqPnhZyacaue7e3Pmri
// SIG // Lq0CAwEAAaOCAd0wggHZMBIGCSsGAQQBgjcVAQQFAgMB
// SIG // AAEwIwYJKwYBBAGCNxUCBBYEFCqnUv5kxJq+gpE8RjUp
// SIG // zxD/LwTuMB0GA1UdDgQWBBSfpxVdAF5iXYP05dJlpxtT
// SIG // NRnpcjBcBgNVHSAEVTBTMFEGDCsGAQQBgjdMg30BATBB
// SIG // MD8GCCsGAQUFBwIBFjNodHRwOi8vd3d3Lm1pY3Jvc29m
// SIG // dC5jb20vcGtpb3BzL0RvY3MvUmVwb3NpdG9yeS5odG0w
// SIG // EwYDVR0lBAwwCgYIKwYBBQUHAwgwGQYJKwYBBAGCNxQC
// SIG // BAweCgBTAHUAYgBDAEEwCwYDVR0PBAQDAgGGMA8GA1Ud
// SIG // EwEB/wQFMAMBAf8wHwYDVR0jBBgwFoAU1fZWy4/oolxi
// SIG // aNE9lJBb186aGMQwVgYDVR0fBE8wTTBLoEmgR4ZFaHR0
// SIG // cDovL2NybC5taWNyb3NvZnQuY29tL3BraS9jcmwvcHJv
// SIG // ZHVjdHMvTWljUm9vQ2VyQXV0XzIwMTAtMDYtMjMuY3Js
// SIG // MFoGCCsGAQUFBwEBBE4wTDBKBggrBgEFBQcwAoY+aHR0
// SIG // cDovL3d3dy5taWNyb3NvZnQuY29tL3BraS9jZXJ0cy9N
// SIG // aWNSb29DZXJBdXRfMjAxMC0wNi0yMy5jcnQwDQYJKoZI
// SIG // hvcNAQELBQADggIBAJ1VffwqreEsH2cBMSRb4Z5yS/yp
// SIG // b+pcFLY+TkdkeLEGk5c9MTO1OdfCcTY/2mRsfNB1OW27
// SIG // DzHkwo/7bNGhlBgi7ulmZzpTTd2YurYeeNg2LpypglYA
// SIG // A7AFvonoaeC6Ce5732pvvinLbtg/SHUB2RjebYIM9W0j
// SIG // VOR4U3UkV7ndn/OOPcbzaN9l9qRWqveVtihVJ9AkvUCg
// SIG // vxm2EhIRXT0n4ECWOKz3+SmJw7wXsFSFQrP8DJ6LGYnn
// SIG // 8AtqgcKBGUIZUnWKNsIdw2FzLixre24/LAl4FOmRsqlb
// SIG // 30mjdAy87JGA0j3mSj5mO0+7hvoyGtmW9I/2kQH2zsZ0
// SIG // /fZMcm8Qq3UwxTSwethQ/gpY3UA8x1RtnWN0SCyxTkct
// SIG // wRQEcb9k+SS+c23Kjgm9swFXSVRk2XPXfx5bRAGOWhmR
// SIG // aw2fpCjcZxkoJLo4S5pu+yFUa2pFEUep8beuyOiJXk+d
// SIG // 0tBMdrVXVAmxaQFEfnyhYWxz/gq77EFmPWn9y8FBSX5+
// SIG // k77L+DvktxW/tM4+pTFRhLy/AsGConsXHRWJjXD+57XQ
// SIG // KBqJC4822rpM+Zv/Cuk0+CQ1ZyvgDbjmjJnW4SLq8CdC
// SIG // PSWU5nR0W2rRnj7tfqAxM328y+l7vzhwRNGQ8cirOoo6
// SIG // CGJ/2XBjU02N7oJtpQUQwXEGahC0HVUzWLOhcGbyoYID
// SIG // UDCCAjgCAQEwgfmhgdGkgc4wgcsxCzAJBgNVBAYTAlVT
// SIG // MRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdS
// SIG // ZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9y
// SIG // YXRpb24xJTAjBgNVBAsTHE1pY3Jvc29mdCBBbWVyaWNh
// SIG // IE9wZXJhdGlvbnMxJzAlBgNVBAsTHm5TaGllbGQgVFNT
// SIG // IEVTTjpBMDAwLTA1RTAtRDk0NzElMCMGA1UEAxMcTWlj
// SIG // cm9zb2Z0IFRpbWUtU3RhbXAgU2VydmljZaIjCgEBMAcG
// SIG // BSsOAwIaAxUACaw/dMpB6aP9ABm+5ZsL7ArakTmggYMw
// SIG // gYCkfjB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2Fz
// SIG // aGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UE
// SIG // ChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQD
// SIG // Ex1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAxMDAN
// SIG // BgkqhkiG9w0BAQsFAAIFAO5tCHIwIhgPMjAyNjEwMDQx
// SIG // NzE2MzRaGA8yMDI2MTAwNTE3MTYzNFowdzA9BgorBgEE
// SIG // AYRZCgQBMS8wLTAKAgUA7m0IcgIBADAKAgEAAgIBcAIB
// SIG // /zAHAgEAAgISqjAKAgUA7m5Z8gIBADA2BgorBgEEAYRZ
// SIG // CgQCMSgwJjAMBgorBgEEAYRZCgMCoAowCAIBAAIDB6Eg
// SIG // oQowCAIBAAIDAYagMA0GCSqGSIb3DQEBCwUAA4IBAQBm
// SIG // UxK7Dk3bzWus91eDJk/BtLIvgIeYFq3Puq/8pg8ksKyJ
// SIG // al1iV2GBsr1J7iU1PhliqF4SE+5iJxjfG8G+/XV9uBr/
// SIG // IflE1gUgnNg6PqQMUEscsC8ITR6jWc8FHS3vJ9RDycOm
// SIG // 2R4ed/JeGmZrREv9t9mviNhBcHC2TaB9Q0bOmgZE6J/Z
// SIG // ut2ki3haYFtJugSjdKBdCy3x+yA+NCiaoKhMPRi6ktNR
// SIG // gMA6C/baGSlPKIShKWa4nD3WQFCpEA4UPWS/VJ3QiPkf
// SIG // oHOVOyyYYf0pfqyb1Vy61OoYVCTVb/PkAZ8VGcBMtWU/
// SIG // /7yZgRWZ7fOEOS4lubdP4z6q5vGlHesKMYIEDTCCBAkC
// SIG // AQEwgZMwfDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldh
// SIG // c2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNV
// SIG // BAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEmMCQGA1UE
// SIG // AxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTAC
// SIG // EzMAAAIruwBQ/007mqEAAQAAAiswDQYJYIZIAWUDBAIB
// SIG // BQCgggFKMBoGCSqGSIb3DQEJAzENBgsqhkiG9w0BCRAB
// SIG // BDAvBgkqhkiG9w0BCQQxIgQgNecZvaQVmYc4jhwrSvUM
// SIG // FHasgUTQQwcVNHBMPuOTWVowgfoGCyqGSIb3DQEJEAIv
// SIG // MYHqMIHnMIHkMIG9BCByDiP0P5BX7WAPjNjmPtQcd2ow
// SIG // Q+v1gwLT09rxZL9uUjCBmDCBgKR+MHwxCzAJBgNVBAYT
// SIG // AlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQH
// SIG // EwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29y
// SIG // cG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jvc29mdCBUaW1l
// SIG // LVN0YW1wIFBDQSAyMDEwAhMzAAACK7sAUP9NO5qhAAEA
// SIG // AAIrMCIEIFro84GjdTAtwkKL7KwEiOlpwVoU1WgufFoM
// SIG // m4vgRmZGMA0GCSqGSIb3DQEBCwUABIICACLK6FMZnxtG
// SIG // ITSSd0xJ6KfPqXA1zXHIHHg/FeLrxVXMSSzyv2nb2gE1
// SIG // duZExQGmkofhafMMBuoaKtkSbNpT+P0x+2v8VL1XD2WT
// SIG // s/8uqU1CK/Tw8yPKrFi8xOyy2vOYpiWV/hhvgoEZU8x7
// SIG // CmyUaOZsMGkJJeS27ShiBYoM0eHdKhN0W/8kMqpwJIxR
// SIG // CS75kUgO2umuhT8W4bPuIWIgrWp1yV+3CWUeMPQOIQHB
// SIG // s44NTckEgu4+l2eGZ6NET117h8/tD/d4qw/Xx5EXOMFT
// SIG // 2c1Uk1XdTlboLrVv+UH8YuE4VMQ6G+uzbdgjKeqmA6Sb
// SIG // WviZrhRKI15jMVwNORlWqIepuLhm4eWbHauFnzNHNkeG
// SIG // rKkYsmRvLwfgO7DXHOBGGIOtWQ1/RC0SgI5Gu7K+6qfF
// SIG // a4I8484H5mC1LukUzwC/W2P72M6vtAuAlw1iuWF/X5ih
// SIG // NgMyVpsXKBIv8PnggTeRwZSnGMAF9dQjHUrAmfBhVUFS
// SIG // Ted8Y+FmNqL10PdoW0G0Bp5IOq9kcfuTBywkX92TNlWo
// SIG // cMTJNZQoU4S+Imz7Zom+4Arh0jEmNPL85J6RYfYtZqgT
// SIG // wGWlKuF9bTuld35Gps53sHcXrpc2mYGHcb5voFNC+xtG
// SIG // BQUoBfy707ShY0kJN1QPk92ppoBpGhU5Ar9e4wdXDRb9
// SIG // 1+pkZyRqNbyE
// SIG // End signature block
