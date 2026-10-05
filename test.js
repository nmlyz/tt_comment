'use strict';


/*
 * ============================================
 * ギフト音声・BGM テスト
 *
 * app.js
 * connection.js
 *..
 * には一切依存しない。
 * ============================================
 */


/*
 * ============================================
 * 音声ファイル
 * ============================================
 */

const GIFT_AUDIO_URL =
    './gift.mp3';

const NORMAL_AUDIO_URL =
    './normal.mp3';

const TEGAMI_AUDIO_URL =
    './tegami.mp3';

const DURANDAL_AUDIO_URL =
    './durandal.mp3';

const DAINSLEIF_AUDIO_URL =
    './dainsleif.mp3';

const BGM_AUDIO_URL =
    './bgm.mp3';


/*
 * ============================================
 * ギフト音声一覧
 *
 * 通常のギフト音声テストでは
 * この中からランダムに選択する。
 * ============================================
 */

const GIFT_SOUND_LIST = [

    {
        name: 'gift.mp3',
        url: GIFT_AUDIO_URL
    },

    {
        name: 'normal.mp3',
        url: NORMAL_AUDIO_URL
    },

    {
        name: 'tegami.mp3',
        url: TEGAMI_AUDIO_URL
    },

    {
        name: 'durandal.mp3',
        url: DURANDAL_AUDIO_URL
    },

    {
        name: 'dainsleif.mp3',
        url: DAINSLEIF_AUDIO_URL
    }

];


/*
 * ============================================
 * テスト設定
 * ============================================
 */

const AUTO_TEST_DELAY =
    5000;

const REPEAT_INTERVAL =
    500;


/*
 * ============================================
 * BGM音量設定
 *
 * 1.0 = 元の音量
 * 0.5 = 50%
 * 0.1 = 10%
 * 0.05 = 5%
 * ============================================
 */

const BGM_GAIN =
    0.05;


/*
 * ============================================
 * 状態
 * ============================================
 */

let testCount =
    0;

let bgmAudio =
    null;

let bgmPlaying =
    false;


/*
 * ============================================
 * Web Audio API
 * ============================================
 */

let audioContext =
    null;

let bgmSource =
    null;

let bgmGainNode =
    null;


/*
 * ============================================
 * AudioContext取得
 * ============================================
 */

function getAudioContext() {

    if (
        !audioContext
    ) {

        const AudioContextClass =
            window.AudioContext ||
            window.webkitAudioContext;


        if (!AudioContextClass) {

            return null;

        }


        audioContext =
            new AudioContextClass();

    }


    return audioContext;

}


/*
 * ============================================
 * AudioContext再開
 * ============================================
 */

function resumeAudioContext() {

    const context =
        getAudioContext();


    if (!context) {

        return Promise.resolve();

    }


    if (
        context.state ===
        'suspended'
    ) {

        return context.resume();

    }


    return Promise.resolve();

}


/*
 * ============================================
 * DOM
 * ============================================
 */

const statusElement =
    document.getElementById(
        'testStatus'
    );


const resultElement =
    document.getElementById(
        'giftResult'
    );


const logElement =
    document.getElementById(
        'testLog'
    );


/*
 * ============================================
 * 状態表示
 * ============================================
 */

function setStatus(
    message
) {

    const time =
        new Date()
            .toLocaleTimeString(
                'ja-JP'
            );


    if (statusElement) {

        statusElement.textContent =
            '[' +
            time +
            '] ' +
            message;

    }


    addLog(
        message
    );

}


/*
 * ============================================
 * ログ
 * ============================================
 */

function addLog(
    message
) {

    if (!logElement) {

        return;

    }


    const time =
        new Date()
            .toLocaleTimeString(
                'ja-JP'
            );


    logElement.textContent +=
        '[' +
        time +
        '] ' +
        message +
        '\n';


    logElement.scrollTop =
        logElement.scrollHeight;

}


/*
 * ============================================
 * 結果
 * ============================================
 */

function setResult(
    message
) {

    if (!resultElement) {

        return;

    }


    resultElement.textContent =
        message;

}


/*
 * ============================================
 * ランダムギフト音声取得
 * ============================================
 */

function getRandomGiftSound() {

    const index =
        Math.floor(
            Math.random() *
            GIFT_SOUND_LIST.length
        );


    return GIFT_SOUND_LIST[index];

}


