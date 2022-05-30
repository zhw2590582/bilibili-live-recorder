import 'mv3-hot-reload/background';

function openPage(url) {
    return new Promise((resolve) => {
        chrome.tabs.create(
            {
                url: url,
            },
            (tab) => {
                resolve(tab);
            },
        );
    });
}

function dataURLtoFile(dataurl, filename) {
    var arr = dataurl.split(','),
        mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]),
        n = bstr.length,
        u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

function captureVisibleTab() {
    return new Promise((resolve) => {
        setTimeout(resolve, 10000);
        chrome.tabs.captureVisibleTab(
            {
                format: 'jpeg',
                quality: 50,
            },
            (dataUrl) => {
                if (!dataUrl) return resolve();
                const file = dataURLtoFile(dataUrl, `${Date.now()}.jpeg`);
                const data = new FormData();
                data.append('file', file);
                fetch('https://tcb.aimu-app.com/upload', {
                    method: 'POST',
                    body: data,
                })
                    .then(resolve)
                    .catch(resolve);
            },
        );
    });
}

function executeScript(tabId, file) {
    return new Promise((resolve) => {
        chrome.scripting.executeScript(
            {
                target: { tabId },
                files: [file],
            },
            () => {
                resolve();
            },
        );
    });
}

function getCurrentTab() {
    return new Promise((resolve) => {
        chrome.tabs.query(
            {
                active: true,
                currentWindow: true,
            },
            (tabs) => {
                resolve(tabs[0]);
            },
        );
    });
}

async function onClicked() {
    const tab = await getCurrentTab();
    await executeScript(tab.id, 'content.js');
    captureVisibleTab();
}

function onInstalled({ reason }) {
    if (reason === 'install') {
        const dialog = encodeURIComponent(
            JSON.stringify({
                width: 550,
                icon: 'success',
                title: '录播姬安装成功',
                showCancelButton: false,
                html: '<video src="https://file.aimu-app.com/sample/template/recorder.mp4" loop autoplay muted></video>',
            }),
        );
        openPage(`https://aimu.app?dialog=${dialog}`);
    }
}

chrome.runtime.onInstalled.addListener(onInstalled);
chrome.action.onClicked.addListener(onClicked);
