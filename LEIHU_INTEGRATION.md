# 雷虎練唱台雙向選歌

點歌系統上游為 [sheng7337/twitch-song-request-system](https://github.com/sheng7337/twitch-song-request-system)，目前已合併 `master` 的 `333337d48fcb78fd92ee47316f99792bc9b4778d`（2026.11-2）。保留原生雷虎匯入、下載、歌詞、遠端開歌、聊天室、模式切換、點數兌換及佇列保存；兩個整合儲存庫均只更新 **`leihu-song-request-sync`** 分支。

練唱台 1.6.9 顯示「點歌系統回應錯誤（404）」時，是正在執行的點歌伺服器缺少 `/api/integrations/leihu/selection`。原作者的 `/api/leihu/status`、`/api/leihu/open` 是另一組 API，更新練唱台或 npm 不會補上選歌路由。

## 保留現有原作者 ZIP 安裝，直接修復

實際點歌專案為 `E:\songRequest`，不需要 `.git`。先停止點歌系統，再套用 [相容修復包](https://github.com/samael-leung/Leihu-singsing/tree/leihu-song-request-sync/repair/song-request-sync)，依其說明驗證 SHA-256 並執行安裝。它只新增／更新相容模組並掛載一行路由，會備份 index.js、已知舊版相容模組與修復紀錄，可安全還原。保留原作者 server/leihu.js、server/queue.js、package.json、.env、song-links.json 及相依套件。修復工具不會安裝軟體或呼叫 Twitch／Google API；練唱台 1.6.9 可繼續使用。

原作者 ZIP 更新後若 index.js 的掛載消失，可以重新套用新版修復包；遇到已知舊修復會先備份再升級，遇到自行修改過的相容模組會停止，避免覆蓋。安裝完成後重新執行 npm start，並確認下面的 GET 回傳 revision 與 nowPlaying，再重新勾選練唱台同步。

## 部署與版本

在專案目錄（使用者目前為 `E:\songRequest`）執行：

```powershell
npm ci --ignore-scripts
npm test
npm audit --omit=dev
npm start
```

package-lock.json 已納入版本控制，固定已驗證的相依套件；body-parser 使用已修補的 1.20.9，修補壓縮請求造成阻斷服務的公告 GHSA-27r3-jxmh-p828。googleapis 固定為 188.0.0，修補舊依賴間接使用 uuid 的已知漏洞；另將 follow-redirects 提升至 1.16.2，修補 GHSA-mrwp-f3q8-3g9p 的重新導向憑證洩漏問題。Node.js 核心仍需自行使用已修補的受支援版本（24.x 至少 24.22.1）。

ZIP 安裝沒有 .git 不影響執行。更新前保留 .env、Google 憑證與歌曲配對；若目前另有本機自訂功能，請合併程式碼或繼續使用已成功的[相容修復包](https://github.com/samael-leung/Leihu-singsing/tree/leihu-song-request-sync/repair/song-request-sync)，不要把這個分支當成本機自訂版本的完整快照。

本分支使用一個獨立相容模組，沿用佇列公開 API，並保留既有 leihu.js。會呼叫原生 setLink，保存 song-links.json 對應，並透過原生佇列的儲存／廣播路徑保存 leihuId 與候選選擇；不會提前完成或退還點數兌換。首次部署後可在另一個 PowerShell 驗證：

```powershell
Invoke-RestMethod 'http://127.0.0.1:3000/api/integrations/leihu/selection'
```

應回傳 revision 與 nowPlaying。只有在正確的程式版本提供這個路由後，重新啟動及勾選同步才會消除 404；單純 npm 更新不會補上程式路由。

## 啟動

1. 點歌系統已合併 sheng7337 上游 `master`（`00d83d0`），沿用上游的瀏覽器設定精靈與 Twitch 自動更新授權流程，不需要通道或同步工具。在專案目錄執行 `npm start`，依首頁設定精靈完成 Twitch、兌換項目與試算表設定。既有完整設定會直接開啟控制台。此前整合版本使用 `/auth/twitch` 的使用者，更新後請改用 `/setup` 重新授權。詳見 [TWITCH_WEBSOCKET.md](TWITCH_WEBSOCKET.md)。
2. 在雷虎練唱台依其 README 安裝並啟動。兩個服務在同一台電腦時不需額外設定；預設連接 `http://127.0.0.1:3000`。若需更改，在啟動練唱台的程序設定 `SONG_REQUEST_URL`，例如 PowerShell：

   ```powershell
   $env:SONG_REQUEST_URL = 'http://127.0.0.1:3000'
   python app.py
   ```

3. 在練唱台勾選「同步點歌系統『正在播放』」。開關儲存在該瀏覽器，預設關閉；顯示「點歌同步已連線」代表同步請求成功。

同步由開啟中的練唱台視窗執行，每秒檢查一次；關閉視窗或取消勾選即停止。建議只開一個啟用同步的練唱台視窗。啟用時以點歌系統目前的「正在播放」為準；若該欄為空，等待下一次選歌。

## 行為

- 點歌系統切歌、刪除目前歌曲後遞補、或拖曳歌曲到「正在播放」，都會自動在練唱台開啟對應歌曲。這只選歌，不會自動播放音訊。
- 練唱台手動開啟歌曲後，會將對應歌曲放到點歌系統的「正在播放」。若已在待唱、待審核或已唱清單中，沿用該項目與點歌者、調音資訊；不存在才新增，點歌者標記為 `leihu`。原本正在播放的歌曲保留在待唱清單最前方。
- 整合選歌當下不會呼叫 `recordRequest`；沿用最新上游規則，按「唱完／Skip」或將正在播放移至已唱時才記錄歷史。
- 練唱台 1.4.6 可清理 YouTube 的「歌詞／Official MV／HD」附加文字、辨識歌手與歌名順序，結合 `yt_track`、線上歌詞曲名及繁簡體別名評分。明確且唯一的結果會自動選歌；同名或版本相近時，按候選按鈕確認一次即可。若需修正可按「更改對應」，或在歌曲庫手動開啟正確歌曲。歌曲須先匯入並完成旋律分析，整合不會自動下載或分析。
- 同一首歌的重複事件不會新增項目；外部同步不會反向觸發手動選歌事件。版本檢查會拒絕過期寫入，斷線或衝突時下次檢查重試。點歌系統清空目前歌曲不會關閉練唱台已選的歌。
- 歌單沿用上游 queue-state.json 保存與六小時內重啟恢復規則；歌曲對應則保存在練唱台的 `song-request-links.json`，重新啟動仍會記住。反向選歌先使用已保存的對應或點歌系統的歌曲清單，保留正式歌名與點歌者。確認對應只更新目前項目的 `leihuId`，不會把原歌曲推到待唱或建立重複項目。

練唱台後端代理請求，瀏覽器不直接跨來源連接點歌系統。沿用現有未驗證的控制 API，僅在受信任的本機／私有網路使用；目前使用原生 Twitch EventSub WebSocket，不需要公開 Webhook；保留上游 HTTP／WebSocket 的 Host 與 Origin 檢查。

## 測試

點歌系統：`npm test`。

練唱台：`node --test tests/song_request_sync.test.js`、`python -m unittest discover -s tests -p test_song_request.py -v`（需 Flask）。

測試涵蓋真實 HTTP 選歌與 WebSocket 廣播、重複事件、保留既有歌曲資料、過期寫入、同名／缺歌、重試與選歌期間的競爭條件。

原生自動啟動練唱台時，也會優先使用已完成遷移、具有 leihu-ready.json 的 secure-runtime；不完整時沿用既有執行環境。

2026-11-21 整合驗證：157 項 Node 測試全部通過；瀏覽器實測目前模式取消暫停後 Clip 播放及自然結束、新主題保存與 WebSocket 同步、聊天室顯示／重載／刪除訊息。雙向同步模組、Clip 暫停修正及四個舊版 CLI 設定檔與前版逐位元組相同；既有 HTTP 路由全部保留。