/*
 * ============================================
 * ギフト音声再生
 * ============================================
 */

function playTestGiftSound(
    testName,
    audioUrl,
    audioName
) {

    testCount +=
        1;


    let soundUrl =
        audioUrl;


    let soundName =
        audioName;


    /*
     * URLが指定されていなければ
     * ランダムなギフト音声を選択。
     */

    if (!soundUrl) {

        const randomSound =
            getRandomGiftSound();


        soundUrl =
            randomSound.url;

        soundName =
            randomSound.name;

    }


    const audio =
        new Audio(
            soundUrl
        );


    audio.preload =
        'auto';

    audio.volume =
        1.0;


    setStatus(
        testName +
        '：音声再生開始\n' +
        'ファイル：' +
        soundName
    );


    addLog(
        'Audio作成：' +
        soundUrl
    );


    audio.addEventListener(
        'ended',
        function () {

            addLog(
                '再生終了：' +
                soundName
            );

        }
    );


    audio.addEventListener(
        'error',
        function () {

            addLog(
                '音声ファイルエラー：' +
                soundName
            );

        }
    );


    const playPromise =
        audio.play();


    if (
        playPromise !== undefined
    ) {

        playPromise
            .then(
                function () {

                    setStatus(
                        testName +
                        '：音声再生成功\n' +
                        'ファイル：' +
                        soundName
                    );


                    setResult(
                        '🎁 テスト #' +
                        testCount +
                        '\n' +
                        '音声再生成功\n' +
                        soundName
                    );

                }
            )
            .catch(
                function (error) {

                    console.error(
                        '[TEST AUDIO ERROR]',
                        error
                    );


                    setStatus(
                        testName +
                        '：音声再生失敗\n' +
                        soundName +
                        '\n' +
                        error.name +
                        ': ' +
                        error.message
                    );


                    setResult(
                        '❌ 音声再生失敗\n' +
                        soundName +
                        '\n' +
                        error.name +
                        ': ' +
                        error.message
                    );

                }
            );

    }

}


/*
 * ============================================
 * 今すぐギフトテスト
 *
 * ランダムな音声を選ぶ。
 * ============================================
 */

function manualTest() {

    setStatus(
        '手動ギフト音声テスト開始'
    );


    playTestGiftSound(
        '手動テスト'
    );

}


/*
 * ============================================
 * 5秒後ギフトテスト
 *
 * ボタンを押してから5秒間、
 * 何も触らない。
 *
 * その後ランダム音声を再生。
 * ============================================
 */

function delayedTest() {

    setStatus(
        '5秒後にギフト音声を再生します。\n' +
        'そのまま何も触らないでください。'
    );


    addLog(
        '5秒後ギフトテスト予約'
    );


    setTimeout(
        function () {

            setStatus(
                '5秒経過。\n' +
                'ギフト音声テスト開始'
            );


            playTestGiftSound(
                '5秒後テスト'
            );

        },
        AUTO_TEST_DELAY
    );

}


/*
 * ============================================
 * 3回連続ギフト音声テスト
 *
 * 毎回別のランダム音声。
 * ============================================
 */

function repeatTest() {

    setStatus(
        '3回連続ギフト音声テスト開始'
    );


    playTestGiftSound(
        '連続テスト 1/3'
    );


    setTimeout(
        function () {

            playTestGiftSound(
                '連続テスト 2/3'
            );

        },
        REPEAT_INTERVAL
    );


    setTimeout(
        function () {

            playTestGiftSound(
                '連続テスト 3/3'
            );

        },
        REPEAT_INTERVAL * 2
    );

}


/*
 * ============================================
 * BGM再生
 *
 * Web Audio APIを使用。
 * BGM専用GainNodeで音量を10分の1にする。
 * ============================================
 */

