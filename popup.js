const exportBtn = document.getElementById('exportBtn');
const statusDiv = document.getElementById('status');

exportBtn.addEventListener('click', async () => {

    const playlistUrl = document
        .getElementById('playlistUrl')
        .value
        .trim();

    if (!playlistUrl) {
        statusDiv.innerText = '请输入播放列表 URL';
        return;
    }

    statusDiv.innerText = '正在打开播放列表...';

    try {

        // 创建新标签页
        const tab = await chrome.tabs.create({
            url: playlistUrl,
            active: false
        });

        // 等待页面加载完成
        await waitForTabComplete(tab.id);

        statusDiv.innerText = '页面加载完成，正在提取视频 URL...';

        // 注入脚本
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },

            func: async () => {

                // 自动滚动页面
                async function autoScroll() {

                    return new Promise((resolve) => {

                        let totalHeight = 0;
                        const distance = 1000;

                        const timer = setInterval(() => {

                            window.scrollBy(0, distance);

                            totalHeight += distance;

                            if (totalHeight >= document.body.scrollHeight) {

                                clearInterval(timer);
                                resolve();
                            }

                        }, 500);
                    });
                }

                // 执行滚动
                await autoScroll();

                // 等待懒加载
                await new Promise(r => setTimeout(r, 3000));

                // 获取所有视频链接
                const links = document.querySelectorAll(
                    'a[href*="watch?v="]'
                );

                const urls = new Set();

                links.forEach(link => {

                    let href = link.href;

                    if (href.includes('&list=')) {
                        href = href.split('&list=')[0];
                    }

                    if (href.includes('watch?v=')) {
                        urls.add(href);
                    }
                });

                return Array.from(urls);
            }
        });

        // 获取结果
        const urls = results[0].result;

        const total = urls.length;

        if (total === 0) {

            statusDiv.innerText = '未获取到视频 URL';
            return;
        }

        // 生成 txt 内容
        let content = '';

        content += `总视频数量：${total}\n`;
        content += '========================================\n\n';

        urls.forEach(url => {
            content += url + '\n';
        });

        // 创建文件
        const blob = new Blob(
            [content],
            { type: 'text/plain' }
        );

        const downloadUrl = URL.createObjectURL(blob);

        // 下载文件
        await chrome.downloads.download({
            url: downloadUrl,
            filename: 'youtube_playlist_urls.txt',
            saveAs: true
        });

        statusDiv.innerText =
            `导出成功！\n共 ${total} 个视频`;

    } catch (error) {

        console.error(error);

        statusDiv.innerText =
            '发生错误：' + error.message;
    }
});

// 等待标签页加载完成
function waitForTabComplete(tabId) {

    return new Promise((resolve) => {

        function listener(updatedTabId, changeInfo) {

            if (
                updatedTabId === tabId &&
                changeInfo.status === 'complete'
            ) {

                chrome.tabs.onUpdated.removeListener(listener);

                resolve();
            }
        }

        chrome.tabs.onUpdated.addListener(listener);
    });
}