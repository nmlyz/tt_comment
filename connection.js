class TikTokIOConnection {

  constructor(backendUrl) {

    // 互換のため引数は受けるが、接続先は Euler Stream 固定
    this.backendUrl = backendUrl || null;

    this.apiKey = 'euler_ZfUhrUMWMlWnYOb9bdmfDDoBMXAikuhcPt0D0YVE50g';

    this.uniqueId = null;
    this.options = null;
    this.socket = null;

    this.handlers = {};
    this._generation = 0;
    this._sdkPromise = null;
  }

  on(eventName, eventHandler) {

    if (!this.handlers[eventName]) {
      this.handlers[eventName] = [];
    }

    this.handlers[eventName].push(eventHandler);
  }

  off(eventName, eventHandler) {

    const list = this.handlers[eventName];

    if (!list) {
      return;
    }

    if (!eventHandler) {
      delete this.handlers[eventName];
      return;
    }

    this.handlers[eventName] =
      list.filter(h => h !== eventHandler);
  }

  emitLocal(eventName, data) {

    const list = this.handlers[eventName];

    if (!list) {
      return;
    }

    list.slice().forEach(handler => {

      try {
        handler(data);
      } catch (e) {
        console.error(e);
      }
    });
  }

  loadSdk() {

    if (!this._sdkPromise) {

      this._sdkPromise =
        import('https://cdn.jsdelivr.net/npm/@eulerstream/euler-websocket-sdk/+esm')
          .catch(() => null);
    }

    return this._sdkPromise;
  }

  async buildUrl(uniqueId) {

    const sdk = await this.loadSdk();

    if (sdk && typeof sdk.createWebSocketUrl === 'function') {

      try {
        return sdk.createWebSocketUrl({
          uniqueId: uniqueId,
          apiKey: this.apiKey
        });
      } catch (e) {
        // フォールバックへ
      }
    }

    return 'wss://ws.eulerstream.com' +
      '?uniqueId=' + encodeURIComponent(uniqueId) +
      '&apiKey=' + encodeURIComponent(this.apiKey);
  }

  connect(uniqueId, options) {

    this.uniqueId = uniqueId;
    this.options = options || {};

    const generation = ++this._generation;

    if (this.socket) {

      try {
        this.socket.close();
      } catch (e) {
        // ignore
      }

      this.socket = null;
    }

    return new Promise((resolve, reject) => {

      let settled = false;
      let fallbackTimer = null;
      let timeoutTimer = null;

      const cleanup = () => {

        if (fallbackTimer) {
          clearTimeout(fallbackTimer);
        }

        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
        }
      };

      const doResolve = (roomId) => {

        if (settled) {
          return;
        }

        settled = true;
        cleanup();

        resolve({
          roomId: roomId || uniqueId,
          isConnected: true
        });
      };

      const doReject = (message) => {

        if (settled) {
          return;
        }

        settled = true;
        cleanup();

        reject(message);
      };

      const start = async () => {

        let url;

        try {
          url = await this.buildUrl(uniqueId);
        } catch (e) {
          doReject('接続URLの生成に失敗しました');
          return;
        }

        if (generation !== this._generation) {
          doReject('接続がキャンセルされました');
          return;
        }

        const ws = new WebSocket(url);
        this.socket = ws;

        timeoutTimer = setTimeout(() => {

          if (!settled) {

            try {
              ws.close();
            } catch (e) {
              // ignore
            }

            doReject('接続がタイムアウトしました');
          }
        }, 20000);

        ws.addEventListener('open', () => {

          // 配信中なら通常はすぐデータが来る。
          // 何も来なくても開いたままなら接続成功とみなす保険。
          fallbackTimer = setTimeout(() => {

            if (ws.readyState === WebSocket.OPEN) {
              doResolve(null);
            }
          }, 10000);
        });

        ws.addEventListener('message', (event) => {

          if (generation !== this._generation) {
            return;
          }

          this.handleFrame(
            event.data,
            (roomId) => doResolve(roomId)
          );
        });

        ws.addEventListener('close', (event) => {

          if (generation !== this._generation) {
            return;
          }

          if (!settled) {
            doReject(
              TikTokIOConnection.closeMessage(
                event.code,
                event.reason
              )
            );
          } else {
            this.emitLocal('streamEnd', {
              action: 'STREAM_END'
            });
          }
        });
      };

      start();
    });
  }

  static closeMessage(code, reason) {

    switch (code) {
      case 4404:
        return '配信していません（オフラインです）';
      case 4401:
        return 'APIキーが無効です';
      case 4403:
        return '接続権限がありません';
      case 4429:
        return '接続数が上限に達しています';
      case 4400:
        return '接続オプションが不正です';
      case 4005:
        return '配信は終了しました';
      default:
        return '接続できませんでした' +
          (reason
            ? '：' + reason
            : (code ? '（' + code + '）' : ''));
    }
  }

  handleFrame(raw, onRoom) {

    if (typeof raw !== 'string') {
      return;
    }

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return;
    }

    const messages =
      Array.isArray(parsed.messages)
        ? parsed.messages
        : [parsed];

    messages.forEach(item => {

      if (!item || !item.type) {
        return;
      }

      this.handleEvent(item.type, item.data || {}, onRoom);
    });
  }

  handleEvent(type, data, onRoom) {

    switch (type) {

      case 'roomInfo': {

        if (onRoom) {
          onRoom(data.roomId || data.id || null);
        }

        break;
      }

      case 'room.status': {

        if (data.state === 'connected' && onRoom) {
          onRoom(data.roomId || null);
        }

        if (data.state === 'ended') {
          this.emitLocal('streamEnd', {
            action: 'STREAM_END'
          });
        }

        break;
      }

      case 'WebcastChatMessage': {

        const out = this.withUser(data);

        out.comment =
          data.comment != null
            ? String(data.comment)
            : (data.content || '');

        out.content = out.comment;

        this.attachCommon(out, data);
        this.emitLocal('chat', out);
        this.notifyRoom(onRoom, data);

        break;
      }

      case 'WebcastGiftMessage': {

        const out = this.withUser(data);
        const gift = data.giftDetails || data.gift || {};

        out.giftId =
          data.giftId != null
            ? data.giftId
            : (gift.id || '');

        out.giftName =
          gift.giftName || gift.name || '';

        out.giftPictureUrl =
          TikTokIOConnection.pickImageUrl(gift.giftImage) ||
          TikTokIOConnection.pickImageUrl(gift.image) ||
          TikTokIOConnection.pickImageUrl(gift.icon) ||
          '';

        out.diamondCount =
          Number(gift.diamondCount || 0);

        out.repeatCount =
          Number(data.repeatCount || 1);

        out.giftType =
          gift.giftType != null
            ? gift.giftType
            : (gift.type != null ? gift.type : 0);

        out.repeatEnd =
          data.repeatEnd === true ||
          Number(data.repeatEnd) > 0;

        out.describe = gift.describe || '';
        out.groupId = data.groupId || '';

        this.attachCommon(out, data);
        this.emitLocal('gift', out);
        this.notifyRoom(onRoom, data);

        break;
      }

      case 'WebcastLikeMessage': {

        const out = this.withUser(data);

        const total =
          data.totalLikeCount != null
            ? Number(data.totalLikeCount)
            : (data.total != null
              ? Number(data.total)
              : null);

        const delta =
          data.likeCount != null
            ? Number(data.likeCount)
            : (data.count != null
              ? Number(data.count)
              : null);

        if (total !== null && isFinite(total)) {
          out.likeCount = total;
        }

        if (delta !== null && isFinite(delta)) {
          out.likeCountDelta = delta;
        }

        if (
          out.likeCount === undefined &&
          out.likeCountDelta === undefined
        ) {
          out.likeCountDelta = 1;
        }

        this.attachCommon(out, data);
        this.emitLocal('like', out);
        this.notifyRoom(onRoom, data);

        break;
      }

      case 'WebcastMemberMessage': {

        const out = this.withUser(data);

        this.attachCommon(out, data);
        this.emitLocal('member', out);
        this.notifyRoom(onRoom, data);

        break;
      }

      case 'WebcastRoomUserSeqMessage': {

        const out = {};

        const viewerCount =
          data.viewerCount != null
            ? Number(data.viewerCount)
            : (data.total != null
              ? Number(data.total)
              : (data.totalUser != null
                ? Number(data.totalUser)
                : NaN));

        if (isFinite(viewerCount)) {
          out.viewerCount = viewerCount;
        }

        const ranksRaw =
          data.ranksList || data.ranks || data.topViewers || [];

        out.ranks = ranksRaw
          .map(rankItem => {

            if (!rankItem) {
              return null;
            }

            return {
              user: this.buildUser(
                rankItem.user || rankItem
              )
            };
          })
          .filter(rankItem =>
            rankItem &&
            (rankItem.user.id || rankItem.user.uniqueId)
          );

        this.emitLocal('roomUser', out);
        this.notifyRoom(onRoom, data);

        break;
      }

      case 'WebcastSocialMessage': {

        const out = this.withUser(data);

        const displayText =
          (data.common && data.common.displayText) ||
          data.displayText ||
          null;

        let displayType =
          displayText && displayText.displayType
            ? String(displayText.displayType)
            : '';

        if (!displayType) {
          displayType =
            (data.shareType || data.shareTarget)
              ? 'share'
              : 'follow';
        }

        out.displayType = displayType;

        out.label =
          displayText && displayText.defaultPattern
            ? String(displayText.defaultPattern)
            : '';

        this.attachCommon(out, data);
        this.emitLocal('social', out);
        this.notifyRoom(onRoom, data);

        break;
      }

      case 'WebcastControlMessage': {

        if (Number(data.action) === 3) {
          this.emitLocal('streamEnd', {
            action: 'STREAM_END'
          });
        }

        this.notifyRoom(onRoom, data);

        break;
      }

      default: {

        // その他のWebcastメッセージは接続確立の材料としてだけ使う
        if (type.startsWith('Webcast')) {
          this.notifyRoom(onRoom, data);
        }

        break;
      }
    }
  }

  notifyRoom(onRoom, data) {

    if (!onRoom) {
      return;
    }

    const roomId =
      data && data.common
        ? (data.common.roomId || null)
        : null;

    onRoom(roomId);
  }

  attachCommon(out, data) {

    if (data && data.common) {

      out.common = data.common;

      if (data.common.msgId != null) {
        out.msgId = String(data.common.msgId);
      }
    }
  }

  withUser(data) {

    const user = this.buildUser(data ? data.user : null);

    return {
      user: user,
      userId: user.id,
      uniqueId: user.uniqueId,
      nickname: user.nickname,
      profilePictureUrl:
        user.avatarThumb.urlList.length
          ? user.avatarThumb.urlList[0]
          : ''
    };
  }

  buildUser(raw) {

    if (!raw || typeof raw !== 'object') {

      return {
        id: '',
        idStr: '',
        displayId: '',
        uniqueId: '',
        nickname: '',
        avatarThumb: { urlList: [] }
      };
    }

    const avatarUrl =
      TikTokIOConnection.pickImageUrl(raw.avatarThumb) ||
      TikTokIOConnection.pickImageUrl(raw.profilePicture) ||
      TikTokIOConnection.pickImageUrl(raw.profilePictureMedium) ||
      TikTokIOConnection.pickImageUrl(raw.avatarJpg) ||
      '';

    const handle = raw.uniqueId || raw.displayId || '';

    const id =
      raw.userId != null
        ? String(raw.userId)
        : (raw.id != null
          ? String(raw.id)
          : (raw.idStr || ''));

    return {
      id: id,
      idStr: raw.idStr || id,
      displayId: handle,
      uniqueId: handle,
      nickname: raw.nickname || '',
      avatarThumb: {
        urlList: avatarUrl ? [avatarUrl] : []
      }
    };
  }

  static pickImageUrl(image) {

    if (!image || typeof image !== 'object') {
      return '';
    }

    const list = image.urlList || image.url || image.mUrls || [];

    if (Array.isArray(list) && list.length) {
      return String(list[0]);
    }

    return '';
  }
}