function startBgm(
    testName
) {

    setStatus(
        testName +
        '：BGM再生開始'
    );


    if (
        bgmAudio &&
        !bgmAudio.paused
    ) {

        setStatus(
            testName +
            '：BGMはすでに再生中'
        );

        return;

    }


    /*
     * 既存BGMが残っている場合は停止。
     */

    if (bgmAudio) {

        try {

            bgmAudio.pause();

        } catch (error) {

            console.warn(
                '[BGM] pause error',
                error
            );

        }

    }


    /*
     * AudioContextを取得。
     */

    const context =
        getAudioContext();


    /*
     * Web Audio APIが使用できない場合。
     *
     * 通常のAudioとして再生する。
     */

    if (!context) {

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


        addLog(
            'Web Audio API非対応'
        );


        addLog(
            '通常AudioでBGM再生'
        );


        const fallbackPromise =
            bgmAudio.play();


        if (
            fallbackPromise !== undefined
        ) {

            fallbackPromise
                .then(
                    function () {

                        bgmPlaying =
                            true;


                        setStatus(
                            testName +
                            '：BGM再生成功'
                        );


                        setResult(
                            '🎵 BGM再生成功\n' +
                            BGM_AUDIO_URL +
                            '\n\n' +
                            '音量：10分の1\n' +
                            'loop=true'
                        );

                    }
                )
                .catch(
                    function (error) {

                        bgmPlaying =
                            false;


                        setStatus(
                            testName +
                            '：BGM再生失敗\n' +
                            error.name +
                            ': ' +
                            error.message
                        );


                        setResult(
                            '❌ BGM再生失敗\n' +
                            error.name +
                            ': ' +
                            error.message
                        );

                    }
                );

        }


        return;

    }


    /*
     * AudioContextを再開。
     */

    resumeAudioContext()
        .then(
            function () {

                /*
                 * BGM Audioを作成。
                 */

                bgmAudio =
                    new Audio(
                        BGM_AUDIO_URL
                    );


                bgmAudio.preload =
                    'auto';

                bgmAudio.loop =
                    true;


                /*
                 * HTMLAudioElement自身のvolumeも設定。
                 */

                bgmAudio.volume =
                    1.0;


                /*
                 * MediaElementSourceを作成。
                 */

                try {

                    bgmSource =
                        context.createMediaElementSource(
                            bgmAudio
                        );

                } catch (error) {

                    addLog(
                        'MediaElementSource作成失敗'
                    );


                    addLog(
                        error.message
                    );


                    /*
                     * 既に同じAudio要素に
                     * SourceNodeが存在する場合など。
                     */

                    bgmAudio.volume =
                        BGM_GAIN;


                    const fallbackPlay =
                        bgmAudio.play();


                    if (
                        fallbackPlay !== undefined
                    ) {

                        fallbackPlay
                            .then(
                                function () {

                                    bgmPlaying =
                                        true;


                                    setStatus(
                                        testName +
                                        '：BGM再生成功'
                                    );

                                }
                            )
                            .catch(
                                function (playError) {

                                    bgmPlaying =
                                        false;


                                    setStatus(
                                        testName +
                                        '：BGM再生失敗\n' +
                                        playError.name +
                                        ': ' +
                                        playError.message
                                    );

                                }
                            );

                    }


                    return;

                }


                /*
                 * BGM専用GainNode。
                 */

                bgmGainNode =
                    context.createGain();


                /*
                 * ここが実際のBGM音量。
                 *
                 * 0.1 = 10%
                 */

                bgmGainNode.gain.value =
                    BGM_GAIN;


                /*
                 * Audio
                 * ↓
                 * GainNode
                 * ↓
                 * スピーカー
                 */

                bgmSource.connect(
                    bgmGainNode
                );


                bgmGainNode.connect(
                    context.destination
                );


                addLog(
                    'BGM GainNode作成'
                );


                addLog(
                    'BGMゲイン：' +
                    BGM_GAIN
                );


                /*
                 * BGM再生。
                 */

                const playPromise =
                    bgmAudio.play();


                if (
                    playPromise !== undefined
                ) {

                    playPromise
                        .then(
                            function () {

                                bgmPlaying =
                                    true;


                                setStatus(
                                    testName +
                                    '：BGM再生成功'
                                );


                                setResult(
                                    '🎵 BGM再生成功\n' +
                                    BGM_AUDIO_URL +
                                    '\n\n' +
                                    '音量：10分の1\n' +
                                    'Gain=' +
                                    BGM_GAIN +
                                    '\n' +
                                    'loop=true'
                                );

                            }
                        )
                        .catch(
                            function (error) {

                                bgmPlaying =
                                    false;


                                setStatus(
                                    testName +
                                    '：BGM再生失敗\n' +
                                    error.name +
                                    ': ' +
                                    error.message
                                );


                                setResult(
                                    '❌ BGM再生失敗\n' +
                                    error.name +
                                    ': ' +
                                    error.message
                                );

                            }
                        );

                }

            }
        )
        .catch(
            function (error) {

                bgmPlaying =
                    false;


                setStatus(
                    testName +
                    '：AudioContext再開失敗\n' +
                    error.name +
                    ': ' +
                    error.message
                );


                setResult(
                    '❌ AudioContextエラー\n' +
                    error.name +
                    ': ' +
                    error.message
                );

            }
        );

}


