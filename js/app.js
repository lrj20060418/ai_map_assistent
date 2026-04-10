import { AMAP_KEY, AMAP_SECURITY_JS_CODE, AMAP_WEBSERVICE_KEY } from "./config.js";

const mapContainerId = "map";
const elCoords = document.getElementById("coords");
const elAddress = document.getElementById("address");
const elHint = document.getElementById("hint");
const elWeatherStatus = document.getElementById("weatherStatus");
const elWeatherTemp = document.getElementById("weatherTemp");
const elWeatherWind = document.getElementById("weatherWind");
const elWeatherHumidity = document.getElementById("weatherHumidity");
const elWeatherObsTime = document.getElementById("weatherObsTime");

function showHint(message) {
  if (elHint) elHint.textContent = message;
}

function setWeatherUI({ status, temp, wind, humidity, obsTime }) {
  if (elWeatherStatus) elWeatherStatus.textContent = status ?? "—";
  if (elWeatherTemp) elWeatherTemp.textContent = temp ?? "—";
  if (elWeatherWind) elWeatherWind.textContent = wind ?? "—";
  if (elWeatherHumidity) elWeatherHumidity.textContent = humidity ?? "—";
  if (elWeatherObsTime) elWeatherObsTime.textContent = obsTime ?? "—";
}

function validateWeatherConfig() {
  if (!AMAP_WEBSERVICE_KEY || AMAP_WEBSERVICE_KEY.includes("YOUR_AMAP_WEBSERVICE")) {
    return false;
  }
  return true;
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

async function fetchAmapWeatherLive({ adcode }) {
  const url = new URL("https://restapi.amap.com/v3/weather/weatherInfo");
  url.searchParams.set("city", adcode);
  url.searchParams.set("key", AMAP_WEBSERVICE_KEY);
  url.searchParams.set("extensions", "base");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`AMap Weather HTTP ${res.status}`);
  }

  const data = await res.json();
  if (data?.status !== "1") {
    throw new Error(`AMap Weather status ${data?.status ?? "unknown"}: ${data?.info ?? ""}`);
  }
  const live = Array.isArray(data?.lives) ? data.lives[0] : null;
  if (!live) {
    throw new Error("AMap Weather missing lives[0]");
  }

  return {
    weather: live.weather,
    temperature: live.temperature,
    winddirection: live.winddirection,
    windpower: live.windpower,
    humidity: live.humidity,
    reporttime: live.reporttime,
  };
}

function renderAmapWeatherLive(live) {
  const status = live?.weather ?? "—";
  const temp = live?.temperature != null ? `${live.temperature} °C` : "—";
  const wind =
    live?.winddirection && live?.windpower
      ? `${live.winddirection} ${live.windpower}`
      : "—";
  const humidity = live?.humidity != null ? `${live.humidity}%` : "—";
  const obsTime = live?.reporttime ?? "—";
  setWeatherUI({ status, temp, wind, humidity, obsTime });
}

function main() {
  if (typeof AMapLoader === "undefined") {
    showHint("未加载 AMapLoader，请检查 index.html 中的 loader.js 引用。");
    return;
  }

  if (!validateConfig()) return;
  const hasWeather = validateWeatherConfig();
  if (!hasWeather) {
    setWeatherUI({
      status: "未配置 AMAP_WEBSERVICE_KEY",
      temp: "—",
      wind: "—",
      humidity: "—",
      obsTime: "—",
    });
  }

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

            const adcode = result?.regeocode?.addressComponent?.adcode;
            if (hasWeather) {
              if (!adcode) {
                setWeatherUI({
                  status: "无法获取 adcode，天气查询不可用",
                  temp: "—",
                  wind: "—",
                  humidity: "—",
                  obsTime: "—",
                });
                console.warn("[天气] 缺少 adcode，无法调用高德天气");
                return;
              }

              setWeatherUI({
                status: "加载中…",
                temp: "—",
                wind: "—",
                humidity: "—",
                obsTime: "—",
              });

              fetchAmapWeatherLive({ adcode })
                .then((live) => {
                  renderAmapWeatherLive(live);
                  console.log("[天气] live:", live, "adcode:", adcode);
                })
                .catch((err) => {
                  console.error("[天气] 拉取失败:", err);
                  setWeatherUI({
                    status: "天气获取失败",
                    temp: "—",
                    wind: "—",
                    humidity: "—",
                    obsTime: "—",
                  });
                });
            }
          } else {
            elAddress.textContent = "逆地理编码失败，请稍后重试";
            console.warn("[地图选点] 逆地理编码失败:", status, result);

            if (hasWeather) {
              setWeatherUI({
                status: "逆地理编码失败，无法查询天气",
                temp: "—",
                wind: "—",
                humidity: "—",
                obsTime: "—",
              });
            }
          }
        });
      });

      showHint(
        hasWeather
          ? "点击地图任意位置可选点，将显示经纬度、地名，并自动展示天气。"
          : "点击地图任意位置可选点，将显示经纬度与地名（天气未配置）。",
      );
    })
    .catch((err) => {
      console.error(err);
      showHint("地图加载失败：请检查 Key、安全密钥与域名白名单配置。");
    });
}

main();
