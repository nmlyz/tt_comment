let backendUrl = "https://sacrifice-nico.com";

let connection = new TikTokIOConnection(
    backendUrl
);

let viewerCount = 0;
let likeCount = 0;
let diamondsCount = 0;

if (!window.settings) {
    window.settings = {};
}


/* =========================================================
   ギフト音
   ========================================================= */

let giftAudio = null;

/*
 * 接続直後にサーバーから送られてくる過去ギフトを
 * 「新規ギフト」として扱わないためのフラグ。
 *
 * tiktokConnected 後、少しの間に届く gift は
 * 画面には表示するが音は鳴らさない。
 */
let giftSoundReady = false;

let giftSoundUnlockReady = false;

function prepareGiftAudio() {

    if (giftAudio) {
        return;
    }

    giftAudio = new Audio(
        new URL(
            'gift.mp3',
            window.location.href
        ).href
    );

    giftAudio.preload = 'auto';

    giftAudio.volume = 1.0;
}

function unlockGiftAudio() {

    prepareGiftAudio();

    if (
        !giftAudio ||
        giftSoundUnlockReady
    ) {
        return;
    }

    giftSoundUnlockReady = true;

    /*
     * iOS / Safari の自動再生制限解除用。
     * 実際のギフト音量には影響させない。
     */
    try {

        const oldVolume = giftAudio.volume;

        giftAudio.volume = 0;

        const p = giftAudio.play();

        if (p && typeof p.catch === 'function') {

            p.catch(() => {});

        }

        setTimeout(() => {

            try {
                giftAudio.pause();
                giftAudio.currentTime = 0;
                giftAudio.volume = oldVolume;
            } catch (e) {}

        }, 50);

    } catch (e) {}
}

function playGiftSound() {

    /*
     * 接続直後の過去ギフトでは鳴らさない。
     */
    if (!giftSoundReady) {
        return;
    }

    prepareGiftAudio();

    if (!giftAudio) {
        return;
    }

    try {

        giftAudio.pause();

        giftAudio.currentTime = 0;

        const p = giftAudio.play();

        if (
            p &&
            typeof p.catch === 'function'
        ) {
            p.catch(() => {});
        }

    } catch (e) {

        console.warn(
            'Gift sound error:',
            e
        );
    }
}


/* =========================================================
   初期化
   ========================================================= */

$(document).ready(() => {

    $('#connectButton').click(() => {

        unlockGiftAudio();

        connect();
    });

    $('#uniqueIdInput').on(
        'keyup',
        function (e) {

            if (e.key === 'Enter') {

                unlockGiftAudio();

                connect();
            }
        }
    );

    $('#copyUrlButton').click(() => {

        copyQueryUrl();
    });

    $('#viewerMenuButton').click(() => {

        openViewerMenu();
    });

    $('#viewerMenuClose').click(() => {

        closeViewerMenu();
    });

    $('#viewerOverlay').click(() => {

        closeViewerMenu();
    });

    /*
     * ページをタップした際にも音声再生権限を
     * 取得できるようにする。
     */
    $(document).on(
        'click touchend',
        function () {

            if (!giftSoundUnlockReady) {
                unlockGiftAudio();
            }
        }
    );

    if (window.settings.username) {

        connect();
    }
});


/* =========================================================
   ユーザーID / URL
   ========================================================= */

function normalizeUniqueId(value) {

    if (!value) {
        return '';
    }

    value = String(value).trim();

    if (!value) {
        return '';
    }

    /*
     * TikTok URL が入力された場合
     */
    try {

        if (
            value.startsWith('http://') ||
            value.startsWith('https://')
        ) {

            const url = new URL(value);

            const parts = url.pathname
                .split('/')
                .filter(Boolean);

            if (parts.length > 0) {

                let id = parts[0];

                if (id.startsWith('@')) {
                    id = id.substring(1);
                }

                return id;
            }
        }

    } catch (e) {}

    if (value.startsWith('@')) {
        value = value.substring(1);
    }

    return value;
}


