# Changelog / 更新紀錄

Versions are `YYYY.MM-W`: the year, the month (two digits) and which release weekend of that month it
is, counted by its Saturday. A hotfix between weekends adds `.N` (`2026.11-1.1`). The version shows in
the dashboard under **🎨 Look & overlays** (at the top). Read **⚠ Action needed** before updating.

版本號是 `YYYY.MM-W`：年、月（兩位數），以及這是該月第幾個發佈週末（以週六算）。兩個週末之間的緊急修正
會加上 `.N`（`2026.11-1.1`）。目前的版本顯示在控制台最上面的「**🎨 外觀與疊加層**」。更新前請先看「⚠ 需要動手」。

---

## 2026.11-3 — unreleased

**Works with:** Node.js LTS · Leihu Singsing 1.6.x–2.0.x (checked with 2.0.0) · for modes, Streamlabs
Desktop or OBS Studio 30+ · for outfits, veadotube mini 2.1+.
**搭配**：Node.js LTS · 雷虎練唱台 1.6.x–2.0.x（以 2.0.0 確認過）· 模式需要 Streamlabs Desktop 或 OBS Studio 30
以上 · 換裝需要 veadotube mini 2.1 以上。

### ⚠ Action needed / 需要動手

- **Restart** the app (close it, run `start.bat` / `start_zh.bat` again) and refresh the dashboard.
  **重新啟動**程式（關掉後再執行 `start.bat`／`start_zh.bat`），並重新整理控制台。
- Moving from **TriggerFyre** to 🎟️ reward effects: save your sounds and pictures into `alert-media`, set the
  rewards up, then turn each one off in TriggerFyre — or it plays twice.
  從 **TriggerFyre** 換成 🎟️ 兌換特效：把音效和圖片存到 `alert-media`，設定好兌換項目，再到 TriggerFyre 把每一個關掉 ——
  否則會播兩次。
- Alerts are optional: nothing new shows on stream until you add their Browser Source. If you keep
  Streamlabs' Alert Box (or another alert service) too, mute or hide one of them, or each alert shows twice.
  通知是選用的：加入它的瀏覽器來源之前，直播畫面上不會多出任何東西。如果你同時保留 Streamlabs 的 Alert Box
  （或其他通知服務），請把其中一個靜音或隱藏，否則每則通知會出現兩次。

### What's new / 新功能

- **🔔 Alerts on stream** (`/overlay/alerts.html`), instead of Streamlabs' Alert Box: follows, subs, gift
  subs, cheers and raids, one at a time, in the overlay theme and language; a gift of several subs is one alert. In the new **🔔 Alerts** tab each kind has on / off, a
  minimum, how long it shows, a picture / GIF / video and a sound from the `alert-media` folder (or a
  built-in chime), and a **big version** from an amount up (e.g. raids from 50 viewers). **▶ Test** shows a
  made-up alert on stream only; **↻ Replay** shows a recent one again. Two layouts — picture above (800 × 600)
  or on the left (1600 × 300) — both listed under 🎨 Look & overlays with **Copy**.
  **🔔 直播畫面上的通知**（`/overlay/alerts.html`），取代 Streamlabs 的 Alert Box：追隨、訂閱、贈訂、小奇點和揪團，
  一次一則，用疊加層的主題和語言；一次送出多份訂閱只顯示一則。在新的「**🔔 通知**」分頁，每一種
  都可以設定開關、最低門檻、顯示多久、`alert-media` 資料夾裡的圖片／GIF／影片和音效（或內建的提示音），以及到達
  一定數量時的**大型通知**（例如 50 人以上的揪團）。「**▶ 測試**」只在直播畫面上顯示一則假的通知；「**↻ 重播**」再顯示
  一次最近的通知。兩種版面 —— 圖在上（800 × 600）或圖在左（1600 × 300）—— 都列在「🎨 外觀與疊加層」，可以「**複製**」。
- **🎟️ Reward effects** (`/overlay/reward-effects.html`, in the 🔔 Alerts tab), instead of TriggerFyre: a
  channel-point reward plays a sound (several = one at random), a picture / GIF / video where you put it, or
  both, and can show who redeemed it. Played → the redemption is marked done; turned off, skipped, past 20
  waiting or cleared → refunded. One after the other, together (up to 3) or skip the new one. **⏸ Pause** — or a
  mode with **🎟️ Pause reward effects** (new 🎤 singing modes have it) — keeps them waiting.
  **🎟️ 兌換特效**（`/overlay/reward-effects.html`，在「🔔 通知」分頁），取代 TriggerFyre：頻道點數兌換時播放音效（放好幾個 =
  每次隨機一個）、放在你指定位置的圖片／GIF／影片，或兩者都有，也可以顯示兌換的人。播完 → 兌換標成完成；關閉、跳過、
  排隊超過 20 個或清除 → 退還點數。可以依序播放、一起播放（最多 3 個）或跳過新的。「**⏸ 暫停**」—— 或勾選「**🎟️ 這個模式時
  暫停兌換特效**」的模式（新的 🎤 唱歌模式預設勾選）—— 會讓兌換先排隊。

