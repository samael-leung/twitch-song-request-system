# Twitch 與雷虎練唱台：不需安裝通道軟體

沿用兩個專案既有的 Node.js、Python／練唱台環境與相依套件。不需要 ngrok、額外伺服器、瀏覽器擴充功能或任何同步工具；程式直接以既有 `ws` 套件連接 Twitch EventSub。沒有新增停用 Twitch 的模式。

## 一次設定

1. 在 [Twitch 開發者控制台](https://dev.twitch.tv/console/apps) 建立或使用既有應用程式，將 OAuth Redirect URL 設為 **`http://localhost:3000/auth/twitch/callback`**。使用支援 implicit grant 的應用程式（Public client 不需要 Client Secret）。
2. 若沒有 `.env`，從 `.env.example` 複製一份。設定真實的 `TWITCH_CLIENT_ID`。預設 `TWITCH_TRANSPORT=websocket`；不需要 `PUBLIC_URL`、Client Secret 或 Webhook Secret。`TWITCH_BROADCASTER_ID` 留空可自動使用授權帳號，若已有設定則必須與授權的主播一致；請清除舊範本的 placeholder。
3. 沿用 `TWITCH_REWARD_ID` 與 `TWITCH_RANDOM_REWARD_ID` 的頻道點數兌換項目設定。只處理這兩種已設定的兌換，不會把其他頻道點數兌換誤當點歌。Google 歌曲清單與點歌紀錄沿用既有試算表及 `google-credentials.json` 設定。
4. 在點歌系統執行 `npm start`，或執行 `start.ps1`／`start_zh.ps1`。這兩個啟動腳本不會尋找、安裝或啟動任何通道工具。
5. 在本機控制台按「連接 Twitch」，用**主播帳號**同意讀取頻道點數兌換的權限。確認控制台顯示「Twitch 已連線」。授權需要連上 Twitch；尚未授權時會顯示「請授權 Twitch」，不代表 Twitch 事件已連線。
6. 啟動包含整合變更的練唱台，在視窗中勾選「同步點歌系統『正在播放』」。雙向選歌細節見 [LEIHU_INTEGRATION.md](LEIHU_INTEGRATION.md)。兩個專案必須都套用整合分支變更。

`setup.ps1`／`setup_zh.ps1` 預設只準備既有 Node 相依套件與 Client ID，後續使用瀏覽器授權。不會要求安裝 ngrok。原本的 webhook 設定流程只供明確選擇 `TWITCH_TRANSPORT=webhook` 的既有 HTTPS 部署使用。

授權 token 只保存在本機、Git 忽略的 `twitch-session.json`，不會放進 URL query、版本控制或日誌。首次回傳的 URL fragment 會立即清除。Token 到期／撤銷時，控制台會要求重新授權；implicit grant 不提供 refresh token，請再次按「連接 Twitch」。程式會在啟動和每小時驗證 token。進階無互動環境也可自行提供 `TWITCH_USER_ACCESS_TOKEN`，需要相同 scope 與主播帳號；環境變數優先於本機授權檔。

若使用非 3000 連接埠，請同時設定 `PORT`、`TWITCH_REDIRECT_URI`，並修改 Twitch 開發者控制台的 Redirect URL，三者必須相符。本機授權頁只允許 loopback 連線，請在執行點歌系統的電腦上操作。雲端開發環境無法用遠端使用者的 localhost 回呼完成授權；正式使用可在原本直播電腦啟動兩個系統。

## 網路與驗證

只需要對外連接 `id.twitch.tv`、`api.twitch.tv`（HTTPS）與 `eventsub.wss.twitch.tv`（WSS），不需要開放外部連入或公開 Webhook。Google Sheets 的既有網路需求不變。

程式處理 EventSub welcome、keepalive、reconnect 交接、斷線後重新訂閱、撤銷與重複事件。WebSocket 與保留的 Webhook 共用相同點歌處理函式。執行 `npm test` 驗證授權、訂閱、重連、去重及雙向選歌；自動測試使用測試 token／事件，不會向真實頻道建立訂閱。

保留 `TWITCH_TRANSPORT=webhook` 給已有公開 HTTPS 部署的使用者；該模式必須自行設定 `PUBLIC_URL`，啟動腳本也不會代為啟動通道軟體。
