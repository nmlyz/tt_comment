// This will use the demo backend if you open index.html locally via file://,
// otherwise sacrifice-nico.com will be used.
let backendUrl =
    location.protocol === 'file:'
        ? "https://tiktok-chat-reader.zerody.one/"
        : "https://sacrifice-nico.com";

let connection = new TikTokIOConnection(backendUrl);

// Counter
let viewerCount = 0;
let likeCount = 0;
let diamondsCount = 0;

// These settings are defined by obs.html
if (!window.settings) {
    window.settings = {};
}

/*
 * ============================================================
 * URL username support
 *
 * 例:
 * https://nmlyz.github.io/tt_comment/?username=r2csq
 *
 * usernameが存在する場合:
 * 1. 入力欄に表示
 * 2. 自動接続
 * ============================================================
 */

function getUsernameFromUrl() {

    const params =
        new URLSearchParams(window.location.search);

    return params.get('username') || '';
}

$(document).ready(() => {

    const queryUsername =
        getUsernameFromUrl();

    if (queryUsername) {

        $('#uniqueIdInput').val(
            queryUsername
        );

        window.settings.username =
            queryUsername;
    }

    $('#connectButton').click(connect);

    $('#uniqueIdInput').on('keyup', function(e) {

        if (e.key === 'Enter') {
            connect();
        }

    });

    if (window.settings.username) {
        connect();
    }
});


function normalizeUniqueId(value) {

    if (!value) {
        return '';
    }

    value = String(value).trim();

    /*
     * @username
     */
    if (value.charAt(0) === '@') {
        value = value.substring(1);
    }

    /*
     * TikTok URL
     *
     * https://www.tiktok.com/@username
     * https://www.tiktok.com/@username?...
     */
    try {

        if (
            value.indexOf('http://') === 0 ||
            value.indexOf('https://') === 0
        ) {

            const url =
                new URL(value);

            let path =
                url.pathname;

            if (path.charAt(0) === '/') {
                path = path.substring(1);
            }

            if (path.charAt(0) === '@') {
                path = path.substring(1);
            }

            value =
                path.split('/')[0];
        }

    } catch (e) {

        console.warn(
            'URL parse failed:',
            e
        );
    }

    return value.trim();
}


