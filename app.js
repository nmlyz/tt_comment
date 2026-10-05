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

const TEGAMI_AUDIO_URL =
    './tegami.mp3';

const TEGAMI_CHANCE_DENOMINATOR =
    30;

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
    false;

let giftAudioUnlocked =
    false;

let audioInteractionListenerInstalled =
    false;

let audioInteractionUnlocked =
    false;


/*
 * 現在再生中のギフト音声。
 *
 * 以前の「最大3個」という制限は撤廃。
 * 何個でも同時に再生可能。
 * (AudioBufferSourceNode / HTMLAudioElement 両方入る)
 */
const activeGiftAudios =
    new Set();


/*
 * ギフト音声増幅。
 *
 * 以前は3.0。
 * Web Audio側で増幅し、
 * 後段のリミッターで音割れを抑える。
 *
 * もっと大きくしたい場合はこの値を上げる。
 */
const GIFT_AUDIO_GAIN =
    10.0;


let giftAudioContext =
    null;

/* マスターGain → リミッター → destination */
let giftMasterGain =
    null;

let giftLimiter =
    null;

/* 無音keepalive（AudioContextのsuspend防止） */
let giftKeepAliveStarted =
    false;

/*
 * ギフト音のデコード済みバッファ。
 *
 * new Audio().play() はiOS WebView等で
 * 「ユーザー操作の数秒後」にブロックされる。
 * AudioContextさえrunningなら
 * BufferSourceは操作なしで鳴らせるので、
 * こちらをメインの再生経路にする。
 */
const giftBuffers =
    new Map();

const giftBufferPromises =
    new Map();

const giftBufferFailed =
    new Set();

let giftWatchdogInstalled =
    false;

let persistentResumeInstalled =
    false;


/* =========================================================
   BGM
========================================================= */

const BGM_AUDIO_URL =
    './bgm.mp3';

const BGM_VOLUME =
    0.05;

let bgmEnabled =
    false;

let bgmAudio =
    null;

const BGM_PLAYBACK_RATE =
    1.0;

let bgmEventsInstalled =
    false;


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
   USER ID
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


/* =========================================================
   URL SETTINGS
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
     * giftMute=0 → ON
     * giftMute=1 → OFF
     *
     * 指定なし → OFF
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

    } else {

        giftAudioEnabled =
            false;
    }
}


/* =========================================================
   GIFT AUDIO CONTEXT
========================================================= */

function createGiftAudioContext() {

    if (
        giftAudioContext
    ) {

        return giftAudioContext;
    }

    const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

    if (
        !AudioContextClass
    ) {

        console.warn(
            '[DEBUG] Web Audio API is unavailable'
        );

        return null;
    }

    try {

        giftAudioContext =
            new AudioContextClass();


        /*
         * マスター: Gain → Limiter → destination
         *
         * 増幅しても音割れしにくくする。
         */
        giftMasterGain =
            giftAudioContext.createGain();

        giftMasterGain.gain.value =
            1.0;

        try {

            giftLimiter =
                giftAudioContext.createDynamicsCompressor();

            giftLimiter.threshold.value =
                -3;

            giftLimiter.knee.value =
                0;

            giftLimiter.ratio.value =
                20;

            giftLimiter.attack.value =
                0.003;

            giftLimiter.release.value =
                0.1;

            giftMasterGain.connect(
                giftLimiter
            );

            giftLimiter.connect(
                giftAudioContext.destination
            );

        } catch (e) {

            console.warn(
                '[DEBUG] Limiter create error:',
                e
            );

            giftLimiter =
                null;

            try {

                giftMasterGain.disconnect();

            } catch (e2) {
            }

            giftMasterGain.connect(
                giftAudioContext.destination
            );
        }


        /*
         * suspend / interrupted になったら
         * 自動で復帰を試みる。
         */
        giftAudioContext.onstatechange =
            function () {

                console.log(
                    '[DEBUG] AudioContext state:',
                    giftAudioContext.state
                );

                if (
                    giftAudioEnabled &&
                    giftAudioContext.state !== 'running'
                ) {

                    try {

                        const p =
                            giftAudioContext.resume();

                        if (
                            p &&
                            p.catch
                        ) {

                            p.catch(
                                function () {
                                }
                            );
                        }

                    } catch (e) {
                    }
                }
            };


        return giftAudioContext;

    } catch (e) {

        console.warn(
            '[DEBUG] AudioContext create error:',
            e
        );

        giftAudioContext =
            null;

        giftMasterGain =
            null;

        giftLimiter =
            null;

        return null;
    }
}


