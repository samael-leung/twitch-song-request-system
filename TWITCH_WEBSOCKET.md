# 不需安裝額外工具的 Twitch／練唱台同步

此整合分支已合併 `master` 的 `33b0ca7`，使用上游內建的瀏覽器設定精靈、Twitch 裝置授權與憑證自動更新。沿用既有 Node.js、Python／練唱台環境與專案相依套件；沒有新增停用 Twitch 的模式，也不需要安裝通道、擴充功能或同步工具。

1. 在點歌系統執行 `npm start`，或使用上游 `start.bat`／`start_zh.bat`／PowerShell 啟動腳本。
2. 在開啟的首頁依設定精靈填入 Client ID、以主播帳號授權、選擇頻道點數兌換及 Google 試算表。Twitch 應用程式請依上游指引設為 Public。**不再使用先前整合版的 `/auth/twitch`、implicit token 或本機 OAuth 回呼設定**。若之前使用該版，請在 `/setup` 重新授權；舊 `twitch-session.json` 仍被 Git 忽略，但不再讀取。
3. 設定完成後伺服器會啟動 Twitch 與歌曲清單服務。隨機獎勵沿用最新上游的 `TWITCH_RANDOM_REWARDS`，可以依試算表分頁設定多個隨機兌換。歷史依上游規則，在歌曲唱完時記錄。
4. 啟動練唱台 1.4.5，勾選「同步點歌系統『正在播放』」。同機執行時預設連接 `http://127.0.0.1:3000`，不同位址可在啟動練唱台前設定 `SONG_REQUEST_URL`。

最新上游的聊天指令、媒體播放器、顯示設定、隨機歌曲冷卻、多候選歌曲選擇與配對改善均保留。練唱台選歌會沿用既有待唱／待審核候選／已唱項目，保留點歌者、調音及隨機標記；原本歌曲移至待唱。重新抽選目前歌曲、切歌、拖曳及刪除遞補都會更新練唱台。

詳細使用方式見 [SETUP_zh_TW.md](SETUP_zh_TW.md) 與 [LEIHU_INTEGRATION.md](LEIHU_INTEGRATION.md)。兩個專案都必須使用整合分支；Windows 練唱台既有 1.4.4 安裝可使用 1.4.5 的程式更新檔，不必重新安裝 Python 或套件。

驗證指令為 `npm test`。測試涵蓋合併後的實際伺服器／設定精靈、HTTP API、WebSocket 廣播、上游新增歌單操作與雙向選歌。真實 Twitch 授權、頻道點數兌換、Google Sheets 及 Windows 安裝 GUI 仍需使用者帳號／實機驗證。