---

## 2026.11-2 — 2026-11-15

**Works with:** Node.js LTS · Leihu Singsing 1.6.x–2.0.x (checked with 2.0.0) · for modes, Streamlabs
Desktop or OBS Studio 30+ · for outfits, veadotube mini 2.1+.
**搭配**：Node.js LTS · 雷虎練唱台 1.6.x–2.0.x（以 2.0.0 確認過）· 模式需要 Streamlabs Desktop 或 OBS Studio 30
以上 · 換裝需要 veadotube mini 2.1 以上。

### ⚠ Action needed / 需要動手

- **Restart** the app (close it, run `start.bat` / `start_zh.bat` again) and refresh the dashboard.
  **重新啟動**程式（關掉後再執行 `start.bat`／`start_zh.bat`），並重新整理控制台。
- **Refresh each Browser Source** in OBS / Streamlabs once (its properties → **Refresh cache of current
  page**): the song list, break card and clip player load the new theme files. They look as before until
  you pick another theme.
  在 OBS／Streamlabs 把每個**瀏覽器來源重新整理**一次（內容 →「**重新整理目前頁面的快取**」）：歌單、休息卡和
  Clip 播放器要載入新的主題檔案。在你選別的主題之前，看起來都和原本一樣。
- The overlays' panel opacity, brightness and language moved from 🎵 Song Queue → ⚙ to **🎨 Look & overlays**
  at the top; your values stay. Everything new is optional: nothing else to change.
  疊加層的面板不透明度、亮度和語言從「🎵 點歌佇列 → ⚙」移到最上面的「**🎨 外觀與疊加層**」；原本的數值不變。新功能都是
  選用的：其他什麼都不用改。
- The terminal setup wizard (`setup.bat` / `setup.ps1`, `setup_zh.*`) is gone: use the web wizard
  (`start.bat` opens it) or [SETUP_MANUAL.md](SETUP_MANUAL.md). Your `.env` stays as it is; the old
  files left in your folder can be deleted.
  終端機版安裝精靈（`setup.bat`／`setup.ps1`、`setup_zh.*`）已移除：請用網頁版精靈（`start_zh.bat` 會開啟）或
  [SETUP_MANUAL.md](SETUP_MANUAL.md)。你的 `.env` 不受影響；資料夾裡留下的舊檔案可以刪掉。

### What's new / 新功能

- **🎨 Themes and text sizes** (**🎨 Look & overlays** at the top, beside EN / 中文): five themes — **Neon** (the original),
  **Daylight**, **High contrast**, **Ocean**, **Cream & coffee** — chosen apart for the dashboard and the
  overlays; the dashboard's text size (85–140%, the same on every browser and phone), the song list's and
  the break card's. Overlays change at once and keep their size in OBS; `?theme=…` on an overlay URL gives
  it its own theme.
  **🎨 主題和文字大小**（最上面、EN／中文旁邊的「**🎨 外觀與疊加層**」）：五個主題 ——「**霓虹**」（原本的樣子）、「**日光**」、
  「**高對比**」、「**海洋**」、「**奶油咖啡**」—— 控制台和疊加層分開選；控制台的文字大小（85–140%，每個瀏覽器和
  手機都一樣）、歌單和休息卡的文字大小。疊加層立刻改變，在 OBS 裡的大小不變；疊加層網址加上 `?theme=…`
  可以單獨用別的主題。
- **💬 Chat on stream** (`/overlay/chat.html`), instead of OneComme: four styles (panel, bubbles, plain
  lines, one row), Twitch badges and emotes, redemptions and subs / gifts / raids / follows; deleted
  messages and banned viewers leave at once. Modes that used OneComme offer **Pick a replacement…**.
  **💬 直播畫面上的聊天室**（`/overlay/chat.html`），取代 OneComme：四種樣式（面板、對話泡泡、簡單列表、橫向一排）、
  Twitch 徽章和表情符號、兌換和訂閱／贈訂／揪團／追隨；被刪除的訊息和被封鎖的觀眾會立刻消失。用過 OneComme 的模式
  會提供「**選擇替代…**」。
- **👕 Outfits** with veadotube mini: viewers redeem a reward, a card pops up (not over the Leihu tab) and
  you click the outfit to wear; the redemption is completed, or refunded. A default outfit (☆) and
  **Back to the default after N minutes**.
  **👕 換裝**（veadotube mini）：觀眾兌換獎勵後會跳出卡片（雷虎練唱台分頁不會跳），點一下要穿的衣服；兌換會自動
  完成，或退還。可以設定預設服裝（☆）和「**N 分鐘後換回預設服裝**」。
