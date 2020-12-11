
class HeartRateSocket{
  


  constructor(url,callback){
    this.socket = new WebSocket(url);
    this.callback = callback;
    var sock = this.socket;
    var cb = this.callback;
    this.socket.onopen = function(e) {
      console.log("[open] Connection established");
      console.log("Sending to server");
      sock.send("web ui checking in");
    };

    this.socket.onmessage = function(event) {
      console.log(`[message] Data received from server: ${event.data}`);
      cb(JSON.parse(event.data));
    };

    this.socket.onclose = function(event) {
      if (event.wasClean) {
        console.log(`[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`);
      } else {
        // e.g. server process killed or network down
        // event.code is usually 1006 in this case
        alert('[close] Connection died');
      }
    };

    this.socket.onerror = function(error) {
      console.log(`[error] ${error.message}`);
    };
  }

}


export { HeartRateSocket};