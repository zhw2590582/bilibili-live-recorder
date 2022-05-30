import style from 'bundle-text:./content.less';
import 'mv3-hot-reload/content';
import fixWebmDuration from 'webm-duration-fix';

class Injected {
    constructor() {
        this.blobs = [];
        this.src = '';
        this.timer = null;
        this.video = null;
        this.stream = null;
        this.mediaRecorder = null;
        this.createUI();
        this.bindEvent();
    }

    check() {
        return new Promise((resolve) => {
            (function loop() {
                const video = document.querySelector('video');
                if (video) {
                    resolve();
                } else {
                    setTimeout(loop, 1000);
                }
            })();
        });
    }

    sendMessage(type, data) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ type, data }, (res) => {
                resolve(res);
            });
        });
    }

    static get options() {
        return {
            audioBitsPerSecond: 128000,
            videoBitsPerSecond: 5000000,
            mimeType: 'video/webm; codecs="h264, opus"',
        };
    }

    get size() {
        return this.blobs.reduce((size, item) => size + item.size, 0);
    }

    log(msg) {
        throw new Error(`录播姬 --> ${msg}`);
    }

    durationToTime(duration) {
        const m = String(Math.floor(duration / 60)).slice(-5);
        const s = String(duration % 60);
        return `${m.length === 1 ? `0${m}` : m}:${s.length === 1 ? `0${s}` : s}`;
    }

    mergeBlobs(blobs = []) {
        const { size } = this;
        let result = new Blob([]);

        const tasks = blobs.map((blob) => () => {
            return new Promise((resolve) => {
                setTimeout(() => {
                    result = new Blob([result, blob], {
                        type: 'video/webm',
                    });
                    this.$wait.textContent = `${Math.floor((result.size / size || 0) * 100)}%`;
                    resolve();
                }, 0);
            });
        });

        return new Promise((resolve) => {
            (async function loop() {
                const task = tasks.shift();
                if (task) {
                    task().then(loop);
                } else {
                    try {
                        const fixBlob = await fixWebmDuration(result);
                        resolve(fixBlob);
                    } catch (error) {
                        resolve(result);
                    }
                }
            })();
        });
    }

    createUI() {
        this.$container = document.createElement('div');
        this.$container.classList.add('bilibili-live-recorder');
        this.$container.innerHTML = `
            <div class="blr-states">
                <div class="blr-state blr-state-before-record blr-active">开始</div>
                <div class="blr-state blr-state-recording">停止</div>
                <div class="blr-state blr-state-after-record">下载</div>
                <div class="blr-state blr-state-wait">0%</div>
            </div>
            <div class="blr-monitors">
                <div class="blr-monitor blr-monitor-top">
                    <div class="blr-monitor-name">时长：</div>
                    <div class="blr-monitor-value blr-duration">00:00</div>
                </div>
                <div class="blr-monitor blr-monitor-bottom">
                    <div class="blr-monitor-name">大小：</div>
                    <div class="blr-monitor-value blr-size">0.00M</div>
                </div>
            </div>
            <div class="blr-subtitle">
                <a href="https://aimu.app" target="_blank">在线字幕编辑器</a>
            </div>
        `;

        this.$states = Array.from(this.$container.querySelectorAll('.blr-state'));
        this.$beforeRecord = this.$container.querySelector('.blr-state-before-record');
        this.$recording = this.$container.querySelector('.blr-state-recording');
        this.$afterRecord = this.$container.querySelector('.blr-state-after-record');
        this.$wait = this.$container.querySelector('.blr-state-wait');
        this.$duration = this.$container.querySelector('.blr-duration');
        this.$size = this.$container.querySelector('.blr-size');
        this.$monitor = this.$container.querySelector('.blr-monitors');
        this.$container.classList.add('blr-focus');
        document.body.appendChild(this.$container);

        setTimeout(() => {
            this.$container.classList.remove('blr-focus');
        }, 3000);
    }

    bindEvent() {
        this.$beforeRecord.addEventListener('click', () => {
            this.start();
        });

        this.$recording.addEventListener('click', () => {
            this.stop();
        });

        this.$afterRecord.addEventListener('click', () => {
            if (this.blobs.length) {
                this.download().then(() => {
                    this.reset();
                });
            } else {
                this.reset();
            }
        });

        let isDroging = false;
        let lastPageX = 0;
        let lastPageY = 0;
        let lastPlayerLeft = 0;
        let lastPlayerTop = 0;

        this.$monitor.addEventListener('mousedown', (event) => {
            if (event.button === 0) {
                isDroging = true;
                lastPageX = event.pageX;
                lastPageY = event.pageY;
                lastPlayerLeft = this.$container.offsetLeft;
                lastPlayerTop = this.$container.offsetTop;
            }
        });

        document.addEventListener('mousemove', (event) => {
            if (isDroging) {
                const x = event.pageX - lastPageX;
                const y = event.pageY - lastPageY;
                this.$container.style.transform = `translate(${x}px, ${y}px)`;
            }
        });

        document.addEventListener('mouseup', (event) => {
            if (isDroging) {
                isDroging = false;
                this.$container.style.transform = 'translate(0, 0)';
                const x = lastPlayerLeft + event.pageX - lastPageX;
                const y = lastPlayerTop + event.pageY - lastPageY;
                this.$container.style.left = `${x}px`;
                this.$container.style.top = `${y}px`;
            }
        });
    }

    start() {
        clearInterval(this.timer);
        if (this.mediaRecorder) this.mediaRecorder.stop();
        const videos = Array.from(document.querySelectorAll('video'));
        if (videos.length) {
            this.video = videos.find((item) => item.captureStream);
            if (this.video) {
                try {
                    this.src = this.video.src;
                    this.video.crossOrigin = 'anonymous';
                    this.stream = this.video.captureStream();
                    this.changeState('recording');
                    if (MediaRecorder && MediaRecorder.isTypeSupported(Injected.options.mimeType)) {
                        this.mediaRecorder = new MediaRecorder(this.stream, Injected.options);
                        this.mediaRecorder.ondataavailable = (event) => {
                            this.blobs.push(event.data);
                            const size = this.size / 1024 / 1024;
                            this.$size.textContent = `${size.toFixed(2).slice(-8)}M`;
                            this.$duration.textContent = this.durationToTime(
                                this.blobs.filter((item) => item.size > 1024).length,
                            );
                        };
                        this.mediaRecorder.start(1000);
                        this.timer = setInterval(() => {
                            if (this.video && this.video.src && this.src !== this.video.src) {
                                if (this.blobs.length) {
                                    this.start();
                                } else {
                                    this.stop();
                                }
                            }
                        }, 1000);
                    } else {
                        this.reset();
                        this.log(`不支持录制格式：${Injected.options.mimeType}`);
                    }
                } catch (error) {
                    this.reset();
                    this.log(`录制视频流失败：${error.message.trim()}`);
                }
            } else {
                this.reset();
                this.log('未发现视频流');
            }
        } else {
            this.reset();
            this.log('未发现视频元素');
        }
    }

    stop() {
        clearInterval(this.timer);
        this.changeState('after-record');
        if (this.mediaRecorder) {
            this.mediaRecorder.stop();
        }
    }

    download() {
        this.changeState('wait');
        return this.mergeBlobs(this.blobs).then((blob) => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${document.title || Date.now()}.webm`;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    reset() {
        clearInterval(this.timer);
        this.changeState('before-record');
        this.blobs = [];
        this.src = '';
        this.timer = null;
        this.video = null;
        this.stream = null;
        this.mediaRecorder = null;
        this.$duration.textContent = '00:00';
        this.$size.textContent = '0.00M';
        this.$wait.textContent = '0%';
    }

    changeState(state) {
        this.$states.forEach((item) => {
            if (item.classList.contains(`blr-state-${state}`)) {
                item.classList.add('blr-active');
            } else {
                item.classList.remove('blr-active');
            }
        });
    }
}

if (typeof document !== 'undefined') {
    if (!document.getElementById('blr-style')) {
        const $style = document.createElement('style');
        $style.id = 'blr-style';
        $style.textContent = style;
        document.head.appendChild($style);
        new Injected();
    }
}

export default Injected;
