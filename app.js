let backendUrl = "https://sacrifice-nico.com";

let connection = new TikTokIOConnection(backendUrl);

let viewerCount = 0;
let likeCount = 0;
let diamondsCount = 0;

let viewerMap = new Map();

let recentComments = new Map();

const COMMENT_DUPLICATE_WINDOW = 3000;

let likeMessageDisplayed = false;

let giftAudio = null;
let giftAudioUnlocked = false;

if (!window.settings) {
    window.settings = {};
}


/* =========================================================
   URL / USER ID
========================================================= */

function normalizeUniqueId(value) {

    if (!value) {
        return '';
    }

    value = String(value).trim();

    if (!value) {
        return '';
    }

    try {

        if (
            value.startsWith('http://') ||
            value.startsWith('https://')
        ) {

            const url = new URL(value);

            const match = url.pathname.match(/@([^/]+)/);

            if (match && match[1]) {
                return match[1];
            }
        }

    } catch (e) {
        console.warn('URL parse error:', e);
    }

    if (value.startsWith('@')) {
        value = value.substring(1);
    }

    return value.trim();
}


function loadUrlSettings() {

    const params = new URLSearchParams(
        window.location.search
    );

    const username = params.get('username');

    if (username) {
        window.settings.username = normalizeUniqueId(
            username
        );
    }

    params.forEach((value, key) => {

        if (key !== 'username') {
            window.settings[key] = value;
        }
    });
}


/* =========================================================
   READY
========================================================= */

$(document).ready(() => {

    loadUrlSettings();

    $('#connectButton').click(function () {
        unlockGiftAudio();
        connect();
    });

    $('#uniqueIdInput').on('keyup', function (e) {

        if (e.key === 'Enter') {
            connect();
        }
    });

    $('#copyUrlButton').click(copyQueryUrl);

    $('#viewerMenuButton').click(openViewerMenu);
    $('#viewerMenuClose').click(closeViewerMenu);
    $('#viewerMenuOverlay').click(closeViewerMenu);

    if (window.settings.username) {

        $('#uniqueIdInput').val(
            window.settings.username
        );

        connect();
    }
});


/* =========================================================
   CONNECT
========================================================= */