- **🚀 Raid with the ending roll**: 🛡 Moderate → Raid with **🎬 With the ending roll** plays the
  `!endingtk` roll so the raid goes 10 seconds after it ends. Cancel, or someone raiding you meanwhile,
  stops both.
  **🚀 搭配片尾名單揪團**：🛡 管理 → 揪團，勾選「**🎬 搭配片尾名單**」會播 `!endingtk` 的片尾名單，名單結束 10 秒後
  出發。取消揪團，或這段期間有人揪團過來，兩個都會停止。
- **準備中 / STARTING SOON** card for the opening (`/overlay/break.html?card=opening`); both cards count
  down with `?min=10` or `?at=20:00`.
  開場用的「**準備中／STARTING SOON**」卡片（`/overlay/break.html?card=opening`）；兩種卡片都可以用 `?min=10` 或
  `?at=20:00` 倒數。
- **Sheet tabs and random pick in the dashboard** (🎵 Song Queue → ⚙): tick which tabs viewers can request,
  and choose weighted or pure random — no more editing `.env`.
  **歌單分頁和抽歌方式改在控制台設定**（🎵 點歌佇列 → ⚙）：勾選哪些分頁可以點歌，選擇加權或完全隨機 —— 不用再改 `.env`。
- **License:** the song queue is now released under the [MIT License](LICENSE).
  **授權**：點歌系統現在以 [MIT 授權](LICENSE) 釋出。

### Fixes / 修正

- Two songs with the same title by different artists now each keep their own request history (last
  requested, by whom, the random cooldown). Before, requesting one updated the other's; past requests
  already mixed in the history sheet stay as they are.
  同名但不同歌手的兩首歌，現在各自有自己的點歌紀錄（上次被點、被誰點、隨機點歌冷卻）。之前點其中一首會算到另一首；
  歷史試算表裡已經混在一起的舊紀錄不會改變。
- Song-request and random-song redemptions no longer show as "to announce" in the 💬 Chat tab (the queue
  already has them).
  點歌和隨機點歌的兌換不會再出現在 💬 聊天室分頁的「要宣讀」（歌單裡已經有了）。
- Stopping a clip no longer blanks a sponsor roll that starts right after it.
  停止 Clip 後馬上播的感謝名單不會再被清掉。
