let backendUrl =
    location.protocol === 'file:'
        ? 'https://tiktok-chat-reader.zerody.one/'
        : 'https://sacrifice-nico.com';

let connection =
    new TikTokIOConnection(backendUrl);

let viewerCount = 0;
let likeCount = 0;
let diamondsCount = 0;

let currentViewers = [];

let recentComments = [];

const COMMENT_DUPLICATE_WINDOW = 3000;

let likeMessageDisplayed = false;

/*
 * roomUser.ranks が同じ視聴者だけを
 * 繰り返し送ってくる場合でも、
 * 以前取得した視聴者を保持する。
 */
let viewerMap = new Map();

if (!window.settings) {
    window.settings = {};
}


/* =========================================================
   URL設定
========================================================= */

function loadUrlSettings() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    const username =
        params.get('username');

    if (username) {
        window.settings.username =
            username;
    }

    const settingNames = [
        'showLikes',
        'showChats',
        'showGifts',
        'showFollows',
        'showJoins'
    ];

    settingNames.forEach((name) => {

        const value =
            params.get(name);

        if (value !== null) {
            window.settings[name] =
                value;
        }
    });
}


/* =========================================================
   ユーザーID処理
========================================================= */

function normalizeUniqueId(value) {

    let text =
        String(value || '').trim();

    if (!text) {
        return '';
    }

    if (text.startsWith('@')) {
        text = text.substring(1);
    }

    try {

        if (
            text.includes('tiktok.com')
        ) {

            const parsed =
                new URL(text);

            const parts =
                parsed.pathname
                    .split('/')
                    .filter(Boolean);

            if (
                parts.length > 0 &&
                parts[0].startsWith('@')
            ) {
                return parts[0].substring(1);
            }
        }

    } catch (error) {

        console.warn(
            'URL parse error:',
            error
        );
    }

    return text;
}


/* =========================================================
   初期化
========================================================= */

$(document).ready(() => {

    loadUrlSettings();

    $('#connectButton').click(() => {

        unlockGiftAudio();

        connect();
    });

    $('#copyQueryButton').click(
        copyQueryLink
    );

    $('#uniqueIdInput').on(
        'keyup',
        function (event) {

            if (event.key === 'Enter') {

                unlockGiftAudio();

                connect();
            }
        }
    );

    $('#uniqueIdInput').on(
        'focus',
        function () {

            unlockGiftAudio();
        }
    );

    $('#viewerMenuButton').click(
        openViewerMenu
    );

    $('#viewerMenuClose').click(
        closeViewerMenu
    );

    $('#viewerMenuOverlay').click(
        closeViewerMenu
    );

    if (window.settings.username) {

        $('#uniqueIdInput').val(
            normalizeUniqueId(
                window.settings.username
            )
        );

        connect();
    }
});


/* =========================================================
   接続
========================================================= */

