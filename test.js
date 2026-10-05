'use strict';


/*
 * ============================================
 * ギフト音声単体テスト
 *
 * app.js
 * connection.js
 *
 * には一切依存しない。
 * ============================================
 */


const GIFT_AUDIO_URL =
    './gift.mp3';


const AUTO_TEST_DELAY =
    5000;


let testCount =
    0;


const statusElement =
    document.getElementById(
        'testStatus'
    );


const resultElement =
    document.getElementById(
        'giftResult'
    );


function setStatus(
    message
) {

    const time =
        new Date()
            .toLocaleTimeString(
                'ja-JP'
            );

    statusElement.textContent =
        '[' +
        time +
        '] ' +
        message;
}


/*
 * ============================================
 * ギフト音声を再生
 * ============================================
 */
function playTestGiftSound(
    testName
) {

    testCount += 1;

    const audio =
        new Audio(
            GIFT_AUDIO_URL
        );


    /*
     * 毎回新しいAudioを作る。
     *
     * 前の音が再生中でも
     * 重ねて再生できる。
     */
    audio.volume =
        1.0;


    setStatus(
        testName +
        '：音声再生を開始します'
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
                        '：音声再生成功'
                    );

                    resultElement.textContent =
                        '🎁 テストギフト #' +
                        testCount +
                        '　音声再生成功';

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
                        error.name +
                        ': ' +
                        error.message
                    );


                    resultElement.textContent =
                        '❌ テストギフト #' +
                        testCount +
                        '　音声再生失敗';
                }
            );

    }

}


/*
 * ============================================
 * 今すぐテスト
 * ============================================
 */
function manualTest() {

    setStatus(
        '手動テスト開始'
    );


    playTestGiftSound(
        '手動テスト'
    );

}


/*
 * ============================================
 * 5秒後テスト
 *
 * ボタンを押してから5秒後なので、
 * その間は触らずに待つ。
 * ============================================
 */
function delayedTest() {

    setStatus(
        '5秒後に自動再生します。\n' +
        'そのまま何も触らないでください。'
    );


    setTimeout(
        function () {

            setStatus(
                '5秒経過。自動テスト開始'
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
 * 3回連続テスト
 * ============================================
 */
function repeatTest() {

    setStatus(
        '3回連続テスト開始'
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
        300
    );


    setTimeout(
        function () {

            playTestGiftSound(
                '連続テスト 3/3'
            );

        },
        600
    );

}


/*
 * ============================================
 * ボタン
 * ============================================
 */

document
    .getElementById(
        'manualTestButton'
    )
    .addEventListener(
        'click',
        function () {

            manualTest();

        }
    );


document
    .getElementById(
        'autoTestButton'
    )
    .addEventListener(
        'click',
        function () {

            delayedTest();

        }
    );


document
    .getElementById(
        'repeatTestButton'
    )
    .addEventListener(
        'click',
        function () {

            repeatTest();

        }
    );


/*
 * ============================================
 * 本命テスト
 *
 * ページを開いてから一切触らず、
 * 5秒後に自動で音声を鳴らす。
 *
 * ここではユーザー操作を一切要求しない。
 * ============================================
 */

setStatus(
    'ページを開きました。\n' +
    '何も触らず5秒待つと自動テストします。'
);


setTimeout(
    function () {

        setStatus(
            '無操作5秒経過。\n' +
            '自動ギフト音声テストを開始します。'
        );


        playTestGiftSound(
            '無操作自動テスト'
        );

    },
    AUTO_TEST_DELAY
);