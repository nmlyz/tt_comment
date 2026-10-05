let backendUrl = "https://sacrifice-nico.com";

let connection = new TikTokIOConnection(backendUrl);

let viewerCount = 0;
let likeCount = 0;
let diamondsCount = 0;

let viewerMap = new Map();

let recentComments = new Map();

const COMMENT_DUPLICATE_WINDOW = 3000;

let likeMessageDisplayed = false;


/* =========================================================
   GIFT AUDIO
========================================================= */

let giftAudioEnabled = true;

let giftAudioUrl = './tegami.mp3';

let rareGiftAudioUrl = './sakibare.mp3';

let giftAudioUnlocked = false;

let giftAudioElements = {};

let playingGiftAudios = [];


/* =========================================================
   GIFT DUPLICATE
========================================================= */

const GIFT_DUPLICATE_WINDOW = 5000;

const recentGifts = new Map();

const activeGiftStreaks = new Set();


/* =========================================================
   CHAT AUTO SCROLL
========================================================= */

let chatAutoScrollEnabled = true;


/* =========================================================
   GIFT EXPAND
========================================================= */

let giftExpanded = false;


/* =========================================================
   SETTINGS
========================================================= */

if (!window.settings) {
    window.settings = {};
}


/* =========================================================
   USERNAME
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

            const url =
                new URL(value);

            const match =
                url.pathname.match(
                    /@([^/]+)/
                );

            if (
                match &&
                match[1]
            ) {

                return match[1];
            }
        }

    } catch (e) {

        console.warn(
            'URL parse error:',
            e
        );
    }

    if (
        value.startsWith('@')
    ) {

        value =
            value.substring(1);
    }

    return value.trim();
}


/* =========================================================
   URL SETTINGS
========================================================= */

function loadUrlSettings() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    const username =
        params.get(
            'username'
        );

    if (username) {

        window.settings.username =
            normalizeUniqueId(
                username
            );
    }

    params.forEach(
        function (
            value,
            key
        ) {

            if (
                key !== 'username'
            ) {

                window.settings[key] =
                    value;
            }
        }
    );

    if (
        window.settings.giftSound
    ) {

        giftAudioUrl =
            String(
                window.settings.giftSound
            ).trim();

        if (
            !giftAudioUrl
        ) {

            giftAudioUrl =
                './tegami.mp3';
        }
    }

    if (
        window.settings.giftMute === '1'
    ) {

        giftAudioEnabled =
            false;

    } else if (
        window.settings.giftMute === '0'
    ) {

        giftAudioEnabled =
            true;
    }
}


/* =========================================================
   GIFT AUDIO BUTTON
========================================================= */

function setupGiftAudioButton() {

    const button =
        $('#giftAudioButton');

    if (
        !button.length
    ) {

        return;
    }

    button.off(
        'click'
    );

    button.on(
        'click',
        function () {

            giftAudioEnabled =
                !giftAudioEnabled;

            updateGiftAudioButton();
        }
    );

    updateGiftAudioButton();
}


function updateGiftAudioButton() {

    const button =
        $('#giftAudioButton');

    if (
        !button.length
    ) {

        return;
    }

    if (
        giftAudioEnabled
    ) {

        button.text(
            '🔊'
        );

        button.attr(
            'title',
            'ギフト音をオフ'
        );

        button.removeClass(
            'audioOff'
        );

    } else {

        button.text(
            '🔇'
        );

        button.attr(
            'title',
            'ギフト音をオン'
        );

        button.addClass(
            'audioOff'
        );
    }
}


/* =========================================================
   CHAT AUTO SCROLL
========================================================= */

function setupChatAutoScrollButton() {

    const button =
        $('#chatAutoScrollButton');

    if (
        !button.length
    ) {

        return;
    }

    button.off(
        'click'
    );

    button.on(
        'click',
        function () {

            chatAutoScrollEnabled =
                !chatAutoScrollEnabled;

            updateChatAutoScrollButton();

            if (
                chatAutoScrollEnabled
            ) {

                scrollChatToBottom();
            }
        }
    );

    updateChatAutoScrollButton();
}


function updateChatAutoScrollButton() {

    const button =
        $('#chatAutoScrollButton');

    if (
        !button.length
    ) {

        return;
    }

    if (
        chatAutoScrollEnabled
    ) {

        button.text(
            '↓'
        );

        button.attr(
            'title',
            '自動スクロールをオフ'
        );

        button.removeClass(
            'autoScrollOff'
        );

    } else {

        button.text(
            '⏸'
        );

        button.attr(
            'title',
            '自動スクロールをオン'
        );

        button.addClass(
            'autoScrollOff'
        );
    }
}


