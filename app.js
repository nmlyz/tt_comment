let backendUrl = undefined;

let connection = new TikTokIOConnection(
    backendUrl
);

let viewerCount = 0;
let likeCount = 0;
let diamondsCount = 0;

if (!window.settings) {
    window.settings = {};
}

/* =========================================
   ギフト音
   ========================================= */

let giftAudio = null;

/*
 * 初回読み込み・接続直後のギフトでは
 * 音を鳴らさないためのフラグ。
 */
let giftSoundReady = false;

/*
 * 接続直後にサーバーから送られてくる
 * ギフト情報を無音にする時間。
 */
let giftSoundReadyTimer = null;

function prepareGiftAudio() {

    if (giftAudio) {
        return;
    }

    giftAudio = new Audio('./gift.mp3');

    giftAudio.preload = 'auto';

    giftAudio.volume = 1.0;
}

function unlockGiftAudio() {

    prepareGiftAudio();

    if (!giftAudio) {
        return;
    }

    try {

        giftAudio.muted = true;

        let promise = giftAudio.play();

        if (promise && promise.then) {

            promise.then(() => {

                giftAudio.pause();
                giftAudio.currentTime = 0;
                giftAudio.muted = false;

            }).catch(() => {

                giftAudio.muted = false;

            });

        } else {

            giftAudio.pause();
            giftAudio.currentTime = 0;
            giftAudio.muted = false;

        }

    } catch (e) {

        try {
            giftAudio.muted = false;
        } catch (_) {}

    }
}

function startGiftSoundCooldown() {

    giftSoundReady = false;

    if (giftSoundReadyTimer) {
        clearTimeout(giftSoundReadyTimer);
    }

    /*
     * 接続直後にサーバーから流れてくる
     * ギフトイベントを無音にする。
     */
    giftSoundReadyTimer = setTimeout(() => {

        giftSoundReady = true;

    }, 5000);
}

function playGiftSound() {

    if (!giftSoundReady) {
        return;
    }

    prepareGiftAudio();

    if (!giftAudio) {
        return;
    }

    try {

        giftAudio.currentTime = 0;

        let promise = giftAudio.play();

        if (promise && promise.catch) {
            promise.catch(() => {});
        }

    } catch (e) {

        console.warn(
            'Gift sound error:',
            e
        );

    }
}

/* =========================================
   重複コメント防止
   ========================================= */

const recentComments = new Map();

const COMMENT_DUPLICATE_WINDOW = 3000;

function getCommentDuplicateKey(data) {

    if (
        data &&
        data.common &&
        data.common.msgId
    ) {
        return 'msg:' + String(
            data.common.msgId
        );
    }

    if (data && data.msgId) {
        return 'msg:' + String(
            data.msgId
        );
    }

    if (
        data &&
        data.common &&
        data.common.logId
    ) {
        return 'log:' + String(
            data.common.logId
        );
    }

    if (data && data.logId) {
        return 'log:' + String(
            data.logId
        );
    }

    let userId =
        data && data.userId
            ? String(data.userId)
            : '';

    let comment =
        data && data.comment
            ? String(data.comment)
            : '';

    return (
        'fallback:' +
        userId +
        '|' +
        comment
    );
}

function isDuplicateComment(data) {

    let key = getCommentDuplicateKey(data);

    let now = Date.now();

    for (let entry of recentComments.entries()) {

        if (
            now - entry[1] >
            COMMENT_DUPLICATE_WINDOW
        ) {
            recentComments.delete(entry[0]);
        }

    }

    if (recentComments.has(key)) {
        return true;
    }

    recentComments.set(key, now);

    return false;
}

/* =========================================
   視聴者
   ========================================= */

const viewerMap = new Map();

