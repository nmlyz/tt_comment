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
   GIFT AUDIO SETTINGS
========================================================= */

const TEGAMI_AUDIO_URL =
    './tegami.mp3';

const TEGAMI_CHANCE_DENOMINATOR =
    10;


const DURANDAL_AUDIO_URL =
    './durandal.mp3';

const DURANDAL_CHANCE_DENOMINATOR =
    50;


const DAINSLEIF_AUDIO_URL =
    './dainsleif.mp3';

const DAINSLEIF_CHANCE_DENOMINATOR =
    100;


const NORMAL_GIFT_AUDIO_URL =
    './normal.mp3';


let giftAudioUrl =
    NORMAL_GIFT_AUDIO_URL;


let giftAudioEnabled =
    true;


let giftAudioUnlocked =
    false;


let audioInteractionListenerInstalled =
    false;

let audioInteractionUnlocked =
    false;


const activeGiftAudios =
    new Set();


const MAX_ACTIVE_GIFT_AUDIOS =
    100;


/* =========================================================
   BGM SETTINGS
========================================================= */

const BGM_AUDIO_URL =
    './bgm.mp3';


const BGM_GAIN =
    0.05;


let bgmEnabled =
    false;


let bgmAudio =
    null;


let bgmAudioContext =
    null;


let bgmSourceNode =
    null;


let bgmGainNode =
    null;


/* =========================================================
   GIFT DUPLICATE
========================================================= */

const displayedGiftKeys =
    new Set();


/* =========================================================
   CHAT AUTO SCROLL
========================================================= */

let chatAutoScrollEnabled =
    true;


/* =========================================================
   GIFT EXPAND
========================================================= */

let giftExpanded =
    false;


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


    value =
        String(value).trim();


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


function loadUrlSettings() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const username =
        params.get('username');


    if (username) {

        window.settings.username =
            normalizeUniqueId(
                username
            );
    }


    params.forEach(
        (value, key) => {

            if (
                key !== 'username'
            ) {

                window.settings[key] =
                    value;
            }
        }
    );


    /*
     * giftSound
     */
    if (
        window.settings.giftSound
    ) {

        giftAudioUrl =
            String(
                window.settings.giftSound
            ).trim();


        if (!giftAudioUrl) {

            giftAudioUrl =
                NORMAL_GIFT_AUDIO_URL;
        }
    }


    /*
     * giftMute
     *
     * 0 = ON
     * 1 = OFF
     */
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
   AUDIO UNLOCK
========================================================= */

