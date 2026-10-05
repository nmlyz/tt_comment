let backendUrl =
    location.protocol === 'file:'
        ? 'https://tiktok-chat-reader.zerody.one/'
        : 'https://sacrifice-nico.com';

let connection =
    new TikTokIOConnection(backendUrl);


let viewerCount = 0;
let likeCount = 0;
let diamondsCount = 0;


if (!window.settings) {
    window.settings = {};
}


/* ========================================
   Gift sound
======================================== */

let giftAudio = null;
let giftAudioReady = false;


function prepareGiftAudio() {

    if (giftAudio) {
        return;
    }


    giftAudio =
        new Audio(
            './gift.mp3'
        );

    giftAudio.preload =
        'auto';

    giftAudio.volume =
        1.0;


    try {
        giftAudio.load();
    } catch (e) {

        console.warn(
            'Gift audio load failed:',
            e
        );
    }
}


function unlockGiftAudio() {

    prepareGiftAudio();


    if (!giftAudio) {
        return;
    }


    /*
     * ユーザー操作中に一度再生・停止して
     * ブラウザの音声再生制限を解除する。
     */

    try {

        giftAudio.muted = true;

        const promise =
            giftAudio.play();


        if (
            promise &&
            typeof promise.then ===
            'function'
        ) {

            promise.then(
                () => {

                    giftAudio.pause();

                    giftAudio.currentTime =
                        0;

                    giftAudio.muted =
                        false;

                    giftAudioReady =
                        true;
                }
            ).catch(
                () => {

                    giftAudio.muted =
                        false;
                }
            );
        }

    } catch (e) {

        console.warn(
            'Gift audio unlock failed:',
            e
        );
    }
}


function playGiftSound() {

    prepareGiftAudio();


    if (!giftAudio) {
        return;
    }


    try {

        giftAudio.pause();

        giftAudio.currentTime =
            0;

        giftAudio.muted =
            false;


        const promise =
            giftAudio.play();


        if (
            promise &&
            typeof promise.catch ===
            'function'
        ) {

            promise.catch(
                error => {

                    console.warn(
                        'Gift sound playback blocked:',
                        error
                    );
                }
            );
        }

    } catch (e) {

        console.warn(
            'Gift sound playback failed:',
            e
        );
    }
}


/* ========================================
   Viewer list
======================================== */

const detectedViewers =
    new Map();


/* ========================================
   URL
======================================== */

function getUsernameFromUrl() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    return params.get('username') || '';
}


/* ========================================
   Ready
======================================== */

$(document).ready(() => {

    prepareGiftAudio();


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
        function() {

            unlockGiftAudio();

            connect();
        }
    );


    $('#uniqueIdInput').on(
        'keyup',
        function(e) {

            if (e.key === 'Enter') {

                unlockGiftAudio();

                connect();
            }

        }
    );


    $('#copyQueryButton').click(
        copyQueryLink
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
        connect();
    }
});


/* ========================================
   Copy query link
======================================== */

async function copyQueryLink() {

    let username =
        $('#uniqueIdInput').val();


    username =
        normalizeUniqueId(
            username
        );


    if (!username) {

        alert(
            'ユーザーIDを入力してください。'
        );

        return;
    }


    const baseUrl =
        window.location.origin +
        window.location.pathname;


    const queryUrl =
        baseUrl +
        '?username=' +
        encodeURIComponent(
            username
        );


    try {

        if (
            navigator.clipboard &&
            navigator.clipboard.writeText
        ) {

            await navigator.clipboard.writeText(
                queryUrl
            );

        } else {

            const textarea =
                document.createElement(
                    'textarea'
                );

            textarea.value =
                queryUrl;

            textarea.style.position =
                'fixed';

            textarea.style.opacity =
                '0';

            document.body.appendChild(
                textarea
            );

            textarea.focus();
            textarea.select();

            document.execCommand(
                'copy'
            );

            textarea.remove();
        }


        const button =
            $('#copyQueryButton');


        button.text(
            '✓ コピー済み'
        );


        button.addClass(
            'copied'
        );


        setTimeout(
            () => {

                button.text(
                    '🔗 コピー'
                );

                button.removeClass(
                    'copied'
                );

            },
            1500
        );

    } catch (error) {

        console.error(
            'Copy failed:',
            error
        );


        /*
         * iOSなどでClipboard APIが
         * 利用できない場合はURLを表示。
         */

        window.prompt(
            '以下のURLをコピーしてください。',
            queryUrl
        );
    }
}


/* ========================================
   Viewer menu
======================================== */

function openViewerMenu() {

    $('#viewerMenu')
        .addClass('open')
        .attr(
            'aria-hidden',
            'false'
        );


    $('#viewerMenuOverlay')
        .addClass('open');


    updateViewerMenu();
}


function closeViewerMenu() {

    $('#viewerMenu')
        .removeClass('open')
        .attr(
            'aria-hidden',
            'true'
        );


    $('#viewerMenuOverlay')
        .removeClass('open');
}


/* ========================================
   User data
======================================== */

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


/* ========================================
   Register viewer
======================================== */

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


    detectedViewers.set(
        key,
        {
            key: key,

            userId:
                String(
                    userId || ''
                ),

            uniqueId:
                uniqueId,

            nickname:
                getDisplayName(data),

            profilePictureUrl:
                data.profilePictureUrl ||
                ''
        }
    );


    updateViewerMenu();
}