function connect() {

    let uniqueId =
        window.settings.username ||
        $('#uniqueIdInput').val();

    uniqueId =
        normalizeUniqueId(uniqueId);

    if (uniqueId !== '') {

        // 入力欄も正規化後のIDにする
        $('#uniqueIdInput').val(
            uniqueId
        );

        // URL経由の場合も設定を維持
        if (window.settings.username) {
            window.settings.username =
                uniqueId;
        }

        $('#stateText').text(
            'Connecting...'
        );

        connection.connect(uniqueId, {
            enableExtendedGiftInfo: true
        }).then(state => {

            $('#stateText').text(
                'ルームID ' +
                state.roomId +
                ' に接続'
            );

            // reset stats
            viewerCount = 0;
            likeCount = 0;
            diamondsCount = 0;

            updateRoomStats();

        }).catch(errorMessage => {

            console.error(
                'TikTok connection error:',
                errorMessage
            );

            $('#stateText').text(
                errorMessage
            );

            // schedule next try if obs username set
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


/**
 * Prevent Cross site scripting (XSS)
 */
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


function updateRoomStats() {

    $('#roomStats').html(
        '視聴者数: <b>' +
        viewerCount.toLocaleString() +
        '</b> いいね: <b>' +
        likeCount.toLocaleString() +
        '</b> ダイヤ: <b>' +
        diamondsCount.toLocaleString() +
        '</b>'
    );
}


function generateUsernameLink(data) {

    const uniqueId =
        sanitize(data.uniqueId || '');

    return (
        '<a class="usernamelink" ' +
        'href="https://www.tiktok.com/@' +
        encodeURIComponent(data.uniqueId || '') +
        '" target="_blank">' +
        uniqueId +
        '</a>'
    );
}


function isPendingStreak(data) {

    return (
        data.giftType === 1 &&
        !data.repeatEnd
    );
}


/*
 * ============================================================
 * Duplicate comment protection
 *
 * 同じコメントが短時間に複数回送られてきた場合に
 * 同じ内容を最大3回表示してしまう問題を防ぐ。
 * ============================================================
 */

const recentComments = new Map();

const COMMENT_DUPLICATE_WINDOW = 3000;


function getCommentKey(data, text) {

    const messageId =
        data.commentId ||
        data.msgId ||
        data.messageId ||
        data.id;

    if (messageId !== undefined && messageId !== null) {

        return 'id:' + String(messageId);
    }

    return (
        'text:' +
        String(data.userId || data.uniqueId || '') +
        '|' +
        String(text || '')
    );
}


function isDuplicateComment(data, text) {

    const key =
        getCommentKey(data, text);

    const now =
        Date.now();

    const previous =
        recentComments.get(key);

    if (
        previous &&
        now - previous < COMMENT_DUPLICATE_WINDOW
    ) {

        return true;
    }

    recentComments.set(
        key,
        now
    );

    // 古いデータを削除
    if (recentComments.size > 1000) {

        for (
            const [oldKey, oldTime]
            of recentComments
        ) {

            if (
                now - oldTime >
                COMMENT_DUPLICATE_WINDOW
            ) {
                recentComments.delete(
                    oldKey
                );
            }

            if (
                recentComments.size <= 800
            ) {
                break;
            }
        }
    }

    return false;
}


/**
 * Add a new message to the chat container
 */
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
            data.profilePictureUrl || ''
        ) +
        '">' +

        '<span>' +

        '<b>' +
        generateUsernameLink(data) +
        ':</b> ' +

        '<span style="color:' +
        sanitize(color || '') +
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


/**
 * Add a new gift to the gift container
 */
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
        data.userId.toString() +
        '_' +
        data.giftId;

    let html =
        '<div data-streakid="' +
        (
            isPendingStreak(data)
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

        sanitize(data.describe || '') +

        '<br>' +

        '<div>' +

        '<table>' +

        '<tr>' +

        '<td>' +

        '<img class="gifticon" src="' +
        sanitize(
            data.giftPictureUrl || ''
        ) +
        '">' +

        '</td>' +

        '<td>' +

        '<span>' +
        'Name: <b>' +
        sanitize(data.giftName || '') +
        '</b> (ID:' +
        sanitize(data.giftId || '') +
        ')' +
        '</span>' +

        '<br>' +

        '<span>' +
        'Repeat: <b style="' +
        (
            isPendingStreak(data)
                ? 'color:red'
                : ''
        ) +
        '">' +

        'x' +
        Number(
            data.repeatCount || 0
        ).toLocaleString() +

        '</b>' +
        '</span>' +

        '<br>' +

        '<span>' +
        'Cost: <b>' +

        (
            Number(
                data.diamondCount || 0
            ) *
            Number(
                data.repeatCount || 0
            )
        ).toLocaleString() +

        ' Diamonds</b>' +

        '</span>' +

        '</td>' +

        '</tr>' +

        '</table>' +

        '</div>' +

        '</span>' +

        '</div>';

    let existingStreakItem =
        container.find(
            "[data-streakid='" +
            streakId +
            "']"
        );

    if (existingStreakItem.length) {

        existingStreakItem.replaceWith(
            html
        );

    } else {

        container.append(
            html
        );
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


// viewer stats
connection.on(
    'roomUser',
    (msg) => {

        if (
            typeof msg.viewerCount ===
            'number'
        ) {

            viewerCount =
                msg.viewerCount;

            updateRoomStats();
        }
    }
);


// like stats
connection.on(
    'like',
    (msg) => {

        if (
            typeof msg.totalLikeCount ===
            'number'
        ) {

            likeCount =
                msg.totalLikeCount;

            updateRoomStats();
        }

        if (
            window.settings.showLikes ===
            "0"
        ) {
            return;
        }

        if (
            typeof msg.likeCount ===
            'number'
        ) {

            let label =
                msg.label || '';

            addChatItem(
                '#447dd4',
                msg,
                label
                    .replace(
                        '{0:user}',
                        ''
                    )
                    .replace(
                        'likes',
                        msg.likeCount +
                        ' likes'
                    )
            );
        }
    }
);


// Member join
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
                'joined',
                true
            );

        }, joinMsgDelay);
    }
);


// New chat comment received
connection.on(
    'chat',
    (msg) => {

        if (
            window.settings.showChats ===
            "0"
        ) {
            return;
        }

        const comment =
            msg.comment || '';

        /*
         * 重複コメント防止
         */
        if (
            isDuplicateComment(
                msg,
                comment
            )
        ) {

            console.warn(
                'Duplicate comment ignored:',
                msg
            );

            return;
        }

        addChatItem(
            '',
            msg,
            comment
        );
    }
);


// New gift received
connection.on(
    'gift',
    (data) => {

        if (
            !isPendingStreak(data) &&
            data.diamondCount > 0
        ) {

            diamondsCount +=
                data.diamondCount *
                data.repeatCount;

            updateRoomStats();
        }

        if (
            window.settings.showGifts ===
            "0"
        ) {
            return;
        }

        addGiftItem(data);
    }
);


// share, follow
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

        addChatItem(
            color,
            data,
            label.replace(
                '{0:user}',
                ''
            )
        );
    }
);


connection.on(
    'streamEnd',
    () => {

        $('#stateText').text(
            '配信は終了しました。'
        );

        // schedule next try if obs username set
        if (
            window.settings.username
        ) {

            setTimeout(() => {
                connect();
            }, 30000);
        }
    }
);