- In the dashboard's Leihu tab, Leihu now plays on the output device chosen in its settings, like its own
  window. Before, the browser refused that and Leihu played on Windows' default device. If the singing on
  stream fell slightly behind the music in the Leihu tab (but not in Leihu's own window), this should fix it.
  控制台的雷虎練唱台分頁現在會用它設定裡選的輸出裝置播放，和它自己的視窗一樣。之前瀏覽器不允許，雷虎練唱台只能用
  Windows 預設裝置播放。如果在雷虎練唱台分頁唱歌時，直播上的歌聲會稍微落後音樂（在它自己的視窗不會），這應該能修正。
- Switching EN / 中文 no longer shows the top bar's Leihu as offline until the next check.
  切換 EN／中文時，最上面的雷虎練唱台狀態不會再暫時顯示成未開啟。
- On a phone the dashboard fits the screen: the top bar and the manual request bar wrap, and a long song
  title no longer makes the page wider than the screen.
  在手機上控制台不會超出畫面：最上面一列和手動點歌列會換行，很長的歌名也不會讓頁面變寬。

### Leihu Singsing 2.0 / 雷虎練唱台 2.0

Works as before. Its new global hotkeys belong to Leihu's own window: they don't work when Leihu is
started from the dashboard (**▶ Start Leihu**), and act on Leihu's window, not the dashboard's Leihu tab.
照常運作。它新的全域快捷鍵屬於雷虎練唱台自己的視窗：從控制台啟動（「**▶ 啟動雷虎練唱台**」）時沒有作用，而且控制的是
雷虎練唱台的視窗，不是控制台的雷虎練唱台分頁。

---

## 2026.11-1 — 2026-11-08

The first official release. 第一個正式版本。

### 🚀 First time? / 第一次使用？

- 新手入門（從零開始，不需要會寫程式）：https://github.com/sheng7337/twitch-song-request-system/blob/v2026.11-1/docs/STARTER_GUIDE_zh_TW.md
- Starter Guide (English): https://github.com/sheng7337/twitch-song-request-system/blob/v2026.11-1/docs/STARTER_GUIDE.md

**Works with:** Node.js LTS · Leihu Singsing 1.6.x (checked with 1.6.8) · for modes, Streamlabs Desktop
or OBS Studio 30+.
**搭配**：Node.js LTS · 雷虎練唱台 1.6.x（以 1.6.8 確認過）· 模式需要 Streamlabs Desktop 或 OBS Studio 30 以上。

### ⚠ Action needed (only if you ran an earlier copy) / 需要動手（只有之前用過舊版的人）

- **Song list Browser Source:** set Height to **1470** (was 1362) and size it **480 × 735** in your
  scene. The overlay is now always the same height; at 1362 its bottom was cut off.
  **歌單瀏覽器來源**：高度改成 **1470**（原本 1362），在場景裡大小設為 **480 × 735**。顯示層現在高度固定；
  用 1362 時最下面會被切掉。
- **Twitch permissions:** if the 💬 Chat tab shows **Authorize again →**, do it once. Sending messages,
  moderation (ban / timeout / Shoutout / raid / pin) and redemptions need permissions older setups
  didn't ask for.
  **Twitch 權限**：如果 💬 聊天室分頁顯示「**重新授權 →**」，請做一次。發言、管理（封鎖／禁言／Shoutout／
  揪團／置頂）和兌換需要舊版沒有要求的權限。
- **Restart** the app (close it, run `start.bat` / `start_zh.bat` again) and refresh the dashboard.
  **重新啟動**程式（關掉後再執行 `start.bat`／`start_zh.bat`），並重新整理控制台。

### What's in it / 內容

**Song requests / 點歌**
- Channel-point song requests matched against your Google Sheet song list (exact, fuzzy, romanized and
  kana titles), with a random-song reward and a cooldown; songs not on the sheet wait in Pending Review.
  頻道點數點歌，比對 Google 試算表歌單（完全相同、模糊、羅馬拼音和假名歌名），附隨機點歌與冷卻；
  不在歌單上的歌先放在待審核。
- The queue survives a server restart mid-stream; sung songs are recorded to the history sheet.
  直播中重新啟動伺服器，佇列也不會不見；唱過的歌記錄到歷史試算表。
- YouTube links found for the song sheet, with a page to review them.
  替歌單找 YouTube 連結，並有確認用的頁面。

**Leihu Singsing / 雷虎練唱台**
- Queued songs linked to Leihu's backing tracks; **Sing** opens the song in Leihu at its key; the whole
  sheet can be prepared ahead; Leihu shows inside the dashboard.
  排隊的歌連到練唱台的伴奏；「**唱**」直接在練唱台打開那首歌和 KEY；可以事先準備整份歌單；練唱台顯示在控制台裡。

**Dashboard / 控制台**
- Tabs: 🎵 Song Queue, 🎤 Leihu Singsing, 💬 Chat, 🎛 Modes — in English and 繁體中文.
  分頁：🎵 點歌佇列、🎤 雷虎練唱台、💬 聊天室、🎛 模式 —— 英文與繁體中文。
- **Chat beside every tab:** live chat in a resizable panel on the right; search, filters and earlier
  days in the Chat tab.
  **每個分頁都看得到聊天室**：右邊可調寬度的即時聊天；搜尋、篩選和之前的日期在聊天室分頁。
- Chat tools: what to thank or greet on stream highlighted, sending and replying, ban / timeout /
  Shoutout / raid / pin, completing or refunding redemptions, song notes on the overlay.
  聊天室工具：標示要感謝或打招呼的事件、發言和回覆、封鎖／禁言／Shoutout／揪團／置頂、完成或退還兌換、
  疊加層上的歌曲註記。
- **Modes** (🎤 Singing / 💬 Talking / ☕ Break …): one click sets Streamlabs Desktop or OBS — scene, what
  shows, positions, sounds — and holds clips, posts in chat and opens a tab.
  **模式**（🎤 唱歌／💬 聊天／☕ 休息…）：按一下設定 Streamlabs Desktop 或 OBS —— 場景、顯示項目、位置、音訊
  —— 並暫停 Clip、在聊天室發言、切換分頁。

**Overlays and commands / 顯示層與指令**
- Song list overlay (960 × 1470), clip player for `!so`, `!watch`, `!tk`, the `!endingtk` ending roll,
  and a **休息中 / ON BREAK** card (`/overlay/break.html`, 960 × 260).
  歌單顯示層（960 × 1470）、`!so`、`!watch`、`!tk` 的 Clip 播放器、`!endingtk` 感謝名單，以及
  **休息中／ON BREAK** 卡片（`/overlay/break.html`，960 × 260）。

**Setup / 安裝**
- A setup wizard for Twitch, Google Sheets, rewards and OBS; a starter guide for newcomers.
  Twitch、Google 試算表、獎勵和 OBS 的安裝精靈；給新手的入門指南。
