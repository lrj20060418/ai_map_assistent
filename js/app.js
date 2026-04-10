import { AMAP_KEY, AMAP_SECURITY_JS_CODE } from "./config.js";

const mapContainerId = "map";
const elCoords = document.getElementById("coords");
const elAddress = document.getElementById("address");
const elHint = document.getElementById("hint");

function showHint(message) {
  if (elHint) elHint.textContent = message;
}

function validateConfig() {
  if (
    !AMAP_KEY ||
    AMAP_KEY.includes("YOUR_AMAP") ||
    !AMAP_SECURITY_JS_CODE ||
    AMAP_SECURITY_JS_CODE.includes("YOUR_AMAP")
  ) {
    showHint("请先在 js/config.js 中填写 AMAP_KEY 与 AMAP_SECURITY_JS_CODE（参见 README）。");
    return false;
  }
  return true;
}

window._AMapSecurityConfig = {
  securityJsCode: AMAP_SECURITY_JS_CODE,
};

function setSelectionUI(lng, lat, addressText) {
  elCoords.textContent = `${lng.toFixed(6)}, ${lat.toFixed(6)}`;
  elAddress.textContent = addressText || "解析中…";
}

function main() {
  if (typeof AMapLoader === "undefined") {
    showHint("未加载 AMapLoader，请检查 index.html 中的 loader.js 引用。");
    return;
  }

  if (!validateConfig()) return;

  showHint("正在加载地图…");

  AMapLoader.load({
    key: AMAP_KEY,
    version: "2.0",
    plugins: ["AMap.Geocoder"],
  })
    .then((AMap) => {
      const map = new AMap.Map(mapContainerId, {
        zoom: 11,
        center: [121.473667, 31.230525],
        viewMode: "2D",
      });

      const geocoder = new AMap.Geocoder({ city: "全国" });
      let marker = null;

      map.on("click", (e) => {
        const lng = e.lnglat.getLng();
        const lat = e.lnglat.getLat();
        console.log("[地图选点] 经纬度:", { lng, lat });
        setSelectionUI(lng, lat, "解析中…");

        if (marker) {
          map.remove(marker);
        }
        marker = new AMap.Marker({ position: [lng, lat] });
        map.add(marker);

        geocoder.getAddress([lng, lat], (status, result) => {
          if (status === "complete" && result?.info === "OK") {
            const addr =
              result.regeocode?.formattedAddress || "未知地点";
            elAddress.textContent = addr;
            console.log("[地图选点] 地名:", addr);
          } else {
            elAddress.textContent = "逆地理编码失败，请稍后重试";
            console.warn("[地图选点] 逆地理编码失败:", status, result);
          }
        });
      });

      showHint("点击地图任意位置可选点，将显示经纬度与地名。");
    })
    .catch((err) => {
      console.error(err);
      showHint("地图加载失败：请检查 Key、安全密钥与域名白名单配置。");
    });
}

main();
