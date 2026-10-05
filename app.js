// This will use the demo backend if you open index.html locally via file://,
// otherwise sacrifice-nico.com will be used.

let backendUrl =
    location.protocol === 'file:'
        ? "https://tiktok-chat-reader.zerody.one/"
        : "https://sacrifice-nico.com";

let connection =
    new TikTokIOConnection(backendUrl);


// ========================================
// Counter
// ========================================

let viewerCount = 0;
let likeCount = 0;
let diamondsCount = 0;


// ========================================
// Settings
// ========================================

if (!window.settings) {
    window.settings = {};
}


// ========================================
// Detected viewers
// ========================================

const detectedViewers = new Map();


// ========================================
// URL username
// ========================================

function getUsernameFromUrl() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    return params.get('username') || '';
}


// ========================================
// Ready
// ========================================

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


    $('#connectButton').click(
        connect
    );


    $('#uniqueIdInput').on(
        'keyup',
        function(e) {

            if (e.key === 'Enter') {
                connect();
            }

        }
    );


    // ====================================
    // Viewer menu
    // ====================================

    $('#viewerMenuButton').click(
        openViewerMenu
    );

    $('#viewerMenuClose').click(
        closeViewerMenu
    );

    $('#viewerMenuOverlay').click(
        closeViewerMenu
    );


    // ====================================
    // Auto connect
    // ====================================

    if (window.settings.username) {
        connect();
    }
});


// ========================================
// Viewer menu
// ========================================

function openViewerMenu() {

    $('#viewerMenu')
        .addClass('open')
        .attr('aria-hidden', 'false');

    $('#viewerMenuOverlay')
        .addClass('open');

    updateViewerMenu();
}


function closeViewerMenu() {

    $('#viewerMenu')
        .removeClass('open')
        .attr('aria-hidden', 'true');

    $('#viewerMenuOverlay')
        .removeClass('open');
}


// ========================================
// Get unique ID
// ========================================

function getDataUniqueId(data) {

    if (!data) {
        return '';
    }

    return (
        data.uniqueId ||
        (
            data.user &&
            data.user.displayId
        ) ||
        ''
    );
}


// ========================================
// Get nickname
// ========================================

function getDisplayName(data) {

    if (!data) {
        return '';
    }

    return (
        data.nickname ||
        (
            data.user &&
            data.user.nickname
        ) ||
        getDataUniqueId(data) ||
        ''
    );
}


// ========================================
// Add detected viewer
// ========================================

function registerViewer(data) {

    if (!data) {
        return;
    }

    const uniqueId =
        getDataUniqueId(data);

    const userId =
        data.userId ||
        (
            data.user &&
            data.user.id
        ) ||
        '';


    if (!uniqueId && !userId) {
        return;
    }


    const key =
        String(
            userId ||
            uniqueId
        );


    const viewer = {

        key: key,

        userId:
            String(userId || ''),

        uniqueId:
            uniqueId,

        nickname:
            getDisplayName(data),

        profilePictureUrl:
            data.profilePictureUrl ||
            (
                data.user &&
                data.user.profilePictureUrl
            ) ||
            ''
    };


    detectedViewers.set(
        key,
        viewer
    );


    updateViewerMenu();
}


// ========================================
// Update viewer menu
// ========================================

function updateViewerMenu() {

    const container =
        $('#viewerList');


    $('#viewerMenuCount').text(
        detectedViewers.size.toLocaleString() +
        '人'
    );


    if (detectedViewers.size === 0) {

        container.html(
            '<div class="viewerEmpty">' +
            'まだ視聴者情報がありません' +
            '</div>'
        );

        return;
    }


    const viewers =
        Array.from(
            detectedViewers.values()
        );


    // 新しく取得した順
    viewers.reverse();


    let html = '';


    viewers.forEach(
        viewer => {

            const nickname =
                sanitize(
                    viewer.nickname ||
                    viewer.uniqueId ||
                    ''
                );


            const uniqueId =
                sanitize(
                    viewer.uniqueId ||
                    ''
                );


            const image =
                sanitize(
                    viewer.profilePictureUrl ||
                    ''
                );


            html +=
                '<div class="viewerItem">' +

                '<img ' +
                'class="viewerItemPicture" ' +
                'src="' +
                image +
                '"' +
                '>' +

                '<div class="viewerItemInfo">' +

                '<span class="viewerItemName">' +
                nickname +
                '</span>' +

                (
                    uniqueId
                        ? (
                            '<span class="viewerItemId">' +
                            '@' +
                            uniqueId +
                            '</span>'
                        )
                        : ''
                ) +

                '</div>' +

                '</div>';
        }
    );


    container.html(html);
}


