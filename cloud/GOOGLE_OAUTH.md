# Google 教師登入：正式啟用狀態

2026-11-23：網站已設定 enabled:true，allowEmailLogin:false。兩位教師 Google 登入、班級授權與跨帳號 Realtime 自動更新已由使用者完成測試。
正式入口：https://mikibear418.github.io/exam-classroom-system/
本機備援與原資料 JSON 匯出：https://mikibear418.github.io/exam-classroom-system/?cloud=local

## 授權

登入後只開放 classroom_members 已授權的班級。待驗證邀請保存在私有 schema，驗證 Email 的 Auth 觸發器加入成員。
網站沒有任意加入班級或提高角色的功能。教師 Email 不作為前端授權依據。

## Google 與 Supabase 設定參考

- Google OAuth 類型：Web application。
- JavaScript origin：https://mikibear418.github.io
- Google redirect URI：https://sbdygqnhawjonvdktqly.supabase.co/auth/v1/callback
- Supabase Site URL 與 Redirect URLs：https://mikibear418.github.io/exam-classroom-system/
- Client Secret 只存於 Supabase Google Provider 設定，禁止放入 GitHub 或前端。
- 已有實際登入成功紀錄；本次未重新核對 Google Audience 的 Testing／Production 狀態或控制台回傳網址欄位。若仍為 Testing，新教師需要加入 Test users，仍須另行取得班級授權。

## 備份與衝突

原本本機資料不會自動遷移。先在原瀏覽器下載本班 JSON，再登入已授權的同名雲端班級載入。
衝突時先匯出目前班級 JSON，再重新同步。完整本機系統備份只在本機版還原。

完整部署與授權說明見 SETUP.md。