/*
 * ============================================
 * BGM停止
 * ============================================
 */

function stopBgm() {

    if (!bgmAudio) {

        setStatus(
            'BGMはまだ再生されていません'
        );

        return;

    }


    bgmAudio.pause();


    bgmAudio.currentTime =
        0;


    bgmPlaying =
        false;


    setStatus(
        'BGM停止'
    );


    setResult(
        '⏹️ BGM停止'
    );

}


/*
 * ============================================
 * BGM ON/OFF
 * ============================================
 */

function toggleBgm() {

    if (
        bgmAudio &&
        !bgmAudio.paused
    ) {

        stopBgm();

        return;

    }


    startBgm(
        'BGM ON'
    );

}


/*
 * ============================================
 * BGM 5秒後テスト
 * ============================================
 */

function delayedBgmTest() {

    setStatus(
        '5秒後にBGMを再生します。\n' +
        'そのまま何も触らないでください。'
    );


    setTimeout(
        function () {

            startBgm(
                '5秒後BGMテスト'
            );

        },
        AUTO_TEST_DELAY
    );

}


/*
 * ============================================
 * BGM手動テスト
 * ============================================
 */

function manualBgmTest() {

    startBgm(
        '手動BGMテスト'
    );

}


/*
 * ============================================
 * BGM＋ギフト同時再生
 * ============================================
 */

function playBoth(
    testName
) {

    startBgm(
        testName +
        ' BGM'
    );


    playTestGiftSound(
        testName +
        ' ギフト'
    );

}


/*
 * ============================================
 * BGM＋ギフト 5秒後
 * ============================================
 */

function delayedBothTest() {

    setStatus(
        '5秒後にBGM＋ギフトを再生します。\n' +
        'そのまま何も触らないでください。'
    );


    setTimeout(
        function () {

            playBoth(
                '5秒後同時再生テスト'
            );

        },
        AUTO_TEST_DELAY
    );

}


/*
 * ============================================
 * 無操作ギフトテスト
 * ============================================
 */

function startNoTouchGiftTest() {

    setStatus(
        '無操作ギフトテスト開始。\n' +
        '5秒間、画面を触らないでください。'
    );


    setTimeout(
        function () {

            playTestGiftSound(
                '無操作ギフトテスト'
            );

        },
        AUTO_TEST_DELAY
    );

}


/*
 * ============================================
 * 無操作BGMテスト
 * ============================================
 */

function startNoTouchBgmTest() {

    setStatus(
        '無操作BGMテスト開始。\n' +
        '5秒間、画面を触らないでください。'
    );


    setTimeout(
        function () {

            startBgm(
                '無操作BGMテスト'
            );

        },
        AUTO_TEST_DELAY
    );

}


/*
 * ============================================
 * 個別音声テスト
 * ============================================
 */

function testAudioFile(
    name,
    url
) {

    setStatus(
        name +
        ' の再生テスト開始'
    );


    playTestGiftSound(
        name,
        url,
        name
    );

}


/*
 * ============================================
 * ボタン設定
 * ============================================
 */

const manualTestButton =
    document.getElementById(
        'manualTestButton'
    );


if (manualTestButton) {

    manualTestButton.addEventListener(
        'click',
        function () {

            manualTest();

        }
    );

}


const autoTestButton =
    document.getElementById(
        'autoTestButton'
    );


if (autoTestButton) {

    autoTestButton.addEventListener(
        'click',
        function () {

            delayedTest();

        }
    );

}


const repeatTestButton =
    document.getElementById(
        'repeatTestButton'
    );


if (repeatTestButton) {

    repeatTestButton.addEventListener(
        'click',
        function () {

            repeatTest();

        }
    );

}


