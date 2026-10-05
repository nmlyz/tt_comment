let backendUrl =
    location.protocol === 'file:'
        ? 'https://tiktok-chat-reader.zerody.one/'
        : 'https://sacrifice-nico.com';

let connection =
    new TikTokIOConnection(backendUrl);

let viewerCount = 0;
let likeCount = 0;
let diamondsCount = 0;

/*
 * 視聴者一覧
 *
 * 以前:
 *   chat / member / like / gift / social
 *   が来たユーザーを追加
 *
 * 現在:
 *   roomUser.ranks に入っているユーザーを使用
 */
let currentViewers = new Map();

let recentComments = new Map();

const COMMENT_DUPLICATE_WINDOW = 3000;

let giftAudio = null;

if (!window.settings) {
    window.settings = {};
}


/* =========================================================
   初期化
   ========================================================= */

$(document).ready(() => {

    $('#connectButton').on(
        'click',
        () => {

            unlockGiftAudio();

            connect();
        }
    );

    $('#uniqueIdInput').on(
        'keyup',
        function (e) {

            if (e.key === 'Enter') {

                unlockGiftAudio();

                connect();
            }
        }
    );

    $('#copyQueryButton').on(
        'click',
        copyQueryLink
    );

    $('#viewerMenuButton').on(
        'click',
        openViewerMenu
    );

    $('#viewerMenuClose').on(
        'click',
        closeViewerMenu
    );

    $('#viewerMenuOverlay').on(
        'click',
        closeViewerMenu
    );

    prepareGiftAudio();

    if (window.settings.username) {

        $('#uniqueIdInput').val(
            window.settings.username
        );

        connect();
    }
});


/* =========================================================
   URL / ユーザーID
   ========================================================= */

function getUsernameFromUrl() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    return params.get('username') || '';
}


function normalizeUniqueId(value) {

    if (!value) {
        return '';
    }

    value = String(value).trim();

    if (!value) {
        return '';
    }

    /*
     * @username
     */
    if (value.startsWith('@')) {

        return value.substring(1);
    }

    /*
     * TikTok URL
     */
    if (
        value.includes('tiktok.com')
    ) {

        try {

            const url =
                new URL(value);

            let path =
                url.pathname
                    .split('/')
                    .filter(Boolean);

            if (
                path.length > 0 &&
                path[0].startsWith('@')
            ) {
                return path[0].substring(1);
            }

            if (path.length > 0) {
                return path[0];
            }

        } catch (error) {

            console.warn(
                'URL解析失敗:',
                error
            );
        }
    }

    return value;
}


/* =========================================================
   接続
   ========================================================= */