// ========================================
// Normalize unique ID
// ========================================

function normalizeUniqueId(value) {

    if (!value) {
        return '';
    }

    value =
        String(value).trim();


    if (value.charAt(0) === '@') {

        value =
            value.substring(1);
    }


    try {

        if (
            value.indexOf('http://') === 0 ||
            value.indexOf('https://') === 0
        ) {

            const url =
                new URL(value);

            let path =
                url.pathname;


            if (
                path.charAt(0) === '/'
            ) {

                path =
                    path.substring(1);
            }


            if (
                path.charAt(0) === '@'
            ) {

                path =
                    path.substring(1);
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


// ========================================
// Connect
// ========================================

function connect() {

    let uniqueId =
        window.settings.username ||
        $('#uniqueIdInput').val();


    uniqueId =
        normalizeUniqueId(
            uniqueId
        );


    if (uniqueId !== '') {

        $('#uniqueIdInput').val(
            uniqueId
        );


        if (
            window.settings.username
        ) {

            window.settings.username =
                uniqueId;
        }


        $('#stateText').text(
            'Connecting...'
        );


        connection.connect(
            uniqueId,
            {
                enableExtendedGiftInfo:
                    true
            }
        ).then(
            state => {

                $('#stateText').text(
                    'ルームID ' +
                    state.roomId +
                    ' に接続'
                );


                viewerCount = 0;
                likeCount = 0;
                diamondsCount = 0;


                updateRoomStats();

            }
        ).catch(
            errorMessage => {

                console.error(
                    'TikTok connection error:',
                    errorMessage
                );


                $('#stateText').text(
                    errorMessage
                );


                if (
                    window.settings.username
                ) {

                    setTimeout(
                        () => {
                            connect();
                        },
                        30000
                    );
                }
            }
        );

    } else {

        alert(
            'ユーザーIDを入力してください。'
        );
    }
}


// ========================================
// Sanitize
// ========================================

function sanitize(text) {

    if (
        text === null ||
        text === undefined
    ) {

        return '';
    }


    return String(text)
        .replace(
            /&/g,
            '&amp;'
        )
        .replace(
            /</g,
            '&lt;'
        )
        .replace(
            />/g,
            '&gt;'
        )
        .replace(
            /"/g,
            '&quot;'
        )
        .replace(
            /'/g,
            '&#039;'
        );
}


// ========================================
// Room stats
// ========================================

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


// ========================================
// Username link
// ========================================

function generateUsernameLink(data) {

    const uniqueId =
        getDataUniqueId(data);


    const displayName =
        getDisplayName(data);


    return (

        '<a class="usernamelink" ' +

        'href="https://www.tiktok.com/@' +

        encodeURIComponent(
            uniqueId
        ) +

        '" target="_blank">' +

        sanitize(
            displayName
        ) +

        '</a>'
    );
}


// ========================================
// Gift streak
// ========================================

function isPendingStreak(data) {

    return (
        data.giftType === 1 &&
        !data.repeatEnd
    );
}


// ========================================
// Comment duplicate detection
// ========================================

const recentComments =
    new Map();

const COMMENT_DUPLICATE_WINDOW =
    3000;


function getCommentKey(
    data,
    text
) {

    /*
     * 今回のログでは
     *
     * data.common.msgId
     *
     * にコメントIDが入っている。
     *
     * まずこれを使う。
     */

    const messageId =

        (
            data.common &&
            data.common.msgId
        ) ||

        data.msgId ||

        data.commentId ||

        data.messageId ||

        data.id;


    if (
        messageId !== undefined &&
        messageId !== null
    ) {

        return (
            'id:' +
            String(messageId)
        );
    }


    /*
     * IDが取れない場合だけ
     * ユーザー + コメント本文
     * を使う。
     */

    return (

        'text:' +

        String(
            data.userId ||
            data.uniqueId ||
            ''
        ) +

        '|' +

        String(
            text || ''
        )
    );
}


function isDuplicateComment(
    data,
    text
) {

    const key =
        getCommentKey(
            data,
            text
        );


    const now =
        Date.now();


    const previous =
        recentComments.get(
            key
        );


    /*
     * 3秒以内に同じものが来たら
     * 重複として弾く。
     */

    if (
        previous &&
        now - previous <
        COMMENT_DUPLICATE_WINDOW
    ) {

        return true;
    }


    recentComments.set(
        key,
        now
    );


    /*
     * 古い履歴を軽く掃除する。
     */

    if (
        recentComments.size >
        1000
    ) {

        for (
            const [
                oldKey,
                oldTime
            ]
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
                recentComments.size <=
                800
            ) {

                break;
            }
        }
    }


    return false;
}


// ========================================
// Add chat item
// ========================================

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


    container.append(

        '<div class="' +

        (
            summarize
                ? 'temporary'
                : 'static'
        ) +

        '">' +

        '<img ' +
        'class="miniprofilepicture" ' +
        'src="' +

        sanitize(
            data.profilePictureUrl ||
            ''
        ) +

        '">' +

        '<span>' +

        '<b>' +

        generateUsernameLink(
            data
        ) +

        ':</b> ' +

        '<span style="color:' +

        sanitize(
            color || ''
        ) +

        '">' +

        sanitize(
            text
        ) +

        '</span>' +

        '</span>' +

        '</div>'
    );


    container.stop();


    container.animate(
        {
            scrollTop:
                container[0]
                    .scrollHeight
        },
        400
    );
}


// ========================================
// Add gift item
// ========================================

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


    let streakId =

        String(
            data.userId || ''
        ) +

        '_' +

        String(
            data.giftId || ''
        );


    let html =

        '<div data-streakid="' +

        (
            isPendingStreak(data)
                ? sanitize(streakId)
                : ''
        ) +

        '">' +

        '<img ' +
        'class="miniprofilepicture" ' +
        'src="' +

        sanitize(
            data.profilePictureUrl ||
            ''
        ) +

        '">' +

        '<span>' +

        '<b>' +

        generateUsernameLink(
            data
        ) +

        ':</b> ' +

        sanitize(
            data.describe || ''
        ) +

        '<br>' +

        '<div>' +

        '<table>' +

        '<tr>' +

        '<td>' +

        '<img ' +
        'class="gifticon" ' +
        'src="' +

        sanitize(
            data.giftPictureUrl ||
            ''
        ) +

        '">' +

        '</td>' +

        '<td>' +

        '<span>' +

        'Name: <b>' +

        sanitize(
            data.giftName ||
            ''
        ) +

        '</b> ' +

        '(ID:' +

        sanitize(
            data.giftId ||
            ''
        ) +

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


    container.stop();


    container.animate(
        {
            scrollTop:
                container[0]
                    .scrollHeight
        },
        800
    );
}


// ========================================
// Room user
// ========================================

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


// ========================================
// Like
// ========================================

connection.on(
    'like',
    (msg) => {

        registerViewer(msg);


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


// ========================================
// Member join
// ========================================

let joinMsgDelay = 0;

connection.on(
    'member',
    (msg) => {

        registerViewer(msg);


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


        joinMsgDelay +=
            addDelay;


        setTimeout(
            () => {

                joinMsgDelay -=
                    addDelay;


                addChatItem(

                    '#21b2c2',

                    msg,

                    'joined',

                    true
                );

            },

            joinMsgDelay
        );
    }
);


// ========================================
// New chat comment
// ========================================

connection.on(
    'chat',
    (msg) => {

        registerViewer(msg);


        if (
            window.settings.showChats ===
            "0"
        ) {

            return;
        }


        const comment =
            msg.comment || '';


        /*
         * 重複コメントを弾く。
         *
         * 深い判定はせず、
         * 同一ID・同一内容の短時間重複だけ
         * 対象にする。
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


// ========================================
// Gift
// ========================================

connection.on(
    'gift',
    (data) => {

        registerViewer(data);


        if (
            !isPendingStreak(data) &&
            Number(
                data.diamondCount || 0
            ) > 0
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
    }
);


// ========================================
// Share / Follow
// ========================================

connection.on(
    'social',
    (data) => {

        registerViewer(data);


        if (
            window.settings.showFollows ===
            "0"
        ) {

            return;
        }


        let displayType =
            data.displayType || '';


        let color =

            displayType.includes(
                'follow'
            )

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


// ========================================
// Stream end
// ========================================

connection.on(
    'streamEnd',
    () => {

        $('#stateText').text(
            '配信は終了しました。'
        );


        if (
            window.settings.username
        ) {

            setTimeout(
                () => {
                    connect();
                },
                30000
            );
        }
    }
);