function scrollChatToBottom() {

    const container =
        $('.chatcontainer');

    if (
        !container.length
    ) {

        return;
    }

    const element =
        container[0];

    element.scrollTop =
        element.scrollHeight;

    requestAnimationFrame(
        function () {

            element.scrollTop =
                element.scrollHeight;
        }
    );
}


/* =========================================================
   GIFT EXPAND
========================================================= */

function setupGiftExpandButton() {

    const button =
        $('#giftExpandButton');

    if (
        !button.length
    ) {

        return;
    }

    button.off(
        'click'
    );

    button.on(
        'click',
        function () {

            giftExpanded =
                !giftExpanded;

            updateGiftExpandedState();
        }
    );

    updateGiftExpandedState();
}


function updateGiftExpandedState() {

    const mainContent =
        $('.mainContent');

    const button =
        $('#giftExpandButton');

    if (
        !mainContent.length
    ) {

        return;
    }

    if (
        giftExpanded
    ) {

        mainContent.addClass(
            'giftExpanded'
        );

        button.text(
            '⛶'
        );

        button.attr(
            'title',
            'ギフトを元に戻す'
        );

        button.addClass(
            'expanded'
        );

    } else {

        mainContent.removeClass(
            'giftExpanded'
        );

        button.text(
            '⛶'
        );

        button.attr(
            'title',
            'ギフトを拡大'
        );

        button.removeClass(
            'expanded'
        );
    }
}


/* =========================================================
   READY
========================================================= */

