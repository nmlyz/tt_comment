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

let giftAudio = null;
let giftAudioUnlocked = false;

let giftAudioEnabled = true;

let giftAudioUrl = './tegami.mp3';

let rareGiftAudioUrl = './sakibare.mp3';

const giftAudioPool = [];
const GIFT_AUDIO_POOL_SIZE = 8;


/* =========================================================
   GIFT DUPLICATE
========================================================= */

const GIFT_DUPLICATE_WINDOW = 5000;

const recentGifts = new Map();

const activeGiftStreaks = new Set();


/* =========================================================
   GIFT INITIAL LOAD
========================================================= */

let giftInitialLoading = false;

let giftSoundReady = false;

let giftInitialTimer = null;

const GIFT_INITIAL_LOAD_WAIT = 1500;


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

            const match =
                url.pathname.match(/@([^/]+)/);

            if (match && match[1]) {
                return match[1];
            }
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

    return value.trim();
}


function loadUrlSettings() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    const username =
        params.get('username');

    if (username) {

        window.settings.username =
            normalizeUniqueId(username);
    }

    params.forEach((value, key) => {

        if (key !== 'username') {
            window.settings[key] = value;
        }
    });

    if (
        window.settings.giftSound
    ) {

        giftAudioUrl =
            String(
                window.settings.giftSound
            ).trim();

        if (!giftAudioUrl) {
            giftAudioUrl = './tegami.mp3';
        }
    }

    if (
        window.settings.giftMute === '1'
    ) {

        giftAudioEnabled = false;

    } else if (
        window.settings.giftMute === '0'
    ) {

        giftAudioEnabled = true;
    }
}


/* =========================================================
   GIFT AUDIO BUTTON
========================================================= */