function setupFirstInteractionAudioUnlock() {

    if (
        audioInteractionListenerInstalled
    ) {

        return;
    }


    audioInteractionListenerInstalled =
        true;


    const handleFirstInteraction =
        function (event) {

            /*
             * BGMボタン・ギフト音ボタンのクリックは
             * それぞれのボタン側で処理する。
             *
             * ここでは何もしない。
             */
            if (
                event &&
                event.target &&
                (
                    $(event.target).closest(
                        '#bgmButton'
                    ).length ||
                    $(event.target).closest(
                        '#giftAudioButton'
                    ).length
                )
            ) {

                return;
            }


            if (
                audioInteractionUnlocked
            ) {

                return;
            }


            if (
                !giftAudioEnabled
            ) {

                return;
            }


            audioInteractionUnlocked =
                true;


            unlockGiftAudio();
        };


    document.addEventListener(
        'touchend',
        handleFirstInteraction,
        {
            passive: true
        }
    );


    document.addEventListener(
        'click',
        handleFirstInteraction,
        {
            passive: true
        }
    );


    document.addEventListener(
        'keydown',
        handleFirstInteraction,
        {
            passive: true
        }
    );
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
        async function (event) {

            /*
             * document側の
             * first interaction処理に
             * 伝播させない。
             */
            event.stopPropagation();


            giftAudioEnabled =
                !giftAudioEnabled;


            if (
                giftAudioEnabled
            ) {

                audioInteractionUnlocked =
                    true;


                await unlockGiftAudio();
            }


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
   BGM BUTTON
========================================================= */

function setupBgmButton() {

    const button =
        $('#bgmButton');


    if (
        !button.length
    ) {

        console.warn(
            '[DEBUG] #bgmButton が見つかりません'
        );

        return;
    }


    button.off(
        'click'
    );


    button.on(
        'click',
        async function (event) {

            /*
             * ここが重要。
             *
             * BGMボタンのクリックを
             * documentまで伝播させない。
             *
             * これによってBGMボタンを押した瞬間に
             * gift.mp3 / tegami.mp3などの
             * unlock処理が走ることを防ぐ。
             */
            event.stopPropagation();


            bgmEnabled =
                !bgmEnabled;


            if (
                bgmEnabled
            ) {

                /*
                 * BGMの開始だけ行う。
                 *
                 * ギフト音unlockは絶対に行わない。
                 */
                await startBgm();

            } else {

                stopBgm();
            }


            updateBgmButton();
        }
    );


    updateBgmButton();
}


function updateBgmButton() {

    const button =
        $('#bgmButton');


    if (
        !button.length
    ) {

        return;
    }


    if (
        bgmEnabled
    ) {

        button.text(
            '🎵'
        );


        button.attr(
            'title',
            'BGMをオフ'
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
            'BGMをオン'
        );


        button.addClass(
            'audioOff'
        );
    }
}


/* =========================================================
   BGM AUDIO CONTEXT
========================================================= */

function getBgmAudioContext() {

    if (
        bgmAudioContext
    ) {

        return bgmAudioContext;
    }


    const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;


    if (
        !AudioContextClass
    ) {

        console.warn(
            '[DEBUG] Web Audio API unavailable'
        );

        return null;
    }


    try {

        bgmAudioContext =
            new AudioContextClass();

    } catch (e) {

        console.warn(
            '[DEBUG] AudioContext create error:',
            e
        );


        bgmAudioContext =
            null;
    }


    return bgmAudioContext;
}


/* =========================================================
   BGM PLAY
========================================================= */

async function startBgm() {

    if (
        !bgmEnabled
    ) {

        return;
    }


    try {

        const context =
            getBgmAudioContext();


        /*
         * Web Audio APIが使用できない場合。
         */
        if (
            !context
        ) {

            await startBgmFallback();

            return;
        }


        /*
         * AudioContextが停止中なら
         * ユーザー操作からresumeする。
         */
        if (
            context.state ===
            'suspended'
        ) {

            try {

                await context.resume();

            } catch (error) {

                console.warn(
                    '[DEBUG] BGM AudioContext resume error:',
                    error
                );

                return;
            }
        }


        /*
         * Audio作成。
         */
        if (
            !bgmAudio
        ) {

            bgmAudio =
                new Audio(
                    BGM_AUDIO_URL
                );


            bgmAudio.preload =
                'auto';


            bgmAudio.loop =
                true;


            bgmAudio.volume =
                1.0;


            bgmAudio.addEventListener(
                'error',
                function (error) {

                    console.warn(
                        '[DEBUG] BGM playback error:',
                        error,
                        bgmAudio.error
                    );
                }
            );
        }


        /*
         * MediaElementSourceは
         * 同じAudio要素に対して一度だけ。
         */
        if (
            !bgmSourceNode
        ) {

            bgmSourceNode =
                context.createMediaElementSource(
                    bgmAudio
                );
        }


        /*
         * GainNode作成。
         */
        if (
            !bgmGainNode
        ) {

            bgmGainNode =
                context.createGain();


            bgmSourceNode.connect(
                bgmGainNode
            );


            bgmGainNode.connect(
                context.destination
            );
        }


        /*
         * BGM音量。
         */
        bgmGainNode.gain.value =
            BGM_GAIN;


        /*
         * すでに再生中なら
         * 二重再生しない。
         */
        if (
            !bgmAudio.paused
        ) {

            console.log(
                '[DEBUG] BGM already playing'
            );

            return;
        }


        /*
         * BGM開始。
         */
        await bgmAudio.play();


        console.log(
            '[DEBUG] BGM started'
        );


        console.log(
            '[DEBUG] BGM gain:',
            BGM_GAIN
        );


    } catch (e) {

        console.warn(
            '[DEBUG] BGM start error:',
            e
        );
    }
}


/* =========================================================
   BGM FALLBACK
========================================================= */

async function startBgmFallback() {

    try {

        if (
            !bgmAudio
        ) {

            bgmAudio =
                new Audio(
                    BGM_AUDIO_URL
                );


            bgmAudio.preload =
                'auto';


            bgmAudio.loop =
                true;


            bgmAudio.volume =
                BGM_GAIN;


            bgmAudio.addEventListener(
                'error',
                function (error) {

                    console.warn(
                        '[DEBUG] BGM fallback playback error:',
                        error,
                        bgmAudio.error
                    );
                }
            );
        }


        if (
            !bgmAudio.paused
        ) {

            return;
        }


        await bgmAudio.play();


        console.log(
            '[DEBUG] BGM fallback started'
        );


    } catch (e) {

        console.warn(
            '[DEBUG] BGM fallback blocked:',
            e
        );
    }
}


/* =========================================================
   BGM STOP
========================================================= */

function stopBgm() {

    if (
        !bgmAudio
    ) {

        return;
    }


    try {

        bgmAudio.pause();

    } catch (e) {

        console.warn(
            '[DEBUG] BGM stop error:',
            e
        );
    }
}


/* =========================================================
   CHAT AUTO SCROLL BUTTON
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
    () => {

        loadUrlSettings();


        setupGiftAudioButton();


        setupBgmButton();


        setupChatAutoScrollButton();


        setupGiftExpandButton();


        setupFirstInteractionAudioUnlock();


        /*
         * Connectボタン。
         *
         * ギフト音のunlockは
         * Connectボタンを押したときだけ行う。
         */
        $('#connectButton').click(
            async function () {

                if (
                    giftAudioEnabled
                ) {

                    audioInteractionUnlocked =
                        true;


                    await unlockGiftAudio();
                }


                connect();
            }
        );


        /*
         * Enterから接続。
         */
        $('#uniqueIdInput').on(
            'keyup',
            async function (e) {

                if (
                    e.key === 'Enter'
                ) {

                    if (
                        giftAudioEnabled
                    ) {

                        audioInteractionUnlocked =
                            true;


                        await unlockGiftAudio();
                    }


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


        /*
         * クエリ接続。
         *
         * ここではギフト音unlockをしない。
         *
         * そのため自動接続時に
         * 勝手に音が鳴ることもない。
         */
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
   CONNECT
========================================================= */

function connect() {

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
            state => {

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
            }
        ).catch(
            errorMessage => {

                $('#stateText').text(
                    String(
                        errorMessage
                    )
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


/* =========================================================
   QUERY URL COPY
========================================================= */

function copyQueryUrl() {

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
        )
        .then(
            () => {

                const button =
                    $('#copyUrlButton');


                const oldText =
                    button.text();


                button.text(
                    'コピーしました'
                );


                setTimeout(
                    () => {

                        button.text(
                            oldText
                        );

                    },
                    1500
                );
            }
        )
        .catch(
            () => {

                fallbackCopy(
                    url
                );
            }
        );

    } else {

        fallbackCopy(
            url
        );
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
            () => {

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
   OBS
========================================================= */

function generateOverlay() {

    let username =
        $('#uniqueIdInput').val();


    username =
        normalizeUniqueId(
            username
        );


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
        sanitize(
            uniqueId
        );


    if (!safeId) {

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
            String(
                data.msgId
            );
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
        getCommentDuplicateKey(
            data
        );


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


/* =========================================================
   GIFT DUPLICATE KEY
========================================================= */

function getGiftDuplicateKey(data) {

    const userId =
        data &&
        data.userId !== undefined &&
        data.userId !== null
            ? String(
                data.userId
            )
            : '';


    const giftId =
        data &&
        data.giftId !== undefined &&
        data.giftId !== null
            ? String(
                data.giftId
            )
            : '';


    let createTime = '';


    if (
        data &&
        data.common &&
        data.common.createTime !== undefined &&
        data.common.createTime !== null
    ) {

        createTime =
            String(
                data.common.createTime
            );

    } else if (
        data &&
        data.createTime !== undefined &&
        data.createTime !== null
    ) {

        createTime =
            String(
                data.createTime
            );
    }


    if (createTime) {

        return (
            userId +
            '_' +
            giftId +
            '_' +
            createTime
        );
    }


    return (
        userId +
        '_' +
        giftId
    );
}


/* =========================================================
   GIFT AUDIO UNLOCK
========================================================= */

async function unlockGiftAudio() {

    if (
        giftAudioUnlocked
    ) {

        return true;
    }


    /*
     * 各ギフト音をミュート状態で
     * ユーザー操作中にunlockする。
     *
     * ここでは絶対に音を聞かせない。
     */
    const urls = [
        NORMAL_GIFT_AUDIO_URL,
        TEGAMI_AUDIO_URL,
        DURANDAL_AUDIO_URL,
        DAINSLEIF_AUDIO_URL
    ];


    const uniqueUrls =
        Array.from(
            new Set(
                urls
            )
        );


    let successCount =
        0;


    for (
        const url of uniqueUrls
    ) {

        try {

            const audio =
                new Audio(
                    url
                );


            audio.preload =
                'auto';


            audio.muted =
                true;


            audio.volume =
                0;


            const promise =
                audio.play();


            if (promise) {

                await promise;
            }


            audio.pause();


            try {

                audio.currentTime =
                    0;

            } catch (e) {
            }


            audio.muted =
                false;


            audio.volume =
                1.0;


            successCount++;

        } catch (error) {

            console.warn(
                '[DEBUG] Gift audio unlock failed:',
                url,
                error
            );
        }
    }


    if (
        successCount > 0
    ) {

        giftAudioUnlocked =
            true;


        console.log(
            '[DEBUG] Gift audio unlocked:',
            successCount +
            '/' +
            uniqueUrls.length
        );


        return true;
    }


    console.warn(
        '[DEBUG] No gift audio could be unlocked'
    );


    return false;
}


/* =========================================================
   GIFT AUDIO RANDOM
========================================================= */

function selectGiftAudioUrl() {

    const maxDenominator =
        Math.max(
            1,
            TEGAMI_CHANCE_DENOMINATOR,
            DURANDAL_CHANCE_DENOMINATOR,
            DAINSLEIF_CHANCE_DENOMINATOR
        );


    const random =
        Math.floor(
            Math.random() *
            maxDenominator
        ) + 1;


    /*
     * 10%
     */
    if (
        random <=
        TEGAMI_CHANCE_DENOMINATOR
    ) {

        console.log(
            '[DEBUG] Gift sound:',
            TEGAMI_AUDIO_URL
        );


        return TEGAMI_AUDIO_URL;
    }


    /*
     * 2%
     */
    const durandalStart =
        TEGAMI_CHANCE_DENOMINATOR +
        1;


    const durandalEnd =
        TEGAMI_CHANCE_DENOMINATOR +
        Math.floor(
            maxDenominator /
            DURANDAL_CHANCE_DENOMINATOR
        );


    if (
        random >= durandalStart &&
        random <= durandalEnd
    ) {

        console.log(
            '[DEBUG] Gift sound:',
            DURANDAL_AUDIO_URL
        );


        return DURANDAL_AUDIO_URL;
    }


    /*
     * 1%
     */
    const dainsleifStart =
        durandalEnd +
        1;


    const dainsleifEnd =
        dainsleifStart +
        Math.floor(
            maxDenominator /
            DAINSLEIF_CHANCE_DENOMINATOR
        ) -
        1;


    if (
        random >= dainsleifStart &&
        random <= dainsleifEnd
    ) {

        console.log(
            '[DEBUG] Gift sound:',
            DAINSLEIF_AUDIO_URL
        );


        return DAINSLEIF_AUDIO_URL;
    }


    /*
     * 残りは通常音。
     *
     * giftSoundクエリ指定時は
     * その音が通常音になる。
     */
    console.log(
        '[DEBUG] Gift sound:',
        giftAudioUrl
    );


    return giftAudioUrl;
}


/* =========================================================
   GIFT AUDIO PLAY
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

        console.log(
            '[DEBUG] Gift audio waiting for unlock'
        );


        return;
    }


    const soundUrl =
        selectGiftAudioUrl();


    let audio;


    try {

        /*
         * 毎回新しいAudioを作る。
         *
         * 前の音を止めないので
         * 複数ギフト音を重ねて再生可能。
         */
        audio =
            new Audio(
                soundUrl
            );


        audio.preload =
            'auto';


        audio.volume =
            1.0;


        activeGiftAudios.add(
            audio
        );


        if (
            activeGiftAudios.size >
            MAX_ACTIVE_GIFT_AUDIOS
        ) {

            console.warn(
                '[DEBUG] Too many active gift audios:',
                activeGiftAudios.size
            );
        }


        const cleanup =
            function () {

                activeGiftAudios.delete(
                    audio
                );


                audio.onended =
                    null;


                audio.onerror =
                    null;


                audio.onabort =
                    null;


                try {

                    audio.pause();

                } catch (e) {
                }


                audio.src =
                    '';


                try {

                    audio.load();

                } catch (e) {
                }
            };


        audio.onended =
            cleanup;


        audio.onerror =
            function (error) {

                console.warn(
                    '[DEBUG] Gift audio playback error:',
                    soundUrl,
                    error,
                    audio.error
                );


                cleanup();
            };


        audio.onabort =
            cleanup;


        const promise =
            audio.play();


        if (promise) {

            promise.then(
                function () {

                    console.log(
                        '[DEBUG] Gift audio started:',
                        soundUrl
                    );

                }
            ).catch(
                function (error) {

                    console.warn(
                        '[DEBUG] Gift audio play blocked:',
                        soundUrl,
                        error
                    );


                    cleanup();
                }
            );
        }


    } catch (e) {

        console.warn(
            '[DEBUG] Gift audio create error:',
            soundUrl,
            e
        );
    }
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
   GIFT DISPLAY
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


    const giftDuplicateKey =
        getGiftDuplicateKey(
            data
        );


    if (
        displayedGiftKeys.has(
            giftDuplicateKey
        )
    ) {

        return;
    }


    displayedGiftKeys.add(
        giftDuplicateKey
    );


    if (
        displayedGiftKeys.size >
        5000
    ) {

        const keys =
            Array.from(
                displayedGiftKeys
            );


        const removeCount =
            keys.length - 4000;


        for (
            let i = 0;
            i < removeCount;
            i++
        ) {

            displayedGiftKeys.delete(
                keys[i]
            );
        }
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
        isPendingStreak(
            data
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


    if (
        giftPictureUrl
    ) {

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


    if (
        profilePictureUrl
    ) {

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


    const html =
        '<div ' +
        'data-streakid="' +
        sanitize(
            pending
                ? streakId
                : ''
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
                    generateUsernameLink(
                        data
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


    if (
        pending &&
        existing.length
    ) {

        existing.first()
            .replaceWith(
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
                generateUsernameLink(
                    data
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
        viewer => {

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


        /*
         * 実際のコメントだけが
         * いいね表示の抑制を解除。
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


        addGiftItem(
            data
        );


        /*
         * ギフトが来たときだけ
         * ギフト音を鳴らす。
         */
        playGiftSound();
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