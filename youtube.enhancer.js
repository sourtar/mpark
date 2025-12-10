// youtube.enhancer.js
// Purpose: remove ad fields from JSON responses & inject PiP-enabling JS into HTML watch pages.
// NOTE: This script runs in Shadowrocket/Surge-style http-response script environment.
// It reads response body as text and should return modified body.

function tryParseJSON(text) {
  try { return JSON.parse(text); } catch(e) { return null; }
}

// Remove ad-related keys recursively from an object
function removeAdKeys(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    const low = key.toLowerCase();
    // keys that commonly carry ads info
    if (low.includes('ad') || low.includes('ads') || low.includes('adbreak') || low.includes('adplacement') || low.includes('midroll') || low.includes('adState') || low.includes('ytad')) {
      delete obj[key];
      continue;
    }
    const val = obj[key];
    if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        if (typeof val[i] === 'object') removeAdKeys(val[i]);
      }
    } else if (typeof val === 'object') {
      removeAdKeys(val);
    }
  }
}

// For HTML pages: inject small script to force PiP friendly attributes on the first video element
const PIP_INJECTION = `<script>
(function(){
  try{
    function enablePiPForVideo(v){
      if(!v) return;
      try{
        // remove attributes that block PiP
        v.removeAttribute('disablepictureinpicture');
        v.removeAttribute('playsinline'); // some players use playsinline; keep though
        v.setAttribute('controls', ''); 
        // set allowPictureInPicture if present in parent
        var p = v.closest('ytd-watch-flexy, div');
        if(p && p.hasAttribute('allowfullscreen')) p.setAttribute('allowfullscreen', '');
        // add event to ensure PiP can be requested
        v.addEventListener('loadedmetadata', function(){
          // if Picture-in-Picture is available, optionally request (commented out to avoid auto-popping)
          // if (document.pictureInPictureEnabled) v.requestPictureInPicture().catch(()=>{});
        });
      }catch(e){}
    }
    // Try immediate
    var v = document.querySelector('video');
    if(v) enablePiPForVideo(v);
    // Also observe for dynamic replacements (YouTube replaces video element sometimes)
    var obs = new MutationObserver(function(){
      var nv = document.querySelector('video');
      if(nv) { enablePiPForVideo(nv); obs.disconnect(); }
    });
    obs.observe(document, {childList:true, subtree:true});
  }catch(e){}
})();
</script></body>`;

// Main handler (Shadowrocket-style)
var body = $response.body || '';
var url = $request.url || '';

if (/^https?:\/\/(.*)youtubei\.googleapis\.com\/.*$/i.test(url) || /^https?:\/\/(.*)\.googlevideo\.com\/.*$/i.test(url)) {
  // likely JSON player / api response
  var parsed = tryParseJSON(body);
  if (parsed) {
    removeAdKeys(parsed);
    // try to force-playability if present
    if (parsed.playabilityStatus && parsed.playabilityStatus.status && parsed.playabilityStatus.status !== 'OK') {
      parsed.playabilityStatus.status = 'OK';
      if (parsed.playabilityStatus.reason) parsed.playabilityStatus.reason = '';
    }
    body = JSON.stringify(parsed);
  } else {
    // not JSON: leave unchanged
  }
} else if (/^https?:\/\/(www\.)?youtube\.com\/watch/i.test(url) || /^https?:\/\/(www\.)?youtube\.com\/embed/i.test(url)) {
  // HTML watch page: inject PiP helper before </body>
  if (body && body.indexOf('</body>') !== -1) {
    // Only inject once
    if (body.indexOf('youtube.enhancer.pip') === -1) {
      body = body.replace(/<\/body>/i, PIP_INJECTION);
    }
  }
} else {
  // other responses: attempt generic JSON ad removal
  var parsed2 = tryParseJSON(body);
  if (parsed2) {
    removeAdKeys(parsed2);
    body = JSON.stringify(parsed2);
  }
}

// return modified body
$done({body: body});
