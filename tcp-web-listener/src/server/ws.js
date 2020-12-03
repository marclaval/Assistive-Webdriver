const net = require("net");
const WebSocket = require('ws');
const argv = require("yargs")
  .default("http-host", "127.0.0.1")
  .default("http-port", 7779)
  .default("tcp-host", "127.0.0.1")
  .default("tcp-port", 4449)
  .default("register-function", "registerLiveListener").argv;

  const formatAddress = function(address) {
    const host = address.address;
    const wrappedHost = host.indexOf(":") > -1 ? `[${host}]` : host;
    return `${wrappedHost}:${address.port}`;
  };
  const readSocketAddress = function(socket) {
    return {
      port: socket.remotePort,
      family: socket.remoteFamily,
      address: socket.remoteAddress
    };
  };

const wss = new WebSocket.Server({
  port: argv["http-port"],
  perMessageDeflate: {
    zlibDeflateOptions: {
      // See zlib defaults.
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    // Other options settable:
    clientNoContextTakeover: true, // Defaults to negotiated value.
    serverNoContextTakeover: true, // Defaults to negotiated value.
    serverMaxWindowBits: 10, // Defaults to negotiated value.
    // Below options specified as default values.
    concurrencyLimit: 10, // Limits zlib concurrency for perf.
    threshold: 1024 // Size (in bytes) below which messages
    // should not be compressed.
  }
});

function sendData(data) {
  console.log(`> ${data}`);
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

const tcpServer = net.createServer(function(socket) {
  const address = formatAddress(readSocketAddress(socket));
  console.log(`tcp client connected: ${address}`);
  let text = "";
  socket.on("data", data => {
    text += data.toString();
    const array = text.split(/\r\n|\n\r|\r|\n/);
    text = array.pop();
    array.forEach(sendData);
  });
  socket.on("error", error => {
    console.log(`error from socket ${address}: ${error}`);
    socket.end();
  });
  socket.on("close", () => {
    if (text) {
      sendData(text);
      text = "";
    }
    console.log(`tcp client disconnected: ${address}`);
  });
});

const startListening = function(serverName, serverObject) {
  serverObject.listen(argv[`${serverName}-port`], argv[`${serverName}-host`]);
  serverObject.on("listening", function() {
    console.log(
      `${serverName} server listening on ${formatAddress(
        serverObject.address()
      )}`
    );
  });
};

startListening("tcp", tcpServer);