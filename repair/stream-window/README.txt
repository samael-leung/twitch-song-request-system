Stream Window Fix / 點歌系統獨立視窗修復

原因：/api/stream-window 使用了作用域外的 listeningPort，會回傳
「listeningPort is not defined」，所以 Chrome / Edge 獨立視窗沒有開啟，
也不會出現 [stream-window] Opened the dashboard in its own window。

使用方式（不需要 Git，也不需要重新安裝套件）：
1. 關閉點歌系統：在 npm start 視窗按 Ctrl+C。
2. 解壓縮 Stream-Window-Fix.zip，雙擊 Install.cmd。
3. 若顯示路徑提示，貼上點歌系統專案資料夾路徑並按 Enter。
   這是內含 package.json、start_zh.bat、server 的資料夾。
   也可將這個資料夾拖曳到 Install.cmd 上。
4. 看到「Stream-window startup repaired」或「Already repaired」後，
   雙擊專案中的 start_zh.bat（英文版為 start.bat）。

進階命令：在專案資料夾執行
  node "完整路徑\Stream-Window-Fix\install.js" .

修復只將 server/index.js 中已知錯誤的視窗網址運算式改成使用伺服器
實際監聽的連接埠；其餘程式碼逐位元組保留。原檔會備份為
server/index.js.before-window-fix-....bak。可重複執行；未知或多處匹配
的版本會停止，不會猜測修改。不修改 .env、憑證、設定、歌曲、配對、
模式、提醒、Clip 修正或練唱台安裝。

若要還原：先停止程式，將上述備份複製回 server/index.js，再重新啟動。

成功時 app.log 應出現：
  [stream-window] Opened the dashboard in its own window (chrome.exe)
若使用 Edge 則為 msedge.exe。電腦需要已安裝 Chrome 或 Edge。
首次設定尚未完成時，啟動腳本仍會開啟一般瀏覽器的安裝精靈。

完整 Node.js 伺服器啟動後，Windows 的啟動腳本才會呼叫開視窗 API；
直接執行 npm start 只啟動伺服器，這是既有行為。