function updateViewerList() {

    let list = $('#viewerList');

    if (!list.length) {
        return;
    }

    let html = '';

    viewerMap.forEach((viewer) => {

        let nickname =
            viewer.nickname ||
            viewer.user &&
            viewer.user.nickname ||
            '';

        let uniqueId =
            viewer.uniqueId ||
            viewer.displayId ||
            viewer.user &&
            viewer.user.displayId ||
            '';

        let picture =
            viewer.profilePictureUrl ||
            viewer.avatarThumb ||
            viewer.user &&
            viewer.user.avatarThumb &&
            viewer.user.avatarThumb.urlList &&
            viewer.user.avatarThumb.urlList[0] ||
            '';

        nickname = sanitize(
            String(nickname)
        );

        uniqueId = sanitize(
            String(uniqueId)
        );

        picture = sanitize(
            String(picture)
        );

        html +=
            '<div class="viewerItem">' +
                '<img src="' +
                    picture +
                '">' +
                '<div class="viewerInfo">' +
                    '<div class="viewerNickname">' +
                        nickname +
                    '</div>' +
                    '<div class="viewerId">' +
                        (uniqueId
                            ? '@' + uniqueId
                            : '') +
                    '</div>' +
                '</div>' +
            '</div>';

    });

    list.html(html);

    $('#viewerCountText').text(
        '視聴者数: ' +
        viewerCount.toLocaleString()
    );
}

function updateViewersFromRoomUser(msg) {

    if (!msg) {
        return;
    }

    if (
        Array.isArray(msg.ranks)
    ) {

        msg.ranks.forEach((rankItem) => {

            if (!rankItem) {
                return;
            }

            let user =
                rankItem.user ||
                {};

            let id =
                user.id ||
                user.idStr;

            if (!id) {
                return;
            }

            viewerMap.set(
                String(id),
                {
                    nickname:
                        user.nickname ||
                        '',

                    uniqueId:
                        user.displayId ||
                        '',

                    displayId:
                        user.displayId ||
                        '',

                    profilePictureUrl:
                        user.avatarThumb &&
                        Array.isArray(
                            user.avatarThumb.urlList
                        )
                            ? user.avatarThumb.urlList[0]
                            : '',

                    user: user
                }
            );

        });

    }

    updateViewerList();
}

/* =========================================
   初期処理
   ========================================= */

$(document).ready(() => {

    $('#connectButton').click(connect);

    $('#uniqueIdInput').on(
        'keyup',
        function (e) {

            if (e.key === 'Enter') {
                connect();
            }

        }
    );

    $('#copyUrlButton').click(
        copyQueryUrl
    );

    $('#menuButton').click(
        openViewerMenu
    );

    $('#closeViewerMenu').click(
        closeViewerMenu
    );

    $('#viewerOverlay').click(
        closeViewerMenu
    );

    /*
     * ページを開いた時点では
     * ギフト音を有効にしない。
     */
    giftSoundReady = false;

    prepareGiftAudio();

    /*
     * ユーザー操作後に音声再生権限を
     * 取得しておく。
     */
    $(document).on(
        'click touchstart',
        unlockGiftAudio
    );

    if (window.settings.username) {
        connect();
    }

});

/* =========================================
   視聴者メニュー
   ========================================= */

function openViewerMenu() {

    $('#viewerMenu').addClass('open');
    $('#viewerOverlay').addClass('show');

}

function closeViewerMenu() {

    $('#viewerMenu').removeClass('open');
    $('#viewerOverlay').removeClass('show');

}

/* =========================================
   TikTok ID正規化
   ========================================= */

function normalizeUniqueId(value) {

    value = String(value || '').trim();

    if (!value) {
        return '';
    }

    try {

        if (
            value.startsWith('http://') ||
            value.startsWith('https://')
        ) {

            let url = new URL(value);

            let path =
                url.pathname
                    .replace(/^\/+/, '')
                    .split('/')[0];

            if (path.startsWith('@')) {
                path = path.substring(1);
            }

            return path;

        }

    } catch (e) {

        console.warn(
            'URL parse error:',
            e
        );

    }

    if (value.startsWith('@')) {
        value = value.substring(1);
    }

    return value;
}

/* =========================================
   接続
   ========================================= */

function connect() {

    let uniqueId =
        window.settings.username ||
        $('#uniqueIdInput').val();

    uniqueId =
        normalizeUniqueId(uniqueId);

    if (uniqueId !== '') {

        $('#stateText').text(
            '接続中...'
        );

        /*
         * 接続するたびに、接続直後の
         * ギフト音を無効化。
         */
        startGiftSoundCooldown();

        viewerMap.clear();

        updateViewerList();

        connection.connect(
            uniqueId,
            {
                enableExtendedGiftInfo: true
            }
        )
        .then((state) => {

            $('#stateText').text(
                'ルームID ' +
                state.roomId +
                ' に接続'
            );

            viewerCount = 0;
            likeCount = 0;
            diamondsCount = 0;

            updateRoomStats();

            /*
             * 接続成功後も一定時間は
             * ギフト音を鳴らさない。
             */
            startGiftSoundCooldown();

        })
        .catch((errorMessage) => {

            $('#stateText').text(
                String(errorMessage)
            );

            if (window.settings.username) {

                setTimeout(() => {

                    connect();

                }, 30000);

            }

        });

    } else {

        alert(
            'ユーザーIDを入力してください。'
        );

    }
}