/* =========================================================
   GIFT AUDIO CONTEXT RESUME
========================================================= */

async function resumeGiftAudioContext() {

    const context =
        createGiftAudioContext();

    if (!context) {
        return false;
    }

    try {

        if (
            context.state !== 'running'
        ) {

            /*
             * 操作なしのresume()は
             * 返ってこないことがあるので
             * タイムアウト付き。
             */
            await Promise.race([
                context.resume(),
                new Promise(
                    function (resolve) {

                        setTimeout(
                            resolve,
                            400
                        );
                    }
                )
            ]);
        }

        return (
            context.state === 'running'
        );

    } catch (e) {

        console.warn(
            '[DEBUG] AudioContext resume error:',
            e
        );

        return false;
    }
}


/* =========================================================
   GIFT AUDIO KEEPALIVE
========================================================= */

/*
 * ほぼ無音のOscillatorを鳴らし続けて
 * AudioContextがsuspendされにくくする。
 */
function startGiftKeepAlive() {

    if (
        giftKeepAliveStarted
    ) {

        return;
    }


    const context =
        giftAudioContext;


    if (
        !context ||
        context.state !== 'running'
    ) {

        return;
    }


    try {

        const oscillator =
            context.createOscillator();

        const gain =
            context.createGain();

        gain.gain.value =
            0.00001;

        oscillator.frequency.value =
            20;

        oscillator.connect(
            gain
        );

        gain.connect(
            context.destination
        );

        oscillator.start();

        giftKeepAliveStarted =
            true;

    } catch (e) {

        console.warn(
            '[DEBUG] Gift keepalive error:',
            e
        );
    }
}


/* =========================================================
   GIFT AUDIO BUFFER
========================================================= */

function loadGiftBuffer(url) {

    if (
        giftBuffers.has(url)
    ) {

        return Promise.resolve(
            giftBuffers.get(url)
        );
    }


    if (
        giftBufferFailed.has(url)
    ) {

        return Promise.resolve(
            null
        );
    }


    if (
        giftBufferPromises.has(url)
    ) {

        return giftBufferPromises.get(
            url
        );
    }


    const context =
        createGiftAudioContext();


    if (!context) {

        return Promise.resolve(
            null
        );
    }


    const promise =
        fetch(url)
            .then(
                function (response) {

                    if (
                        !response.ok
                    ) {

                        throw new Error(
                            'HTTP ' +
                            response.status
                        );
                    }

                    return response.arrayBuffer();
                }
            )
            .then(
                function (arrayBuffer) {

                    return new Promise(
                        function (
                            resolve,
                            reject
                        ) {

                            context.decodeAudioData(
                                arrayBuffer,
                                resolve,
                                reject
                            );
                        }
                    );
                }
            )
            .then(
                function (buffer) {

                    giftBuffers.set(
                        url,
                        buffer
                    );

                    giftBufferPromises.delete(
                        url
                    );

                    console.log(
                        '[DEBUG] Gift buffer loaded:',
                        url
                    );

                    return buffer;
                }
            )
            .catch(
                function (error) {

                    console.warn(
                        '[DEBUG] Gift buffer load failed (HTMLAudio fallback):',
                        url,
                        error
                    );

                    giftBufferPromises.delete(
                        url
                    );

                    giftBufferFailed.add(
                        url
                    );

                    return null;
                }
            );


    giftBufferPromises.set(
        url,
        promise
    );


    return promise;
}


function preloadGiftBuffers() {

    const urls =
        Array.from(
            new Set([
                NORMAL_GIFT_AUDIO_URL,
                TEGAMI_AUDIO_URL,
                DURANDAL_AUDIO_URL,
                DAINSLEIF_AUDIO_URL,
                giftAudioUrl
            ])
        );


    urls.forEach(
        function (url) {

            loadGiftBuffer(
                url
            );
        }
    );
}


/* =========================================================
   GIFT AUDIO UNLOCK
========================================================= */

