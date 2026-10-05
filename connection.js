/**
 * Wrapper for client-side TikTok connection over Socket.IO
 *
 * 接続先は sacrifice-nico.com の Socket.IO サーバー。
 *
 * GitHub Pages:
 *   https://nmlyz.github.io/tt_comment/
 *
 * Socket.IO:
 *   https://sacrifice-nico.com/socket.io/
 */

class TikTokIOConnection {
  
  constructor(backendUrl) {
    
    this.backendUrl =
      backendUrl || 'https://sacrifice-nico.com';
    
    this.socket = io(this.backendUrl, {
      path: '/socket.io/',
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnection: true
    });
    
    this.uniqueId = null;
    this.options = null;
    
    this.socket.on('connect', () => {
      
      console.info(
        'Socket connected!',
        this.socket.id
      );
      
      // Socket.IO接続後、
      // 既にユーザーIDが設定されていれば再接続
      if (this.uniqueId) {
        this.setUniqueId();
      }
    });
    
    this.socket.on('disconnect', (reason) => {
      
      console.warn(
        'Socket disconnected!',
        reason
      );
    });
    
    this.socket.on('connect_error', (error) => {
      
      console.error(
        'Socket connection error:',
        error
      );
    });
    
    this.socket.on('streamEnd', () => {
      
      console.warn('LIVE has ended!');
      
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
      
      let settled = false;
      
      const handleConnected = (data) => {
        
        if (settled) {
          return;
        }
        
        settled = true;
        clearTimeout(timeoutId);
        
        resolve(data);
      };
      
      const handleDisconnected = (error) => {
        
        if (settled) {
          return;
        }
        
        settled = true;
        clearTimeout(timeoutId);
        
        reject(error);
      };
      
      this.socket.once(
        'tiktokConnected',
        handleConnected
      );
      
      this.socket.once(
        'tiktokDisconnected',
        handleDisconnected
      );
      
      const timeoutId = setTimeout(() => {
        
        if (settled) {
          return;
        }
        
        settled = true;
        
        this.socket.off(
          'tiktokConnected',
          handleConnected
        );
        
        this.socket.off(
          'tiktokDisconnected',
          handleDisconnected
        );
        
        reject('Connection Timeout');
        
      }, 15000);
    });
  }
  
  setUniqueId() {
    
    if (!this.socket.connected) {
      
      console.warn(
        'Socket is not connected yet. ' +
        'setUniqueId will be sent after Socket.IO connects.'
      );
      
      return;
    }
    
    console.info(
      'Sending setUniqueId:',
      this.uniqueId,
      this.options
    );
    
    this.socket.emit(
      'setUniqueId',
      this.uniqueId,
      this.options
    );
  }
  
  on(eventName, eventHandler) {
    
    this.socket.on(
      eventName,
      eventHandler
    );
  }
}