/* =========================================
   URLコピー
   ========================================= */

function copyQueryUrl() {

    let username =
        $('#uniqueIdInput').val().trim();

    username =
        normalizeUniqueId(username);

    if (!username) {

        alert(
            'ユーザーIDを入力してください。'
        );

        return;
    }

    let url =
        new URL(
            window.location.href
        );

    url.search = '';

    url.searchParams.set(
        'username',
        username
    );

    let text = url.toString();

    if (
        navigator.clipboard &&
        navigator.clipboard.writeText
    ) {

        navigator.clipboard.writeText(text)
        .then(() => {

            alert(
                '接続用URLをコピーしました。'
            );

        })
        .catch(() => {

            fallbackCopy(text);

        });

    } else {

        fallbackCopy(text);

    }
}

function fallbackCopy(text) {

    let textarea =
        document.createElement('textarea');

    textarea.value = text;

    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';

    document.body.appendChild(
        textarea
    );

    textarea.select();

    try {

        document.execCommand('copy');

        alert(
            '接続用URLをコピーしました。'
        );

    } catch (e) {

        alert(text);

    }

    textarea.remove();
}

/* =========================================
   OBS URL
   ========================================= */

function generateOverlay() {

    let username =
        $('#uniqueIdInput').val().trim();

    username =
        normalizeUniqueId(username);

    if (!username) {

        alert(
            'ユーザーIDを入力してください。'
        );

        return;
    }

    let url =
        new URL(
            'obs.html',
            window.location.href
        );

    url.searchParams.set(
        'username',
        username
    );

    url.searchParams.set(
        'showLikes',
        '1'
    );

    url.searchParams.set(
        'showChats',
        '1'
    );

    url.searchParams.set(
        'showGifts',
        '1'
    );

    url.searchParams.set(
        'showFollows',
        '1'
    );

    url.searchParams.set(
        'showJoins',
        '1'
    );

    url.searchParams.set(
        'bgColor',
        'rgb(24,23,28)'
    );

    url.searchParams.set(
        'fontColor',
        'rgb(227,229,235)'
    );

    url.searchParams.set(
        'fontSize',
        '1.3em'
    );

    window.open(
        url.toString(),
        '_blank'
    );
}

/* =========================================
   サニタイズ
   ========================================= */

function sanitize(text) {

    if (text === null || text === undefined) {
        return '';
    }

    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

}

/* =========================================
   統計
   ========================================= */

function updateRoomStats() {

    $('#roomStats').html(
        '視聴者数: <b>' +
        viewerCount.toLocaleString() +
        '</b> ' +
        'いいね: <b>' +
        likeCount.toLocaleString() +
        '</b> ' +
        'ダイヤ: <b>' +
        diamondsCount.toLocaleString() +
        '</b>'
    );

    $('#viewerCountText').text(
        '視聴者数: ' +
        viewerCount.toLocaleString()
    );
}

/* =========================================
   ユーザー名
   ========================================= */

function generateUsernameLink(data) {

    let uniqueId =
        data.uniqueId ||
        data.user &&
        data.user.displayId ||
        '';

    uniqueId = String(uniqueId);

    return (
        '<a class="usernamelink" ' +
        'href="https://www.tiktok.com/@' +
        encodeURIComponent(uniqueId) +
        '" target="_blank">' +
        sanitize(uniqueId) +
        '</a>'
    );

}

/* =========================================
   ギフトストリーク
   ========================================= */

function isPendingStreak(data) {

    return (
        data &&
        data.giftType === 1 &&
        !data.repeatEnd
    );

}

/* =========================================
   いいね抑制
   ========================================= */

let likeMessageShown = false;

/*
 * いいね表示後、
 * 「通常コメント」が来るまで
 * 次のいいね表示を抑制する。
 */
function resetLikeSuppression() {

    likeMessageShown = false;

}

/* =========================================
   チャット追加
   ========================================= */