async function unlockGiftAudio() {

    if (
        giftAudioUnlocked
    ) {

        await resumeGiftAudioContext();

        startGiftKeepAlive();

        preloadGiftBuffers();

        return true;
    }


    /*
     * Web Audio側の再生許可を取得。
     *
     * 無音のOscillatorなので
     * アンロック時にギフト音は鳴らない。
     */
    const context =
        createGiftAudioContext();


    if (context) {

        try {

            if (
                context.state === 'suspended'
            ) {

                await context.resume();
            }


            const oscillator =
                context.createOscillator();


            const gain =
                context.createGain();


            gain.gain.value =
                0;


            oscillator.connect(
                gain
            );


            gain.connect(
                context.destination
            );


            oscillator.start();


            oscillator.stop(
                context.currentTime +
                0.01
            );

        } catch (e) {

            console.warn(
                '[DEBUG] Silent AudioContext unlock error:',
                e
            );
        }


        startGiftKeepAlive();

        preloadGiftBuffers();
    }


    /*
     * HTMLAudio側も再生許可を取得。
     *
     * 完全ミュートで行う。
     * （BufferSource再生に失敗したときの
     *   フォールバック用）
     */
    const urls = [
        NORMAL_GIFT_AUDIO_URL,
        TEGAMI_AUDIO_URL,
        DURANDAL_AUDIO_URL,
        DAINSLEIF_AUDIO_URL
    ];


    const uniqueUrls =
        Array.from(
            new Set(urls)
        );


    let successCount =
        0;


    for (
        const url of uniqueUrls
    ) {

        let audio =
            null;

        try {

            audio =
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
                true;

            audio.volume =
                0;


            successCount++;

        } catch (e) {

            console.warn(
                '[DEBUG] Gift audio unlock failed:',
                url,
                e
            );

        } finally {

            if (audio) {

                try {

                    audio.pause();

                } catch (e) {
                }

                audio.muted =
                    true;

                audio.volume =
                    0;

                audio.onended =
                    null;

                audio.onerror =
                    null;

                audio.onabort =
                    null;

                try {

                    audio.removeAttribute(
                        'src'
                    );

                    audio.load();

                } catch (e) {
                }

                audio =
                    null;
            }
        }
    }


    /*
     * AudioContextが使える場合は
     * こちらも成功扱い。
     */
    if (
        context &&
        context.state === 'running'
    ) {

        giftAudioUnlocked =
            true;

    } else if (
        successCount > 0
    ) {

        giftAudioUnlocked =
            true;

    } else {

        giftAudioUnlocked =
            false;
    }


    console.log(
        '[DEBUG] Gift audio unlocked:',
        giftAudioUnlocked
    );


    return giftAudioUnlocked;
}


/* =========================================================
   FIRST INTERACTION
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
   PERSISTENT AUDIO RESUME
========================================================= */

/*
 * 1回きりではなく、操作のたびに
 * AudioContextがrunningか確認して復帰させる。
 * （ミュート切替後しばらくして鳴らなくなる対策）
 */
function setupPersistentAudioResume() {

    if (
        persistentResumeInstalled
    ) {

        return;
    }


    persistentResumeInstalled =
        true;


    const handler =
        function () {

            if (
                !giftAudioEnabled
            ) {

                return;
            }


            if (
                !giftAudioContext
            ) {

                return;
            }


            if (
                giftAudioContext.state ===
                'running'
            ) {

                return;
            }


            resumeGiftAudioContext().then(
                function (running) {

                    if (running) {

                        startGiftKeepAlive();

                        preloadGiftBuffers();
                    }
                }
            );
        };


    [
        'touchstart',
        'touchend',
        'pointerdown',
        'click',
        'keydown'
    ].forEach(
        function (name) {

            document.addEventListener(
                name,
                handler,
                {
                    passive: true,
                    capture: true
                }
            );
        }
    );
}


/* =========================================================
   GIFT AUDIO WATCHDOG
========================================================= */

