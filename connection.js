class TikTokIOConnection {
  
  constructor(backendUrl) {
    
    this.backendUrl = backendUrl || "https://sacrifice-nico.com";
    
    this.socket = io(this.backendUrl, {
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });
    
    this.uniqueId = null;
    this.options = null;
    
    this.socket.on('connect', () => {
      
      console.info("Socket connected!");
      
      if (this.uniqueId) {
        this.setUniqueId();
      }
    });
    
    this.socket.on('disconnect', () => {
      console.warn("Socket disconnected!");
    });
    
    this.socket.on('streamEnd', () => {
      
      console.warn("LIVE has ended!");
      
      this.uniqueId = null;
    });
    
    this.socket.on('tiktokDisconnected', (errMsg) => {
      
      console.warn(errMsg);
      
      if (
        errMsg &&
        String(errMsg).includes('LIVE has ended')
      ) {
        this.uniqueId = null;
      }
    });
  }
  
  connect(uniqueId, options) {
    
    this.uniqueId = uniqueId;
    this.options = options || {};
    
    this.setUniqueId();
    
    return new Promise((resolve, reject) => {
      
      let finished = false;
      
      const cleanup = () => {
        
        this.socket.off('tiktokConnected', onConnected);
        this.socket.off('tiktokDisconnected', onDisconnected);
        
        clearTimeout(timeoutId);
      };
      
      const onConnected = (state) => {
        
        if (finished) {
          return;
        }
        
        finished = true;
        cleanup();
        
        resolve(state);
      };
      
      const onDisconnected = (errorMessage) => {
        
        if (finished) {
          return;
        }
        
        finished = true;
        cleanup();
        
        reject(errorMessage);
      };
      
      this.socket.once('tiktokConnected', onConnected);
      this.socket.once('tiktokDisconnected', onDisconnected);
      
      const timeoutId = setTimeout(() => {
        
        if (finished) {
          return;
        }
        
        finished = true;
        cleanup();
        
        reject('Connection Timeout');
        
      }, 15000);
    });
  }
  
  setUniqueId() {
    
    if (!this.socket || !this.socket.connected) {
      return;
    }
    
    this.socket.emit(
      'setUniqueId',
      this.uniqueId,
      this.options || {}
    );
  }
  
  on(eventName, eventHandler) {
    this.socket.on(eventName, eventHandler);
  }
  
  off(eventName, eventHandler) {
    this.socket.off(eventName, eventHandler);
  }
}