function addChatItem(
    color,
    data,
    text,
    summarize
) {

    let container =
        location.href.includes('obs.html')
            ? $('.eventcontainer')
            : $('.chatcontainer');

    if (
        container.find('div').length >
        500
    ) {

        container
            .find('div')
            .slice(0, 200)
            .remove();

    }

    container.find('.temporary').remove();

    let picture =
        data.profilePictureUrl ||
        '';

    let html =
        '<div class="' +
        (
            summarize
                ? 'temporary'
                : 'static'
        ) +
        '">' +

            '<img class="miniprofilepicture" ' +
            'src="' +
            sanitize(picture) +
            '">' +

            '<span>' +

                '<b>' +
                    generateUsernameLink(data) +
                    ':' +
                '</b> ' +

                '<span style="color:' +
                    sanitize(color) +
                '">' +
                    sanitize(text) +
                '</span>' +

            '</span>' +

        '</div>';

    container.append(html);

    container.stop();

    container.animate(
        {
            scrollTop:
                container[0].scrollHeight
        },
        400
    );

}

/* =========================================
   ギフト追加
   ========================================= */

function addGiftItem(data) {

    let container =
        location.href.includes('obs.html')
            ? $('.eventcontainer')
            : $('.giftcontainer');

    if (
        container.find('div').length >
        200
    ) {

        container
            .find('div')
            .slice(0, 100)
            .remove();

    }

    let streakId =
        String(data.userId || '') +
        '_' +
        String(data.giftId || '');

    let repeatCount =
        Number(data.repeatCount || 0);

    let diamondCount =
        Number(data.diamondCount || 0);

    let totalCost =
        diamondCount *
        repeatCount;

    let giftName =
        data.giftName ||
        '';

    let giftPicture =
        data.giftPictureUrl ||
        '';

    let description =
        data.describe ||
        '';

    /*
     * Sent xxx を
     * xxxを送信 に変換。
     */
    description =
        String(description)
            .replace(
                /^Sent\s+/i,
                ''
            );

    if (
        description &&
        !description.endsWith('を送信')
    ) {
        description += 'を送信';
    }

    let now =
        new Date();

    let time =
        String(now.getHours())
            .padStart(2, '0') +
        ':' +
        String(now.getMinutes())
            .padStart(2, '0') +
        ':' +
        String(now.getSeconds())
            .padStart(2, '0');

    let html =
        '<div data-streakid="' +
        (
            isPendingStreak(data)
                ? sanitize(streakId)
                : ''
        ) +
        '">' +

            '<div style="display:flex;align-items:flex-start;gap:6px;">' +

                '<img class="miniprofilepicture" ' +
                'src="' +
                sanitize(
                    data.profilePictureUrl ||
                    ''
                ) +
                '">' +

                '<span style="min-width:0;">' +

                    '<b>' +
                        generateUsernameLink(data) +
                    '</b> ' +

                    '<span>' +
                        sanitize(description) +
                    '</span>' +

                    '<span class="giftTime">' +
                        sanitize(time) +
                    '</span>' +

                    '<br>' +

                    '<div>' +

                        '<table>' +

                            '<tr>' +

                                '<td>' +

                                    '<img ' +
                                    'class="gifticon" ' +
                                    'src="' +
                                    sanitize(
                                        giftPicture
                                    ) +
                                    '">' +

                                '</td>' +

                                '<td>' +

                                    '<span class="giftTitle">' +
                                        '名前: <b>' +
                                        sanitize(giftName) +
                                        '</b> ' +
                                        '(ID:' +
                                        sanitize(
                                            String(
                                                data.giftId || ''
                                            )
                                        ) +
                                        ')' +
                                    '</span>' +

                                    '<br>' +

                                    '<span class="giftDetail">' +
                                        '個数: ' +

                                        '<b style="' +
                                        (
                                            isPendingStreak(data)
                                                ? 'color:red'
                                                : ''
                                        ) +
                                        '">' +

                                            'x' +
                                            repeatCount.toLocaleString() +

                                        '</b>' +

                                    '</span>' +

                                    '<br>' +

                                    '<span class="giftDetail">' +
                                        'コスト: <b>' +
                                        totalCost.toLocaleString() +
                                        ' Diamonds</b>' +
                                    '</span>' +

                                '</td>' +

                            '</tr>' +

                        '</table>' +

                    '</div>' +

                '</span>' +

            '</div>' +

        '</div>';

    let existingStreakItem =
        container.find(
            "[data-streakid='" +
            streakId +
            "']"
        );

    if (
        existingStreakItem.length
    ) {

        existingStreakItem.replaceWith(
            html
        );

    } else {

        container.append(html);

    }

    /*
     * 新しいギフトが来たら最新位置へ。
     * ギフト欄自体は独立してスクロール可能。
     */
    container.stop();

    container.animate(
        {
            scrollTop:
                container[0].scrollHeight
        },
        400
    );

}