/* ========================================
   Update viewer menu
======================================== */

function updateViewerMenu() {

    const container =
        $('#viewerList');


    $('#viewerMenuCount').text(
        detectedViewers.size.toLocaleString() +
        '人'
    );


    if (
        detectedViewers.size === 0
    ) {

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
        ).reverse();


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
                '" ' +
                'loading="lazy" ' +
                'onerror="this.style.visibility=\'hidden\'"' +
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


    container.html(
        html
    );
}


/* ========================================
   Normalize ID
======================================== */

function normalizeUniqueId(value) {

    if (!value) {
        return '';
    }


    value =
        String(value).trim();


    if (
        value.charAt(0) === '@'
    ) {

        value =
            value.substring(1);
    }


    try {

        if (
            value.indexOf(
                'http://'
            ) === 0 ||

            value.indexOf(
                'https://'
            ) === 0
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


/* ========================================
   Connect
======================================== */

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
            '接続中...'
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


/* ========================================
   Sanitize
======================================== */

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


/* ========================================
   Time
======================================== */

function getCurrentTime() {

    const now =
        new Date();


    return now.toLocaleTimeString(
        'ja-JP',
        {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }
    );
}


/* ========================================
   Stats
======================================== */

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


/* ========================================
   Username
======================================== */

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


/* ========================================
   Gift streak
======================================== */

function isPendingStreak(data) {

    return (
        data.giftType === 1 &&
        !data.repeatEnd
    );
}


/* ========================================
   Duplicate comments
======================================== */

const recentComments =
    new Map();

const COMMENT_DUPLICATE_WINDOW =
    3000;


function getCommentKey(
    data,
    text
) {

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


/* ========================================
   Chat
======================================== */

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


/* ========================================
   Gifts
======================================== */

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


    const giftTime =
        getCurrentTime();


    const repeatCount =
        Number(
            data.repeatCount || 0
        );


    const diamondCount =
        Number(
            data.diamondCount || 0
        );


    const totalCost =
        diamondCount *
        repeatCount;


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

        '<span class="giftTime">' +

        giftTime +

        '</span>' +

        '<div class="giftDescription">' +

        sanitize(
            data.describe || ''
        ) +

        '</div>' +

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

        '<td class="giftDetails">' +

        '<span>' +

        'ギフト: <b>' +

        sanitize(
            data.giftName ||
            ''
        ) +

        '</b>' +

        '</span>' +

        '<br>' +

        '<span>' +

        'ギフトID: <b>' +

        sanitize(
            data.giftId ||
            ''
        ) +

        '</b>' +

        '</span>' +

        '<br>' +

        '<span>' +

        'リピート: <b style="' +

        (
            isPendingStreak(data)
                ? 'color:#ff596d'
                : ''
        ) +

        '">' +

        '×' +

        repeatCount.toLocaleString() +

        '</b>' +

        '</span>' +

        '<br>' +

        '<span>' +

        'コスト: <b>' +

        totalCost.toLocaleString() +

        ' ダイヤ</b>' +

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


/* ========================================
   Room users
======================================== */

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


/* ========================================
   Likes
======================================== */

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
            '0'
        ) {

            return;
        }


        if (
            typeof msg.likeCount ===
            'number'
        ) {

            addChatItem(

                '#7187d8',

                msg,

                'ライブにいいねされました'
            );
        }
    }
);


/* ========================================
   Member
======================================== */

let joinMsgDelay = 0;

connection.on(
    'member',
    (msg) => {

        registerViewer(msg);


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


        joinMsgDelay +=
            addDelay;


        setTimeout(
            () => {

                joinMsgDelay -=
                    addDelay;


                addChatItem(
                    '#42aeb9',
                    msg,
                    'ライブに参加しました',
                    true
                );

            },
            joinMsgDelay
        );
    }
);


/* ========================================
   Chat
======================================== */

connection.on(
    'chat',
    (msg) => {

        registerViewer(msg);


        if (
            window.settings.showChats ===
            '0'
        ) {

            return;
        }


        const comment =
            msg.comment || '';


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


/* ========================================
   Gift
======================================== */

connection.on(
    'gift',
    (data) => {

        registerViewer(data);


        /*
         * ギフトを受信したら音を鳴らす。
         */

        playGiftSound();


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
            '0'
        ) {

            return;
        }


        addGiftItem(data);
    }
);


/* ========================================
   Social
======================================== */

connection.on(
    'social',
    (data) => {

        registerViewer(data);


        if (
            window.settings.showFollows ===
            '0'
        ) {

            return;
        }


        let displayType =
            data.displayType || '';


        let color =

            displayType.includes(
                'follow'
            )

                ? '#d95678'

                : '#4ba84b';


        let text =
            'ソーシャルイベント';


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

        } else if (
            data.label
        ) {

            text =
                String(
                    data.label
                )
                    .replace(
                        '{0:user}',
                        ''
                    )
                    .replace(
                        'liked the live',
                        'ライブにいいねされました'
                    )
                    .replace(
                        'shared the live',
                        'ライブをシェアされました'
                    );
        }


        addChatItem(
            color,
            data,
            text
        );
    }
);


/* ========================================
   Stream end
======================================== */

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