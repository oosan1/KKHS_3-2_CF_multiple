DEFAULT_SOCKET_IO_URL = 'http://localhost:3000';
let socket;

const initialSetup = document.getElementById('initial-setup');
const waitingScreen = document.getElementById('waiting-screen');
const numberDisplay = document.getElementById('number-display');
const numberSelect = document.getElementById('number-select');
const connectBtn = document.getElementById('connect-btn');
const audioPlayer = document.getElementById('audio-player');
const socketIoUrlInput = document.getElementById('server-url-input');

const urlParams = new URLSearchParams(window.location.search);
const queryUrl = urlParams.get('serverUrl');
if (queryUrl) {
    socketIoUrlInput.value = queryUrl;
} else {
    socketIoUrlInput.value = DEFAULT_SOCKET_IO_URL;
}

// Shooting mode elements
const shootingMode = document.getElementById('shooting-mode');
const video = document.getElementById('video-feed');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('capture-btn');
const remainingShotsSpan = document.getElementById('remaining-shots');

let myNumber = -1;
let stream = null;
let remainingShots = 0;

// --- 初期設定 ---
// 番号のプルダウンを生成 (1-30)
for (let i = 1; i <= 30; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = i;
    numberSelect.appendChild(option);
}

// 接続ボタン
connectBtn.addEventListener('click', () => {
    myNumber = numberSelect.value;
    const serverUrl = socketIoUrlInput.value;
    if (socket) {
        socket.disconnect(); // 既存の接続を切断
    }
    socket = io.connect(serverUrl);
    initializeSocketEvents(); // ソケットイベントリスナーを再初期化
    initialSetup.classList.add('hidden');
    showWaitingScreen();
});

// --- 画面表示制御 ---
function hideAllScreens() {
    waitingScreen.classList.add('hidden');
    numberDisplay.classList.add('hidden');
    shootingMode.classList.add('hidden');
    document.body.style.backgroundColor = '#000'; // Reset background
}

function showWaitingScreen() {
    hideAllScreens();
    waitingScreen.classList.remove('hidden');
    document.body.innerHTML = ''; // 他の要素をクリア
    document.body.appendChild(waitingScreen);
    document.body.appendChild(audioPlayer); // audio要素は残す
}


// --- Socketイベントリスナー ---
function initializeSocketEvents() {
    // 接続処理
    socket.on('connect', () => {
        socket.emit('register-client-a', myNumber);
    });

    // 機能①: 画面色変更
    socket.on('command-change-color', (color) => {
        hideAllScreens();
        document.body.style.backgroundColor = color;
    });

    // 機能②: 番号確認
    socket.on('command-show-number', (number) => {
        hideAllScreens();
        numberDisplay.textContent = number;
        numberDisplay.classList.remove('hidden');
        document.body.innerHTML = ''; // 他の要素をクリア
        document.body.appendChild(numberDisplay);
    });

    // 機能③: 音声再生
    socket.on('command-play-audio', (data) => {
        if (data.type === 'specific' && data.number == myNumber) {
            audioPlayer.src = `audio/${data.number}_audio.mp3`;
            audioPlayer.play();
        } else if (data.type === 'bgm') {
            audioPlayer.src = `audio/BGM1.mp3`;
            audioPlayer.play();
        }
    });

    socket.on('command-set-volume', (volume) => {
        audioPlayer.volume = volume;
    });

    socket.on('command-stop-audio', () => {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
    });


    // 機能④: 写真撮影
    socket.on('command-start-shooting', async (data) => {
        hideAllScreens();
        shootingMode.classList.remove('hidden');
        document.body.appendChild(shootingMode); // body直下に追加

        remainingShots = data.count;
        remainingShotsSpan.textContent = remainingShots;
        captureBtn.disabled = false;

        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            video.srcObject = stream;
        } catch (err) {
            console.error("Error accessing camera: ", err);
            alert('カメラにアクセスできませんでした。');
        }
    });

    socket.on('command-stop-shooting', () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        showWaitingScreen();
    });
};

// 撮影ボタンの処理
captureBtn.addEventListener('click', () => {
    if (remainingShots <= 0) return;

    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const photoData = canvas.toDataURL('image/jpeg');
    socket.emit('photo-to-server', { photoData });

    remainingShots--;
    remainingShotsSpan.textContent = remainingShots;

    if (remainingShots <= 0) {
        captureBtn.disabled = true;
        const lockMessage = document.createElement('div');
        lockMessage.textContent = '撮影枚数の上限に達しました。';
        lockMessage.style.fontSize = '2em';
        lockMessage.style.color = 'yellow';
        lockMessage.style.marginTop = '20px';
        captureBtn.parentElement.appendChild(lockMessage);
    }
});