$(document).ready(
    function () {

        loadUrlSettings();

        setupGiftAudioButton();

        setupChatAutoScrollButton();

        setupGiftExpandButton();

        $('#connectButton').click(
            function () {

                /*
                 * ユーザー操作中に
                 * 両方の音声を解禁する。
                 */
                unlockGiftAudio();

                connect();
            }
        );

        $('#uniqueIdInput').on(
            'keyup',
            function (e) {

                if (
                    e.key === 'Enter'
                ) {

                    connect();
                }
            }
        );

        $('#copyUrlButton').click(
            copyQueryUrl
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

        if (
            window.settings.username
        ) {

            $('#uniqueIdInput').val(
                window.settings.username
            );

            connect();
        }
    }
);


/* =========================================================
   AUDIO UNLOCK
========================================================= */

function unlockGiftAudio() {

    /*
     * すでに解禁済みなら何もしない。
     */
    if (
        giftAudioUnlocked
    ) {

        return;
    }

    const urls = [
        giftAudioUrl,
        rareGiftAudioUrl
    ];

    let completed = 0;

    urls.forEach(
        function (url) {

            try {

                /*
                 * 音声ファイルごとに
                 * 専用Audioを作る。
                 */
                const audio =
                    new Audio(url);

                audio.preload =
                    'auto';

                audio.volume =
                    1.0;

                /*
                 * ユーザー操作中なので
                 * mutedでplayしてブラウザに
                 * 音声再生許可を取得する。
                 */
                audio.muted =
                    true;

                giftAudioElements[url] =
                    audio;

                const promise =
                    audio.play();

                if (
                    promise
                ) {

                    promise.then(
                        function () {

                            audio.pause();

                            audio.currentTime =
                                0;

                            audio.muted =
                                false;

                            completed++;

                            if (
                                completed >=
                                urls.length
                            ) {

                                giftAudioUnlocked =
                                    true;
                            }

                        }
                    ).catch(
                        function (error) {

                            console.warn(
                                'Audio unlock failed:',
                                url,
                                error
                            );

                            /*
                             * 片方失敗しても
                             * もう片方は処理する。
                             */
                            completed++;

                            if (
                                completed >=
                                urls.length
                            ) {

                                giftAudioUnlocked =
                                    true;
                            }
                        }
                    );

                } else {

                    audio.pause();

                    audio.currentTime =
                        0;

                    audio.muted =
                        false;

                    completed++;

                    if (
                        completed >=
                        urls.length
                    ) {

                        giftAudioUnlocked =
                            true;
                    }
                }

            } catch (error) {

                console.warn(
                    'Audio setup failed:',
                    url,
                    error
                );

                completed++;

                if (
                    completed >=
                    urls.length
                ) {

                    giftAudioUnlocked =
                        true;
                }
            }
        }
    );
}


/* =========================================================
   PLAY GIFT SOUND
========================================================= */

function playGiftSound() {

    if (
        !giftAudioEnabled
    ) {

        return;
    }

    if (
        !giftAudioUnlocked
    ) {

        console.warn(
            'Gift audio is not unlocked.'
        );

        return;
    }

    /*
     * 1～50
     *
     * 1      = sakibare
     * 2～50  = tegami
     */
    const random =
        Math.floor(
            Math.random() * 50
        ) + 1;

    let soundUrl;

    if (
        random === 1
    ) {

        soundUrl =
            rareGiftAudioUrl;

    } else {

        soundUrl =
            giftAudioUrl;
    }

    try {

        /*
         * 解禁時に作ったAudioを
         * 直接使わず、同じURLの
         * 新しいAudioを作成する。
         *
         * これにより前の音声が
         * 再生中でも重ねられる。
         */
        const audio =
            new Audio(soundUrl);

        audio.preload =
            'auto';

        audio.volume =
            1.0;

        audio.muted =
            false;

        /*
         * 再生中Audioを保持。
         * iOS/SafariでGCされるのを防ぐ。
         */
        playingGiftAudios.push(
            audio
        );

        const cleanup =
            function () {

                const index =
                    playingGiftAudios.indexOf(
                        audio
                    );

                if (
                    index !== -1
                ) {

                    playingGiftAudios.splice(
                        index,
                        1
                    );
                }
            };

        audio.addEventListener(
            'ended',
            cleanup,
            {
                once: true
            }
        );

        audio.addEventListener(
            'error',
            cleanup,
            {
                once: true
            }
        );

        const promise =
            audio.play();

        if (
            promise
        ) {

            promise.catch(
                function (error) {

                    console.warn(
                        'Gift audio playback failed:',
                        soundUrl,
                        error
                    );

                    cleanup();
                }
            );
        }

    } catch (error) {

        console.warn(
            'Gift audio error:',
            error
        );
    }
}


/* =========================================================
   CONNECT
========================================================= */

function connect() {

    recentGifts.clear();

    activeGiftStreaks.clear();

    let uniqueId =
        window.settings.username ||
        $('#uniqueIdInput').val();

    uniqueId =
        normalizeUniqueId(
            uniqueId
        );

    if (
        uniqueId !== ''
    ) {

        $('#stateText').text(
            '接続中...'
        );

        connection.connect(
            uniqueId,
            {
                enableExtendedGiftInfo: true
            }
        ).then(
            function (state) {

                $('#stateText').text(
                    '接続:' +
                    state.roomId
                );

                viewerCount = 0;

                likeCount = 0;

                diamondsCount = 0;

                viewerMap.clear();

                recentGifts.clear();

                activeGiftStreaks.clear();

                updateRoomStats();

                updateViewerList();
            }
        ).catch(
            function (errorMessage) {

                $('#stateText').text(
                    String(
                        errorMessage
                    )
                );

                if (
                    window.settings.username
                ) {

                    setTimeout(
                        function () {

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


/* =========================================================
   COPY QUERY URL
========================================================= */

function copyQueryUrl() {

    let username =
        $('#uniqueIdInput').val();

    username =
        normalizeUniqueId(
            username
        );

    if (
        !username
    ) {

        alert(
            'ユーザーIDを入力してください。'
        );

        return;
    }

    const params =
        new URLSearchParams();

    params.set(
        'username',
        username
    );

    if (
        window.settings.giftSound
    ) {

        params.set(
            'giftSound',
            window.settings.giftSound
        );
    }

    if (
        window.settings.giftMute === '0' ||
        window.settings.giftMute === '1'
    ) {

        params.set(
            'giftMute',
            window.settings.giftMute
        );
    }

    const url =
        window.location.origin +
        window.location.pathname +
        '?' +
        params.toString();

    if (
        navigator.clipboard &&
        navigator.clipboard.writeText
    ) {

        navigator.clipboard.writeText(
            url
        ).then(
            function () {

                const button =
                    $('#copyUrlButton');

                const oldText =
                    button.text();

                button.text(
                    'コピーしました'
                );

                setTimeout(
                    function () {

                        button.text(
                            oldText
                        );

                    },
                    1500
                );
            }
        ).catch(
            function () {

                fallbackCopy(url);
            }
        );

    } else {

        fallbackCopy(url);
    }
}


function fallbackCopy(text) {

    const textarea =
        document.createElement(
            'textarea'
        );

    textarea.value =
        text;

    textarea.style.position =
        'fixed';

    textarea.style.left =
        '-9999px';

    document.body.appendChild(
        textarea
    );

    textarea.select();

    try {

        document.execCommand(
            'copy'
        );

        $('#copyUrlButton').text(
            'コピーしました'
        );

        setTimeout(
            function () {

                $('#copyUrlButton').text(
                    'URLコピー'
                );

            },
            1500
        );

    } catch (e) {

        alert(
            'URLのコピーに失敗しました。\n\n' +
            text
        );
    }

    document.body.removeChild(
        textarea
    );
}


/* =========================================================
   OBS OVERLAY
========================================================= */

function generateOverlay() {

    let username =
        $('#uniqueIdInput').val();

    username =
        normalizeUniqueId(
            username
        );

    if (
        !username
    ) {

        alert(
            'ユーザーIDを入力してください。'
        );

        return;
    }

    const baseUrl =
        new URL(
            'obs.html',
            window.location.href
        ).href;

    const params =
        new URLSearchParams();

    params.set(
        'username',
        username
    );

    params.set(
        'showLikes',
        '1'
    );

    params.set(
        'showChats',
        '1'
    );

    params.set(
        'showGifts',
        '1'
    );

    params.set(
        'showFollows',
        '1'
    );

    params.set(
        'showJoins',
        '1'
    );

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
        baseUrl +
        '?' +
        params.toString(),
        '_blank'
    );
}


/* =========================================================
   SANITIZE
========================================================= */

function sanitize(text) {

    if (
        text === undefined ||
        text === null
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


/* =========================================================
   ROOM STATS
========================================================= */

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


/* =========================================================
   USERNAME LINK
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
        sanitize(
            uniqueId
        );

    if (
        !safeId
    ) {

        return 'ユーザー';
    }

    return (
        '<a class="usernamelink" ' +
        'href="https://www.tiktok.com/@' +
        encodeURIComponent(
            uniqueId
        ) +
        '" target="_blank">' +
        safeId +
        '</a>'
    );
}


/* =========================================================
   COMMENT DUPLICATE
========================================================= */

function getCommentDuplicateKey(data) {

    if (
        data &&
        data.common &&
        data.common.msgId
    ) {

        return (
            'msg:' +
            String(
                data.common.msgId
            )
        );
    }

    if (
        data &&
        data.msgId
    ) {

        return (
            'msg:' +
            String(
                data.msgId
            )
        );
    }

    if (
        data &&
        data.common &&
        data.common.logId
    ) {

        return (
            'log:' +
            String(
                data.common.logId
            )
        );
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

    if (
        userId &&
        comment
    ) {

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

    const key =
        getCommentDuplicateKey(
            data
        );

    if (
        !key
    ) {

        return false;
    }

    const now =
        Date.now();

    for (
        const [
            oldKey,
            timestamp
        ]
        of recentComments.entries()
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
   GIFT DUPLICATE
========================================================= */

function isPendingStreak(data) {

    return (
        data &&
        data.giftType === 1 &&
        !data.repeatEnd
    );
}


function getGiftDuplicateKey(data) {

    const userId =
        data &&
        (
            data.userId ||
            (
                data.user &&
                (
                    data.user.id ||
                    data.user.idStr
                )
            )
        );

    const giftId =
        data &&
        (
            data.giftId ||
            data.giftName ||
            ''
        );

    if (
        !userId &&
        !giftId
    ) {

        return null;
    }

    return (
        String(
            userId || ''
        ) +
        '_' +
        String(
            giftId || ''
        )
    );
}


function isDuplicateGift(data) {

    const key =
        getGiftDuplicateKey(
            data
        );

    if (
        !key
    ) {

        return false;
    }

    const now =
        Date.now();

    for (
        const [
            oldKey,
            timestamp
        ]
        of recentGifts.entries()
    ) {

        if (
            now - timestamp >
            GIFT_DUPLICATE_WINDOW
        ) {

            recentGifts.delete(
                oldKey
            );
        }
    }

    if (
        recentGifts.has(key)
    ) {

        recentGifts.set(
            key,
            now
        );

        return true;
    }

    recentGifts.set(
        key,
        now
    );

    return false;
}


/* =========================================================
   GIFT TIME
========================================================= */

function formatGiftTime() {

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


/* =========================================================
   ADD GIFT
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
            .slice(
                0,
                100
            )
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
        getGiftDuplicateKey(
            data
        ) ||
        (
            String(userId) +
            '_' +
            String(giftId)
        );

    const giftName =
        data.giftName ||
        'ギフト';

    const repeatCount =
        Number(
            data.repeatCount ||
            1
        );

    const diamondCount =
        Number(
            data.diamondCount ||
            0
        );

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
        sanitize(
            giftName
        );

    const safeDescribe =
        sanitize(
            String(describe)
                .replace(
                    /^Sent\s+/i,
                    ''
                )
        );

    const repeatText =
        '個数: x' +
        repeatCount.toLocaleString();

    const cost =
        diamondCount *
        repeatCount;

    const timeText =
        formatGiftTime();

    let giftImageHtml =
        '';

    if (
        giftPictureUrl
    ) {

        giftImageHtml =
            '<img class="gifticon" ' +
            'src="' +
            sanitize(
                giftPictureUrl
            ) +
            '" alt="" loading="lazy">';
    }

    let profileImageHtml =
        '';

    if (
        profilePictureUrl
    ) {

        profileImageHtml =
            '<img class="miniprofilepicture" ' +
            'src="' +
            sanitize(
                profilePictureUrl
            ) +
            '" alt="" loading="lazy">';
    }

    const giftNickname =
        data.nickname ||
        (
            data.user &&
            data.user.nickname
        ) ||
        'ユーザー';

    const html =
        '<div ' +
        'data-streakid="' +
        sanitize(
            streakId
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
                    sanitize(
                        giftNickname
                    ) +
                    ':</b> ' +

                    '<span class="giftTitle">' +
                    safeDescribe +
                    '</span>' +

                    '<br>' +

                    '<span class="giftDetail">' +
                    timeText +
                    '</span>' +

                    '<div>' +

                        '<table>' +

                            '<tr>' +

                                '<td>' +
                                    giftImageHtml +
                                '</td>' +

                                '<td>' +

                                    '<span class="giftDetail">' +
                                    '名前: <b>' +
                                    safeGiftName +
                                    '</b>' +
                                    '</span>' +

                                    '<br>' +

                                    '<span class="giftDetail">' +
                                    'ID: <b>' +
                                    sanitize(
                                        giftId
                                    ) +
                                    '</b>' +
                                    '</span>' +

                                    '<br>' +

                                    '<span class="giftDetail">' +
                                    sanitize(
                                        repeatText
                                    ) +
                                    '</span>' +

                                    '<br>' +

                                    '<span class="giftDetail">' +
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
            .find(
                '[data-streakid]'
            )
            .filter(
                function () {

                    return (
                        $(this).attr(
                            'data-streakid'
                        ) === streakId
                    );
                }
            );

    /*
     * 既存ギフトなら更新。
     *
     * ここでは音を鳴らさない。
     */
    if (
        existing.length
    ) {

        existing.first().replaceWith(
            html
        );

        scrollGiftToBottom();

        return {
            added: false,
            element:
                container.find(
                    '[data-streakid]'
                ).last()
        };
    }

    /*
     * 本当に新しいギフトだけ追加。
     */
    container.append(
        html
    );

    const newElement =
        container
            .find(
                '[data-streakid]'
            )
            .last();

    scrollGiftToElement(
        newElement
    );

    return {
        added: true,
        element: newElement
    };
}


/* =========================================================
   GIFT SCROLL
========================================================= */

function scrollGiftToElement(element) {

    const container =
        location.href.includes(
            'obs.html'
        )
            ? $('.eventcontainer')
            : $('.giftcontainer');

    if (
        !container.length
    ) {

        return;
    }

    const target =
        container[0];

    target.scrollTop =
        target.scrollHeight;

    requestAnimationFrame(
        function () {

            target.scrollTop =
                target.scrollHeight;

            requestAnimationFrame(
                function () {

                    target.scrollTop =
                        target.scrollHeight;
                }
            );
        }
    );

    setTimeout(
        function () {

            target.scrollTop =
                target.scrollHeight;

        },
        50
    );

    setTimeout(
        function () {

            target.scrollTop =
                target.scrollHeight;

        },
        150
    );

    setTimeout(
        function () {

            target.scrollTop =
                target.scrollHeight;

        },
        300
    );
}


function scrollGiftToBottom() {

    const container =
        location.href.includes(
            'obs.html'
        )
            ? $('.eventcontainer')
            : $('.giftcontainer');

    if (
        !container.length
    ) {

        return;
    }

    const target =
        container[0];

    target.scrollTop =
        target.scrollHeight;

    requestAnimationFrame(
        function () {

            target.scrollTop =
                target.scrollHeight;

            requestAnimationFrame(
                function () {

                    target.scrollTop =
                        target.scrollHeight;
                }
            );
        }
    );

    setTimeout(
        function () {

            target.scrollTop =
                target.scrollHeight;

        },
        50
    );

    setTimeout(
        function () {

            target.scrollTop =
                target.scrollHeight;

        },
        150
    );

    setTimeout(
        function () {

            target.scrollTop =
                target.scrollHeight;

        },
        300
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
            .slice(
                0,
                200
            )
            .remove();
    }

    container
        .find('.temporary')
        .remove();

    const profilePictureUrl =
        data.profilePictureUrl ||
        '';

    let profileImageHtml =
        '';

    if (
        profilePictureUrl
    ) {

        profileImageHtml =
            '<img class="miniprofilepicture" ' +
            'src="' +
            sanitize(
                profilePictureUrl
            ) +
            '" alt="" loading="lazy">';
    }

    const chatNickname =
        data.nickname ||
        (
            data.user &&
            data.user.nickname
        ) ||
        'ユーザー';

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
                sanitize(
                    chatNickname
                ) +
                ':</b> ' +

                '<span style="color:' +
                sanitize(
                    color
                ) +
                '">' +
                sanitize(
                    text
                ) +
                '</span>' +

            '</span>' +

        '</div>'
    );

    if (
        container.hasClass(
            'chatcontainer'
        )
    ) {

        if (
            chatAutoScrollEnabled
        ) {

            scrollChatToBottom();
        }

    } else {

        container[0].scrollTop =
            container[0].scrollHeight;
    }
}


/* =========================================================
   VIEWER LIST
========================================================= */

function updateViewersFromRoomUser(msg) {

    if (
        !msg ||
        !Array.isArray(
            msg.ranks
        )
    ) {

        return;
    }

    msg.ranks.forEach(
        function (rankItem) {

            if (
                !rankItem ||
                !rankItem.user
            ) {

                return;
            }

            const user =
                rankItem.user;

            const id =
                user.id ||
                user.idStr ||
                user.displayId;

            if (
                !id
            ) {

                return;
            }

            viewerMap.set(
                String(id),
                {
                    id:
                        String(id),

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
        }
    );

    updateViewerList();
}


function updateViewerList() {

    const list =
        $('#viewerList');

    if (
        !list.length
    ) {

        return;
    }

    const viewers =
        Array.from(
            viewerMap.values()
        );

    list.empty();

    viewers.forEach(
        function (viewer) {

            const item =
                $('<div>')
                    .addClass(
                        'viewerItem'
                    );

            if (
                viewer.avatar
            ) {

                $('<img>')
                    .attr(
                        'src',
                        viewer.avatar
                    )
                    .attr(
                        'alt',
                        ''
                    )
                    .appendTo(
                        item
                    );
            }

            const text =
                $('<div>')
                    .addClass(
                        'viewerItemText'
                    );

            $('<div>')
                .addClass(
                    'viewerItemNickname'
                )
                .text(
                    viewer.nickname
                )
                .appendTo(
                    text
                );

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
                .appendTo(
                    text
                );

            item.append(
                text
            );

            list.append(
                item
            );
        }
    );

    $('#viewerCountText').text(
        '視聴者数: ' +
        viewerCount.toLocaleString()
    );
}


/* =========================================================
   VIEWER MENU
========================================================= */

function openViewerMenu() {

    $('#viewerSideMenu')
        .addClass(
            'open'
        );

    $('#viewerMenuOverlay')
        .addClass(
            'open'
        );
}


function closeViewerMenu() {

    $('#viewerSideMenu')
        .removeClass(
            'open'
        );

    $('#viewerMenuOverlay')
        .removeClass(
            'open'
        );
}


/* =========================================================
   ROOM USER
========================================================= */

connection.on(
    'roomUser',
    function (msg) {

        if (
            msg &&
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
   MEMBER
========================================================= */

let joinMsgDelay = 0;

connection.on(
    'member',
    function (msg) {

        if (
            window.settings.showJoins ===
            '0'
        ) {

            return;
        }

        const addDelay =
            250;

        let actualDelay =
            addDelay;

        if (
            joinMsgDelay >
            500
        ) {

            actualDelay =
                100;
        }

        if (
            joinMsgDelay >
            1000
        ) {

            actualDelay =
                0;
        }

        joinMsgDelay +=
            actualDelay;

        setTimeout(
            function () {

                joinMsgDelay -=
                    actualDelay;

                addChatItem(
                    '#21b2c2',
                    msg,
                    '参加しました',
                    true
                );

            },
            joinMsgDelay
        );
    }
);


/* =========================================================
   CHAT
========================================================= */

connection.on(
    'chat',
    function (msg) {

        if (
            window.settings.showChats ===
            '0'
        ) {

            return;
        }

        if (
            isDuplicateComment(msg)
        ) {

            return;
        }

        /*
         * 本物のコメントだけが
         * いいね表示の抑制を解除する。
         */
        likeMessageDisplayed =
            false;

        const comment =
            msg.comment ||
            msg.content ||
            '';

        addChatItem(
            '',
            msg,
            comment
        );
    }
);


/* =========================================================
   GIFT
========================================================= */

connection.on(
    'gift',
    function (data) {

        if (
            !isPendingStreak(data) &&
            Number(
                data.diamondCount ||
                0
            ) > 0
        ) {

            diamondsCount +=
                Number(
                    data.diamondCount ||
                    0
                ) *
                Number(
                    data.repeatCount ||
                    1
                );

            updateRoomStats();
        }

        if (
            window.settings.showGifts ===
            '0'
        ) {

            return;
        }

        const duplicate =
            isDuplicateGift(
                data
            );

        /*
         * 同じギフトイベントの
         * 更新処理。
         *
         * 表示だけ更新。
         * 音は鳴らさない。
         */
        if (
            duplicate
        ) {

            addGiftItem(
                data
            );

            if (
                data &&
                data.repeatEnd
            ) {

                const streakKey =
                    getGiftDuplicateKey(
                        data
                    );

                if (
                    streakKey
                ) {

                    activeGiftStreaks.delete(
                        streakKey
                    );
                }
            }

            return;
        }

        const streakKey =
            getGiftDuplicateKey(
                data
            );

        /*
         * 先にギフト欄へ追加する。
         */
        const result =
            addGiftItem(
                data
            );

        /*
         * 「新規カード追加」のときだけ
         * 音声を鳴らす。
         *
         * 既存カードの更新では鳴らさない。
         */
        if (
            result &&
            result.added
        ) {

            requestAnimationFrame(
                function () {

                    playGiftSound();
                }
            );
        }

        if (
            data &&
            data.repeatEnd
        ) {

            activeGiftStreaks.delete(
                streakKey
            );
        }
    }
);


/* =========================================================
   SOCIAL
========================================================= */

connection.on(
    'social',
    function (data) {

        if (
            window.settings.showFollows ===
            '0'
        ) {

            return;
        }

        let color =
            '#2fb816';

        if (
            data.displayType &&
            data.displayType.includes(
                'follow'
            )
        ) {

            color =
                '#ff005e';
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
    }
);


/* =========================================================
   LIKE
========================================================= */

connection.on(
    'like',
    function (data) {

        if (
            window.settings.showLikes ===
            '0'
        ) {

            return;
        }

        if (
            data &&
            typeof data.likeCount ===
            'number'
        ) {

            likeCount =
                data.likeCount;

        } else if (
            data &&
            typeof data.likeCountDelta ===
            'number'
        ) {

            likeCount +=
                data.likeCountDelta;

        } else {

            likeCount++;
        }

        updateRoomStats();

        /*
         * 最初のいいねだけ表示。
         *
         * member / social / joinでは
         * likeMessageDisplayedを解除しない。
         */
        if (
            likeMessageDisplayed
        ) {

            return;
        }

        likeMessageDisplayed =
            true;

        const messageData =
            data || {};

        addChatItem(
            '#ff6688',
            messageData,
            'ライブにいいねされました'
        );
    }
);


/* =========================================================
   STREAM END
========================================================= */

connection.on(
    'streamEnd',
    function () {

        $('#stateText').text(
            '配信は終了しました。'
        );

        if (
            window.settings.username
        ) {

            setTimeout(
                function () {

                    connect();

                },
                30000
            );
        }
    }
);