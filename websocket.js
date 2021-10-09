import WebSocket from 'ws';

let socket = new WebSocket("wss://ff6x7f50y6.execute-api.eu-west-1.amazonaws.com/dev");

socket.onopen = function(e) {
    console.log("[open] Connection established");
    console.log("Sending to server");
    socket.send('{"action":"audio-compression","data":"hello world"}');
};

socket.onmessage = function(event) {
    console.log(`[message] Data received from server: ${event.data}`);
};

socket.onclose = function(event) {
    if (event.wasClean) {
        console.log(`[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`);
    } else {
        // e.g. server process killed or network down
        // event.code is usually 1006 in this case
        console.log('[close] Connection died');
    }
};

socket.onerror = function(error) {
    console.log(`[error] ${error.message}`);
};