function connect() {

    let uniqueId =
        window.settings.username ||
        $('#uniqueIdInput').val();

    uniqueId = normalizeUniqueId(uniqueId);

    if (uniqueId !== '') {

        $('#stateText').text('接続中...');

        connection.connect(uniqueId, {
            enableExtendedGiftInfo: true
        }).then(state => {

            $('#stateText').text(
                'ルームID ' +
                state.roomId +
                ' に接続'
            );

            viewerCount = 0;
            likeCount = 0;
            diamondsCount = 0;

            viewerMap.clear();

            updateRoomStats();
            updateViewerList();

        }).catch(errorMessage => {

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


/* =========================================================
   QUERY URL COPY
========================================================= */

function copyQueryUrl() {

    let username = $('#uniqueIdInput').val();

    username = normalizeUniqueId(username);

    if (!username) {

        alert(
            'ユーザーIDを入力してください。'
        );

        return;
    }

    const url =
        window.location.origin +
        window.location.pathname +
        '?username=' +
        encodeURIComponent(username);

    if (
        navigator.clipboard &&
        navigator.clipboard.writeText
    ) {

        navigator.clipboard.writeText(url)
            .then(() => {

                const button = $('#copyUrlButton');
                const oldText = button.text();

                button.text('コピーしました');

                setTimeout(() => {
                    button.text(oldText);
                }, 1500);

            })
            .catch(() => {
                fallbackCopy(url);
            });

    } else {

        fallbackCopy(url);
    }
}


function fallbackCopy(text) {

    const textarea =
        document.createElement('textarea');

    textarea.value = text;

    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';

    document.body.appendChild(textarea);

    textarea.select();

    try {
        document.execCommand('copy');

        $('#copyUrlButton').text(
            'コピーしました'
        );

        setTimeout(() => {
            $('#copyUrlButton').text(
                'URLコピー'
            );
        }, 1500);

    } catch (e) {

        alert(
            'URLのコピーに失敗しました。\n\n' +
            text
        );
    }

    document.body.removeChild(textarea);
}


/* =========================================================
   OBS
========================================================= */

function generateOverlay() {

    let username = $('#uniqueIdInput').val();

    username = normalizeUniqueId(username);

    if (!username) {

        alert(
            "ユーザーIDを入力してください。"
        );

        return;
    }

    const baseUrl =
        new URL(
            'obs.html',
            window.location.href
        ).href;

    const params = new URLSearchParams();

    params.set('username', username);
    params.set('showLikes', '1');
    params.set('showChats', '1');
    params.set('showGifts', '1');
    params.set('showFollows', '1');
    params.set('showJoins', '1');
    params.set(
        'bgColor',
        'rgb(24,23,28)'
    );
    params.set(
        'fontColor',
        'rgb(227,229,235)'
    );
    params.set(
        'fontSize',
        '1.3em'
    );

    window.open(
        baseUrl + '?' + params.toString(),
        '_blank'
    );
}


/* =========================================================
   BASIC
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


function updateRoomStats() {

    $('#roomStats').html(
        '視聴者数: <b>' +
        viewerCount.toLocaleString() +
        '</b>　いいね: <b>' +
        likeCount.toLocaleString() +
        '</b>　ダイヤ: <b>' +
        diamondsCount.toLocaleString() +
        '</b>'
    );

    $('#viewerCountText').text(
        '視聴者数: ' +
        viewerCount.toLocaleString()
    );
}


function generateUsernameLink(data) {

    const uniqueId =
        data.uniqueId ||
        (
            data.user &&
            data.user.displayId
        ) ||
        '';

    const safeId = sanitize(uniqueId);

    if (!safeId) {
        return 'ユーザー';
    }

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
   DUPLICATE COMMENT
========================================================= */

function getCommentDuplicateKey(data) {

    if (
        data &&
        data.common &&
        data.common.msgId
    ) {
        return 'msg:' +
            String(data.common.msgId);
    }

    if (data && data.msgId) {

        return 'msg:' +
            String(data.msgId);
    }

    if (
        data &&
        data.common &&
        data.common.logId
    ) {
        return 'log:' +
            String(data.common.logId);
    }

    const userId =
        data &&
        (
            data.userId ||
            (
                data.user &&
                data.user.id
            )
        );

    const comment =
        data &&
        (
            data.comment ||
            data.content ||
            ''
        );

    if (userId && comment) {

        return (
            'fallback:' +
            String(userId) +
            '|' +
            String(comment)
        );
    }

    return null;
}


function isDuplicateComment(data) {

    const key = getCommentDuplicateKey(data);

    if (!key) {
        return false;
    }

    const now = Date.now();

    for (const [
        oldKey,
        timestamp
    ] of recentComments.entries()) {

        if (
            now - timestamp >
            COMMENT_DUPLICATE_WINDOW
        ) {
            recentComments.delete(oldKey);
        }
    }

    if (recentComments.has(key)) {
        return true;
    }

    recentComments.set(key, now);

    return false;
}


/* =========================================================
   GIFT
========================================================= */

function isPendingStreak(data) {

    return (
        data &&
        data.giftType === 1 &&
        !data.repeatEnd
    );
}


function ensureGiftAudio() {

    if (!giftAudio) {

        giftAudio = new Audio(
            './gift.mp3'
        );

        giftAudio.preload = 'auto';
    }

    return giftAudio;
}


function unlockGiftAudio() {

    if (giftAudioUnlocked) {
        return;
    }

    try {

        const audio = ensureGiftAudio();

        audio.muted = true;

        const promise = audio.play();

        if (promise) {

            promise.then(() => {

                audio.pause();
                audio.currentTime = 0;
                audio.muted = false;

                giftAudioUnlocked = true;

            }).catch(() => {

                audio.muted = false;
            });

        }

    } catch (e) {

        console.warn(
            'Gift audio unlock failed:',
            e
        );
    }
}


function playGiftSound() {

    try {

        const audio = ensureGiftAudio();

        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;

        const promise = audio.play();

        if (promise) {

            promise.catch(error => {

                console.warn(
                    'Gift audio playback blocked:',
                    error
                );
            });
        }

    } catch (e) {

        console.warn(
            'Gift audio error:',
            e
        );
    }
}


function formatGiftTime() {

    const now = new Date();

    return now.toLocaleTimeString(
        'ja-JP',
        {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }
    );
}


function addGiftItem(data) {

    let container =
        location.href.includes('obs.html')
            ? $('.eventcontainer')
            : $('.giftcontainer');

    if (container.find('div').length > 200) {

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
        data.giftId ||
        '';

    const streakId =
        String(userId) +
        '_' +
        String(giftId);

    const pending =
        isPendingStreak(data);

    const giftName =
        data.giftName ||
        'ギフト';

    const repeatCount =
        Number(data.repeatCount || 1);

    const diamondCount =
        Number(data.diamondCount || 0);

    const giftPictureUrl =
        data.giftPictureUrl ||
        '';

    const profilePictureUrl =
        data.profilePictureUrl ||
        '';

    const describe =
        data.describe ||
        'ギフトを送信';

    const safeGiftName =
        sanitize(giftName);

    const safeDescribe =
        sanitize(
            String(describe)
                .replace(/^Sent\s+/i, '')
        );

    const repeatText =
        '個数: ' +
        'x' +
        repeatCount.toLocaleString();

    const cost =
        diamondCount *
        repeatCount;

    const timeText =
        formatGiftTime();

    let giftImageHtml = '';

    if (giftPictureUrl) {

        giftImageHtml =
            '<img class="gifticon" ' +
            'src="' +
            sanitize(giftPictureUrl) +
            '" ' +
            'alt="" ' +
            'loading="lazy">';
    }

    let profileImageHtml = '';

    if (profilePictureUrl) {

        profileImageHtml =
            '<img class="miniprofilepicture" ' +
            'src="' +
            sanitize(profilePictureUrl) +
            '" ' +
            'alt="" ' +
            'loading="lazy">';
    }

    const html =
        '<div ' +
        'data-streakid="' +
        sanitize(
            pending ? streakId : ''
        ) +
        '">' +

            '<div style="' +
            'display:flex;' +
            'align-items:flex-start;' +
            'gap:6px;' +
            'min-width:0;' +
            '">' +

                profileImageHtml +

                '<span style="' +
                'min-width:0;' +
                'flex:1;' +
                'overflow:hidden;' +
                '">' +

                    '<b>' +
                    generateUsernameLink(data) +
                    ':</b> ' +

                    '<span class="giftTitle">' +
                    safeDescribe +
                    '</span>' +

                    '<br>' +

                    '<span ' +
                    'class="giftDetail">' +
                    timeText +
                    '</span>' +

                    '<div>' +

                        '<table>' +

                            '<tr>' +

                                '<td>' +
                                    giftImageHtml +
                                '</td>' +

                                '<td>' +

                                    '<span ' +
                                    'class="giftDetail">' +
                                    '名前: <b>' +
                                    safeGiftName +
                                    '</b>' +
                                    '</span>' +

                                    '<br>' +

                                    '<span ' +
                                    'class="giftDetail">' +
                                    'ID: <b>' +
                                    sanitize(giftId) +
                                    '</b>' +
                                    '</span>' +

                                    '<br>' +

                                    '<span ' +
                                    'class="giftDetail">' +
                                    sanitize(repeatText) +
                                    '</span>' +

                                    '<br>' +

                                    '<span ' +
                                    'class="giftDetail">' +
                                    'コスト: <b>' +
                                    cost.toLocaleString() +
                                    ' Diamonds</b>' +
                                    '</span>' +

                                '</td>' +

                            '</tr>' +

                        '</table>' +

                    '</div>' +

                '</span>' +

            '</div>' +

        '</div>';

    const existing =
        container
            .find('[data-streakid]')
            .filter(function () {

                return (
                    $(this).attr(
                        'data-streakid'
                    ) === streakId
                );
            });

    if (
        pending &&
        existing.length
    ) {

        existing.first().replaceWith(html);

    } else {

        container.append(html);
    }

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
   CHAT
========================================================= */

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

    container
        .find('.temporary')
        .remove();

    const profilePictureUrl =
        data.profilePictureUrl ||
        '';

    let profileImageHtml = '';

    if (profilePictureUrl) {

        profileImageHtml =
            '<img class="miniprofilepicture" ' +
            'src="' +
            sanitize(profilePictureUrl) +
            '" ' +
            'alt="" ' +
            'loading="lazy">';
    }

    container.append(

        '<div class="' +
        (
            summarize
                ? 'temporary'
                : 'static'
        ) +
        '">' +

            profileImageHtml +

            '<span style="min-width:0;">' +

                '<b>' +
                generateUsernameLink(data) +
                ':</b> ' +

                '<span style="color:' +
                sanitize(color) +
                '">' +
                sanitize(text) +
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
   VIEWERS
========================================================= */

function updateViewersFromRoomUser(msg) {

    if (
        !msg ||
        !Array.isArray(msg.ranks)
    ) {
        return;
    }

    msg.ranks.forEach(rankItem => {

        if (!rankItem || !rankItem.user) {
            return;
        }

        const user =
            rankItem.user;

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
                id: String(id),

                nickname:
                    user.nickname ||
                    user.displayId ||
                    'ユーザー',

                displayId:
                    user.displayId ||
                    '',

                avatar:
                    user.avatarThumb &&
                    Array.isArray(
                        user.avatarThumb.urlList
                    ) &&
                    user.avatarThumb.urlList.length
                        ? user.avatarThumb.urlList[0]
                        : ''
            }
        );
    });

    updateViewerList();
}


function updateViewerList() {

    const list =
        $('#viewerList');

    if (!list.length) {
        return;
    }

    const viewers =
        Array.from(
            viewerMap.values()
        );

    list.empty();

    viewers.forEach(viewer => {

        const item =
            $('<div>')
                .addClass('viewerItem');

        if (viewer.avatar) {

            $('<img>')
                .attr(
                    'src',
                    viewer.avatar
                )
                .attr(
                    'alt',
                    ''
                )
                .appendTo(item);
        }

        const text =
            $('<div>')
                .addClass('viewerItemText');

        $('<div>')
            .addClass(
                'viewerItemNickname'
            )
            .text(
                viewer.nickname
            )
            .appendTo(text);

        $('<div>')
            .addClass(
                'viewerItemId'
            )
            .text(
                viewer.displayId
                    ? '@' +
                      viewer.displayId
                    : ''
            )
            .appendTo(text);

        item.append(text);

        list.append(item);
    });

    $('#viewerCountText').text(
        '視聴者数: ' +
        viewerCount.toLocaleString()
    );
}


function openViewerMenu() {

    $('#viewerSideMenu')
        .addClass('open');

    $('#viewerMenuOverlay')
        .addClass('open');
}


function closeViewerMenu() {

    $('#viewerSideMenu')
        .removeClass('open');

    $('#viewerMenuOverlay')
        .removeClass('open');
}


/* =========================================================
   ROOM USER
========================================================= */

connection.on('roomUser', (msg) => {

    if (
        msg &&
        typeof msg.viewerCount === 'number'
    ) {

        viewerCount =
            msg.viewerCount;

        updateRoomStats();
    }

    updateViewersFromRoomUser(msg);
});


/* =========================================================
   MEMBER
========================================================= */

let joinMsgDelay = 0;

connection.on('member', (msg) => {

    if (
        window.settings.showJoins === "0"
    ) {
        return;
    }

    const addDelay = 250;

    let actualDelay =
        addDelay;

    if (joinMsgDelay > 500) {
        actualDelay = 100;
    }

    if (joinMsgDelay > 1000) {
        actualDelay = 0;
    }

    joinMsgDelay += actualDelay;

    setTimeout(() => {

        joinMsgDelay -= actualDelay;

        addChatItem(
            '#21b2c2',
            msg,
            '参加しました',
            true
        );

    }, joinMsgDelay);
});


/* =========================================================
   CHAT EVENT
========================================================= */

connection.on('chat', (msg) => {

    if (
        window.settings.showChats === "0"
    ) {
        return;
    }

    if (isDuplicateComment(msg)) {
        return;
    }

    /*
     * いいね抑制は「実際の通常コメント」
     * が来たときだけ解除する。
     *
     * member / social / join は解除しない。
     */
    likeMessageDisplayed = false;

    const comment =
        msg.comment ||
        msg.content ||
        '';

    addChatItem(
        '',
        msg,
        comment
    );
});


/* =========================================================
   GIFT EVENT
========================================================= */

connection.on('gift', (data) => {

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
        window.settings.showGifts === "0"
    ) {
        return;
    }

    addGiftItem(data);

    /*
     * 実際のgiftイベントを受け取ったときだけ
     * 音を鳴らす。
     */
    playGiftSound();
});


/* =========================================================
   SOCIAL
========================================================= */

connection.on('social', (data) => {

    if (
        window.settings.showFollows === "0"
    ) {
        return;
    }

    let color =
        '#2fb816';

    if (
        data.displayType &&
        data.displayType.includes('follow')
    ) {
        color = '#ff005e';
    }

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
});


/* =========================================================
   LIKE
========================================================= */

connection.on('like', (data) => {

    if (
        window.settings.showLikes === "0"
    ) {
        return;
    }

    if (
        data &&
        typeof data.likeCount === 'number'
    ) {

        likeCount =
            data.likeCount;

    } else if (
        data &&
        typeof data.likeCountDelta === 'number'
    ) {

        likeCount +=
            data.likeCountDelta;

    } else {

        likeCount++;
    }

    updateRoomStats();

    /*
     * 最初のいいねを表示。
     *
     * その後、
     * - member
     * - social
     * - 参加しました
     *
     * だけなら再表示しない。
     *
     * 通常のchatが来たら
     * app.jsのchatイベントで解除される。
     */
    if (likeMessageDisplayed) {
        return;
    }

    likeMessageDisplayed = true;

    const messageData = data || {};

    addChatItem(
        '#ff6688',
        messageData,
        'ライブにいいねされました'
    );
});


/* =========================================================
   STREAM END
========================================================= */

connection.on('streamEnd', () => {

    $('#stateText').text(
        '配信は終了しました。'
    );

    if (window.settings.username) {

        setTimeout(() => {
            connect();
        }, 30000);
    }
});