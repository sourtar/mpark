/**
 * YouTube Enhancer Script (V2)
 * 去广告 + 后台播放 + PiP + 界面净化
 */

(function() {
    'use strict';

    const args = JSON.parse($argument || '{}');
    const blockUpload = args.blockUpload ?? true;
    const blockImmersive = args.blockImmersive ?? true;
    const blockShorts = args.blockShorts ?? true;
    const lyricLang = args.lyricLang ?? 'off';
    const captionLang = args.captionLang ?? 'off';
    const enablePiP = args.enablePiP ?? true;

    function cleanJSON(json) {
        // ===== 删除广告 =====
        if (json.playerResponse) {
            const pr = json.playerResponse;

            if (pr.adPlacements) delete pr.adPlacements;
            if (pr.adSlots) delete pr.adSlots;
            if (pr.playerAds) delete pr.playerAds;
            if (pr.adBreaks) delete pr.adBreaks;

            if (pr.streamingData && pr.streamingData.adaptiveFormats) {
                pr.streamingData.adaptiveFormats = pr.streamingData.adaptiveFormats.filter(f => !/ad/.test(f.url));
            }
        }

        // ===== 屏蔽按钮：上传、精选片段、Shorts =====
        if (json.contents) {
            let str = JSON.stringify(json.contents);
            if (blockUpload) str = str.replace(/uploadButton/g, '');
            if (blockImmersive) str = str.replace(/immersive/g, '');
            if (blockShorts) str = str.replace(/shorts/g, '');
            json.contents = JSON.parse(str);
        }

        // ===== 强制 PiP 与后台播放 =====
        if (enablePiP && json.playerResponse) {
            json.playerResponse.playbackTracking = json.playerResponse.playbackTracking || {};
            json.playerResponse.playbackTracking.disablePauseOnBackground = true;
        }

        // ===== 字幕和歌词语言 =====
        if (json.playerResponse && json.playerResponse.captions) {
            if (lyricLang !== 'off') json.playerResponse.captions.defaultAudioLanguage = lyricLang;
            if (captionLang !== 'off') json.playerResponse.captions.defaultCaptionLanguage = captionLang;
        }

        return json;
    }

    if ($response?.body) {
        try {
            const json = JSON.parse($response.body);
            const modified = cleanJSON(json);
            $done({ body: JSON.stringify(modified) });
        } catch (_) {
            $done({});
        }
    } else {
        $done({});
    }
})();