/* =========================================
   視聴者数
   ========================================= */

connection.on(
    'roomUser',
    (msg) => {

        if (
            msg &&
            typeof msg.viewerCount === 'number'
        ) {

            viewerCount =
                msg.viewerCount;

            updateRoomStats();

        }

        updateViewersFromRoomUser(
            msg
        );

    }
);

/* =========================================
   入室
   ========================================= */

let joinMsgDelay = 0;

connection.on(
    'member',
    (msg) => {

        if (
            window.settings.showJoins ===
            "0"
        ) {
            return;
        }

        let addDelay = 250;

        if (
            joinMsgDelay > 500
        ) {
            addDelay = 100;
        }

        if (
            joinMsgDelay > 1000
        ) {
            addDelay = 0;
        }

        joinMsgDelay += addDelay;

        setTimeout(() => {

            joinMsgDelay -= addDelay;

            addChatItem(
                '#21b2c2',
                msg,
                '参加しました',
                true
            );

        }, joinMsgDelay);

    }
);

/* =========================================
   コメント
   ========================================= */

connection.on(
    'chat',
    (msg) => {

        if (
            window.settings.showChats ===
            "0"
        ) {
            return;
        }

        /*
         * common.msgIdを利用した重複防止。
         */
        if (
            isDuplicateComment(msg)
        ) {
            return;
        }

        /*
         * 通常コメントだけが
         * いいね抑制を解除する。
         */
        resetLikeSuppression();

        addChatItem(
            '',
            msg,
            msg.comment || ''
        );

    }
);

/* =========================================
   ギフト
   ========================================= */

connection.on(
    'gift',
    (data) => {

        if (
            !isPendingStreak(data) &&
            Number(data.diamondCount || 0) > 0
        ) {

            diamondsCount +=
                Number(
                    data.diamondCount || 0
                ) *
                Number(
                    data.repeatCount || 0
                );

            updateRoomStats();

        }

        if (
            window.settings.showGifts ===
            "0"
        ) {
            return;
        }

        addGiftItem(data);

        /*
         * 接続直後のギフトでは鳴らさない。
         * cooldown終了後のギフトだけ鳴らす。
         */
        playGiftSound();

    }
);

/* =========================================
   フォロー・シェア
   ========================================= */

connection.on(
    'social',
    (data) => {

        if (
            window.settings.showFollows ===
            "0"
        ) {
            return;
        }

        let displayType =
            data.displayType || '';

        let color =
            displayType.includes('follow')
                ? '#ff005e'
                : '#2fb816';

        let label =
            data.label || '';

        label =
            label.replace(
                '{0:user}',
                ''
            );

        addChatItem(
            color,
            data,
            label
        );

    }
);

/* =========================================
   いいね
   ========================================= */

connection.on(
    'like',
    (data) => {

        if (
            window.settings.showLikes ===
            "0"
        ) {
            return;
        }

        let count =
            Number(
                data.likeCount ||
                data.count ||
                data.totalLikeCount ||
                1
            );

        if (
            Number.isFinite(count)
        ) {

            likeCount += count;

        } else {

            likeCount += 1;

        }

        updateRoomStats();

        /*
         * 最初のいいね表示後、
         * 通常コメントが来るまでは
         * 連続したいいね表示を抑制。
         */
        if (likeMessageShown) {
            return;
        }

        likeMessageShown = true;

        addChatItem(
            '#ff5ca8',
            data,
            'ライブにいいねされました'
        );

    }
);

/* =========================================
   配信終了
   ========================================= */

connection.on(
    'streamEnd',
    () => {

        $('#stateText').text(
            '配信は終了しました。'
        );

        if (
            window.settings.username
        ) {

            setTimeout(() => {

                connect();

            }, 30000);

        }

    }
);