/* =========================================================
   接続
   ========================================================= */

function connect() {

    let uniqueId =
        window.settings.username ||
        $('#uniqueIdInput').val();

    uniqueId = normalizeUniqueId(uniqueId);

    if (uniqueId !== '') {

        $('#stateText').text(
            '接続中...'
        );

        /*
         * 新しい接続を開始した時点では、
         * まだ過去ギフト扱い。
         */
        giftSoundReady = false;

        connection.connect(
            uniqueId,
            {
                enableExtendedGiftInfo: true
            }
        ).then(state => {

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
             * tiktokConnected 直後に届く gift は
             * まだ過去データの可能性がある。
             *
             * 少し待ってから新着ギフト音を有効化。
             */
            setTimeout(() => {

                giftSoundReady = true;

                console.info(
                    'Gift sound enabled.'
                );

            }, 1500);

        }).catch(errorMessage => {

            $('#stateText').text(
                errorMessage
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


/* =========================================================
   URLコピー
   ========================================================= */

function copyQueryUrl() {

    let username =
        normalizeUniqueId(
            $('#uniqueIdInput').val()
        );

    if (!username) {

        alert(
            'ユーザーIDを入力してください。'
        );

        return;
    }

    const url = new URL(
        window.location.href
    );

    url.search = '';

    url.searchParams.set(
        'username',
        username
    );

    const text = url.toString();

    if (
        navigator.clipboard &&
        navigator.clipboard.writeText
    ) {

        navigator.clipboard.writeText(text)
            .then(() => {

                alert(
                    'URLをコピーしました。'
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

    const textarea =
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
            'URLをコピーしました。'
        );

    } catch (e) {

        alert(
            'コピーできませんでした。\n\n' +
            text
        );
    }

    document.body.removeChild(
        textarea
    );
}


/* =========================================================
   OBS URL
   ========================================================= */

function generateOverlay() {

    let username =
        normalizeUniqueId(
            $('#uniqueIdInput').val()
        );

    if (!username) {

        alert(
            'ユーザーIDを入力してください。'
        );

        return;
    }

    const url = new URL(
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


/* =========================================================
   サニタイズ
   ========================================================= */

function sanitize(text) {

    if (text === undefined || text === null) {
        return '';
    }

    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


/* =========================================================
   ルーム情報
   ========================================================= */

function updateRoomStats() {

    $('#roomStats').html(
        '視聴者: <b>' +
        viewerCount.toLocaleString() +
        '</b> ' +
        'いいね: <b>' +
        likeCount.toLocaleString() +
        '</b> ' +
        'ダイヤ: <b>' +
        diamondsCount.toLocaleString() +
        '</b>'
    );
}


/* =========================================================
   ユーザー名リンク
   ========================================================= */

function generateUsernameLink(data) {

    const uniqueId =
        data.uniqueId ||
        (
            data.user &&
            data.user.displayId
        ) ||
        '';

    const safeId =
        sanitize(uniqueId);

    return (
        '<a class="usernamelink" ' +
        'href="https://www.tiktok.com/@' +
        encodeURIComponent(uniqueId) +
        '" target="_blank">' +
        safeId +
        '</a>'
    );
}


/* =========================================================
   ギフト連続判定
   ========================================================= */

function isPendingStreak(data) {

    return (
        data &&
        data.giftType === 1 &&
        !data.repeatEnd
    );
}


/* =========================================================
   チャット重複防止
   ========================================================= */

const recentComments = new Map();

const COMMENT_DUPLICATE_WINDOW = 3000;

function getCommentDuplicateKey(data) {

    if (
        data &&
        data.common &&
        data.common.msgId
    ) {

        return 'msg:' +
            String(data.common.msgId);
    }

    if (
        data &&
        data.msgId
    ) {

        return 'msg:' +
            String(data.msgId);
    }

    const userId =
        data &&
        data.userId
            ? String(data.userId)
            : '';

    const comment =
        data &&
        data.comment
            ? String(data.comment)
            : '';

    if (userId || comment) {

        return (
            'fallback:' +
            userId +
            '|' +
            comment
        );
    }

    return '';
}

function isDuplicateComment(data) {

    const key =
        getCommentDuplicateKey(data);

    if (!key) {
        return false;
    }

    const now = Date.now();

    for (
        const [oldKey, timestamp]
        of recentComments
    ) {

        if (
            now - timestamp >
            COMMENT_DUPLICATE_WINDOW
        ) {

            recentComments.delete(
                oldKey
            );
        }
    }

    if (
        recentComments.has(key)
    ) {

        return true;
    }

    recentComments.set(
        key,
        now
    );

    return false;
}


/* =========================================================
   チャット表示
   ========================================================= */

function addChatItem(
    color,
    data,
    text,
    summarize
) {

    const container =
        location.href.includes('obs.html')
            ? $('.eventcontainer')
            : $('.chatcontainer');

    if (
        container.find('div').length >
        500
    ) {

        container.find('div')
            .slice(0, 200)
            .remove();
    }

    container
        .find('.temporary')
        .remove();

    const safeText =
        sanitize(text);

    container.append(
        '<div class="' +
        (
            summarize
                ? 'temporary'
                : 'static'
        ) +
        '">' +

        '<img class="miniprofilepicture" ' +
        'src="' +
        sanitize(
            data.profilePictureUrl ||
            ''
        ) +
        '">' +

        '<span>' +

        '<b>' +
        generateUsernameLink(data) +
        ':</b> ' +

        '<span style="color:' +
        sanitize(color || '') +
        '">' +
        safeText +
        '</span>' +

        '</span>' +

        '</div>'
    );

    container.stop();

    container.animate(
        {
            scrollTop:
                container[0].scrollHeight
        },
        400
    );
}


/* =========================================================
   ギフト表示
   ========================================================= */

function getGiftTime(data) {

    let timestamp = null;

    if (
        data &&
        data.common &&
        data.common.createTime
    ) {

        timestamp = Number(
            data.common.createTime
        );
    }

    if (!timestamp) {

        timestamp = Date.now();
    }

    /*
     * createTime が秒の場合への対応
     */
    if (timestamp < 100000000000) {
        timestamp *= 1000;
    }

    const date =
        new Date(timestamp);

    const hh = String(
        date.getHours()
    ).padStart(2, '0');

    const mm = String(
        date.getMinutes()
    ).padStart(2, '0');

    const ss = String(
        date.getSeconds()
    ).padStart(2, '0');

    return (
        hh +
        ':' +
        mm +
        ':' +
        ss
    );
}

function getGiftDescription(data) {

    let describe =
        data.describe ||
        '';

    describe = String(
        describe
    );

    describe = describe
        .replace(/^Sent\s+/i, '')
        .trim();

    if (!describe) {

        describe =
            data.giftName ||
            'ギフト';
    }

    return describe;
}

function addGiftItem(data) {

    const container =
        location.href.includes('obs.html')
            ? $('.eventcontainer')
            : $('.giftcontainer');

    if (
        container.find('div').length >
        200
    ) {

        container.find('div')
            .slice(0, 100)
            .remove();
    }

    const userId =
        data.userId ||
        (
            data.user &&
            data.user.id
        ) ||
        '';

    const giftId =
        data.giftId ||
        '';

    const streakId =
        String(userId) +
        '_' +
        String(giftId);

    const pending =
        isPendingStreak(data);

    const repeatCount =
        Number(data.repeatCount || 1);

    const diamondCount =
        Number(data.diamondCount || 0);

    const totalCost =
        diamondCount *
        repeatCount;

    const giftName =
        sanitize(
            data.giftName ||
            '不明なギフト'
        );

    const giftImage =
        sanitize(
            data.giftPictureUrl ||
            ''
        );

    const profileImage =
        sanitize(
            data.profilePictureUrl ||
            ''
        );

    const time =
        getGiftTime(data);

    const describe =
        sanitize(
            getGiftDescription(data)
        );

    const html =
        '<div data-streakid="' +
        (
            pending
                ? sanitize(streakId)
                : ''
        ) +
        '">' +

        '<div style="' +
        'display:flex;' +
        'align-items:flex-start;' +
        'gap:6px;' +
        '">' +

        '<img class="miniprofilepicture" ' +
        'src="' +
        profileImage +
        '">' +

        '<div style="' +
        'min-width:0;' +
        'flex:1;' +
        '">' +

        '<div>' +
        '<b>' +
        generateUsernameLink(data) +
        ':</b> ' +
        describe +
        '</div>' +

        '<div style="' +
        'display:flex;' +
        'align-items:center;' +
        'gap:6px;' +
        'margin-top:3px;' +
        '">' +

        '<img class="gifticon" ' +
        'src="' +
        giftImage +
        '">' +

        '<div style="' +
        'min-width:0;' +
        'flex:1;' +
        '">' +

        '<div class="giftTitle">' +
        '名前: <b>' +
        giftName +
        '</b> ' +
        '(ID:' +
        sanitize(giftId) +
        ')' +
        '</div>' +

        '<div class="giftDetail">' +
        '個数: <b style="' +
        (
            pending
                ? 'color:red;'
                : ''
        ) +
        '">x' +
        repeatCount.toLocaleString() +
        '</b>' +
        '</div>' +

        '<div class="giftDetail">' +
        'コスト: <b>' +
        totalCost.toLocaleString() +
        ' Diamonds</b>' +
        '</div>' +

        '</div>' +

        '</div>' +

        '<div class="giftTime">' +
        time +
        '</div>' +

        '</div>' +

        '</div>' +

        '</div>';

    const existingStreakItem =
        container.find(
            '[data-streakid="' +
            CSS.escape(streakId) +
            '"]'
        );

    if (
        existingStreakItem.length
    ) {

        existingStreakItem.replaceWith(
            html
        );

    } else {

        container.append(
            html
        );
    }

    /*
     * ギフト欄の最後まで自動スクロール。
     * 欄そのものは独立してスクロール可能。
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


/* =========================================================
   視聴者リスト
   ========================================================= */

const viewerMap = new Map();

function updateViewerList() {

    const list =
        $('#viewerList');

    if (!list.length) {
        return;
    }

    list.empty();

    const viewers =
        Array.from(
            viewerMap.values()
        );

    viewers.forEach(viewer => {

        const user =
            viewer.user ||
            viewer;

        const id =
            user.id ||
            user.idStr ||
            '';

        const nickname =
            user.nickname ||
            '';

        const displayId =
            user.displayId ||
            '';

        let avatar = '';

        if (
            user.avatarThumb &&
            Array.isArray(
                user.avatarThumb.urlList
            ) &&
            user.avatarThumb.urlList.length
        ) {

            avatar =
                user.avatarThumb.urlList[0];
        }

        if (!avatar) {

            avatar =
                viewer.profilePictureUrl ||
                '';
        }

        list.append(
            '<div class="viewerItem">' +

            '<img class="viewerItemPicture" ' +
            'src="' +
            sanitize(avatar) +
            '">' +

            '<div class="viewerItemText">' +

            '<div class="viewerItemName">' +
            sanitize(nickname) +
            '</div>' +

            '<div class="viewerItemId">' +
            sanitize(
                displayId
                    ? '@' + displayId
                    : ''
            ) +
            '</div>' +

            '</div>' +

            '</div>'
        );
    });

    $('#viewerCountText').text(
        '視聴者 ' +
        viewerCount.toLocaleString() +
        '人'
    );
}

function updateViewersFromRoomUser(msg) {

    if (!msg) {
        return;
    }

    if (
        typeof msg.viewerCount ===
        'number'
    ) {

        viewerCount =
            msg.viewerCount;

        updateRoomStats();
    }

    /*
     * roomUser の ranks に入っている
     * ユーザー情報を視聴者リストへ反映。
     */
    if (
        Array.isArray(msg.ranks)
    ) {

        msg.ranks.forEach(rankItem => {

            const user =
                rankItem &&
                rankItem.user;

            if (!user) {
                return;
            }

            const id =
                user.id ||
                user.idStr ||
                user.displayId;

            if (!id) {
                return;
            }

            viewerMap.set(
                String(id),
                {
                    user: user,
                    rank: rankItem.rank,
                    score: rankItem.score
                }
            );
        });
    }

    updateViewerList();
}


/* =========================================================
   視聴者メニュー
   ========================================================= */

function openViewerMenu() {

    $('#viewerMenu')
        .addClass('open');

    $('#viewerOverlay')
        .addClass('open');
}

function closeViewerMenu() {

    $('#viewerMenu')
        .removeClass('open');

    $('#viewerOverlay')
        .removeClass('open');
}


/* =========================================================
   roomUser
   ========================================================= */

connection.on(
    'roomUser',
    (msg) => {

        updateViewersFromRoomUser(
            msg
        );
    }
);


/* =========================================================
   参加メッセージ
   ========================================================= */

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

        if (joinMsgDelay > 500) {
            addDelay = 100;
        }

        if (joinMsgDelay > 1000) {
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


/* =========================================================
   いいね抑制
   ========================================================= */

let likeMessageShown = false;

function resetLikeSuppression() {

    likeMessageShown = false;
}


/* =========================================================
   チャット
   ========================================================= */

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
         * 同じコメントを二重表示しない
         */
        if (
            isDuplicateComment(msg)
        ) {

            return;
        }

        const comment =
            msg.comment ||
            msg.content ||
            '';

        /*
         * 本物の通常コメントだけが
         * いいね抑制を解除する。
         */
        resetLikeSuppression();

        addChatItem(
            '',
            msg,
            comment
        );
    }
);


/* =========================================================
   ギフト
   ========================================================= */

connection.on(
    'gift',
    (data) => {

        if (
            !data
        ) {
            return;
        }

        if (
            !isPendingStreak(data) &&
            Number(data.diamondCount || 0) > 0
        ) {

            diamondsCount +=
                Number(
                    data.diamondCount || 0
                ) *
                Number(
                    data.repeatCount || 1
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
         * 接続直後に取得された過去ギフトは
         * addGiftItem() で表示するだけ。
         *
         * giftSoundReady が true になってから
         * 新しく届いたギフトだけ鳴らす。
         */
        playGiftSound();
    }
);


/* =========================================================
   フォロー / ソーシャル
   ========================================================= */

connection.on(
    'social',
    (data) => {

        if (
            window.settings.showFollows ===
            "0"
        ) {
            return;
        }

        const displayType =
            data.displayType ||
            '';

        const color =
            displayType.includes('follow')
                ? '#ff005e'
                : '#2fb816';

        let label =
            data.label ||
            '';

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


/* =========================================================
   いいね
   ========================================================= */

connection.on(
    'like',
    (data) => {

        if (
            window.settings.showLikes ===
            "0"
        ) {
            return;
        }

        likeCount += Number(
            data.likeCount ||
            data.count ||
            1
        );

        updateRoomStats();

        /*
         * 通常コメントが来るまで、
         * 連続した「いいね」を
         * 何度も表示しない。
         *
         * member / social は
         * リセットしない。
         */
        if (likeMessageShown) {
            return;
        }

        likeMessageShown = true;

        addChatItem(
            '#ff005e',
            data,
            'ライブにいいねされました'
        );
    }
);


/* =========================================================
   配信終了
   ========================================================= */

connection.on(
    'streamEnd',
    () => {

        $('#stateText').text(
            '配信は終了しました。'
        );

        giftSoundReady = false;

        if (window.settings.username) {

            setTimeout(() => {

                connect();

            }, 30000);
        }
    }
);