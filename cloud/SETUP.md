# 段考監考教室系統 V1.16：雲端啟用說明

目前已加入可選用 Supabase 的教師登入及班級資料同步程式，但尚未連接實際 Supabase 專案，預設仍是本機版。

## 必要設定
1. 到 https://supabase.com/dashboard 建立學校專用專案。
2. 在 SQL Editor 執行 cloud/schema.sql，建立 classroom_members 與 classroom_state 及 RLS。
3. 在 Authentication > Users 建立教師帳號；建議關閉不受控的公開註冊。
4. 用 SQL Editor 查詢教師 UUID：select id,email from auth.users;
5. 在 SQL Editor 授權班級，例如：
insert into public.classroom_members(room,user_id,role) values ('知足班','實際 UUID'::uuid,'editor') on conflict(room,user_id) do update set role=excluded.role;
6. 在 Project Settings > API 複製 Project URL 與 publishable/anon 公開金鑰，填入 cloud/config.js 的 url 與 publishableKey。
7. 不得在公開 GitHub 存放 service_role、secret API key、資料庫密碼、教師密碼及真實學生名冊。
8. 網站更新後教師登入；第一次該班雲端尚無資料時，授權老師按「初始化本班」。後續同班授權老師登入，即能讀取雲端資料。

## 授權與同步
- classroom_members 中 role 為 admin、editor、viewer。viewer 只有檢視權限；班級成員新增由學校管理者於 SQL Editor 執行。
- 不同班級的資料依 room 欄位分開，RLS 限制讀寫。多位老師可編輯相同班級。
- 自動儲存採約 850ms 延遲上傳。出現版本衝突時不會靜默覆蓋，需先保留本機工作、再載入雲端版本。
- 班級版本的 JSON 可先備份；請用校內受控方式保存。

## 上線前必做
- 用兩位不同教師、兩台設備實測登入、權限、同班同步和衝突處理。
- 確認未獲授權帳號無法查詢或修改任何班級。
- 確認學校學生個資管理、帳號停用、資料刪除及備份程序。

未實際建立 Supabase 專案、完成 SQL 設定與測試之前，不能視為雲端版已正式上線。
## 已確認的實際部署狀態（2026-11-23）
- Supabase 專案：sbdygqnhawjonvdktqly（運作正常）。
- classroom_members 與 classroom_state 已正式建立，並啟用 RLS。
- classroom_private.can_access 在非公開 schema 執行成員授權檢查。
- classroom_state 已加入 supabase_realtime 發布；資料表修訂版 revision 用於防止競爭更新。
- Supabase 安全檢查：目前 0 則警告。未登入者不能讀取班級資料，一般教師無法直接新增班級授權。
- **目前教師 Auth 帳號 0、班級成員授權 0、班級資料 0，因此「兩台裝置/兩位老師」的端到端測試還無法執行。**
- 為避免使現有本機白板突然被登入畫面鎖住，公開網站 cloud/config.js 仍保留空白；須先建立教師帳號、授權班級，再填入公開 URL 與 publishable key 啟用雲端模式。
- GitHub 不可儲存真正的學生資料、教師密碼或 Supabase secret key。


## 雙教師測試準備（2026-11-23）
- 已在 Supabase 私有 schema `classroom_private.teacher_pending_invites` 建立兩位教師的 Email 待驗證授權，角色分別為 `admin`、`editor`，目標均為「同步測試班」，不含學生個資。公開 GitHub 不儲存 Email。
- 已部署 `auth.users` 郵件驗證完成後的觸發器：比對已驗證 Email，自動加入 `classroom_members`；未經驗證的信箱不會獲得班級權限。
- 已加入網頁免密碼電子郵件登入按鈕，正式啟用前必須先在 Supabase Auth → URL Configuration 將 `https://mikibear418.github.io/exam-classroom-system/` 設為允許的回傳網址。
- **Auth Users 仍沒有教師帳號，尚未寄發正式邀請郵件，也尚未啟用網站的雲端設定。** 請由管理者在 Supabase Auth → Users → Invite user 邀請兩位老師，或在 URL Configuration 設定後使用網頁 Email 登入流程。
- 連接前端必須在 `cloud/config.js` 設定專案 URL 與**公開** publishable key；且完成雙帳號登入、兩台設備同步、唯讀權限與衝突測試，再宣告正式啟用。