function connect() {

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
        )
        .then((state) => {

            $('#stateText').text(
                'ルームID ' +
                state.roomId +
                ' に接続'
            );

            viewerCount = 0;
            likeCount = 0;
            diamondsCount = 0;

            currentViewers.clear();

            updateRoomStats();
            updateViewerMenu();

        })
        .catch((errorMessage) => {

            $('#stateText').text(
                String(errorMessage)
            );

            console.error(
                'TikTok接続エラー:',
                errorMessage
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
   テキスト処理
   ========================================================= */

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
        '不明'
    );
}


function getProfilePicture(data) {

    if (!data) {
        return '';
    }

    if (data.profilePictureUrl) {
        return data.profilePictureUrl;
    }

    if (
        data.user &&
        data.user.avatarThumb &&
        Array.isArray(
            data.user.avatarThumb.urlList
        ) &&
        data.user.avatarThumb.urlList.length > 0
    ) {

        return data.user.avatarThumb.urlList[0];
    }

    return '';
}


function getCurrentTime() {

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


/* =========================================================
   ユーザーリンク
   ========================================================= */

function generateUsernameLink(data) {

    const uniqueId =
        getDataUniqueId(data);

    const displayName =
        getDisplayName(data);

    if (!uniqueId) {

        return (
            '<span class="usernamelink">' +
            sanitize(displayName) +
            '</span>'
        );
    }

    return (
        '<a class="usernamelink" ' +
        'href="https://www.tiktok.com/@' +
        encodeURIComponent(uniqueId) +
        '" target="_blank" rel="noopener noreferrer">' +
        sanitize(displayName) +
        '</a>'
    );
}


/* =========================================================
   ギフト
   ========================================================= */

function isPendingStreak(data) {

    return (
        data &&
        data.giftType === 1 &&
        !data.repeatEnd
    );
}


function prepareGiftAudio() {

    if (giftAudio) {
        return;
    }

    giftAudio =
        new Audio('./gift.mp3');

    giftAudio.preload = 'auto';
}


function unlockGiftAudio() {

    prepareGiftAudio();

    if (!giftAudio) {
        return;
    }

    const currentVolume =
        giftAudio.volume;

    giftAudio.volume = 0;

    const promise =
        giftAudio.play();

    if (promise && promise.catch) {

        promise
            .then(() => {

                giftAudio.pause();
                giftAudio.currentTime = 0;
                giftAudio.volume = currentVolume;

            })
            .catch(() => {

                giftAudio.volume = currentVolume;
            });

    } else {

        giftAudio.pause();
        giftAudio.currentTime = 0;
        giftAudio.volume = currentVolume;
    }
}


function playGiftSound() {

    prepareGiftAudio();

    if (!giftAudio) {
        return;
    }

    try {

        giftAudio.pause();
        giftAudio.currentTime = 0;
        giftAudio.volume = 1;

        const promise =
            giftAudio.play();

        if (promise && promise.catch) {

            promise.catch((error) => {

                console.warn(
                    'ギフト音声を再生できません:',
                    error
                );
            });
        }

    } catch (error) {

        console.warn(
            'ギフト音声再生エラー:',
            error
        );
    }
}


/* =========================================================
   コメント重複防止
   ========================================================= */

function getCommentKey(data) {

    if (!data) {
        return '';
    }

    /*
     * 今回確認できた実データでは
     *
     * data.common.msgId
     *
     * が存在する。
     */
    if (
        data.common &&
        data.common.msgId
    ) {

        return String(
            data.common.msgId
        );
    }

    if (data.msgId) {

        return String(
            data.msgId
        );
    }

    if (
        data.messageId
    ) {

        return String(
            data.messageId
        );
    }

    /*
     * 最終フォールバック
     */
    return (
        String(
            data.userId ||
            (
                data.user &&
                data.user.id
            ) ||
            ''
        ) +
        '|' +
        String(
            data.comment ||
            data.content ||
            ''
        )
    );
}


function isDuplicateComment(data) {

    const key =
        getCommentKey(data);

    if (!key) {
        return false;
    }

    const now =
        Date.now();

    /*
     * 古いものを掃除
     */
    for (
        const [oldKey, timestamp]
        of recentComments
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
   チャット表示
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

    if (!container.length) {
        return;
    }

    if (
        !location.href.includes('obs.html') &&
        container.find('div').length > 500
    ) {

        container
            .find('div')
            .slice(0, 200)
            .remove();
    }

    container
        .find('.temporary')
        .remove();

    const profilePicture =
        getProfilePicture(data);

    const imageHtml =
        profilePicture
            ? (
                '<img class="miniprofilepicture" ' +
                'src="' +
                sanitize(profilePicture) +
                '" ' +
                'onerror="this.style.visibility=\'hidden\'">'
            )
            : (
                '<div class="miniprofilepicture"></div>'
            );

    const safeText =
        sanitize(text);

    const textColor =
        color || 'inherit';

    const className =
        summarize
            ? 'temporary'
            : 'static';

    container.append(
        '<div class="' +
        className +
        '">' +

            imageHtml +

            '<span>' +

                '<b>' +
                generateUsernameLink(data) +
                ':</b> ' +

                '<span style="color:' +
                textColor +
                '">' +
                safeText +
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
   ギフト表示
   ========================================================= */

function addGiftItem(data) {

    let container =
        location.href.includes('obs.html')
            ? $('.eventcontainer')
            : $('.giftcontainer');

    if (!container.length) {
        return;
    }

    if (
        !location.href.includes('obs.html') &&
        container.find('div').length > 200
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
        String(userId) +
        '_' +
        String(giftId);

    const pending =
        isPendingStreak(data);

    const repeatCount =
        Number(data.repeatCount) || 1;

    const diamondCount =
        Number(data.diamondCount) || 0;

    const totalCost =
        diamondCount *
        repeatCount;

    const giftName =
        data.giftName ||
        '不明';

    const giftPicture =
        data.giftPictureUrl ||
        '';

    const time =
        getCurrentTime();

    const giftImageHtml =
        giftPicture
            ? (
                '<img class="gifticon" ' +
                'src="' +
                sanitize(giftPicture) +
                '" ' +
                'onerror="this.style.visibility=\'hidden\'">'
            )
            : '';

    const html =
        '<div ' +
        'data-streakid="' +
        (
            pending
                ? sanitize(streakId)
                : ''
        ) +
        '">' +

            (
                getProfilePicture(data)
                    ? (
                        '<img class="miniprofilepicture" ' +
                        'src="' +
                        sanitize(
                            getProfilePicture(data)
                        ) +
                        '" ' +
                        'onerror="this.style.visibility=\'hidden\'">'
                    )
                    : (
                        '<div class="miniprofilepicture"></div>'
                    )
            ) +

            '<span>' +

                '<b>' +
                generateUsernameLink(data) +
                ':</b> ' +

                '<span>' +
                sanitize(
                    data.describe || ''
                ) +
                '</span>' +

                '<span class="giftTime">' +
                sanitize(time) +
                '</span>' +

                '<div class="giftDetails">' +

                    '<table>' +

                        '<tr>' +

                            '<td>' +
                            giftImageHtml +
                            '</td>' +

                            '<td>' +

                                '<span>' +
                                'ギフト: ' +
                                '<b>' +
                                sanitize(giftName) +
                                '</b>' +
                                '</span>' +

                                '<br>' +

                                '<span>' +
                                'ギフトID: ' +
                                '<b>' +
                                sanitize(giftId) +
                                '</b>' +
                                '</span>' +

                                '<br>' +

                                '<span>' +
                                '個数: ' +

                                '<b ' +
                                (
                                    pending
                                        ? 'style="color:red"'
                                        : ''
                                ) +
                                '>' +
                                '×' +
                                repeatCount.toLocaleString() +
                                '</b>' +

                                '</span>' +

                                '<br>' +

                                '<span>' +
                                'コスト: ' +
                                '<b>' +
                                totalCost.toLocaleString() +
                                '</b> ダイヤ' +
                                '</span>' +

                            '</td>' +

                        '</tr>' +

                    '</table>' +

                '</div>' +

            '</span>' +

        '</div>';

    const existingStreakItem =
        container.find(
            '[data-streakid="' +
            CSS.escape(streakId) +
            '"]'
        );

    if (
        pending &&
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
                container[0].scrollHeight
        },
        800
    );
}


/* =========================================================
   視聴者一覧
   ========================================================= */

function getViewerIdFromRank(rankData) {

    if (!rankData) {
        return '';
    }

    const user =
        rankData.user ||
        {};

    return String(
        user.id ||
        user.idStr ||
        user.displayId ||
        ''
    );
}


function convertRankUser(rankData) {

    if (!rankData) {
        return null;
    }

    const user =
        rankData.user ||
        {};

    const viewerId =
        getViewerIdFromRank(
            rankData
        );

    if (!viewerId) {
        return null;
    }

    let profilePicture = '';

    if (
        user.avatarThumb &&
        Array.isArray(
            user.avatarThumb.urlList
        ) &&
        user.avatarThumb.urlList.length > 0
    ) {

        profilePicture =
            user.avatarThumb.urlList[0];
    }

    return {

        id: viewerId,

        nickname:
            user.nickname ||
            user.displayId ||
            '不明',

        uniqueId:
            user.displayId ||
            '',

        profilePictureUrl:
            profilePicture,

        secUid:
            user.secUid ||
            '',

        score:
            rankData.score ||
            '0',

        rank:
            rankData.rank,

        raw: rankData
    };
}


function updateViewersFromRoomUser(msg) {

    if (
        !msg ||
        !Array.isArray(msg.ranks)
    ) {

        return;
    }

    /*
     * roomUser.ranks に存在するものだけで
     * 現在の一覧を作り直す。
     *
     * 以前のように
     * コメントした人・入室した人を
     * 無期限に追加し続けない。
     */

    const nextViewers =
        new Map();

    msg.ranks.forEach(
        (rankData) => {

            const viewer =
                convertRankUser(
                    rankData
                );

            if (!viewer) {
                return;
            }

            nextViewers.set(
                viewer.id,
                viewer
            );
        }
    );

    currentViewers =
        nextViewers;

    updateViewerMenu();
}


function updateViewerMenu() {

    const container =
        $('#viewerList');

    const countElement =
        $('#viewerMenuCount');

    if (!container.length) {
        return;
    }

    const viewers =
        Array.from(
            currentViewers.values()
        );

    /*
     * scoreがある場合は
     * TikTokから送られてきた順序を維持。
     *
     * 勝手に「rank 0～4」を
     * 5段階ランクとして扱わない。
     */

    countElement.text(
        viewers.length.toLocaleString() +
        '人'
    );

    if (viewers.length === 0) {

        container.html(
            '<div class="viewerEmpty">' +
            '視聴者情報を取得中...' +
            '</div>'
        );

        return;
    }

    let html = '';

    viewers.forEach(
        (viewer) => {

            const avatar =
                viewer.profilePictureUrl
                    ? (
                        '<img class="viewerAvatar" ' +
                        'src="' +
                        sanitize(
                            viewer.profilePictureUrl
                        ) +
                        '" ' +
                        'onerror="this.style.visibility=\'hidden\'">'
                    )
                    : (
                        '<div class="viewerAvatar"></div>'
                    );

            const nickname =
                sanitize(
                    viewer.nickname
                );

            const uniqueId =
                sanitize(
                    viewer.uniqueId
                );

            html +=
                '<div class="viewerItem">' +

                    avatar +

                    '<div class="viewerInfo">' +

                        '<div class="viewerNickname">' +
                        nickname +
                        '</div>' +

                        (
                            uniqueId
                                ? (
                                    '<div class="viewerUniqueId">' +
                                    '@' +
                                    uniqueId +
                                    '</div>'
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


function openViewerMenu() {

    $('#viewerMenu').addClass(
        'open'
    );

    $('#viewerMenuOverlay').addClass(
        'open'
    );

    updateViewerMenu();
}


function closeViewerMenu() {

    $('#viewerMenu').removeClass(
        'open'
    );

    $('#viewerMenuOverlay').removeClass(
        'open'
    );
}


/* =========================================================
   URLコピー
   ========================================================= */

async function copyQueryLink() {

    const inputValue =
        $('#uniqueIdInput').val();

    const username =
        normalizeUniqueId(
            inputValue
        );

    if (!username) {

        alert(
            'ユーザーIDを入力してください。'
        );

        return;
    }

    const url =
        new URL(
            'index.html',
            window.location.href
        );

    url.searchParams.set(
        'username',
        username
    );

    const text =
        url.toString();

    try {

        await navigator.clipboard.writeText(
            text
        );

        showCopyComplete();

    } catch (error) {

        console.warn(
            'Clipboard API失敗:',
            error
        );

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

            showCopyComplete();

        } catch (error2) {

            console.error(
                'コピー失敗:',
                error2
            );

            alert(
                'URLをコピーできませんでした。'
            );
        }

        textarea.remove();
    }
}


function showCopyComplete() {

    const button =
        $('#copyQueryButton');

    const originalText =
        button.text();

    button.text(
        '✓ コピー済み'
    );

    setTimeout(() => {

        button.text(
            originalText
        );

    }, 1500);
}


/* =========================================================
   部屋情報
   ========================================================= */

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


/* =========================================================
   roomUser
   ========================================================= */

connection.on(
    'roomUser',
    (msg) => {

        console.log(
            '[roomUser]',
            msg
        );

        if (
            msg &&
            typeof msg.viewerCount === 'number'
        ) {

            viewerCount =
                msg.viewerCount;

            updateRoomStats();
        }

        /*
         * ここが今回の重要部分。
         *
         * ranks に入っているユーザーを
         * 視聴者一覧として使用。
         */
        updateViewersFromRoomUser(
            msg
        );
    }
);


/* =========================================================
   Like
   ========================================================= */

connection.on(
    'like',
    (msg) => {

        console.log(
            '[like]',
            msg
        );

        if (
            msg &&
            typeof msg.totalLikeCount === 'number'
        ) {

            likeCount =
                msg.totalLikeCount;

            updateRoomStats();
        }

        if (
            window.settings.showLikes === '0'
        ) {

            return;
        }

        if (
            msg &&
            typeof msg.likeCount === 'number'
        ) {

            addChatItem(
                '#447dd4',
                msg,
                'ライブにいいねされました',
                false
            );
        }
    }
);


/* =========================================================
   Member
   ========================================================= */

let joinMsgDelay = 0;

connection.on(
    'member',
    (msg) => {

        console.log(
            '[member]',
            msg
        );

        if (
            window.settings.showJoins === '0'
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
                'ライブに参加しました',
                true
            );

        }, joinMsgDelay);
    }
);


/* =========================================================
   Chat
   ========================================================= */

connection.on(
    'chat',
    (msg) => {

        console.log(
            '[chat]',
            msg
        );

        if (
            window.settings.showChats === '0'
        ) {

            return;
        }

        /*
         * 同じコメントが重複して
         * 表示されるのを防ぐ。
         */
        if (
            isDuplicateComment(msg)
        ) {

            console.debug(
                '重複コメントを除外:',
                getCommentKey(msg)
            );

            return;
        }

        addChatItem(
            '',
            msg,
            msg.comment ||
            msg.content ||
            '',
            false
        );
    }
);


/* =========================================================
   Gift
   ========================================================= */

connection.on(
    'gift',
    (data) => {

        console.log(
            '[gift]',
            data
        );

        playGiftSound();

        if (
            !isPendingStreak(data) &&
            Number(data.diamondCount) > 0
        ) {

            diamondsCount +=
                Number(data.diamondCount) *
                (
                    Number(data.repeatCount) ||
                    1
                );

            updateRoomStats();
        }

        if (
            window.settings.showGifts === '0'
        ) {

            return;
        }

        addGiftItem(
            data
        );
    }
);


/* =========================================================
   Social
   ========================================================= */

connection.on(
    'social',
    (data) => {

        console.log(
            '[social]',
            data
        );

        if (
            window.settings.showFollows === '0'
        ) {

            return;
        }

        const displayType =
            String(
                data.displayType ||
                ''
            ).toLowerCase();

        let text = '';

        if (
            displayType.includes('follow')
        ) {

            text =
                'フォローされました';

        } else if (
            displayType.includes('share')
        ) {

            text =
                'ライブをシェアされました';

        } else {

            const label =
                String(
                    data.label ||
                    ''
                );

            text =
                label
                    .replace(
                        '{0:user}',
                        ''
                    )
                    .replace(
                        /liked the live/gi,
                        'ライブにいいねされました'
                    )
                    .replace(
                        /shared the live/gi,
                        'ライブをシェアされました'
                    );
        }

        addChatItem(
            '#ff005e',
            data,
            text,
            false
        );
    }
);


/* =========================================================
   配信終了
   ========================================================= */

connection.on(
    'streamEnd',
    () => {

        $('#stateText').text(
            '配信は終了しました。'
        );

        currentViewers.clear();

        updateViewerMenu();

        if (window.settings.username) {

            setTimeout(() => {

                connect();

            }, 30000);
        }
    }
);