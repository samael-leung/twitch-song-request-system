# Changelog / 更新紀錄

Versions are `YYYY.MM-W`: the year, the month (two digits) and which release weekend of that month it
is, counted by its Saturday. A hotfix between weekends adds `.N` (`2026.11-1.1`). The version shows in
the dashboard under 🎵 Song Queue → ⚙ Settings. Read **⚠ Action needed** before updating.

版本號是 `YYYY.MM-W`：年、月（兩位數），以及這是該月第幾個發佈週末（以週六算）。兩個週末之間的緊急修正
會加上 `.N`（`2026.11-1.1`）。目前的版本顯示在控制台「🎵 點歌佇列 → ⚙ 設定」。更新前請先看「⚠ 需要動手」。

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
- Everything new is optional: nothing else to change.
  新功能都是選用的：其他什麼都不用改。
- The terminal setup wizard (`setup.bat` / `setup.ps1`, `setup_zh.*`) is gone: use the web wizard
  (`start.bat` opens it) or [SETUP_MANUAL.md](SETUP_MANUAL.md). Your `.env` stays as it is.
  終端機版安裝精靈（`setup.bat`／`setup.ps1`、`setup_zh.*`）已移除：請用網頁版精靈（`start_zh.bat` 會開啟）或
  [SETUP_MANUAL.md](SETUP_MANUAL.md)。你的 `.env` 不受影響。

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

### Fixes / 修正

- Song-request and random-song redemptions no longer show as "to announce" in the 💬 Chat tab (the queue
  already has them).
  點歌和隨機點歌的兌換不會再出現在 💬 聊天室分頁的「要宣讀」（歌單裡已經有了）。
- Stopping a clip no longer blanks a sponsor roll that starts right after it.
  停止 Clip 後馬上播的感謝名單不會再被清掉。

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