function setupGiftAudioWatchdog() {

    if (
        giftWatchdogInstalled
    ) {

        return;
    }


    giftWatchdogInstalled =
        true;


    setInterval(
        function () {

            if (
                !giftAudioEnabled ||
                !giftAudioContext
            ) {

                return;
            }


            if (
                giftAudioContext.state !==
                'running'
            ) {

                resumeGiftAudioContext().then(
                    function (running) {

                        if (running) {

                            startGiftKeepAlive();
                        }
                    }
                );
            }
        },
        2000
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

            event.preventDefault();

            event.stopPropagation();


            if (
                giftAudioEnabled
            ) {

                giftAudioEnabled =
                    false;

            } else {

                giftAudioEnabled =
                    true;

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

        return;
    }


    button.off(
        'click'
    );


    button.on(
        'click',
        async function (event) {

            event.preventDefault();

            event.stopPropagation();


            bgmEnabled =
                !bgmEnabled;


            if (
                bgmEnabled
            ) {

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
   BGM SPEED
========================================================= */

function forceBgmNormalSpeed() {

    if (
        !bgmAudio
    ) {

        return;
    }


    try {

        bgmAudio.defaultPlaybackRate =
            BGM_PLAYBACK_RATE;

        bgmAudio.playbackRate =
            BGM_PLAYBACK_RATE;

    } catch (e) {

        console.warn(
            '[DEBUG] BGM speed reset error:',
            e
        );
    }
}


/* =========================================================
   BGM EVENTS
========================================================= */

function setupBgmEvents() {

    if (
        !bgmAudio ||
        bgmEventsInstalled
    ) {

        return;
    }


    bgmEventsInstalled =
        true;


    bgmAudio.addEventListener(
        'ratechange',
        function () {

            forceBgmNormalSpeed();
        }
    );


    bgmAudio.addEventListener(
        'loadedmetadata',
        function () {

            forceBgmNormalSpeed();
        }
    );


    bgmAudio.addEventListener(
        'canplay',
        function () {

            forceBgmNormalSpeed();
        }
    );


    bgmAudio.addEventListener(
        'play',
        function () {

            forceBgmNormalSpeed();
        }
    );


    bgmAudio.addEventListener(
        'playing',
        function () {

            forceBgmNormalSpeed();
        }
    );


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


/* =========================================================
   CREATE BGM
========================================================= */

function createBgmAudio() {

    if (
        bgmAudio
    ) {

        return bgmAudio;
    }


    bgmAudio =
        new Audio(
            BGM_AUDIO_URL
        );


    bgmAudio.preload =
        'auto';

    bgmAudio.loop =
        true;

    bgmAudio.volume =
        BGM_VOLUME;

    bgmAudio.defaultPlaybackRate =
        BGM_PLAYBACK_RATE;

    bgmAudio.playbackRate =
        BGM_PLAYBACK_RATE;


    setupBgmEvents();


    return bgmAudio;
}


/* =========================================================
   START BGM
========================================================= */

async function startBgm() {

    if (
        !bgmEnabled
    ) {

        return;
    }


    try {

        const audio =
            createBgmAudio();


        forceBgmNormalSpeed();


        audio.volume =
            BGM_VOLUME;


        if (
            !audio.paused
        ) {

            forceBgmNormalSpeed();

            return;
        }


        const promise =
            audio.play();


        if (promise) {

            await promise;
        }


        forceBgmNormalSpeed();


        console.log(
            '[DEBUG] BGM started at 1.0x'
        );

    } catch (e) {

        console.warn(
            '[DEBUG] BGM start error:',
            e
        );
    }
}


/* =========================================================
   STOP BGM
========================================================= */

function stopBgm() {

    if (
        !bgmAudio
    ) {

        return;
    }


    try {

        bgmAudio.pause();

        forceBgmNormalSpeed();

    } catch (e) {

        console.warn(
            '[DEBUG] BGM stop error:',
            e
        );
    }
}


/* =========================================================
   PAGE EVENTS
========================================================= */

document.addEventListener(
    'visibilitychange',
    function () {

        if (
            bgmAudio
        ) {

            forceBgmNormalSpeed();
        }


        if (
            giftAudioEnabled &&
            giftAudioContext &&
            giftAudioContext.state !== 'running'
        ) {

            resumeGiftAudioContext();
        }
    }
);


window.addEventListener(
    'pageshow',
    function () {

        if (
            bgmAudio
        ) {

            forceBgmNormalSpeed();


            if (
                bgmEnabled &&
                bgmAudio.paused
            ) {

                startBgm();
            }
        }


        if (
            giftAudioEnabled &&
            giftAudioContext &&
            giftAudioContext.state !== 'running'
        ) {

            resumeGiftAudioContext();
        }
    }
);


window.addEventListener(
    'focus',
    function () {

        if (
            bgmAudio
        ) {

            forceBgmNormalSpeed();
        }


        if (
            giftAudioEnabled &&
            giftAudioContext &&
            giftAudioContext.state !== 'running'
        ) {

            resumeGiftAudioContext();
        }
    }
);


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
    () => {

        loadUrlSettings();


        setupGiftAudioButton();

        setupBgmButton();

        setupChatAutoScrollButton();

        setupGiftExpandButton();

        setupFirstInteractionAudioUnlock();

        setupPersistentAudioResume();

        setupGiftAudioWatchdog();


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
                    '接続:  ' +
                    state.roomId
                );


                viewerCount =
                    0;

                likeCount =
                    0;

                diamondsCount =
                    0;


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
   COPY URL
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
   DISPLAY NAME
========================================================= */

function generateDisplayName(data) {

    if (!data) {
        return 'ユーザー';
    }


    if (
        data.nickname
    ) {

        return sanitize(
            data.nickname
        );
    }


    if (
        data.user &&
        data.user.nickname
    ) {

        return sanitize(
            data.user.nickname
        );
    }


    return 'ユーザー';
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
   PENDING GIFT
========================================================= */

function isPendingStreak(data) {

    return (
        data &&
        data.giftType === 1 &&
        !data.repeatEnd
    );
}


/* =========================================================
   GIFT DUPLICATE
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


    let createTime =
        '';


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
   GIFT SOUND SELECT
========================================================= */

function selectGiftAudioUrl() {

    const random =
        Math.random();


    if (
        random <
        (
            1 /
            TEGAMI_CHANCE_DENOMINATOR
        )
    ) {

        console.log(
            '[DEBUG] Gift sound selected: tegami.mp3'
        );

        return TEGAMI_AUDIO_URL;
    }


    if (
        random <
        (
            (1 / TEGAMI_CHANCE_DENOMINATOR) +
            (1 / DURANDAL_CHANCE_DENOMINATOR)
        )
    ) {

        console.log(
            '[DEBUG] Gift sound selected: durandal.mp3'
        );

        return DURANDAL_AUDIO_URL;
    }


    if (
        random <
        (
            (1 / TEGAMI_CHANCE_DENOMINATOR) +
            (1 / DURANDAL_CHANCE_DENOMINATOR) +
            (1 / DAINSLEIF_CHANCE_DENOMINATOR)
        )
    ) {

        console.log(
            '[DEBUG] Gift sound selected: dainsleif.mp3'
        );

        return DAINSLEIF_AUDIO_URL;
    }


    return giftAudioUrl;
}


/* =========================================================
   PLAY GIFT AUDIO (Web Audio BufferSource)
========================================================= */

/*
 * メイン再生経路。
 * AudioContextがrunningなら
 * ユーザー操作なしで何度でも鳴らせる。
 */
function playGiftBuffer(context, buffer) {

    const source =
        context.createBufferSource();

    const gainNode =
        context.createGain();


    source.buffer =
        buffer;

    gainNode.gain.value =
        GIFT_AUDIO_GAIN;


    source.connect(
        gainNode
    );

    gainNode.connect(
        giftMasterGain ||
        context.destination
    );


    activeGiftAudios.add(
        source
    );


    source.onended =
        function () {

            activeGiftAudios.delete(
                source
            );

            try {

                source.disconnect();

            } catch (e) {
            }

            try {

                gainNode.disconnect();

            } catch (e) {
            }
        };


    source.start(
        0
    );


    console.log(
        '[DEBUG] Gift audio started (buffer):',
        'active:',
        activeGiftAudios.size,
        'gain:',
        GIFT_AUDIO_GAIN
    );
}


/* =========================================================
   PLAY GIFT AUDIO (HTMLAudio fallback)
========================================================= */

function playGiftWithHtmlAudio(soundUrl) {

    let audio =
        null;


    let source =
        null;


    let gainNode =
        null;


    let cleaned =
        false;


    try {

        audio =
            new Audio(
                soundUrl
            );


        audio.preload =
            'auto';


        /*
         * HTMLAudio側は最大。
         */
        audio.volume =
            1.0;


        activeGiftAudios.add(
            audio
        );


        /*
         * Web Audioで増幅。
         */
        const context =
            createGiftAudioContext();


        if (
            context &&
            context.state === 'running'
        ) {

            source =
                context.createMediaElementSource(
                    audio
                );


            gainNode =
                context.createGain();


            gainNode.gain.value =
                GIFT_AUDIO_GAIN;


            source.connect(
                gainNode
            );


            gainNode.connect(
                giftMasterGain ||
                context.destination
            );
        }


        const cleanup =
            function () {

                if (
                    cleaned
                ) {

                    return;
                }


                cleaned =
                    true;


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


                try {

                    if (
                        source
                    ) {

                        source.disconnect();
                    }

                } catch (e) {
                }


                try {

                    if (
                        gainNode
                    ) {

                        gainNode.disconnect();
                    }

                } catch (e) {
                }


                try {

                    audio.removeAttribute(
                        'src'
                    );

                    audio.load();

                } catch (e) {
                }
            };


        audio.onended =
            cleanup;


        audio.onerror =
            function (error) {

                console.warn(
                    '[DEBUG] Gift audio error:',
                    soundUrl,
                    error,
                    audio.error
                );


                cleanup();
            };


        audio.onabort =
            cleanup;


        /*
         * ここで即時再生。
         *
         * キューなし。
         * 最大数制限なし。
         */
        const promise =
            audio.play();


        if (promise) {

            promise.then(
                function () {

                    console.log(
                        '[DEBUG] Gift audio started (html):',
                        soundUrl,
                        'active:',
                        activeGiftAudios.size,
                        'gain:',
                        GIFT_AUDIO_GAIN
                    );
                }
            ).catch(
                function (error) {

                    console.warn(
                        '[DEBUG] Gift audio play failed:',
                        soundUrl,
                        error
                    );


                    cleanup();
                }
            );
        }

    } catch (e) {

        console.warn(
            '[DEBUG] Gift audio create/play error:',
            soundUrl,
            e
        );


        if (
            audio
        ) {

            activeGiftAudios.delete(
                audio
            );
        }
    }
}


/* =========================================================
   PLAY GIFT AUDIO
========================================================= */

async function playQueuedGiftSound(soundUrl) {

    if (
        !giftAudioEnabled
    ) {

        return;
    }


    try {

        /*
         * まずAudioContextをrunningにする。
         * 止まっていたらここで復帰を試みる。
         */
        const running =
            await resumeGiftAudioContext();


        if (running) {

            startGiftKeepAlive();


            let buffer =
                giftBuffers.get(
                    soundUrl
                );


            if (!buffer) {

                buffer =
                    await loadGiftBuffer(
                        soundUrl
                    );
            }


            if (
                buffer &&
                giftAudioContext &&
                giftAudioContext.state === 'running'
            ) {

                playGiftBuffer(
                    giftAudioContext,
                    buffer
                );

                return;
            }
        }

    } catch (e) {

        console.warn(
            '[DEBUG] Gift buffer play error (fallback):',
            soundUrl,
            e
        );
    }


    /*
     * バッファ再生できない場合は
     * 従来のHTMLAudio再生にフォールバック。
     */
    playGiftWithHtmlAudio(
        soundUrl
    );
}


/* =========================================================
   GIFT SOUND
========================================================= */

function playGiftSound() {

    if (
        !giftAudioEnabled
    ) {

        return;
    }


    /*
     * giftAudioUnlockedでは弾かない。
     *
     * 以前はここでブロックされて
     * 一度でもunlock状態が崩れると
     * 再度オンオフするまで鳴らなかった。
     * 今は常に再生を試み、
     * context復帰もplayQueuedGiftSound側で行う。
     */
    const soundUrl =
        selectGiftAudioUrl();


    /*
     * 待機キューには入れない。
     *
     * ギフトが追加された瞬間に
     * そのまま再生する。
     */
    playQueuedGiftSound(
        soundUrl
    );
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
   GIFT ITEM
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

        return false;
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
                    generateDisplayName(
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


    return true;
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
                generateDisplayName(
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
         * 本物のコメントで
         * いいね表示の抑制解除。
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


        /*
         * 先にUIへ追加。
         */
        const added =
            addGiftItem(
                data
            );


        /*
         * UI追加直後に即再生。
         *
         * duplicateならaddGiftItemがfalseなので
         * 音も鳴らない。
         */
        if (
            added
        ) {

            playGiftSound();
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
