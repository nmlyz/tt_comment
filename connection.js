class TikTokIOConnection {
  
  constructor(backendUrl) {
    
    this.backendUrl =
      backendUrl ||
      "https://sacrifice-nico.com";
    
    this.socket = io(this.backendUrl, {
      transports: ["polling", "websocket"],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
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
        
        this.socket.off(
          'tiktokConnected',
          handleConnected
        );
        
        this.socket.off(
          'tiktokDisconnected',
          handleDisconnected
        );
        
        clearTimeout(timer);
      };
      
      const handleConnected = (state) => {
        
        if (finished) return;
        
        finished = true;
        
        cleanup();
        
        resolve(state);
      };
      
      const handleDisconnected = (error) => {
        
        if (finished) return;
        
        finished = true;
        
        cleanup();
        
        reject(error);
      };
      
      const timer = setTimeout(() => {
        
        if (finished) return;
        
        finished = true;
        
        cleanup();
        
        reject('Connection Timeout');
        
      }, 15000);
      
      this.socket.once(
        'tiktokConnected',
        handleConnected
      );
      
      this.socket.once(
        'tiktokDisconnected',
        handleDisconnected
      );
      
    });
  }
  
  setUniqueId() {
    
    this.socket.emit(
      'setUniqueId',
      this.uniqueId,
      this.options || {}
    );
    
  }
  
  on(eventName, eventHandler) {
    
    this.socket.on(
      eventName,
      eventHandler
    );
    
  }
  
}