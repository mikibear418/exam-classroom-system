# 段考監考教室系統 V1.16：正式雲端模式

正式入口：https://mikibear418.github.io/exam-classroom-system/
本機備援：https://mikibear418.github.io/exam-classroom-system/?cloud=local

## 2026-11-23 啟用狀態

- Supabase 專案 sbdygqnhawjonvdktqly：ACTIVE_HEALTHY。
- Google OAuth 已由兩位教師實際登入；跨帳號 Realtime 自動傳達由使用者確認。
- classroom_members、classroom_state 已啟用 RLS，classroom_state 已加入 supabase_realtime。
- 同步測試班現有 admin 與 editor 各一位。登入不等於有班級權限；新班級仍需管理者授權。
- config.js 設為 enabled:true，allowEmailLogin:false，僅含公開 publishable key。
- 不更動 Google OAuth 憑證或 Supabase 資料庫結構。

## 本機資料與 JSON 備份

原本本機資料不會自動遷移。請在原裝置、原瀏覽器以 ?cloud=local 開啟原有資料，按「儲存本班版本」下載 JSON。
管理者先授權同名雲端班級，教師登入並開啟該班，再按「載入班級版本」確認取代；等待「雲端已儲存」。
完整系統 JSON 的還原限本機版，雲端僅匯出目前班級。保管好備份，不要提交公開 GitHub。

本機版不讀取雲端資料；雲端模式不寫回原有 localStorage。回到雲端請使用不含 ?cloud=local 的正式入口。
連線、套件或設定失敗時，保留啟動／登入遮罩，使用者可明確切換本機備援。
雲端衝突時先下載本班 JSON，再同步重新載入；不要將未同步畫面視為已儲存。

## 授權與安全

admin、editor 可寫入授權班級；viewer 僅可讀取。classroom_members 一般教師只有讀取自己紀錄的權限。
班級成員由學校管理者透過 Supabase SQL Editor 或受保護的伺服器維護，前端不提供任意加入或提升權限功能。
RLS 依 auth.uid() 與資料庫成員紀錄檢查，不依使用者可編輯的 user_metadata 授權。
Google 回傳網址應為正式入口；先前實際登入已驗證回傳成功。本次未重新讀取控制台的 Site URL／Redirect URLs。
約 850ms 延遲寫入，更新附帶 revision 條件避免衝突覆蓋。
公開 GitHub 不得存放 secret/service_role、資料庫密碼、OAuth Client Secret、教師密碼或真實學生資料。

## 本次安全檢查的剩餘提示

- 私有 teacher_pending_invites 啟用 RLS 而無政策：採預設拒絕，不開放一般教師讀寫，保留此設定。
- Supabase 提示未開啟外洩密碼保護；本網站仍為 Google-only。若未來啟用密碼登入，應先處理此提示：
  https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

參考資料庫結構見 schema.sql；不要把參考檔當作涵蓋所有 Auth 觸發器的完整重建備份。