function connect() {

    let uniqueId =
        window.settings.username ||
        $('#uniqueIdInput').val();

    uniqueId =
        normalizeUniqueId(uniqueId);

    if (uniqueId !== '') {

        $('#stateText').text(
            'Connecting...'
        );

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

            currentViewers = [];

            viewerMap.clear();

            likeMessageDisplayed = false;

            updateRoomStats();
            updateViewerMenu();

        })
        .catch((errorMessage) => {

            $('#stateText').text(
                errorMessage
            );

            if (
                window.settings.username
            ) {

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
   クエリURLコピー
========================================================= */

function copyQueryLink() {

    const username =
        normalizeUniqueId(
            $('#uniqueIdInput').val()
        );

    if (!username) {

        alert(
            'ユーザーIDを入力してください。'
        );

        return;
    }

    const url =
        new URL(
            'index.html',
            window.location.href
        );

    url.search = '';

    url.searchParams.set(
        'username',
        username
    );

    const text =
        url.toString();

    if (
        navigator.clipboard &&
        navigator.clipboard.writeText
    ) {

        navigator.clipboard.writeText(text)
            .then(() => {

                alert(
                    'クエリURLをコピーしました。'
                );

            })
            .catch(() => {

                fallbackCopyText(text);
            });

    } else {

        fallbackCopyText(text);
    }
}


function fallbackCopyText(text) {

    const textarea =
        document.createElement('textarea');

    textarea.value = text;

    textarea.style.position =
        'fixed';

    textarea.style.left =
        '-9999px';

    document.body.appendChild(
        textarea
    );

    textarea.focus();
    textarea.select();

    try {

        document.execCommand(
            'copy'
        );

        alert(
            'クエリURLをコピーしました。'
        );

    } catch (error) {

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
   OBSオーバーレイ
========================================================= */

function generateOverlay() {

    const username =
        normalizeUniqueId(
            $('#uniqueIdInput').val()
        );

    if (!username) {

        alert(
            'ユーザーIDを入力してください。'
        );

        return;
    }

    const url =
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


/* =========================================================
   HTMLエスケープ
========================================================= */

function sanitize(text) {

    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


/* =========================================================
   ルーム統計
========================================================= */

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
}


/* =========================================================
   ユーザー名
========================================================= */

function getDisplayName(data) {

    if (
        data &&
        data.nickname
    ) {
        return data.nickname;
    }

    if (
        data &&
        data.user &&
        data.user.nickname
    ) {
        return data.user.nickname;
    }

    if (
        data &&
        data.uniqueId
    ) {
        return data.uniqueId;
    }

    if (
        data &&
        data.user &&
        data.user.displayId
    ) {
        return data.user.displayId;
    }

    return 'Unknown';
}


function getUniqueId(data) {

    if (
        data &&
        data.uniqueId
    ) {
        return data.uniqueId;
    }

    if (
        data &&
        data.user &&
        data.user.displayId
    ) {
        return data.user.displayId;
    }

    return '';
}


function generateUsernameLink(data) {

    const uniqueId =
        getUniqueId(data);

    const safeUniqueId =
        sanitize(uniqueId);

    if (!uniqueId) {
        return safeUniqueId;
    }

    return (
        '<a class="usernamelink" ' +
        'href="https://www.tiktok.com/@' +
        encodeURIComponent(uniqueId) +
        '" target="_blank">' +
        safeUniqueId +
        '</a>'
    );
}


/* =========================================================
   ギフト
========================================================= */

function isPendingStreak(data) {

    return (
        data &&
        data.giftType === 1 &&
        !data.repeatEnd
    );
}


function translateSentText(text) {

    const value =
        String(text || '');

    return value.replace(
        /^Sent\s+(.+)$/i,
        '$1を送信'
    );
}


/* =========================================================
   チャット重複判定
========================================================= */

function getCommentDuplicateKey(data) {

    if (
        data &&
        data.common &&
        data.common.msgId
    ) {
        return String(
            data.common.msgId
        );
    }

    if (
        data &&
        data.msgId
    ) {
        return String(
            data.msgId
        );
    }

    if (
        data &&
        data.common &&
        data.common.logId
    ) {
        return String(
            data.common.logId
        );
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

    return (
        userId +
        '|' +
        comment
    );
}


function isDuplicateComment(data) {

    const key =
        getCommentDuplicateKey(data);

    const now =
        Date.now();

    recentComments =
        recentComments.filter(
            (item) => {

                return (
                    now - item.time <
                    COMMENT_DUPLICATE_WINDOW
                );
            }
        );

    const exists =
        recentComments.some(
            (item) => {

                return item.key === key;
            }
        );

    if (exists) {
        return true;
    }

    recentComments.push({
        key: key,
        time: now
    });

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

    let container =
        location.href.includes(
            'obs.html'
        )
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

    container
        .find('.temporary')
        .remove();

    const profilePicture =
        data.profilePictureUrl ||
        (
            data.user &&
            data.user.avatarThumb &&
            data.user.avatarThumb.urlList &&
            data.user.avatarThumb.urlList[0]
        ) ||
        '';

    const html =
        '<div class="' +
        (
            summarize
                ? 'temporary'
                : 'static'
        ) +
        '">' +

        '<img class="miniprofilepicture" ' +
        'src="' +
        sanitize(profilePicture) +
        '">' +

        '<span>' +

        '<b>' +
        generateUsernameLink(data) +
        ':</b> ' +

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


/* =========================================================
   ギフト表示
========================================================= */

function addGiftItem(data) {

    let container =
        location.href.includes(
            'obs.html'
        )
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

    const userId =
        data.userId ||
        (
            data.user &&
            data.user.id
        ) ||
        '';

    const giftId =
        data.giftId || '';

    const streakId =
        String(userId) +
        '_' +
        String(giftId);

    const pending =
        isPendingStreak(data);

    const giftTime =
        new Date().toLocaleTimeString(
            'ja-JP',
            {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }
        );

    const giftName =
        data.giftName ||
        'ギフト';

    const giftPictureUrl =
        data.giftPictureUrl ||
        '';

    const repeatCount =
        Number(data.repeatCount) ||
        0;

    const diamondCount =
        Number(data.diamondCount) ||
        0;

    const totalCost =
        diamondCount *
        repeatCount;

    const describe =
        translateSentText(
            data.describe || ''
        );

    const html =
        '<div data-streakid="' +
        (
            pending
                ? sanitize(streakId)
                : ''
        ) +
        '">' +

        '<img class="miniprofilepicture" ' +
        'src="' +
        sanitize(
            data.profilePictureUrl || ''
        ) +
        '">' +

        '<span>' +

        '<b>' +
        generateUsernameLink(data) +
        ':</b> ' +

        sanitize(describe) +

        '<br>' +

        '<span>' +
        giftTime +
        '</span>' +

        '<br>' +

        '<div>' +

        '<table>' +

        '<tr>' +

        '<td>' +

        '<img class="gifticon" ' +
        'src="' +
        sanitize(giftPictureUrl) +
        '">' +

        '</td>' +

        '<td>' +

        '<span>' +
        'ギフト: <b>' +
        sanitize(giftName) +
        '</b>' +
        '</span>' +

        '<br>' +

        '<span>' +
        'ギフトID: <b>' +
        sanitize(giftId) +
        '</b>' +
        '</span>' +

        '<br>' +

        '<span>' +
        '個数: <b style="' +
        (
            pending
                ? 'color:red'
                : ''
        ) +
        '">x' +
        repeatCount.toLocaleString() +
        '</b>' +
        '</span>' +

        '<br>' +

        '<span>' +
        'コスト: <b>' +
        totalCost.toLocaleString() +
        ' Diamonds' +
        '</b>' +
        '</span>' +

        '</td>' +

        '</tr>' +

        '</table>' +

        '</div>' +

        '</span>' +

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

        container.append(html);
    }

    container.stop();

    container.animate(
        {
            scrollTop:
                container[0].scrollHeight
        },
        800
    );
}


/* =========================================================
   ギフト音声
========================================================= */

let giftAudio = null;
let giftAudioUnlocked = false;


function prepareGiftAudio() {

    if (giftAudio) {
        return;
    }

    giftAudio =
        new Audio('./gift.mp3');

    giftAudio.preload =
        'auto';

    giftAudio.volume =
        1.0;
}


/*
 * iPhone / iPadのブラウザでは、
 * ユーザー操作なしで作ったAudioは
 * 後からplay()できない場合がある。
 *
 * そこで接続ボタン・入力欄などの
 * ユーザー操作時に一度だけ
 * ミュート状態で再生して停止し、
 * 音声をアンロックする。
 *
 * ここでは音を出さない。
 */
function unlockGiftAudio() {

    if (giftAudioUnlocked) {
        return;
    }

    prepareGiftAudio();

    if (!giftAudio) {
        return;
    }

    try {

        giftAudio.muted = true;

        const promise =
            giftAudio.play();

        if (
            promise &&
            typeof promise.then ===
                'function'
        {

            promise.then(() => {

                giftAudio.pause();

                giftAudio.currentTime =
                    0;

                giftAudio.muted =
                    false;

                giftAudioUnlocked =
                    true;

            }).catch(() => {

                giftAudio.muted =
                    false;
            });

        } else {

            giftAudio.pause();

            giftAudio.currentTime =
                0;

            giftAudio.muted =
                false;

            giftAudioUnlocked =
                true;
        }

    } catch (error) {

        giftAudio.muted =
            false;

        console.warn(
            'Gift audio unlock failed:',
            error
        );
    }
}


function playGiftSound() {

    /*
     * 実際のgiftイベントからのみ
     * 呼び出される。
     */

    if (!giftAudio) {
        prepareGiftAudio();
    }

    if (!giftAudio) {
        return;
    }

    try {

        giftAudio.currentTime = 0;
        giftAudio.muted = false;

        const playPromise =
            giftAudio.play();

        if (
            playPromise &&
            typeof playPromise.catch ===
                'function'
        ) {

            playPromise.catch(
                (error) => {

                    console.warn(
                        'Gift sound playback failed:',
                        error
                    );
                }
            );
        }

    } catch (error) {

        console.warn(
            'Gift sound error:',
            error
        );
    }
}


/* =========================================================
   視聴者一覧
========================================================= */

function updateViewersFromRoomUser(
    msg
) {

    if (
        !msg ||
        !Array.isArray(msg.ranks)
    ) {

        updateViewerMenu();

        return;
    }

    /*
     * 今回のroomUserで届いた人を
     * Mapへ追加・更新する。
     *
     * 以前の一覧を毎回空にしない。
     */
    msg.ranks.forEach(
        (item) => {

            if (!item) {
                return;
            }

            const user =
                item.user || {};

            const id =
                user.id ||
                user.idStr ||
                user.displayId ||
                '';

            if (!id) {
                return;
            }

            viewerMap.set(
                String(id),
                {
                    id:
                        user.id ||
                        user.idStr ||
                        '',

                    nickname:
                        user.nickname ||
                        '',

                    displayId:
                        user.displayId ||
                        '',

                    avatar:
                        user.avatarThumb &&
                        user.avatarThumb.urlList &&
                        user.avatarThumb.urlList.length
                            ? user.avatarThumb.urlList[0]
                            : '',

                    rank:
                        item.rank,

                    score:
                        item.score
                }
            );
        }
    );

    currentViewers =
        Array.from(
            viewerMap.values()
        );

    /*
     * rankが存在する場合は
     * rank順に並べる。
     *
     * rankがない場合は取得順を維持。
     */
    currentViewers.sort(
        (a, b) => {

            const rankA =
                Number(a.rank);

            const rankB =
                Number(b.rank);

            if (
                Number.isNaN(rankA) ||
                Number.isNaN(rankB)
            ) {
                return 0;
            }

            return rankA - rankB;
        }
    );

    updateViewerMenu();
}


function updateViewerMenu() {

    const list =
        $('#viewerList');

    if (!list.length) {
        return;
    }

    $('#viewerMenuCount').text(
        currentViewers.length +
        '人'
    );

    list.empty();

    if (
        currentViewers.length === 0
    ) {

        list.html(
            '<div style="' +
            'padding:20px;' +
            'text-align:center;' +
            'color:#92939a;' +
            '">' +
            '視聴者情報を取得中...' +
            '</div>'
        );

        return;
    }

    currentViewers.forEach(
        (viewer) => {

            const nickname =
                viewer.nickname ||
                viewer.displayId ||
                'Unknown';

            const displayId =
                viewer.displayId ||
                '';

            const rank =
                viewer.rank !== undefined &&
                viewer.rank !== null
                    ? viewer.rank
                    : '';

            const html =
                '<div class="viewerItem">' +

                '<img ' +
                'class="viewerItemImage" ' +
                'src="' +
                sanitize(
                    viewer.avatar || ''
                ) +
                '">' +

                '<div class="viewerItemInfo">' +

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

                '<div class="viewerItemRank">' +
                sanitize(rank) +
                '</div>' +

                '</div>';

            list.append(html);
        }
    );
}


/* =========================================================
   視聴者メニュー
========================================================= */

function openViewerMenu() {

    $('#viewerMenu').addClass(
        'open'
    );

    $('#viewerMenuOverlay').addClass(
        'open'
    );
}


function closeViewerMenu() {

    $('#viewerMenu').removeClass(
        'open'
    );

    $('#viewerMenuOverlay').removeClass(
        'open'
    );
}


/* =========================================================
   roomUser
========================================================= */

connection.on(
    'roomUser',
    (msg) => {

        console.log(
            '[roomUser]',
            msg
        );

        if (
            typeof msg.viewerCount ===
            'number'
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


/* =========================================================
   入室
========================================================= */

let joinMsgDelay = 0;

connection.on(
    'member',
    (msg) => {

        if (
            window.settings.showJoins ===
            '0'
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
                'ライブに参加しました',
                true
            );

        }, joinMsgDelay);
    }
);


/* =========================================================
   チャット
========================================================= */

connection.on(
    'chat',
    (msg) => {

        /*
         * 本物のchatイベントが来たら
         * いいね表示の抑制を解除。
         */
        likeMessageDisplayed = false;

        if (
            window.settings.showChats ===
            '0'
        ) {
            return;
        }

        if (
            isDuplicateComment(msg)
        ) {

            console.log(
                '[Duplicate chat ignored]',
                msg
            );

            return;
        }

        addChatItem(
            '',
            msg,
            msg.comment
        );
    }
);


/* =========================================================
   ギフト
========================================================= */

connection.on(
    'gift',
    (data) => {

        console.log(
            '[GIFT EVENT]',
            data
        );

        /*
         * 実際のgiftイベント受信時だけ
         * 音を再生。
         */
        playGiftSound();

        if (
            !isPendingStreak(data) &&
            Number(data.diamondCount) > 0
        ) {

            diamondsCount +=
                Number(data.diamondCount) *
                Number(data.repeatCount || 0);

            updateRoomStats();
        }

        if (
            window.settings.showGifts ===
            '0'
        ) {
            return;
        }

        addGiftItem(data);
    }
);


/* =========================================================
   いいね・フォロー・シェア
========================================================= */

connection.on(
    'social',
    (data) => {

        if (
            window.settings.showFollows ===
            '0'
        ) {
            return;
        }

        const displayType =
            String(
                data.displayType || ''
            );

        let text =
            data.label || '';

        if (
            displayType.includes(
                'follow'
            )
        ) {

            text =
                'フォローされました';

        } else if (
            displayType.includes(
                'share'
            )
        ) {

            text =
                'ライブをシェアされました';
        }

        addChatItem(
            displayType.includes(
                'follow'
            )
                ? '#ff005e'
                : '#2fb816',
            data,
            text
        );
    }
);


/* =========================================================
   いいね
========================================================= */

connection.on(
    'like',
    (data) => {

        /*
         * いいね数の集計は変更しない。
         */
        likeCount +=
            Number(
                data.likeCount ||
                data.likeCountDelta ||
                1
            );

        updateRoomStats();

        /*
         * 前回のいいね表示後に
         * チャットが来ていなければ
         * 今回の表示をスキップ。
         */
        if (
            likeMessageDisplayed
        ) {

            console.log(
                '[Like message skipped] ' +
                '前回のいいね表示後に' +
                'チャットがありません。'
            );

            return;
        }

        if (
            window.settings.showLikes ===
            '0'
        ) {
            return;
        }

        addChatItem(
            '#ff5c8a',
            data,
            'ライブにいいねされました'
        );

        likeMessageDisplayed =
            true;
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

        currentViewers = [];

        viewerMap.clear();

        likeMessageDisplayed =
            false;

        updateViewerMenu();

        if (
            window.settings.username
        ) {

            setTimeout(() => {

                connect();

            }, 30000);
        }
    }
);