function setupGiftAudioButton() {

    const button =
        $('#giftAudioButton');

    if (!button.length) {
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

    if (!button.length) {
        return;
    }

    if (giftAudioEnabled) {

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
   CHAT AUTO SCROLL BUTTON
========================================================= */

function setupChatAutoScrollButton() {

    const button =
        $('#chatAutoScrollButton');

    if (!button.length) {
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

    if (!button.length) {
        return;
    }

    if (chatAutoScrollEnabled) {

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

    if (!container.length) {
        return;
    }

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


/* =========================================================
   GIFT EXPAND BUTTON
========================================================= */

function setupGiftExpandButton() {

    const button =
        $('#giftExpandButton');

    if (!button.length) {
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

    if (!mainContent.length) {
        return;
    }

    if (giftExpanded) {

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

$(document).ready(() => {

    loadUrlSettings();

    setupGiftAudioButton();

    setupChatAutoScrollButton();

    setupGiftExpandButton();

    $('#connectButton').click(function () {

        unlockGiftAudio();

        connect();
    });

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
            window.settings.username
        );

        connect();
    }
});


/* =========================================================
   CONNECT
========================================================= */

function connect() {

    recentGifts.clear();

    activeGiftStreaks.clear();

    giftInitialLoading = true;
    giftSoundReady = false;

    if (giftInitialTimer) {

        clearTimeout(
            giftInitialTimer
        );

        giftInitialTimer = null;
    }

    let uniqueId =
        window.settings.username ||
        $('#uniqueIdInput').val();

    uniqueId =
        normalizeUniqueId(uniqueId);

    if (uniqueId !== '') {

        $('#stateText').text(
            '接続中...'
        );

        connection.connect(
            uniqueId,
            {
                enableExtendedGiftInfo: true
            }
        ).then(state => {

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

            giftInitialTimer =
                setTimeout(
                    function () {

                        giftInitialLoading =
                            false;

                        giftSoundReady =
                            true;

                        giftInitialTimer =
                            null;

                    },
                    GIFT_INITIAL_LOAD_WAIT
                );

        }).catch(errorMessage => {

            giftInitialLoading =
                false;

            giftSoundReady =
                false;

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

        giftInitialLoading =
            false;

        giftSoundReady =
            false;

        alert(
            'ユーザーIDを入力してください。'
        );
    }
}


/* =========================================================
   QUERY URL COPY
========================================================= */

function copyQueryUrl() {

    let username =
        $('#uniqueIdInput').val();

    username =
        normalizeUniqueId(username);

    if (!username) {

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

        navigator.clipboard.writeText(url)
            .then(() => {

                const button =
                    $('#copyUrlButton');

                const oldText =
                    button.text();

                button.text(
                    'コピーしました'
                );

                setTimeout(() => {

                    button.text(
                        oldText
                    );

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

    document.body.removeChild(
        textarea
    );
}


/* =========================================================
   OBS
========================================================= */

function generateOverlay() {

    let username =
        $('#uniqueIdInput').val();

    username =
        normalizeUniqueId(username);

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
   BASIC
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

    const safeId =
        sanitize(uniqueId);

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
            String(
                data.common.msgId
            );
    }

    if (
        data &&
        data.msgId
    ) {

        return 'msg:' +
            String(data.msgId);
    }

    if (
        data &&
        data.common &&
        data.common.logId
    ) {

        return 'log:' +
            String(
                data.common.logId
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
        getCommentDuplicateKey(data);

    if (!key) {
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
   GIFT
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
        String(userId || '') +
        '_' +
        String(giftId || '')
    );
}


function isDuplicateGift(data) {

    const key =
        getGiftDuplicateKey(data);

    if (!key) {
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
   GIFT AUDIO POOL
========================================================= */

function prepareGiftAudioPool() {

    if (
        giftAudioPool.length > 0
    ) {

        return;
    }

    for (
        let i = 0;
        i < GIFT_AUDIO_POOL_SIZE;
        i++
    ) {

        const audio =
            new Audio(
                giftAudioUrl
            );

        audio.preload =
            'auto';

        audio.volume =
            1.0;

        audio._giftSoundUrl =
            giftAudioUrl;

        giftAudioPool.push(
            audio
        );
    }

    if (
        !giftAudio &&
        giftAudioPool.length > 0
    ) {

        giftAudio =
            giftAudioPool[0];
    }
}


function unlockGiftAudio() {

    if (
        giftAudioUnlocked
    ) {

        return;
    }

    try {

        prepareGiftAudioPool();

        let unlockIndex =
            0;

        function unlockNext() {

            if (
                unlockIndex >=
                giftAudioPool.length
            ) {

                giftAudioUnlocked =
                    true;

                return;
            }

            const audio =
                giftAudioPool[
                    unlockIndex
                ];

            unlockIndex++;

            audio.muted =
                true;

            audio.currentTime =
                0;

            const promise =
                audio.play();

            if (promise) {

                promise.then(() => {

                    audio.pause();

                    audio.currentTime =
                        0;

                    audio.muted =
                        false;

                    unlockNext();

                }).catch(error => {

                    audio.muted =
                        false;

                    console.warn(
                        'Gift audio unlock failed:',
                        error
                    );

                    unlockNext();
                });

            } else {

                audio.pause();

                audio.currentTime =
                    0;

                audio.muted =
                    false;

                unlockNext();
            }
        }

        unlockNext();

    } catch (e) {

        console.warn(
            'Gift audio unlock failed:',
            e
        );
    }
}


/* =========================================================
   PLAY GIFT SOUND
========================================================= */

function playGiftSound() {

    if (!giftAudioEnabled) {
        return;
    }

    if (!giftSoundReady) {
        return;
    }

    try {

        prepareGiftAudioPool();

        /*
         * 1～50
         *
         * 1      → durandal
         * 2～50  → tegami
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

        let audio =
            null;

        for (
            let i = 0;
            i < giftAudioPool.length;
            i++
        ) {

            const candidate =
                giftAudioPool[i];

            if (
                candidate._giftSoundUrl !==
                soundUrl
            ) {

                continue;
            }

            if (
                candidate.paused ||
                candidate.ended
            ) {

                audio =
                    candidate;

                break;
            }
        }

        if (!audio) {

            audio =
                new Audio(
                    soundUrl
                );

            audio.preload =
                'auto';

            audio.volume =
                1.0;

            audio._giftSoundUrl =
                soundUrl;

            giftAudioPool.push(
                audio
            );
        }

        if (
            audio._giftSoundUrl !==
            soundUrl
        ) {

            audio.src =
                soundUrl;

            audio._giftSoundUrl =
                soundUrl;

            audio.load();
        }

        if (
            audio.ended ||
            (
                Number.isFinite(
                    audio.duration
                ) &&
                audio.currentTime >=
                audio.duration
            )
        ) {

            audio.currentTime =
                0;
        }

        audio.muted =
            false;

        const promise =
            audio.play();

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
   ADD GIFT ITEM
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
        sanitize(giftName);

    const safeDescribe =
        sanitize(
            String(describe)
                .replace(
                    /^Sent\s+/i,
                    ''
                )
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

    let giftImageHtml =
        '';

    if (giftPictureUrl) {

        giftImageHtml =
            '<img class="gifticon" ' +
            'src="' +
            sanitize(
                giftPictureUrl
            ) +
            '" ' +
            'alt="" ' +
            'loading="lazy">';
    }

    let profileImageHtml =
        '';

    if (profilePictureUrl) {

        profileImageHtml =
            '<img class="miniprofilepicture" ' +
            'src="' +
            sanitize(
                profilePictureUrl
            ) +
            '" ' +
            'alt="" ' +
            'loading="lazy">';
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
        sanitize(streakId) +
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
                                    sanitize(
                                        giftId
                                    ) +
                                    '</b>' +
                                    '</span>' +

                                    '<br>' +

                                    '<span ' +
                                    'class="giftDetail">' +
                                    sanitize(
                                        repeatText
                                    ) +
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
     */
    if (
        existing.length
    ) {

        existing.first()
            .replaceWith(
                html
            );

        /*
         * 更新された場合も、
         * 必ずギフト欄の最下部へ。
         */
        scrollGiftToBottom();

        return {
            added: false,
            element:
                container
                    .find(
                        '[data-streakid="' +
                        CSS.escape(
                            streakId
                        ) +
                        '"]'
                    )
                    .last()
        };
    }

    /*
     * 新規ギフト。
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

    /*
     * 新規追加直後に最下部へ。
     */
    scrollGiftToBottom();

    /*
     * DOM反映後にも再度最下部へ。
     */
    requestAnimationFrame(
        function () {

            scrollGiftToBottom();
        }
    );

    return {
        added: true,
        element: newElement
    };
}


/* =========================================================
   GIFT SCROLL
========================================================= */

/*
 * ギフト欄そのものを必ず一番下へ移動する。
 *
 * offsetTopなどの要素位置計算は使用しない。
 * stickyヘッダーや画像読み込みで位置がズレるため、
 * scrollHeightだけを基準にする。
 */
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

    const element =
        container[0];

    function forceScroll() {

        if (!element) {
            return;
        }

        element.scrollTop =
            element.scrollHeight;
    }

    /*
     * 即時
     */
    forceScroll();

    /*
     * ブラウザがDOMを反映した後
     */
    requestAnimationFrame(
        function () {

            forceScroll();

            requestAnimationFrame(
                function () {

                    forceScroll();
                }
            );
        }
    );

    /*
     * 画像・レイアウト反映後
     */
    setTimeout(
        function () {

            forceScroll();

        },
        30
    );

    setTimeout(
        function () {

            forceScroll();

        },
        80
    );

    setTimeout(
        function () {

            forceScroll();

        },
        150
    );

    setTimeout(
        function () {

            forceScroll();

        },
        300
    );
}


/*
 * 互換用。
 *
 * 既存コードから呼ばれても、
 * 常にギフト欄の一番下へ移動する。
 */
function scrollGiftToElement(element) {

    scrollGiftToBottom();
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
            .slice(0, 200)
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

    if (profilePictureUrl) {

        profileImageHtml =
            '<img class="miniprofilepicture" ' +
            'src="' +
            sanitize(
                profilePictureUrl
            ) +
            '" ' +
            'alt="" ' +
            'loading="lazy">';
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
                sanitize(color) +
                '">' +
                sanitize(text) +
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
}


/* =========================================================
   VIEWERS
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
        rankItem => {

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
                            user.avatarThumb
                                .urlList
                        ) &&
                        user.avatarThumb
                            .urlList
                            .length
                            ? user.avatarThumb
                                .urlList[0]
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

    if (!list.length) {
        return;
    }

    const viewers =
        Array.from(
            viewerMap.values()
        );

    list.empty();

    viewers.forEach(
        viewer => {

            const item =
                $('<div>')
                    .addClass(
                        'viewerItem'
                    );

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
    (msg) => {

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
    (msg) => {

        if (
            window.settings.showJoins ===
            "0"
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
            () => {

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
   CHAT EVENT
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

        if (
            isDuplicateComment(msg)
        ) {

            return;
        }

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
   GIFT EVENT
========================================================= */

connection.on(
    'gift',
    (data) => {

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
            "0"
        ) {

            return;
        }

        const duplicate =
            isDuplicateGift(
                data
            );

        /*
         * 重複イベント。
         *
         * 表示更新のみ。
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

                if (streakKey) {

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
         * 先にギフトを実際にDOMへ追加。
         */
        const result =
            addGiftItem(
                data
            );

        /*
         * 新規カードとして追加された場合だけ音を鳴らす。
         */
        if (
            result &&
            result.added &&
            giftSoundReady
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
    (data) => {

        if (
            window.settings.showFollows ===
            "0"
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
    (data) => {

        if (
            window.settings.showLikes ===
            "0"
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
    () => {

        $('#stateText').text(
            '配信は終了しました。'
        );

        giftInitialLoading =
            false;

        giftSoundReady =
            false;

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