const bgmManualButton =
    document.getElementById(
        'bgmManualButton'
    );


if (bgmManualButton) {

    bgmManualButton.addEventListener(
        'click',
        function () {

            manualBgmTest();

        }
    );

}


const bgmAutoButton =
    document.getElementById(
        'bgmAutoButton'
    );


if (bgmAutoButton) {

    bgmAutoButton.addEventListener(
        'click',
        function () {

            delayedBgmTest();

        }
    );

}


const bgmToggleButton =
    document.getElementById(
        'bgmToggleButton'
    );


if (bgmToggleButton) {

    bgmToggleButton.addEventListener(
        'click',
        function () {

            toggleBgm();

        }
    );

}


const bgmStopButton =
    document.getElementById(
        'bgmStopButton'
    );


if (bgmStopButton) {

    bgmStopButton.addEventListener(
        'click',
        function () {

            stopBgm();

        }
    );

}


const bothManualButton =
    document.getElementById(
        'bothManualButton'
    );


if (bothManualButton) {

    bothManualButton.addEventListener(
        'click',
        function () {

            playBoth(
                '手動同時再生テスト'
            );

        }
    );

}


const bothAutoButton =
    document.getElementById(
        'bothAutoButton'
    );


if (bothAutoButton) {

    bothAutoButton.addEventListener(
        'click',
        function () {

            delayedBothTest();

        }
    );

}


const noTouchGiftButton =
    document.getElementById(
        'noTouchGiftButton'
    );


if (noTouchGiftButton) {

    noTouchGiftButton.addEventListener(
        'click',
        function () {

            startNoTouchGiftTest();

        }
    );

}


const noTouchBgmButton =
    document.getElementById(
        'noTouchBgmButton'
    );


if (noTouchBgmButton) {

    noTouchBgmButton.addEventListener(
        'click',
        function () {

            startNoTouchBgmTest();

        }
    );

}


/*
 * ============================================
 * 個別ファイル
 * ============================================
 */

const normalButton =
    document.getElementById(
        'normalButton'
    );


if (normalButton) {

    normalButton.addEventListener(
        'click',
        function () {

            testAudioFile(
                'normal.mp3',
                NORMAL_AUDIO_URL
            );

        }
    );

}


const tegamiButton =
    document.getElementById(
        'tegamiButton'
    );


if (tegamiButton) {

    tegamiButton.addEventListener(
        'click',
        function () {

            testAudioFile(
                'tegami.mp3',
                TEGAMI_AUDIO_URL
            );

        }
    );

}


const durandalButton =
    document.getElementById(
        'durandalButton'
    );


if (durandalButton) {

    durandalButton.addEventListener(
        'click',
        function () {

            testAudioFile(
                'durandal.mp3',
                DURANDAL_AUDIO_URL
            );

        }
    );

}


const dainsleifButton =
    document.getElementById(
        'dainsleifButton'
    );


if (dainsleifButton) {

    dainsleifButton.addEventListener(
        'click',
        function () {

            testAudioFile(
                'dainsleif.mp3',
                DAINSLEIF_AUDIO_URL
            );

        }
    );

}


const bgmFileButton =
    document.getElementById(
        'bgmFileButton'
    );


if (bgmFileButton) {

    bgmFileButton.addEventListener(
        'click',
        function () {

            manualBgmTest();

        }
    );

}


/*
 * ============================================
 * ページを開いてから完全無操作
 *
 * 5秒後にランダムなギフト音声。
 * ============================================
 */

setStatus(
    'ページを開きました。\n' +
    '何も触らず5秒待つとランダムなギフト音声を再生します。'
);


setTimeout(
    function () {

        setStatus(
            '無操作5秒経過。\n' +
            'ランダムギフト音声テスト開始'
        );


        playTestGiftSound(
            'ページロード無操作テスト'
        );

    },
    AUTO_TEST_DELAY
);


/*
 * ============================================
 * 初期ログ
 * ============================================
 */

addLog(
    'test.js 読み込み完了'
);


addLog(
    'ギフト音声：ランダム選択'
);


addLog(
    '登録音声数：' +
    GIFT_SOUND_LIST.length
);


addLog(
    'BGM：' +
    BGM_AUDIO_URL
);


addLog(
    'BGMゲイン：' +
    BGM_GAIN +
    '（10分の1）'
);